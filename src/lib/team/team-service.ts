import "server-only";

import { Prisma, type UserPokemon } from "@prisma/client";
import { prisma } from "../prisma";
import { isPokemonInActiveBattle } from "../combat/battle-session-store";
import { toCollectionEntry, type CollectionEntry } from "./collection-entry";
import { buildTeamLayout } from "./team-layout";
import {
  PC_BOX_COUNT,
  PC_COLUMNS,
  PC_ROWS,
  ReleasePokemonBodySchema,
  UpdateTeamBodySchema,
  type ReleasePokemonInput,
  type UpdateTeamInput,
} from "./team-contract";
import {
  TeamCompositionInvalidError,
  TeamOnboardingRequiredError,
  TeamPokemonInBattleError,
  TeamPokemonNotOwnedError,
  TeamRevisionConflictError,
} from "./team-errors";
import { validateTeamComposition } from "./team-validator";

export * from "./team-errors";
export type { CollectionEntry } from "./collection-entry";

export interface PlayerCollection {
  revision: number;
  count: number;
  pokemon: CollectionEntry[];
  team: CollectionEntry[];
  pc: {
    columns: number;
    rows: number;
    boxes: { number: number; name: string }[];
  };
}

function snapshot(revision: number, pokemon: UserPokemon[]): PlayerCollection {
  const entries = pokemon.map(toCollectionEntry);
  return {
    revision,
    count: entries.length,
    pokemon: entries,
    team: entries
      .filter((entry) => entry.teamPosition !== null)
      .sort((a, b) => a.teamPosition! - b.teamPosition!),
    pc: {
      columns: PC_COLUMNS,
      rows: PC_ROWS,
      boxes: Array.from({ length: PC_BOX_COUNT }, (_, i) => ({
        number: i + 1,
        name: `Boîte ${i + 1}`,
      })),
    },
  };
}

const collectionOrder: Prisma.UserPokemonOrderByWithRelationInput[] = [
  { teamPosition: "asc" },
  { boxNumber: "asc" },
  { boxSlot: "asc" },
  { caughtAt: "asc" },
  { id: "asc" },
];

/** Lit une version et son rangement dans le même instantané de la base. */
export async function getPlayerCollection(
  userId: string,
): Promise<PlayerCollection> {
  return prisma.$transaction(
    async (tx) => {
      const profile = await tx.userProfile.findUnique({ where: { userId } });
      if (!profile?.hasCompletedOnboarding)
        throw new TeamOnboardingRequiredError();
      const pokemon = await tx.userPokemon.findMany({
        where: { userId },
        orderBy: collectionOrder,
      });
      return snapshot(profile.collectionRevision, pokemon);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

/** Enregistre ensemble les positions d'équipe et de PC, ou annule tout en cas d'erreur. */
export async function updateActiveTeam(
  userId: string,
  input: UpdateTeamInput,
): Promise<PlayerCollection> {
  // On valide aussi ici : un futur appel serveur ne doit pas contourner les règles de l'API.
  const parsed = UpdateTeamBodySchema.safeParse(input);
  if (!parsed.success)
    throw new TeamCompositionInvalidError(
      parsed.error.issues.map((issue) => issue.message),
    );

  return prisma.$transaction(
    async (tx) => {
      // Verrou par joueur : deux sauvegardes attendent leur tour, même sur plusieurs serveurs.
      // La requête est paramétrée ; aucun identifiant n'est concaténé dans du SQL.
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "user_profile" WHERE "userId" = ${userId} FOR UPDATE`,
      );
      const profile = await tx.userProfile.findUnique({ where: { userId } });
      if (!profile?.hasCompletedOnboarding)
        throw new TeamOnboardingRequiredError();
      if (profile.collectionRevision !== parsed.data.expectedRevision) {
        throw new TeamRevisionConflictError();
      }

      const owned = await tx.userPokemon.findMany({
        where: { userId },
        orderBy: collectionOrder,
      });
      const locations = buildTeamLayout(owned, parsed.data);
      const byId = new Map(owned.map((pokemon) => [pokemon.id, pokemon]));
      const changed = locations.filter((location) => {
        const previous = byId.get(location.pokemonId)!;
        return (
          previous.teamPosition !== location.teamPosition ||
          previous.boxNumber !== location.boxNumber ||
          previous.boxSlot !== location.boxSlot
        );
      });

      if (changed.length > 0) {
        // Une seule écriture pour toute la collection, sans un aller-retour par créature.
        // Les contraintes différées de la migration permettent l'échange de deux cases.
        const rows = changed.map(
          (location) => Prisma.sql`(
        ${location.pokemonId}::text, ${location.teamPosition}::integer,
        ${location.boxNumber}::integer, ${location.boxSlot}::integer
      )`,
        );
        const updatedCount = await tx.$executeRaw(Prisma.sql`
        UPDATE "user_pokemon" AS pokemon
        SET "teamPosition" = target.team_position,
            "boxNumber" = target.box_number,
            "boxSlot" = target.box_slot
        FROM (VALUES ${Prisma.join(rows)}) AS target(id, team_position, box_number, box_slot)
        WHERE pokemon."id" = target.id AND pokemon."userId" = ${userId}
      `);
        if (updatedCount !== changed.length)
          throw new TeamRevisionConflictError();
      }

      // La version ne change qu'après une sauvegarde valide ; une erreur annule aussi cet incrément.
      const updatedProfile = await tx.userProfile.update({
        where: { userId },
        data: { collectionRevision: { increment: 1 } },
      });
      const updated = await tx.userPokemon.findMany({
        where: { userId },
        orderBy: collectionOrder,
      });
      return snapshot(updatedProfile.collectionRevision, updated);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

/** Supprime définitivement une créature possédée et compacte l'équipe si besoin. */
export async function releasePokemon(
  userId: string,
  input: ReleasePokemonInput,
): Promise<PlayerCollection> {
  const parsed = ReleasePokemonBodySchema.safeParse(input);
  if (!parsed.success) {
    throw new TeamCompositionInvalidError(
      parsed.error.issues.map((issue) => issue.message),
    );
  }

  // Une suppression pendant un combat rendrait ses participants introuvables
  // au moment d'attribuer l'expérience et les gains persistants.
  if (isPokemonInActiveBattle(userId, parsed.data.pokemonId)) {
    throw new TeamPokemonInBattleError();
  }

  return prisma.$transaction(
    async (tx) => {
      // Le même verrou sérialise déplacements, échanges et relâchements.
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "user_profile" WHERE "userId" = ${userId} FOR UPDATE`,
      );
      const profile = await tx.userProfile.findUnique({ where: { userId } });
      if (!profile?.hasCompletedOnboarding) {
        throw new TeamOnboardingRequiredError();
      }
      if (profile.collectionRevision !== parsed.data.expectedRevision) {
        throw new TeamRevisionConflictError();
      }

      const owned = await tx.userPokemon.findMany({
        where: { userId },
        orderBy: collectionOrder,
      });
      const target = owned.find(
        (pokemon) => pokemon.id === parsed.data.pokemonId,
      );
      // Même réponse pour un identifiant inconnu et pour la créature d'un autre compte.
      if (!target) throw new TeamPokemonNotOwnedError();

      if (target.teamPosition !== null) {
        const remainingTeam = owned
          .filter(
            (pokemon) =>
              pokemon.id !== target.id && pokemon.teamPosition !== null,
          )
          .sort((a, b) => a.teamPosition! - b.teamPosition!)
          // La transaction compacte les positions après la suppression. La
          // validation doit donc examiner cette future équipe, pas le trou
          // temporaire laissé par la créature relâchée.
          .map((pokemon, index) => ({ ...pokemon, teamPosition: index + 1 }));
        const validation = validateTeamComposition(remainingTeam);
        if (!validation.isValid) {
          throw new TeamCompositionInvalidError(validation.errors);
        }
      }

      const deleted = await tx.userPokemon.deleteMany({
        where: { id: target.id, userId },
      });
      if (deleted.count !== 1) throw new TeamRevisionConflictError();

      if (target.teamPosition !== null) {
        // La suppression libère d'abord sa place ; les suivantes remontent ensuite
        // dans une seule écriture, sans trou dans l'équipe active.
        await tx.userPokemon.updateMany({
          where: { userId, teamPosition: { gt: target.teamPosition } },
          data: { teamPosition: { decrement: 1 } },
        });
      }

      const updatedProfile = await tx.userProfile.update({
        where: { userId },
        data: { collectionRevision: { increment: 1 } },
      });
      const updated = await tx.userPokemon.findMany({
        where: { userId },
        orderBy: collectionOrder,
      });
      return snapshot(updatedProfile.collectionRevision, updated);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

import { Prisma, type UserPokemon } from "@prisma/client";
import { prisma } from "../prisma";
import { toCollectionEntry, type CollectionEntry } from "./collection-entry";
import { buildTeamLayout } from "./team-layout";
import {
  PC_BOX_COUNT, PC_COLUMNS, PC_ROWS, UpdateTeamBodySchema, type UpdateTeamInput,
} from "./team-contract";
import {
  TeamCompositionInvalidError, TeamOnboardingRequiredError, TeamRevisionConflictError,
} from "./team-errors";

export * from "./team-errors";
export type { CollectionEntry } from "./collection-entry";

export interface PlayerCollection {
  revision: number;
  count: number;
  pokemon: CollectionEntry[];
  team: CollectionEntry[];
  pc: { columns: number; rows: number; boxes: { number: number; name: string }[] };
}

function snapshot(revision: number, pokemon: UserPokemon[]): PlayerCollection {
  const entries = pokemon.map(toCollectionEntry);
  return {
    revision,
    count: entries.length,
    pokemon: entries,
    team: entries.filter((entry) => entry.teamPosition !== null)
      .sort((a, b) => a.teamPosition! - b.teamPosition!),
    pc: {
      columns: PC_COLUMNS,
      rows: PC_ROWS,
      boxes: Array.from({ length: PC_BOX_COUNT }, (_, i) => ({ number: i + 1, name: `Boîte ${i + 1}` })),
    },
  };
}

const collectionOrder: Prisma.UserPokemonOrderByWithRelationInput[] = [
  { teamPosition: "asc" }, { boxNumber: "asc" }, { boxSlot: "asc" }, { caughtAt: "asc" }, { id: "asc" },
];

/** Lit une version et son rangement dans le même instantané de la base. */
export async function getPlayerCollection(userId: string): Promise<PlayerCollection> {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.userProfile.findUnique({ where: { userId } });
    if (!profile?.hasCompletedOnboarding) throw new TeamOnboardingRequiredError();
    const pokemon = await tx.userPokemon.findMany({ where: { userId }, orderBy: collectionOrder });
    return snapshot(profile.collectionRevision, pokemon);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

/** Enregistre ensemble les positions d'équipe et de PC, ou annule tout en cas d'erreur. */
export async function updateActiveTeam(userId: string, input: UpdateTeamInput): Promise<PlayerCollection> {
  // On valide aussi ici : un futur appel serveur ne doit pas contourner les règles de l'API.
  const parsed = UpdateTeamBodySchema.safeParse(input);
  if (!parsed.success) throw new TeamCompositionInvalidError(parsed.error.issues.map((issue) => issue.message));

  return prisma.$transaction(async (tx) => {
    // Verrou par joueur : deux sauvegardes attendent leur tour, même sur plusieurs serveurs.
    // La requête est paramétrée ; aucun identifiant n'est concaténé dans du SQL.
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "user_profile" WHERE "userId" = ${userId} FOR UPDATE`);
    const profile = await tx.userProfile.findUnique({ where: { userId } });
    if (!profile?.hasCompletedOnboarding) throw new TeamOnboardingRequiredError();
    if (profile.collectionRevision !== parsed.data.expectedRevision) {
      throw new TeamRevisionConflictError();
    }

    const owned = await tx.userPokemon.findMany({ where: { userId }, orderBy: collectionOrder });
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
      // Une seule écriture pour toute la collection, au lieu de 1 050 allers-retours.
      // Les contraintes différées de la migration permettent l'échange de deux cases.
      const rows = changed.map((location) => Prisma.sql`(
        ${location.pokemonId}::text, ${location.teamPosition}::integer,
        ${location.boxNumber}::integer, ${location.boxSlot}::integer
      )`);
      const updatedCount = await tx.$executeRaw(Prisma.sql`
        UPDATE "user_pokemon" AS pokemon
        SET "teamPosition" = target.team_position,
            "boxNumber" = target.box_number,
            "boxSlot" = target.box_slot
        FROM (VALUES ${Prisma.join(rows)}) AS target(id, team_position, box_number, box_slot)
        WHERE pokemon."id" = target.id AND pokemon."userId" = ${userId}
      `);
      if (updatedCount !== changed.length) throw new TeamRevisionConflictError();
    }

    // La version ne change qu'après une sauvegarde valide ; une erreur annule aussi cet incrément.
    const updatedProfile = await tx.userProfile.update({
      where: { userId }, data: { collectionRevision: { increment: 1 } },
    });
    const updated = await tx.userPokemon.findMany({ where: { userId }, orderBy: collectionOrder });
    return snapshot(updatedProfile.collectionRevision, updated);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

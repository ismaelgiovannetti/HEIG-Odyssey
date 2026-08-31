import type { UserPokemon } from "@prisma/client";
import { prisma } from "../prisma";
import { getSpecies } from "../content/loader";
import { validateTeamComposition } from "./team-validator";
import type { PokemonType } from "../content/schemas";

// Le contenu du navigateur ne peut jamais désigner une créature d'un autre
// compte : ce message reste générique, qu'elle n'existe pas ou appartienne à autrui.
export class TeamPokemonNotOwnedError extends Error {
  constructor() {
    super("Une ou plusieurs créatures ne font pas partie de votre collection.");
    this.name = "TeamPokemonNotOwnedError";
  }
}

export class TeamCompositionInvalidError extends Error {
  constructor(public readonly reasons: string[]) {
    super("Composition d'équipe invalide.");
    this.name = "TeamCompositionInvalidError";
  }
}

export interface CollectionEntry {
  id: string;
  speciesId: string;
  name: string;
  nickname: string | null;
  level: number;
  currentHp: number;
  maxHp: number;
  isShiny: boolean;
  teamPosition: number | null;
  types: PokemonType[];
  dexNumber?: number;
}

function toCollectionEntry(pokemon: UserPokemon): CollectionEntry {
  const species = getSpecies(pokemon.speciesId);

  return {
    id: pokemon.id,
    speciesId: pokemon.speciesId,
    name: pokemon.nickname || species?.name || pokemon.speciesId,
    nickname: pokemon.nickname,
    level: pokemon.level,
    currentHp: pokemon.currentHp,
    maxHp: pokemon.maxHp,
    isShiny: pokemon.isShiny,
    teamPosition: pokemon.teamPosition,
    types: species?.types || ["Normal"],
    dexNumber: species?.dexNumber,
  };
}

/** Lit l'intégralité de la collection d'un joueur, équipe active comprise. */
export async function getPlayerCollection(userId: string): Promise<CollectionEntry[]> {
  const pokemon = await prisma.userPokemon.findMany({
    where: { userId },
    orderBy: [{ teamPosition: "asc" }, { caughtAt: "asc" }],
  });

  return pokemon.map(toCollectionEntry);
}

/**
 * Remplace intégralement l'équipe active par la liste ordonnée fournie
 * (position = index + 1). Toute créature retirée de la liste retourne dans
 * la collection (teamPosition = null) plutôt que d'être supprimée.
 */
export async function updateActiveTeam(
  userId: string,
  teamPokemonIds: string[]
): Promise<CollectionEntry[]> {
  return prisma.$transaction(async (tx) => {
    // La composition n'est jamais validée sur la seule confiance du client :
    // chaque identifiant doit réellement appartenir au joueur authentifié.
    const owned = await tx.userPokemon.findMany({
      where: { userId, id: { in: teamPokemonIds } },
    });

    if (owned.length !== teamPokemonIds.length) {
      throw new TeamPokemonNotOwnedError();
    }

    const ownedById = new Map(owned.map((pokemon) => [pokemon.id, pokemon]));
    const hypotheticalTeam = teamPokemonIds.map((id, index) => ({
      ...ownedById.get(id)!,
      teamPosition: index + 1,
    }));

    const validation = validateTeamComposition(hypotheticalTeam);
    if (!validation.isValid) {
      throw new TeamCompositionInvalidError(validation.errors);
    }

    // Les créatures qui quittent l'équipe retournent dans la collection.
    await tx.userPokemon.updateMany({
      where: {
        userId,
        teamPosition: { not: null },
        id: { notIn: teamPokemonIds },
      },
      data: { teamPosition: null },
    });

    for (const [index, id] of teamPokemonIds.entries()) {
      await tx.userPokemon.update({
        where: { id },
        data: { teamPosition: index + 1 },
      });
    }

    const updatedTeam = await tx.userPokemon.findMany({
      where: { userId, id: { in: teamPokemonIds } },
      orderBy: { teamPosition: "asc" },
    });

    return updatedTeam.map(toCollectionEntry);
  });
}

import type { CollectionEntry } from "./collection-entry";
import {
  PC_BOX_CAPACITY,
  PC_BOX_COUNT,
  PC_COLUMNS,
  PC_ROWS,
  TEAM_CAPACITY,
  type PcPlacement,
  type UpdateTeamInput,
} from "./team-contract";

// Le brouillon ne contient que des identifiants et des positions. Les stats
// affichées restent celles du serveur et ne font jamais partie d'une mutation.
export interface TeamDraft {
  team: string[];
  pc: PcPlacement[];
}

export type TeamCell =
  { area: "team"; slot: number } | { area: "pc"; box: number; slot: number };

// Géométrie de l'interface uniquement : les six places serveur ne changent pas.
const TEAM_COLUMNS = 2;
const TEAM_ROWS = TEAM_CAPACITY / TEAM_COLUMNS;

export function cellKey(cell: TeamCell): string {
  return cell.area === "team"
    ? `team-${cell.slot}`
    : `pc-${cell.box}-${cell.slot}`;
}

export function describeCell(cell: TeamCell): string {
  return cell.area === "team"
    ? `Équipe, emplacement ${cell.slot}`
    : `Boîte ${cell.box}, case ${cell.slot}`;
}

export function draftFromCollection(pokemon: CollectionEntry[]): TeamDraft {
  return {
    team: pokemon
      .filter((entry) => entry.teamPosition !== null)
      .sort((a, b) => a.teamPosition! - b.teamPosition!)
      .map((entry) => entry.id),
    pc: pokemon
      .filter((entry) => entry.teamPosition === null)
      .map((entry) => ({
        pokemonId: entry.id,
        boxNumber: entry.boxNumber!,
        boxSlot: entry.boxSlot!,
      })),
  };
}

export function pokemonAt(
  draft: TeamDraft,
  cell: TeamCell,
): string | undefined {
  return cell.area === "team"
    ? draft.team[cell.slot - 1]
    : draft.pc.find((p) => p.boxNumber === cell.box && p.boxSlot === cell.slot)
        ?.pokemonId;
}

export function locatePokemon(
  draft: TeamDraft,
  id: string,
): TeamCell | undefined {
  const index = draft.team.indexOf(id);
  if (index >= 0) return { area: "team", slot: index + 1 };
  const placement = draft.pc.find((p) => p.pokemonId === id);
  return (
    placement && {
      area: "pc",
      box: placement.boxNumber,
      slot: placement.boxSlot,
    }
  );
}

function validCell(cell: TeamCell): boolean {
  return (
    Number.isInteger(cell.slot) &&
    cell.slot >= 1 &&
    (cell.area === "team"
      ? cell.slot <= TEAM_CAPACITY
      : cell.slot <= PC_BOX_CAPACITY &&
        Number.isInteger(cell.box) &&
        cell.box >= 1 &&
        cell.box <= PC_BOX_COUNT)
  );
}

/** Une équipe vide ou entièrement K.O. ne peut pas être enregistrée par l'API. */
export function teamRefusal(
  draft: TeamDraft,
  pokemon: CollectionEntry[],
): string | null {
  if (draft.team.length === 0)
    return "Gardez au moins un Pokémon dans votre équipe.";
  if (
    !pokemon.some(
      (entry) => draft.team.includes(entry.id) && entry.currentHp > 0,
    )
  ) {
    return "Gardez au moins un Pokémon apte au combat dans votre équipe.";
  }
  return null;
}

/** Même opération pour le clic, le clavier et le glisser-déposer : jamais de copie. */
export function movePokemon(
  draft: TeamDraft,
  from: TeamCell,
  to: TeamCell,
  pokemon: CollectionEntry[],
): { draft: TeamDraft; error?: string } {
  if (!validCell(from) || !validCell(to))
    return { draft, error: "Cette case n'est pas disponible." };
  const source = pokemonAt(draft, from);
  if (!source || cellKey(from) === cellKey(to)) return { draft };
  const target = pokemonAt(draft, to);
  const team: Array<string | undefined> = [...draft.team];
  const pc = draft.pc.filter(
    (p) => p.pokemonId !== source && p.pokemonId !== target,
  );
  const place = (cell: TeamCell, id: string | undefined) => {
    if (cell.area === "team") team[cell.slot - 1] = id;
    else if (id)
      pc.push({ pokemonId: id, boxNumber: cell.box, boxSlot: cell.slot });
  };
  // Une destination occupée retourne son Pokémon à la case d'origine.
  place(from, target);
  place(to, source);
  // Le serveur utilise un ordre continu pour l'équipe, contrairement aux cases
  // fixes du PC. Après un retrait, les partenaires suivants remontent d'une place.
  const next = { team: team.filter((id): id is string => Boolean(id)), pc };
  const error =
    from.area === "team" || to.area === "team"
      ? teamRefusal(next, pokemon)
      : null;
  return error ? { draft, error } : { draft: next };
}

/** L'ordre du tableau PC n'a aucune importance ; seules les cases comptent. */
export function draftSignature(draft: TeamDraft): string {
  return JSON.stringify([
    draft.team,
    [...draft.pc].sort(
      (a, b) => a.boxNumber - b.boxNumber || a.boxSlot - b.boxSlot,
    ),
  ]);
}

export function saveDraft(draft: TeamDraft, revision: number): UpdateTeamInput {
  return {
    expectedRevision: revision,
    teamPokemonIds: [...draft.team],
    pcPlacements: draft.pc.map((p) => ({ ...p })),
  };
}

/** Déplacement du focus, sans modifier le rangement ni le Pokémon transporté. */
export function adjacentCell(
  cell: TeamCell,
  key: string,
  box: number,
): TeamCell {
  if (key === "PageUp" || key === "PageDown") {
    return {
      area: "pc",
      box: Math.max(
        1,
        Math.min(PC_BOX_COUNT, box + (key === "PageUp" ? -1 : 1)),
      ),
      slot: cell.area === "pc" ? cell.slot : 1,
    };
  }
  if (cell.area === "team") {
    const column = (cell.slot - 1) % TEAM_COLUMNS;
    const row = Math.floor((cell.slot - 1) / TEAM_COLUMNS);
    // On traverse d'abord les deux cartes d'une rangée avant d'entrer dans le PC.
    // Les passages se répartissent sur la hauteur des dix lignes du PC.
    if (key === "ArrowRight" && column === TEAM_COLUMNS - 1) {
      const pcRow = Math.round((row * (PC_ROWS - 1)) / (TEAM_ROWS - 1));
      return { area: "pc", box, slot: pcRow * PC_COLUMNS + 1 };
    }
    let slot = cell.slot;
    if (key === "ArrowLeft" && column > 0) slot -= 1;
    if (key === "ArrowRight" && column < TEAM_COLUMNS - 1) slot += 1;
    if (key === "ArrowUp" && row > 0) slot -= TEAM_COLUMNS;
    if (key === "ArrowDown" && row < TEAM_ROWS - 1) slot += TEAM_COLUMNS;
    if (key === "Home") slot = cell.slot - column;
    if (key === "End") slot = cell.slot - column + TEAM_COLUMNS - 1;
    return { ...cell, slot };
  }
  const column = (cell.slot - 1) % PC_COLUMNS;
  const rowStart = cell.slot - column;
  if (key === "ArrowLeft" && column === 0) {
    const pcRow = Math.floor((cell.slot - 1) / PC_COLUMNS);
    const teamRow = Math.round((pcRow * (TEAM_ROWS - 1)) / (PC_ROWS - 1));
    // Le retour vise la colonne de droite, celle qui borde le PC.
    return {
      area: "team",
      slot: (teamRow + 1) * TEAM_COLUMNS,
    };
  }
  let slot = cell.slot;
  if (key === "ArrowLeft") slot -= 1;
  if (key === "ArrowRight" && column < PC_COLUMNS - 1) slot += 1;
  if (key === "ArrowUp" && slot > PC_COLUMNS) slot -= PC_COLUMNS;
  if (key === "ArrowDown" && slot <= PC_BOX_CAPACITY - PC_COLUMNS)
    slot += PC_COLUMNS;
  if (key === "Home") slot = rowStart;
  if (key === "End") slot = rowStart + PC_COLUMNS - 1;
  return { ...cell, slot };
}

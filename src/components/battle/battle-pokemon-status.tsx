import type { BattlePokemonPayload } from "@/lib/combat/battle-client";
import { getPokemonTypeLabel } from "@/lib/pokemon/type-presentation";
import { getSpeciesFrenchName } from "@/lib/pokemon/species-names-fr";

const STATUS_LABELS: Readonly<Record<string, string>> = {
  brn: "Brûlure",
  par: "Paralysie",
  slp: "Sommeil",
  psn: "Poison",
  tox: "Poison grave",
  frz: "Gel",
};

export interface HpOverride {
  currentHp: number;
  maxHp: number;
  hpPercent: number;
}

interface PokemonStatusProps {
  pokemon: BattlePokemonPayload;
  hpOverride?: HpOverride | null;
  statusOverride?: string | null;
  className?: string;
}

/** Associe le pourcentage de PV à la couleur de sa jauge. */
function hpTone(percent: number) {
  if (percent <= 20) return "critical";
  if (percent <= 50) return "warning";
  return "healthy";
}

/** Résumé accessible des PV, types et altérations d'un combattant. */
export function PokemonStatus({
  pokemon,
  hpOverride,
  statusOverride,
  className = "",
}: Readonly<PokemonStatusProps>) {
  const currentHp =
    hpOverride !== null && hpOverride !== undefined
      ? hpOverride.currentHp
      : pokemon.currentHp;
  const maxHp =
    hpOverride && hpOverride.maxHp > 0
      ? hpOverride.maxHp
      : pokemon.maxHp > 0
        ? pokemon.maxHp
        : 1;
  const hpPercent =
    hpOverride && typeof hpOverride.hpPercent === "number"
      ? hpOverride.hpPercent
      : maxHp > 0
        ? Math.round((currentHp / maxHp) * 100)
        : 0;

  const displayName =
    pokemon.nickname || getSpeciesFrenchName(pokemon.speciesId, pokemon.name);
  const effectiveStatus =
    statusOverride !== undefined ? statusOverride : pokemon.status;

  return (
    <div className={`battle-pokemon-status ${className}`}>
      <div className="battle-pokemon-status__heading">
        <strong>{displayName}</strong>
        <span>Niv. {pokemon.level}</span>
      </div>
      <div className="battle-pokemon-status__meta">
        <span>PV</span>
        <strong>
          {currentHp}/{maxHp}
        </strong>
      </div>
      <div
        className="battle-hp"
        role="progressbar"
        aria-label={`Points de vie de ${displayName}`}
        aria-valuemin={0}
        aria-valuemax={maxHp}
        aria-valuenow={currentHp}
      >
        <span
          data-tone={hpTone(hpPercent)}
          style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }}
        />
      </div>
      <div className="battle-pokemon-status__footer">
        <span>{pokemon.types.map(getPokemonTypeLabel).join(" · ")}</span>
        {effectiveStatus && (
          <strong>{STATUS_LABELS[effectiveStatus] ?? effectiveStatus}</strong>
        )}
      </div>
    </div>
  );
}

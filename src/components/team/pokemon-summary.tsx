import { Sparkles, Swords } from "lucide-react";
import { SpriteProvider } from "@/components/pokemon/sprite-provider";
import type { CollectionEntry } from "@/lib/team/collection-entry";
import type { PokemonType } from "@/lib/content/schemas";
import type { EvolutionTarget } from "@/lib/pokemon/pokemon-evolution-types";
import { formatGameInteger } from "@/lib/format-number";
import { getMoveFrenchName } from "@/lib/pokemon/move-names-fr";
import { getPokemonTypeLabel } from "@/lib/pokemon/type-presentation";
import styles from "./team-manager.module.css";

// Les libellés restent lisibles indépendamment de la couleur ou du thème choisi.
export function PokemonTypes({ types }: { types: PokemonType[] }) {
  return (
    <span className={styles.types}>
      {types.map((type) => (
        <span key={type} className={styles.type} data-type={type}>
          {getPokemonTypeLabel(type)}
        </span>
      ))}
    </span>
  );
}

export function PokemonSprite({
  pokemon,
  size = 48,
  normalizeVisibleSize = false,
}: {
  pokemon: CollectionEntry;
  size?: number;
  normalizeVisibleSize?: boolean;
}) {
  return (
    <span className={styles.sprite} aria-hidden="true">
      <SpriteProvider
        key={`${pokemon.speciesId}-${pokemon.isShiny}`}
        speciesId={pokemon.speciesId}
        variant={pokemon.isShiny ? "front_shiny" : "front"}
        alt=""
        width={size}
        height={size}
        normalizeVisibleSize={normalizeVisibleSize}
      />
    </span>
  );
}

/** Contenu de la fiche Pokémon avec actions de modification des attaques et d'évolution */
export function PokemonSummary({
  pokemon,
  titleId,
  evolutions = [],
  onOpenMovesEditor,
  onOpenEvolution,
}: {
  pokemon: CollectionEntry;
  titleId: string;
  evolutions?: EvolutionTarget[];
  onOpenMovesEditor?: () => void;
  onOpenEvolution?: (evo: EvolutionTarget) => void;
}) {
  const stats = pokemon.stats;
  return (
    <section className={styles.summary} aria-label={`Fiche de ${pokemon.name}`}>
      {/* Le résumé supérieur reste consacré à l'identité et aux statistiques. */}
      <div className={styles.summaryTop}>
        <div className={styles.identity}>
          <PokemonSprite pokemon={pokemon} size={112} />
          <div>
            <p className={styles.eyebrow}>
              #
              {pokemon.dexNumber == null
                ? "-"
                : String(pokemon.dexNumber).padStart(3, "0")}{" "}
              · Niveau {pokemon.level}
            </p>
            <h2 id={titleId}>
              {pokemon.name}{" "}
              {pokemon.isShiny && (
                <Sparkles size={16} aria-label="Chromatique" />
              )}
            </h2>
            <PokemonTypes types={pokemon.types} />
            <p className={styles.muted}>
              PV : {pokemon.currentHp} / {pokemon.maxHp}
              {pokemon.currentHp === 0 ? " · K.O." : ""}
            </p>

            {/* Actions d'évolution disponibles */}
            {evolutions.length > 0 && onOpenEvolution && (
              <div className={styles.summaryHeaderActions}>
                {evolutions.map((evo) => (
                  <button
                    key={evo.targetSpeciesId}
                    type="button"
                    className={`${styles.evolveActionBtn} ${
                      !evo.canEvolve ? styles.notReady : ""
                    }`}
                    onClick={() => onOpenEvolution(evo)}
                    title={
                      evo.canEvolve
                        ? `Faire évoluer en ${evo.targetName} maintenant`
                        : `Évolution disponible au niveau ${evo.requiredLevel}`
                    }
                  >
                    <Sparkles size={12} />
                    {evo.canEvolve
                      ? `Évoluer en ${evo.targetName}`
                      : `Niv. ${evo.requiredLevel} : ${evo.targetName}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className={styles.stats}>
          <h3>Statistiques</h3>
          {stats ? (
            <dl>
              {(
                [
                  ["PV max.", stats.hp],
                  ["ATQ", stats.attack],
                  ["DEF", stats.defense],
                  ["ATQ.SP", stats.specialAttack],
                  ["DEF.SP", stats.specialDefense],
                  ["VIT", stats.speed],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className={styles.muted}>Statistiques indisponibles.</p>
          )}
        </div>
      </div>
      <div className={styles.summaryBottom}>
        {/* La limite du jeu est de quatre capacités : deux colonnes et deux
            rangées gardent chaque carte lisible sans créer de case factice. */}
        <div className={styles.moves}>
          <div className={styles.movesSectionHeader}>
            <h3>Capacités actuelles</h3>
            {onOpenMovesEditor && (
              <button
                type="button"
                className={styles.editMovesBtn}
                onClick={onOpenMovesEditor}
                title="Modifier les attaques du Pokémon"
              >
                <Swords size={12} /> Modifier
              </button>
            )}
          </div>

          {pokemon.moves.length ? (
            <ul>
              {pokemon.moves.map((move) => (
                <li key={move.id}>
                  <div className={styles.moveHeading}>
                    <strong>{getMoveFrenchName(move.id, move.name)}</strong>
                    <span>
                      {move.pp}/{move.maxPp} PP
                    </span>
                  </div>
                  <div className={styles.moveDetails}>
                    <PokemonTypes types={[move.type]} />
                    <span>
                      {
                        {
                          physical: "Physique",
                          special: "Spéciale",
                          status: "Statut",
                        }[move.category]
                      }
                    </span>
                    <span>Puissance : {move.power || "-"}</span>
                    <span>
                      Précision : {move.accuracy ? `${move.accuracy} %` : "-"}
                    </span>
                  </div>
                  {move.description && (
                    <p className={styles.muted}>{move.description}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>Aucune capacité renseignée.</p>
          )}
        </div>
        <dl className={styles.pokemonFacts}>
          <div>
            <dt>Talent</dt>
            <dd>{pokemon.ability || "Non renseigné"}</dd>
          </div>
          <div>
            <dt>Nature</dt>
            <dd>{pokemon.nature || "Non renseignée"}</dd>
          </div>
          <div>
            <dt>Expérience</dt>
            <dd>{formatGameInteger(pokemon.experience)} XP</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

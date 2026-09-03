"use client";

import { useEffect, useRef, useState } from "react";
import {
  SpriteProvider,
  type SpriteVariant,
} from "@/components/pokemon/sprite-provider";

export interface ShowcaseStarterItem {
  speciesId: string;
  name: string;
}

interface StarterSpot {
  speciesId: string;
  name: string;
  isShiny: boolean;
  isExiting: boolean;
}

const DEFAULT_STARTERS: ShowcaseStarterItem[] = [
  { speciesId: "bulbasaur", name: "Bulbizarre" },
  { speciesId: "charmander", name: "Salamèche" },
  { speciesId: "squirtle", name: "Carapuce" },
  { speciesId: "chikorita", name: "Germignon" },
  { speciesId: "cyndaquil", name: "Héricendre" },
  { speciesId: "totodile", name: "Kaiminus" },
  { speciesId: "treecko", name: "Arcko" },
  { speciesId: "torchic", name: "Poussifeu" },
  { speciesId: "mudkip", name: "Gobou" },
  { speciesId: "turtwig", name: "Tortipouss" },
  { speciesId: "chimchar", name: "Ouisticram" },
  { speciesId: "piplup", name: "Tiplouf" },
  { speciesId: "pikachu", name: "Pikachu" },
  { speciesId: "eevee", name: "Évoli" },
  { speciesId: "riolu", name: "Riolu" },
  { speciesId: "shinx", name: "Lixy" },
];
const EMPTY_CATALOG: ShowcaseStarterItem[] = [];

// Taux de Shiny à 1% pour une rareté authentique
const SHINY_RATE = 0.01;
// Intervalle de changement simultané des 3 starters
const ROTATION_INTERVAL_MS = 3400;
const SWAP_ANIMATION_MS = 200;

function getRandomStarters(
  source: ShowcaseStarterItem[],
  count: number,
  excludeSpecies: Set<string> = new Set(),
): ShowcaseStarterItem[] {
  const available = source.filter((s) => !excludeSpecies.has(s.speciesId));
  const pool = available.length >= count ? available : source;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function StarterShowcase({
  catalog = EMPTY_CATALOG,
}: {
  catalog?: ShowcaseStarterItem[];
}) {
  const activePool = catalog.length > 0 ? catalog : DEFAULT_STARTERS;
  const poolRef = useRef(activePool);
  poolRef.current = activePool;

  const [spots, setSpots] = useState<StarterSpot[]>(() => {
    // Conserver le même premier rendu côté serveur et côté navigateur évite
    // qu'une sélection aléatoire ne provoque une erreur d'hydratation.
    const initial = DEFAULT_STARTERS.slice(0, 3);
    return initial.map((starter) => ({
      speciesId: starter.speciesId,
      name: starter.name,
      isShiny: false,
      isExiting: false,
    }));
  });

  const spotsRef = useRef(spots);
  spotsRef.current = spots;

  // Randomiser après le montage, puis utiliser le catalogue complet dès sa réception.
  useEffect(() => {
    const fresh = getRandomStarters(
      catalog.length > 0 ? catalog : DEFAULT_STARTERS,
      3,
    );
    setSpots(
      fresh.map((starter) => ({
        speciesId: starter.speciesId,
        name: starter.name,
        isShiny: Math.random() < SHINY_RATE,
        isExiting: false,
      })),
    );
  }, [catalog]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const intervalId = setInterval(() => {
      if (!isMounted) return;

      // 1. Déclencher la disparition simultanée des 3 Pokémon
      setSpots((prev) => prev.map((spot) => ({ ...spot, isExiting: true })));

      // 2. Changer les 3 Pokémon en même temps avec 3 nouvelles créatures distinctes
      timeoutId = setTimeout(() => {
        if (!isMounted) return;

        const currentPool = poolRef.current;
        const currentSpots = spotsRef.current;
        const currentlyDisplayed = new Set(
          currentSpots.map((s) => s.speciesId),
        );

        // Sélectionner 3 nouveaux Pokémon différents des 3 précédents
        const nextTrio = getRandomStarters(currentPool, 3, currentlyDisplayed);

        setSpots(
          nextTrio.map((starter) => ({
            speciesId: starter.speciesId,
            name: starter.name,
            isShiny: Math.random() < SHINY_RATE,
            isExiting: false,
          })),
        );
      }, SWAP_ANIMATION_MS);
    }, ROTATION_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const totalStartersCount = catalog.length > 0 ? catalog.length : 210;

  return (
    <div
      className="onboarding-arena"
      aria-label="Aperçu aléatoire des créatures de départ disponibles"
    >
      <div className="onboarding-showcase__header">
        <span className="onboarding-showcase__badge">
          Partenaires disponibles
        </span>
        <span className="onboarding-showcase__hint">
          {totalStartersCount} créatures de départ
        </span>
      </div>

      <div className="onboarding-showcase__stage">
        {spots.map((spot, index) => {
          const variant: SpriteVariant = spot.isShiny ? "shiny" : "front";
          const spriteSize = index === 1 ? 92 : 84;

          return (
            <div
              key={index}
              className={`onboarding-showcase__slot onboarding-showcase__slot--${index}`}
            >
              <div
                className={`onboarding-showcase__sprite-wrapper ${
                  spot.isExiting ? "is-changing" : ""
                }`}
              >
                {spot.isShiny ? (
                  <span
                    className="onboarding-showcase__shiny-badge"
                    title="Pokémon chromatique !"
                  >
                    ✨
                  </span>
                ) : null}
                <SpriteProvider
                  speciesId={spot.speciesId}
                  variant={variant}
                  alt={spot.name}
                  width={spriteSize}
                  height={spriteSize}
                  priority={index === 1}
                />
              </div>

              <div
                className="onboarding-showcase__pedestal"
                aria-hidden="true"
              />

              <span className="onboarding-showcase__name">{spot.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

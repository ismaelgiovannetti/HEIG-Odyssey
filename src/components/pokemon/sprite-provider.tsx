"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  findSpriteBounds,
  fitSpriteBounds,
  MAX_SPRITE_DIMENSION,
  type SpriteBounds,
} from "@/lib/content/sprite-framing";

export type SpriteVariant =
  "front" | "back" | "shiny" | "front_shiny" | "back_shiny";

export interface SpriteProviderProps {
  speciesId?: string;
  trainerSpritePath?: string;
  variant?: SpriteVariant;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  // Option réservée aux vues qui souhaitent des Pokémon de taille visuelle comparable.
  normalizeVisibleSize?: boolean;
}

const FALLBACK_SPRITE = "/pokeball-pixel.svg";
// Réutilise la mesure lors d'un échange ; chaque variante chromatique a sa propre entrée.
const spriteBoundsCache = new Map<string, SpriteBounds | null>();

/**
 * Espèces de base connues de la 4e génération ayant des formes alternatives
 * (Morphéo, Motisma, Deoxys, Ceriflor, Cheniselle, Cheniti, Giratina, Shaymin, Arceus, etc.).
 */
export const GEN4_FORME_BASE_IDS = [
  "gastrodon",
  "castform",
  "giratina",
  "wormadam",
  "cherrim",
  "shellos",
  "shaymin",
  "arceus",
  "deoxys",
  "rotom",
  "burmy",
  "pichu",
  "unown",
] as const;

/**
 * Extrait l'identifiant de l'espèce de base pour une forme spéciale
 * (ex: castformsunny -> castform, rotom-wash -> rotom, deoxysattack -> deoxys).
 */
export function getBaseSpeciesId(speciesId: string): string {
  if (!speciesId) return "";
  const normalized = speciesId.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const baseId of GEN4_FORME_BASE_IDS) {
    if (normalized.length > baseId.length && normalized.startsWith(baseId)) {
      return baseId;
    }
  }

  const dashIndex = speciesId.indexOf("-");
  if (dashIndex > 0) {
    return speciesId.slice(0, dashIndex).toLowerCase();
  }

  return normalized;
}

export function getPokemonSpriteUrl(
  speciesId: string,
  variant: SpriteVariant = "front",
): string {
  if (!speciesId) return FALLBACK_SPRITE;

  let folder = "front";
  if (variant === "back") {
    folder = "back";
  } else if (variant === "shiny" || variant === "front_shiny") {
    folder = "front_shiny";
  } else if (variant === "back_shiny") {
    folder = "back_shiny";
  }

  return `/sprites/pokemon/${folder}/${speciesId.toLowerCase()}.png`;
}

export function SpriteProvider({
  speciesId,
  trainerSpritePath,
  variant = "front",
  alt,
  width = 96,
  height = 96,
  className = "",
  priority = false,
  normalizeVisibleSize = false,
}: SpriteProviderProps) {
  // Stade de repli : primaire (forme spécifique) -> base (espèce de base) -> pokeball
  const [fallbackStage, setFallbackStage] = useState<
    "primary" | "base" | "pokeball"
  >("primary");
  const [measured, setMeasured] = useState<{
    src: string;
    bounds: SpriteBounds | null;
  } | null>(null);

  React.useEffect(() => {
    setFallbackStage("primary");
    setMeasured(null);
  }, [speciesId, variant, trainerSpritePath]);

  let effectiveSrc = FALLBACK_SPRITE;
  if (trainerSpritePath) {
    effectiveSrc =
      fallbackStage === "pokeball" ? FALLBACK_SPRITE : trainerSpritePath;
  } else if (speciesId) {
    const baseSpeciesId = getBaseSpeciesId(speciesId);
    const hasAlternativeBase =
      baseSpeciesId &&
      baseSpeciesId !== speciesId.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (fallbackStage === "primary") {
      effectiveSrc = getPokemonSpriteUrl(speciesId, variant);
    } else if (fallbackStage === "base" && hasAlternativeBase) {
      effectiveSrc = getPokemonSpriteUrl(baseSpeciesId, variant);
    } else {
      effectiveSrc = FALLBACK_SPRITE;
    }
  }

  const isFailed = effectiveSrc === FALLBACK_SPRITE;
  const shouldNormalize =
    normalizeVisibleSize &&
    Boolean(speciesId) &&
    !trainerSpritePath &&
    !isFailed;
  const framing =
    shouldNormalize && measured?.src === effectiveSrc && measured.bounds
      ? fitSpriteBounds(measured.bounds, width, height)
      : null;

  function measureSprite(event: React.SyntheticEvent<HTMLImageElement>) {
    if (!shouldNormalize) return;
    const img = event.currentTarget;
    if (
      !img.naturalWidth ||
      !img.naturalHeight ||
      img.naturalWidth > MAX_SPRITE_DIMENSION ||
      img.naturalHeight > MAX_SPRITE_DIMENSION
    )
      return;
    try {
      let bounds = spriteBoundsCache.get(effectiveSrc);
      if (bounds === undefined) {
        // Lecture locale de l'image déjà chargée : aucun fichier n'est modifié ou renvoyé.
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(img, 0, 0);
        const pixels = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;
        bounds = findSpriteBounds(pixels, canvas.width, canvas.height);
        spriteBoundsCache.set(effectiveSrc, bounds);
      }
      setMeasured({ src: effectiveSrc, bounds });
    } catch {
      // Si le navigateur interdit la lecture du canvas, le sprite normal reste utilisable.
    }
  }

  function handleImageError() {
    if (fallbackStage === "primary") {
      const baseSpeciesId = speciesId ? getBaseSpeciesId(speciesId) : "";
      const hasAlternativeBase =
        baseSpeciesId &&
        baseSpeciesId !== speciesId?.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (hasAlternativeBase) {
        setFallbackStage("base");
      } else {
        setFallbackStage("pokeball");
      }
    } else if (fallbackStage === "base") {
      setFallbackStage("pokeball");
    }
    setMeasured(null);
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{
        width,
        height,
        overflow: shouldNormalize ? "hidden" : undefined,
      }}
    >
      <Image
        src={effectiveSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        unoptimized
        onLoad={measureSprite}
        onError={handleImageError}
        className="object-contain pixelated"
        style={{
          imageRendering: "pixelated",
          // Seule l'image change d'échelle : la carte et son cadre ne grandissent pas.
          ...(framing
            ? {
                width: framing.width,
                height: framing.height,
                maxWidth: "none",
                flexShrink: 0,
                transform: `translate(${framing.offsetX}px, ${framing.offsetY}px)`,
              }
            : {}),
        }}
      />
    </div>
  );
}

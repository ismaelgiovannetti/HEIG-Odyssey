"use client";

import React, { useState } from "react";
import Image from "next/image";

export type SpriteVariant = "front" | "back" | "shiny" | "front_shiny" | "back_shiny";

export interface SpriteProviderProps {
  speciesId?: string;
  trainerSpritePath?: string;
  variant?: SpriteVariant;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

const FALLBACK_SPRITE = "/pokeball-pixel.svg";

export function getPokemonSpriteUrl(
  speciesId: string,
  variant: SpriteVariant = "front"
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
}: SpriteProviderProps) {
  const [srcError, setSrcError] = useState(false);

  let initialSrc = FALLBACK_SPRITE;
  if (trainerSpritePath) {
    initialSrc = trainerSpritePath;
  } else if (speciesId) {
    initialSrc = getPokemonSpriteUrl(speciesId, variant);
  }

  const effectiveSrc = srcError ? FALLBACK_SPRITE : initialSrc;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width, height }}
    >
      <Image
        src={effectiveSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        unoptimized
        onError={() => setSrcError(true)}
        className="object-contain pixelated"
        style={{
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}

export default SpriteProvider;

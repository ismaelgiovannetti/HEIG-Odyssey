// Les sprites locaux sont petits : une image anormalement grande garde son rendu normal.
export const MAX_SPRITE_DIMENSION = 512;

export interface SpriteBounds {
  imageWidth: number;
  imageHeight: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Mesure uniquement les pixels visibles, pas la marge transparente du fichier. */
export function findSpriteBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): SpriteBounds | null {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_SPRITE_DIMENSION ||
    height > MAX_SPRITE_DIMENSION ||
    pixels.length !== width * height * 4
  )
    return null;

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Le canal alpha vaut zéro pour un pixel entièrement transparent.
      if (pixels[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left) return null;
  return {
    imageWidth: width,
    imageHeight: height,
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

/** Même encombrement visible, proportions intactes et grossissement plafonné. */
export function fitSpriteBounds(
  bounds: SpriteBounds,
  width: number,
  height: number,
) {
  if (
    ![...Object.values(bounds), width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    bounds.imageWidth <= 0 ||
    bounds.imageHeight <= 0 ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    bounds.left < 0 ||
    bounds.top < 0 ||
    bounds.left + bounds.width > bounds.imageWidth ||
    bounds.top + bounds.height > bounds.imageHeight
  )
    return null;

  const originalScale = Math.min(
    width / bounds.imageWidth,
    height / bounds.imageHeight,
  );
  // 82 % du cadre laisse une marge ; au-delà de ×3, un minuscule sprite serait illisible.
  const scale = Math.min(
    (width * 0.82) / bounds.width,
    (height * 0.82) / bounds.height,
    originalScale * 3,
  );
  return {
    width: bounds.imageWidth * scale,
    height: bounds.imageHeight * scale,
    // Centre le Pokémon lui-même, même si les marges du PNG sont asymétriques.
    offsetX: (bounds.imageWidth / 2 - bounds.left - bounds.width / 2) * scale,
    offsetY: (bounds.imageHeight / 2 - bounds.top - bounds.height / 2) * scale,
  };
}

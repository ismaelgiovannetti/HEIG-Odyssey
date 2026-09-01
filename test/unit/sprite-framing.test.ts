import { describe, expect, it } from "vitest";
import {
  findSpriteBounds,
  fitSpriteBounds,
  MAX_SPRITE_DIMENSION,
  type SpriteBounds,
} from "@/lib/content/sprite-framing";

const bounds = (changes: Partial<SpriteBounds> = {}): SpriteBounds => ({
  imageWidth: 96,
  imageHeight: 96,
  left: 28,
  top: 20,
  width: 40,
  height: 60,
  ...changes,
});

describe("taille visible des sprites", () => {
  it("ignore les marges transparentes sans perdre les pixels peu opaques", () => {
    const pixels = new Uint8ClampedArray(8 * 6 * 4);
    pixels[(2 * 8 + 3) * 4 + 3] = 255;
    pixels[(4 * 8 + 5) * 4 + 3] = 1;
    expect(findSpriteBounds(pixels, 8, 6)).toEqual({
      imageWidth: 8,
      imageHeight: 6,
      left: 3,
      top: 2,
      width: 3,
      height: 3,
    });
  });

  it("garde le rendu normal pour une image vide ou des dimensions incohérentes", () => {
    expect(findSpriteBounds(new Uint8ClampedArray(16), 2, 2)).toBeNull();
    expect(findSpriteBounds(new Uint8ClampedArray(4), 2, 2)).toBeNull();
    expect(findSpriteBounds(new Uint8ClampedArray(), 0, 0)).toBeNull();
    expect(
      findSpriteBounds(new Uint8ClampedArray(), MAX_SPRITE_DIMENSION + 1, 1),
    ).toBeNull();
  });

  it("donne le même grand côté visible à un petit et à un grand Pokémon", () => {
    const small = fitSpriteBounds(bounds({ width: 24, height: 30 }), 64, 64)!;
    const large = fitSpriteBounds(bounds(), 64, 64)!;
    expect((small.height / 96) * 30).toBeCloseTo(64 * 0.82);
    expect((large.height / 96) * 60).toBeCloseTo(64 * 0.82);
    expect(small.width / small.height).toBe(1);
  });

  it("centre les pixels visibles malgré des marges asymétriques", () => {
    const content = bounds({ left: 6, top: 32, width: 36, height: 50 });
    const frame = fitSpriteBounds(content, 64, 64)!;
    const scale = frame.width / content.imageWidth;
    expect(
      (content.left + content.width / 2 - content.imageWidth / 2) * scale +
        frame.offsetX,
    ).toBeCloseTo(0);
    expect(
      (content.top + content.height / 2 - content.imageHeight / 2) * scale +
        frame.offsetY,
    ).toBeCloseTo(0);
  });

  it("préserve les proportions et laisse une marge dans un cadre rectangulaire", () => {
    const content = bounds({ imageHeight: 80, width: 40, height: 60 });
    const frame = fitSpriteBounds(content, 64, 48)!;
    expect(frame.width / frame.height).toBeCloseTo(96 / 80);
    expect((frame.width / 96) * content.width).toBeLessThanOrEqual(64 * 0.82);
    expect((frame.height / 80) * content.height).toBeCloseTo(48 * 0.82);
  });

  it("plafonne le grossissement à trois fois le rendu initial", () => {
    const frame = fitSpriteBounds(bounds({ width: 1, height: 1 }), 64, 64)!;
    expect(frame.width).toBe(64 * 3);
    expect(frame.height).toBe(64 * 3);
  });

  it("refuse une mesure invalide plutôt que de produire une image démesurée", () => {
    expect(fitSpriteBounds(bounds({ width: 0 }), 64, 64)).toBeNull();
    expect(fitSpriteBounds(bounds({ left: 90 }), 64, 64)).toBeNull();
    expect(fitSpriteBounds(bounds(), Number.NaN, 64)).toBeNull();
    expect(fitSpriteBounds(bounds(), 64, 0)).toBeNull();
  });
});

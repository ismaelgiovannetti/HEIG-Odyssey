/**
 * Petit générateur congruentiel utilisé uniquement par les tests.
 * Une même graine reproduit toujours exactement la même séquence [0, 1).
 */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

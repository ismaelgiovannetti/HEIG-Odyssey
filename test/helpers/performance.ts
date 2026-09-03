interface MedianMeasurementOptions {
  warmupRuns?: number;
  sampleRuns?: number;
}

/**
 * Mesure une opération après échauffement et retourne la médiane. Chaque
 * contexte est préparé hors chronométrage afin de mesurer uniquement
 * l'opération ciblée. La médiane absorbe les pauses ponctuelles d'un runner CI.
 */
export function measureMedianDurationMs<T>(
  setup: () => T,
  operation: (context: T) => unknown,
  { warmupRuns = 5, sampleRuns = 11 }: MedianMeasurementOptions = {},
): number {
  if (warmupRuns < 0 || sampleRuns < 3 || sampleRuns % 2 === 0) {
    throw new Error(
      "Les mesures exigent un échauffement positif et un nombre impair d'échantillons >= 3.",
    );
  }

  const measureOnce = () => {
    const context = setup();
    const start = performance.now();
    operation(context);
    return performance.now() - start;
  };

  for (let index = 0; index < warmupRuns; index += 1) {
    measureOnce();
  }

  const durations = Array.from({ length: sampleRuns }, measureOnce).sort(
    (left, right) => left - right,
  );

  return durations[Math.floor(durations.length / 2)];
}

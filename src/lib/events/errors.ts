/**
 * Signale qu'un événement ne pourra jamais réussir après une nouvelle livraison.
 * Les erreurs inconnues restent réessayables par défaut.
 */
export class PermanentDomainEventError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "PermanentDomainEventError";
  }
}

export function isPermanentDomainEventError(
  error: Error,
): error is PermanentDomainEventError {
  return error instanceof PermanentDomainEventError;
}

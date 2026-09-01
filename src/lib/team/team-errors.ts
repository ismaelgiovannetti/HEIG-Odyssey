// Ces erreurs sont prévues et affichables ; les erreurs techniques restent côté serveur.
export class TeamPokemonNotOwnedError extends Error {
  constructor() {
    super("Une ou plusieurs créatures ne font pas partie de votre collection.");
    this.name = "TeamPokemonNotOwnedError";
  }
}

export class TeamCompositionInvalidError extends Error {
  constructor(public readonly reasons: string[]) {
    super("Composition de l'équipe ou rangement du PC invalide.");
    this.name = "TeamCompositionInvalidError";
  }
}

export class TeamRevisionConflictError extends Error {
  constructor() {
    super("La collection a changé. Rechargez-la avant d'enregistrer vos modifications.");
    this.name = "TeamRevisionConflictError";
  }
}

export class TeamOnboardingRequiredError extends Error {
  constructor() {
    super("Terminez le recrutement initial avant de gérer votre équipe.");
    this.name = "TeamOnboardingRequiredError";
  }
}

export class PcCapacityExceededError extends Error {
  constructor() {
    super("Le PC est plein. Conservez davantage de créatures dans l'équipe.");
    this.name = "PcCapacityExceededError";
  }
}

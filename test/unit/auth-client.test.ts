import { beforeEach, describe, expect, it, vi } from "vitest";

// Ces tests protègent le contrat entre nos formulaires et Better Auth : choix
// de la méthode de connexion, normalisation et destinations de retour sûres.
const authClientMocks = vi.hoisted(() => ({
  isUsernameAvailable: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  sendVerificationEmail: vi.fn(),
  signInEmail: vi.fn(),
  signInUsername: vi.fn(),
  signOut: vi.fn(),
  signUpEmail: vi.fn(),
}));

// Better Auth est remplacé par une frontière contrôlée : ces tests vérifient
// uniquement les données que notre adaptateur lui transmet.
vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({
    isUsernameAvailable: authClientMocks.isUsernameAvailable,
    requestPasswordReset: authClientMocks.requestPasswordReset,
    resetPassword: authClientMocks.resetPassword,
    sendVerificationEmail: authClientMocks.sendVerificationEmail,
    signIn: {
      email: authClientMocks.signInEmail,
      username: authClientMocks.signInUsername,
    },
    signOut: authClientMocks.signOut,
    signUp: {
      email: authClientMocks.signUpEmail,
    },
  }),
}));

vi.mock("better-auth/client/plugins", () => ({
  usernameClient: () => ({ id: "username" }),
}));

import {
  buildPostSignInCallback,
  checkUsernameAvailability,
  requestPasswordRecovery,
  requestVerificationEmail,
  resetPasswordWithToken,
  signInWithIdentifier,
  signOutCurrentSession,
  signUpWithEmail,
} from "@/lib/auth-client";

describe("adaptateur client d'authentification", () => {
  beforeEach(() => {
    // Réinitialise aussi les réponses simulées afin que chaque scénario reste
    // indépendant de l'ordre d'exécution choisi par Vitest.
    vi.resetAllMocks();
  });

  // Une destination reçue depuis l'URL ne doit jamais permettre de sortir du site.
  it("construit une reprise interne et refuse une redirection externe", () => {
    expect(buildPostSignInCallback("/campaign?world=bachelor-1")).toBe(
      "/auth/continue?next=%2Fcampaign%3Fworld%3Dbachelor-1"
    );
    expect(buildPostSignInCallback("https://malicious.example")).toBe(
      "/auth/continue?next=%2Fdashboard"
    );
  });

  // Le champ unique doit sélectionner exactement une des deux routes Better Auth.
  it("normalise une adresse e-mail avant la connexion", async () => {
    authClientMocks.signInEmail.mockResolvedValue({ data: {}, error: null });

    await signInWithIdentifier({
      identifier: "  Player@Example.COM  ",
      password: "TestPassword!2026",
      rememberMe: false,
      callbackPath: "/campaign",
    });

    expect(authClientMocks.signInEmail).toHaveBeenCalledWith({
      email: "player@example.com",
      password: "TestPassword!2026",
      rememberMe: false,
      callbackURL: "/auth/continue?next=%2Fcampaign",
    });
    expect(authClientMocks.signInUsername).not.toHaveBeenCalled();
  });

  it("normalise un nom d'utilisateur avant la connexion", async () => {
    authClientMocks.signInUsername.mockResolvedValue({ data: {}, error: null });

    await signInWithIdentifier({
      identifier: "  Kim.Possible_1  ",
      password: "TestPassword!2026",
    });

    expect(authClientMocks.signInUsername).toHaveBeenCalledWith({
      username: "kim.possible_1",
      password: "TestPassword!2026",
      rememberMe: true,
      callbackURL: "/auth/continue?next=%2Fdashboard",
    });
    expect(authClientMocks.signInEmail).not.toHaveBeenCalled();
  });

  // L'inscription conserve un nom lisible tout en générant une clé unique stable.
  it("normalise les données d'inscription et conserve le nom affiché", async () => {
    authClientMocks.signUpEmail.mockResolvedValue({ data: {}, error: null });

    await signUpWithEmail({
      username: "  Kim.Possible_1  ",
      email: "  Player@Example.COM  ",
      password: "TestPassword!2026",
      callbackPath: "/login?verified=1",
    });

    expect(authClientMocks.signUpEmail).toHaveBeenCalledWith({
      name: "Kim.Possible_1",
      username: "kim.possible_1",
      email: "player@example.com",
      password: "TestPassword!2026",
      callbackURL: "/login?verified=1",
    });
  });

  it("normalise le nom avant de vérifier sa disponibilité", async () => {
    authClientMocks.isUsernameAvailable.mockResolvedValue({
      data: { available: true },
      error: null,
    });

    await checkUsernameAvailability("  Kim.Possible_1  ");

    expect(authClientMocks.isUsernameAvailable).toHaveBeenCalledWith({
      username: "kim.possible_1",
    });
  });

  // Le renvoi utilise la même normalisation que l'inscription initiale.
  it("normalise le renvoi de vérification et utilise une destination fixe", async () => {
    authClientMocks.sendVerificationEmail.mockResolvedValue({ data: {}, error: null });

    await requestVerificationEmail("  Player@Example.COM  ");

    expect(authClientMocks.sendVerificationEmail).toHaveBeenCalledWith({
      email: "player@example.com",
      callbackURL: "/login?verified=1",
    });
  });

  // Le retour de récupération reste fixé côté application : une valeur fournie
  // par l'utilisateur ne peut pas transformer le lien reçu en redirection externe.
  it("normalise la demande de récupération et utilise une destination interne", async () => {
    authClientMocks.requestPasswordReset.mockResolvedValue({ data: {}, error: null });

    await requestPasswordRecovery("  Player@Example.COM  ");

    expect(authClientMocks.requestPasswordReset).toHaveBeenCalledWith({
      email: "player@example.com",
      redirectTo: "/reset-password",
    });
  });

  // Le jeton et le nouveau secret sont transmis uniquement à la route Better Auth
  // chargée de vérifier l'expiration et de consommer le lien une seule fois.
  it("transmet le jeton lors de la réinitialisation du mot de passe", async () => {
    authClientMocks.resetPassword.mockResolvedValue({ data: {}, error: null });

    await resetPasswordWithToken({
      token: "reset-token",
      newPassword: "TestPassword!2026",
    });

    expect(authClientMocks.resetPassword).toHaveBeenCalledWith({
      token: "reset-token",
      newPassword: "TestPassword!2026",
    });
  });

  // Les composants React sont responsables de transformer l'erreur en message sûr.
  it("transmet les échecs du service afin que l'interface puisse les traiter", async () => {
    const serviceError = new Error("SERVICE_UNAVAILABLE");
    authClientMocks.signInEmail.mockRejectedValue(serviceError);

    await expect(
      signInWithIdentifier({
        identifier: "player@example.com",
        password: "TestPassword!2026",
      })
    ).rejects.toBe(serviceError);
  });

  // La fonction d'adaptation ne doit ni masquer ni remplacer l'appel de déconnexion.
  it("invalide la session courante via Better Auth", async () => {
    authClientMocks.signOut.mockResolvedValue({ data: {}, error: null });

    await signOutCurrentSession();

    expect(authClientMocks.signOut).toHaveBeenCalledOnce();
  });
});

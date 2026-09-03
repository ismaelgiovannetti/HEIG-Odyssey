// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom reproduit ici les interactions essentielles du navigateur sans lancer
// un serveur ni dépendre d'un compte réel, de PostgreSQL ou de Resend.
const formMocks = vi.hoisted(() => ({
  buildPostSignInCallback: vi.fn(),
  checkUsernameAvailability: vi.fn(),
  requestPasswordRecovery: vi.fn(),
  requestVerificationEmail: vi.fn(),
  resetPasswordWithToken: vi.fn(),
  routerPush: vi.fn(),
  signInWithIdentifier: vi.fn(),
  signOutCurrentSession: vi.fn(),
  signUpWithEmail: vi.fn(),
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: formMocks.useRouter,
  useSearchParams: formMocks.useSearchParams,
}));

vi.mock("@/lib/auth/client", () => ({
  buildPostSignInCallback: formMocks.buildPostSignInCallback,
  checkUsernameAvailability: formMocks.checkUsernameAvailability,
  requestPasswordRecovery: formMocks.requestPasswordRecovery,
  requestVerificationEmail: formMocks.requestVerificationEmail,
  resetPasswordWithToken: formMocks.resetPasswordWithToken,
  signInWithIdentifier: formMocks.signInWithIdentifier,
  signOutCurrentSession: formMocks.signOutCurrentSession,
  signUpWithEmail: formMocks.signUpWithEmail,
}));

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { LoginForm } from "@/components/auth/login-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { SignupForm } from "@/components/auth/signup-form";
import { VerificationForm } from "@/components/auth/verification-form";
import { INVALID_CREDENTIALS_MESSAGE } from "@/lib/auth/constants";

describe("erreurs des formulaires d'authentification", () => {
  beforeEach(() => {
    // Chaque formulaire reçoit un routeur et des paramètres d'URL neutres.
    vi.resetAllMocks();
    formMocks.useRouter.mockReturnValue({ push: formMocks.routerPush });
    formMocks.useSearchParams.mockReturnValue(new URLSearchParams());
    formMocks.buildPostSignInCallback.mockReturnValue(
      "/auth/continue?next=%2Fdashboard",
    );
    formMocks.checkUsernameAvailability.mockResolvedValue({
      data: { available: true },
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    // Restaure notamment sessionStorage lorsqu'un scénario le rend indisponible.
    vi.restoreAllMocks();
  });

  // La validation locale évite une requête inutile et fournit un retour immédiat.
  it("refuse une connexion dont les champs sont vides", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "Renseignez votre identifiant et votre mot de passe.",
    );
    expect(formMocks.signInWithIdentifier).not.toHaveBeenCalled();
  });

  // Le détail renvoyé par Better Auth ne doit jamais permettre d'énumérer les comptes.
  it("affiche un message générique lorsque les identifiants sont refusés", async () => {
    const user = userEvent.setup();
    formMocks.signInWithIdentifier.mockResolvedValue({
      error: { message: "EMAIL_NOT_FOUND" },
    });
    render(<LoginForm />);

    await user.type(
      screen.getByLabelText("Adresse e-mail ou nom d'utilisateur"),
      "absent@example.com",
    );
    await user.type(
      screen.getByLabelText("Mot de passe"),
      "WrongPassword!2026",
    );
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(INVALID_CREDENTIALS_MESSAGE);
    expect(alert.textContent).not.toContain("EMAIL_NOT_FOUND");
  });

  // Une panne interne est convertie en message utilisateur sans information sensible.
  it("indique une indisponibilité sans exposer l'erreur technique", async () => {
    const user = userEvent.setup();
    formMocks.signInWithIdentifier.mockRejectedValue(
      new Error("DATABASE_CONNECTION_STRING"),
    );
    render(<LoginForm />);

    await user.type(
      screen.getByLabelText("Adresse e-mail ou nom d'utilisateur"),
      "player@example.com",
    );
    await user.type(screen.getByLabelText("Mot de passe"), "TestPassword!2026");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "La connexion est momentanément indisponible. Réessayez.",
    );
    expect(alert.textContent).not.toContain("DATABASE_CONNECTION_STRING");
  });

  // Une erreur de vérification prend le pas sur un éventuel indicateur de succès.
  it("signale un lien de vérification invalide sans afficher un faux succès", () => {
    formMocks.useSearchParams.mockReturnValue(
      new URLSearchParams("verified=1&error=invalid_token"),
    );

    render(<LoginForm />);

    expect(screen.getByRole("alert").textContent).toContain(
      "Ce lien de vérification est invalide ou a expiré.",
    );
    expect(
      screen.queryByText(
        "Adresse vérifiée. Vous pouvez maintenant vous connecter.",
      ),
    ).toBeNull();
  });

  // Le visiteur doit comprendre pourquoi une route privée l'a renvoyé ici.
  it("explique la redirection provoquée par une session expirée", () => {
    formMocks.useSearchParams.mockReturnValue(
      new URLSearchParams("sessionExpired=1"),
    );

    render(<LoginForm />);

    expect(screen.getByRole("status").textContent).toContain(
      "Votre session a expiré. Connectez-vous à nouveau.",
    );
  });

  // L'inscription invalide reste entièrement côté navigateur.
  it("refuse localement une inscription invalide avant tout appel réseau", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    const firstAlert = screen.getByRole("alert");
    expect(firstAlert.getAttribute("aria-live")).toBe("assertive");
    expect(firstAlert.getAttribute("aria-atomic")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "Corrigez les champs signalés avant de continuer.",
    );
    expect(screen.getByRole("alert")).not.toBe(firstAlert);
    expect(formMocks.signUpWithEmail).not.toHaveBeenCalled();
  });

  it("signale en direct un nom d'utilisateur déjà pris", async () => {
    const user = userEvent.setup();
    formMocks.checkUsernameAvailability.mockResolvedValue({
      data: { available: false },
      error: null,
    });
    render(<SignupForm />);

    const usernameInput = screen.getByLabelText("Nom d'utilisateur");
    await user.type(usernameInput, "Katniss_1");

    expect(
      await screen.findByText(
        "Ce nom d'utilisateur est déjà pris.",
        {},
        { timeout: 2_000 },
      ),
    ).toBeTruthy();
    expect(usernameInput.getAttribute("aria-invalid")).toBe("true");
    expect(formMocks.checkUsernameAvailability).toHaveBeenCalledWith(
      "Katniss_1",
    );
  });

  // Le refus final ne révèle ni l'adresse enregistrée ni les détails du serveur.
  it("conserve un refus d'inscription générique", async () => {
    const user = userEvent.setup();
    formMocks.signUpWithEmail.mockResolvedValue({
      error: { message: "USER_ALREADY_EXISTS" },
    });
    render(<SignupForm />);

    await user.type(screen.getByLabelText("Nom d'utilisateur"), "Katniss_1");
    await user.type(
      screen.getByLabelText("Adresse e-mail"),
      "katniss@example.com",
    );
    await user.type(screen.getByLabelText("Mot de passe"), "TestPassword!2026");
    await user.type(
      screen.getByLabelText("Confirmer le mot de passe"),
      "TestPassword!2026",
    );
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Impossible de créer le compte avec ces informations.",
    );
    expect(alert.textContent).not.toContain("USER_ALREADY_EXISTS");
  });

  // Un secret insuffisant est refusé par l'interface avant même l'appel serveur.
  it("applique la politique renforcée lors de la création du compte", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText("Nom d'utilisateur"), "Katniss_1");
    await user.type(
      screen.getByLabelText("Adresse e-mail"),
      "katniss@example.com",
    );
    await user.type(screen.getByLabelText("Mot de passe"), "motdepassefaible");
    await user.type(
      screen.getByLabelText("Confirmer le mot de passe"),
      "motdepassefaible",
    );
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "Corrigez les champs signalés avant de continuer.",
    );
    expect(formMocks.signUpWithEmail).not.toHaveBeenCalled();
  });

  // La réponse affichée reste volontairement identique pour une adresse connue
  // ou inconnue, ce qui empêche l'énumération des comptes depuis cet écran.
  it("confirme une demande de récupération avec un message neutre", async () => {
    const user = userEvent.setup();
    formMocks.requestPasswordRecovery.mockResolvedValue({
      data: {},
      error: null,
    });
    render(<ForgotPasswordForm />);

    await user.type(
      screen.getByLabelText("Adresse e-mail du compte"),
      "absent@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Envoyer le lien de récupération" }),
    );

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain(
      "Si un compte correspond à cette adresse",
    );
    expect(status.textContent).not.toContain("absent");
  });

  it("n'expose pas l'erreur technique d'une demande de récupération", async () => {
    const user = userEvent.setup();
    formMocks.requestPasswordRecovery.mockRejectedValue(
      new Error("RESEND_API_KEY"),
    );
    render(<ForgotPasswordForm />);

    await user.type(
      screen.getByLabelText("Adresse e-mail du compte"),
      "player@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Envoyer le lien de récupération" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Impossible de traiter la demande maintenant",
    );
    expect(alert.textContent).not.toContain("RESEND_API_KEY");
  });

  it("refuse un écran de réinitialisation dépourvu de jeton", () => {
    render(<ResetPasswordForm />);

    expect(screen.getByRole("alert").textContent).toContain(
      "invalide, expiré ou déjà utilisé",
    );
    expect(formMocks.resetPasswordWithToken).not.toHaveBeenCalled();
  });

  it("renouvelle le retour visuel après deux mots de passe faibles", async () => {
    const user = userEvent.setup();
    formMocks.useSearchParams.mockReturnValue(
      new URLSearchParams("token=one-time-token"),
    );
    render(<ResetPasswordForm />);

    await user.type(
      screen.getByLabelText("Nouveau mot de passe"),
      "motdepassefaible",
    );
    await user.type(
      screen.getByLabelText("Confirmer le nouveau mot de passe"),
      "motdepassefaible",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Enregistrer le nouveau mot de passe",
      }),
    );

    const firstAlert = screen.getByRole("alert");
    await user.click(
      screen.getByRole("button", {
        name: "Enregistrer le nouveau mot de passe",
      }),
    );

    expect(screen.getByRole("alert")).not.toBe(firstAlert);
    expect(formMocks.resetPasswordWithToken).not.toHaveBeenCalled();
  });

  it("réinitialise le mot de passe avec le jeton reçu", async () => {
    const user = userEvent.setup();
    formMocks.useSearchParams.mockReturnValue(
      new URLSearchParams("token=one-time-token"),
    );
    formMocks.resetPasswordWithToken.mockResolvedValue({
      data: {},
      error: null,
    });
    render(<ResetPasswordForm />);

    await user.type(
      screen.getByLabelText("Nouveau mot de passe"),
      "FreshPassword!2026",
    );
    await user.type(
      screen.getByLabelText("Confirmer le nouveau mot de passe"),
      "FreshPassword!2026",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Enregistrer le nouveau mot de passe",
      }),
    );

    expect(formMocks.resetPasswordWithToken).toHaveBeenCalledWith({
      token: "one-time-token",
      newPassword: "FreshPassword!2026",
    });
    expect((await screen.findByRole("status")).textContent).toContain(
      "Votre mot de passe a été modifié",
    );
  });

  // Certains navigateurs ou réglages de confidentialité désactivent ce stockage.
  it("reste utilisable lorsque la lecture du stockage navigateur est bloquée", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("STORAGE_DISABLED");
    });

    expect(() => render(<VerificationForm />)).not.toThrow();
    expect(screen.getByLabelText("Adresse e-mail")).toBeDefined();
  });

  // Le message technique de Resend reste hors de l'interface.
  it("affiche une erreur générique si le renvoi du lien échoue", async () => {
    const user = userEvent.setup();
    formMocks.requestVerificationEmail.mockRejectedValue(
      new Error("RESEND_API_KEY"),
    );
    render(<VerificationForm />);

    await user.type(
      screen.getByLabelText("Adresse e-mail"),
      "player@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Renvoyer le lien" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Impossible de traiter la demande maintenant. Réessayez plus tard.",
    );
    expect(alert.textContent).not.toContain("RESEND_API_KEY");
  });

  // Une déconnexion refusée ne simule pas une sortie réussie.
  it("garde le joueur sur la page si la déconnexion échoue", async () => {
    const user = userEvent.setup();
    formMocks.signOutCurrentSession.mockResolvedValue({
      error: { message: "SESSION_STORAGE_ERROR" },
    });
    render(<LogoutButton />);

    await user.click(
      screen.getByRole("button", { name: "Confirmer la déconnexion" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("La déconnexion a échoué. Réessayez.");
    expect(alert.textContent).not.toContain("SESSION_STORAGE_ERROR");
  });
});

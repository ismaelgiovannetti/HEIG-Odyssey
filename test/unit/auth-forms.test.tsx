// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom reproduit ici les interactions essentielles du navigateur sans lancer
// un serveur ni dépendre d'un compte réel, de PostgreSQL ou de Resend.
const formMocks = vi.hoisted(() => ({
  buildPostSignInCallback: vi.fn(),
  requestVerificationEmail: vi.fn(),
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

vi.mock("@/lib/auth-client", () => ({
  buildPostSignInCallback: formMocks.buildPostSignInCallback,
  requestVerificationEmail: formMocks.requestVerificationEmail,
  signInWithIdentifier: formMocks.signInWithIdentifier,
  signOutCurrentSession: formMocks.signOutCurrentSession,
  signUpWithEmail: formMocks.signUpWithEmail,
}));

import { LoginForm } from "@/components/auth/login-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { SignupForm } from "@/components/auth/signup-form";
import { VerificationForm } from "@/components/auth/verification-form";
import { INVALID_CREDENTIALS_MESSAGE } from "@/lib/auth/constants";

describe("erreurs des formulaires d'authentification", () => {
  beforeEach(() => {
    // Chaque formulaire reçoit un routeur et des paramètres d'URL neutres.
    vi.resetAllMocks();
    formMocks.useRouter.mockReturnValue({ push: formMocks.routerPush });
    formMocks.useSearchParams.mockReturnValue(new URLSearchParams());
    formMocks.buildPostSignInCallback.mockReturnValue("/auth/continue?next=%2Fdashboard");
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
      "Renseignez votre identifiant et votre mot de passe."
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

    await user.type(screen.getByLabelText("Adresse e-mail ou nom d'utilisateur"), "absent@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "WrongPassword!2026");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(INVALID_CREDENTIALS_MESSAGE);
    expect(alert.textContent).not.toContain("EMAIL_NOT_FOUND");
  });

  // Une panne interne est convertie en message utilisateur sans information sensible.
  it("indique une indisponibilité sans exposer l'erreur technique", async () => {
    const user = userEvent.setup();
    formMocks.signInWithIdentifier.mockRejectedValue(new Error("DATABASE_CONNECTION_STRING"));
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Adresse e-mail ou nom d'utilisateur"), "player@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "TestPassword!2026");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "La connexion est momentanément indisponible. Réessayez."
    );
    expect(alert.textContent).not.toContain("DATABASE_CONNECTION_STRING");
  });

  // Une erreur de vérification prend le pas sur un éventuel indicateur de succès.
  it("signale un lien de vérification invalide sans afficher un faux succès", () => {
    formMocks.useSearchParams.mockReturnValue(
      new URLSearchParams("verified=1&error=invalid_token")
    );

    render(<LoginForm />);

    expect(screen.getByRole("alert").textContent).toContain(
      "Ce lien de vérification est invalide ou a expiré."
    );
    expect(screen.queryByText("Adresse vérifiée. Vous pouvez maintenant vous connecter.")).toBeNull();
  });

  // Le visiteur doit comprendre pourquoi une route privée l'a renvoyé ici.
  it("explique la redirection provoquée par une session expirée", () => {
    formMocks.useSearchParams.mockReturnValue(new URLSearchParams("sessionExpired=1"));

    render(<LoginForm />);

    expect(screen.getByRole("status").textContent).toContain(
      "Votre session a expiré. Connectez-vous à nouveau."
    );
  });

  // L'inscription invalide reste entièrement côté navigateur.
  it("refuse localement une inscription invalide avant tout appel réseau", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "Corrigez les champs signalés avant de continuer."
    );
    expect(formMocks.signUpWithEmail).not.toHaveBeenCalled();
  });

  // Le serveur peut refuser l'inscription sans révéler le champ déjà utilisé.
  it("ne révèle pas si l'e-mail ou le nom existe déjà", async () => {
    const user = userEvent.setup();
    formMocks.signUpWithEmail.mockResolvedValue({
      error: { message: "USER_ALREADY_EXISTS" },
    });
    render(<SignupForm />);

    await user.type(screen.getByLabelText("Nom d'utilisateur"), "Katniss_1");
    await user.type(screen.getByLabelText("Adresse e-mail"), "katniss@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "TestPassword!2026");
    await user.type(screen.getByLabelText("Confirmer le mot de passe"), "TestPassword!2026");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Impossible de créer le compte avec ces informations."
    );
    expect(alert.textContent).not.toContain("USER_ALREADY_EXISTS");
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
    formMocks.requestVerificationEmail.mockRejectedValue(new Error("RESEND_API_KEY"));
    render(<VerificationForm />);

    await user.type(screen.getByLabelText("Adresse e-mail"), "player@example.com");
    await user.click(screen.getByRole("button", { name: "Renvoyer le lien" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Impossible de traiter la demande maintenant. Réessayez plus tard."
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

    await user.click(screen.getByRole("button", { name: "Confirmer la déconnexion" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("La déconnexion a échoué. Réessayez.");
    expect(alert.textContent).not.toContain("SESSION_STORAGE_ERROR");
  });
});

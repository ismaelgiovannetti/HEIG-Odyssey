import { expect, test } from "@playwright/test";

import { prisma } from "../../src/lib/prisma";
import {
  createOnboardingTestUser,
  deleteOnboardingTestUser,
  E2E_PASSWORD,
  type OnboardingTestUser,
} from "./helpers/onboarding-user";

test.describe("premier lancement du joueur", () => {
  let testUser: OnboardingTestUser | undefined;

  test.afterEach(async () => {
    await deleteOnboardingTestUser(testUser);
    testUser = undefined;
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("crée l'équipe une seule fois puis ignore l'onboarding aux connexions suivantes", async ({
    page,
  }) => {
    testUser = await createOnboardingTestUser();

    // Première connexion : le profil incomplet doit toujours rejoindre l'onboarding.
    await page.goto("/login");
    await page
      .getByLabel("Adresse e-mail ou nom d'utilisateur")
      .fill(testUser.email);
    await page
      .getByRole("textbox", { name: "Mot de passe" })
      .fill(E2E_PASSWORD);

    // Le chargement du catalogue prouve que le composant client est hydraté.
    // Sans cette attente, un clic très rapide peut viser le HTML serveur avant
    // que React ait attaché les gestionnaires d'événements.
    const catalogReady = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/starter/list") && response.ok(),
    );
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await catalogReady;

    await page
      .getByRole("button", { name: "Choisir mon premier partenaire" })
      .click();
    await page
      .getByRole("button", { name: /Bulbizarre/ })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Choisir Bulbizarre", exact: true })
      .click();

    // La première compilation de la route peut prendre quelques secondes en
    // mode développement. Attendre la réponse évite un délai visuel arbitraire.
    const starterClaimed = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/starter/choose") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Confirmer le recrutement" })
      .click();
    expect((await starterClaimed).status()).toBe(201);

    await expect(
      page.getByRole("heading", { name: "Bulbizarre rejoint votre équipe !" }),
    ).toBeVisible();

    // La transaction doit produire exactement un starter, une équipe et une zone.
    const [profile, team, campaign] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId: testUser.id } }),
      prisma.userPokemon.findMany({
        where: { userId: testUser.id },
        orderBy: { teamPosition: "asc" },
      }),
      prisma.campaignProgress.findMany({ where: { userId: testUser.id } }),
    ]);

    expect(profile?.hasCompletedOnboarding).toBe(true);
    expect(profile?.onboardingCompletedAt).not.toBeNull();
    expect(team).toHaveLength(1);
    expect(team[0]).toMatchObject({
      speciesId: "bulbasaur",
      level: 5,
      teamPosition: 1,
    });
    expect(campaign).toEqual([
      expect.objectContaining({
        worldId: "bachelor-1",
        stageId: "bachelor-1-stage-1",
        isCompleted: false,
      }),
    ]);

    // Un rejeu authentifié est refusé et ne crée aucune deuxième créature.
    const replay = await page.context().request.post("/api/starter/choose", {
      data: { speciesId: "charmander" },
    });
    expect(replay.status()).toBe(409);
    expect(
      await prisma.userPokemon.count({ where: { userId: testUser.id } }),
    ).toBe(1);

    await page
      .getByRole("button", { name: "Accéder à l’accueil" })
      .click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Une visite ultérieure de l'URL est redirigée sans rejouer le recrutement.
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/dashboard$/);

    // Une nouvelle session doit reprendre directement au dashboard.
    await page.goto("/logout");
    await page
      .getByRole("button", { name: "Confirmer la déconnexion" })
      .click();
    await expect(page).toHaveURL(/\/login\?loggedOut=1$/);

    // La page de connexion est rendue côté serveur avant que React n'attache
    // le gestionnaire du formulaire. Attendre la fin des chargements évite
    // qu'un clic très rapide déclenche la soumission HTML native en GET.
    await page.waitForLoadState("networkidle");

    await page
      .getByLabel("Adresse e-mail ou nom d'utilisateur")
      .fill(testUser.email);
    await page
      .getByRole("textbox", { name: "Mot de passe" })
      .fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole("heading", { name: `Bienvenue, ${testUser.username} !` }),
    ).toBeVisible();
  });
});

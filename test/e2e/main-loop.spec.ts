import { expect, test } from "@playwright/test";

import { prisma } from "../../src/lib/prisma";
import {
  createBattleReadyTestUser,
  deleteBattleReadyTestUser,
  E2E_PASSWORD,
  type BattleReadyTestUser,
} from "./helpers/battle-ready-user";

async function login(page: import("@playwright/test").Page, user: BattleReadyTestUser) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Adresse e-mail ou nom d'utilisateur").fill(user.email);
  await page.getByRole("textbox", { name: "Mot de passe" }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("boucle principale (T-US19-05)", () => {
  let testUser: BattleReadyTestUser | undefined;

  test.afterEach(async () => {
    await deleteBattleReadyTestUser(testUser);
    testUser = undefined;
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("équipe, campagne, entraînement et persistance des gains", async ({ page }) => {
    testUser = await createBattleReadyTestUser();
    await login(page, testUser);

    // --- Étape 1 : lecture de l'équipe active -------------------------------
    await page.goto("/team");
    await expect(page.getByRole("heading", { name: "Gestion d'équipe" })).toBeVisible();
    await expect(page.getByRole("button", { name: /: Pikachu,/ })).toBeVisible();

    // --- Étape 2 : lancement et résolution d'un combat de campagne ----------
    await page.goto("/campaign");
    await expect(page.getByRole("heading", { name: /^Campagne - / })).toBeVisible();

    const battleStarted = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/battle/start") &&
        response.request().method() === "POST" &&
        response.ok(),
    );
    await page
      .getByRole("button", { name: /^Lancer le combat : / })
      .click();
    await battleStarted;

    await expect(page.locator("#battle-title")).toBeVisible();

    // Le Pikachu niveau 50 écrase le Bidoof niveau 6 : une victoire déterministe
    // en un tour, sans dépendre du profil aléatoire de l'IA adverse.
    const victoryHeading = page.getByRole("heading", { name: "Victoire confirmée !" });
    for (let attempt = 0; attempt < 3 && !(await victoryHeading.isVisible()); attempt++) {
      const actionResolved = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/battle/action") && response.ok(),
      );
      await page.getByRole("button", { name: /Thunderbolt/ }).click();
      await actionResolved;
    }
    await expect(victoryHeading).toBeVisible();

    // --- Étape 3 : résultat et gains vérifiés immédiatement après le combat -
    const rewards = page.locator(".battle-result__rewards");
    await expect(rewards).toContainText("+40 ₽");
    await expect(rewards).toContainText("+70 XP");
    await expect(rewards).toContainText("40 ₽");
    await expect(page.getByLabel("40 Pokédollars")).toBeVisible();

    await page.getByRole("button", { name: /Retour.*campagne/ }).click();
    await expect(
      page.getByRole("button", { name: /^Rejouer : / }),
    ).toBeVisible();

    // --- Étape 4 : génération et lancement d'un entraînement ----------------
    await page.goto("/training");
    await expect(page.getByRole("heading", { name: "Centre d’entraînement" })).toBeVisible();
    await expect(page.getByText("Pikachu")).toBeVisible();

    // L'input radio est visuellement masqué (habillé par le label) : cliquer
    // l'input directement échoue l'actionabilité de Playwright ("outside of
    // the viewport"), on clique donc le label, association native HTML.
    await page.locator('label[data-difficulty="easy"]').click();

    const trainingOpponentReady = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/battle/start") &&
        response.request().method() === "POST" &&
        response.ok(),
    );
    await page.getByRole("button", { name: /Générer l.adversaire/ }).click();
    await trainingOpponentReady;

    await expect(page.getByRole("heading", { name: "Simulation prête" })).toBeVisible();
    await page.getByRole("button", { name: /Entrer dans l.arène/ }).click();
    await expect(page.locator("#battle-title")).toBeVisible();

    // La difficulté ne change pas le niveau de l'adversaire (il reste calé sur
    // le niveau moyen de l'équipe) : on ne force donc pas d'issue, on quitte
    // proprement — le DoD exige la génération et le lancement, pas le résultat.
    await page.getByRole("button", { name: "Quitter le combat" }).click();
    await expect(page.getByRole("heading", { name: "Centre d’entraînement" })).toBeVisible();

    // --- Étape 5 : persistance après une nouvelle navigation ----------------
    const [profileAfterBattle, progressAfterBattle] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId: testUser.id } }),
      prisma.campaignProgress.findMany({ where: { userId: testUser.id } }),
    ]);
    expect(profileAfterBattle?.pokedollars).toBe(40);
    expect(progressAfterBattle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stageId: "bachelor-1-stage-1", isCompleted: true }),
        expect.objectContaining({ stageId: "bachelor-1-stage-2", isCompleted: false }),
      ]),
    );

    // Persistance après reconnexion, pas seulement après rafraîchissement client.
    await page.goto("/logout");
    await page.getByRole("button", { name: "Confirmer la déconnexion" }).click();
    await expect(page).toHaveURL(/\/login\?loggedOut=1$/);
    await page.waitForLoadState("networkidle");
    await login(page, testUser);

    await expect(page.getByLabel("40 Pokédollars")).toBeVisible();

    await page.goto("/team");
    await expect(page.getByRole("button", { name: /: Pikachu,/ })).toBeVisible();

    // Après une vraie reconnexion (nouveau montage), l'écran présente par
    // défaut la prochaine étape recommandée (désormais l'étape 2, débloquée) —
    // pas l'étape 1 rejouée. La preuve de persistance est la progression
    // elle-même : le compteur d'épreuves réussies et l'étape 2 accessible.
    await page.goto("/campaign");
    await expect(page.getByLabel(/1 étapes? terminées? sur \d+/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Lancer le combat : Laboratoire Normal - Étape 2/ }),
    ).toBeVisible();
  });
});

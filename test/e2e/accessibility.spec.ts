import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { prisma } from "./helpers/prisma";
import {
  createApplicationTestUser,
  deleteApplicationTestUser,
  E2E_PASSWORD,
  type ApplicationTestUser,
} from "./helpers/onboarding-user";

/** Connecte un joueur de test sans dépendre de l'envoi d'e-mail. */
async function loginApplicationUser(
  page: Page,
  user: ApplicationTestUser,
): Promise<void> {
  // Cette suite vérifie l'accessibilité des écrans protégés, pas le formulaire
  // de connexion. Passer par l'API évite une soumission native avant que React
  // ait terminé son hydratation sur un premier démarrage du serveur de test.
  await page.goto("/login");
  const response = await page.request.post("/api/auth/sign-in/email", {
    data: {
      email: user.email,
      password: E2E_PASSWORD,
      rememberMe: true,
    },
    headers: {
      Origin: new URL(page.url()).origin,
    },
  });

  expect(response.ok()).toBe(true);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("Contrôles d'accessibilité automatisés avec axe-core (T-US14-03)", () => {
  test("Vérifie l'accessibilité de la page d'accueil (Landing / Accueil)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("Vérifie l'accessibilité du formulaire de connexion (/login)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("Vérifie l'accessibilité du formulaire d'inscription (/register)", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.waitForLoadState("domcontentloaded");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test.describe("Écrans connectés de l'application", () => {
    let testUser: ApplicationTestUser | undefined;

    test.beforeEach(async () => {
      testUser = await createApplicationTestUser();
    });

    test.afterEach(async () => {
      await deleteApplicationTestUser(testUser);
      testUser = undefined;
    });

    test.afterAll(async () => {
      await prisma.$disconnect();
    });

    const PROTECTED_ROUTES = [
      { path: "/dashboard", name: "Tableau de bord" },
      { path: "/campaign", name: "Campagne" },
      { path: "/training", name: "Entraînement" },
      { path: "/team", name: "Gestion d'équipe" },
      { path: "/gacha", name: "Boutique Gacha" },
    ];

    for (const route of PROTECTED_ROUTES) {
      test(`Vérifie l'accessibilité de l'écran ${route.name} (${route.path})`, async ({
        page,
      }) => {
        if (!testUser) throw new Error("USER_NOT_INITIALIZED");
        await loginApplicationUser(page, testUser);

        await page.goto(route.path);
        await page.waitForLoadState("networkidle");

        const accessibilityScanResults = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
      });
    }
  });
});

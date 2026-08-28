import { expect, test, type Locator, type Page } from "@playwright/test";

import { prisma } from "../../src/lib/prisma";
import {
  createApplicationTestUser,
  deleteApplicationTestUser,
  E2E_PASSWORD,
  type ApplicationTestUser,
} from "./helpers/onboarding-user";

// Une seule table pilote les routes, titres et libellés contrôlés dans chaque
// scénario afin d'éviter qu'un parcours soit oublié lors d'une évolution.
const APPLICATION_AREAS = [
  { href: "/campaign", heading: "Campagne", navigationLabel: "Campagne" },
  {
    href: "/training",
    heading: "Entraînement",
    navigationLabel: "Entraînement",
  },
  {
    href: "/team",
    heading: "Gestion d'équipe",
    navigationLabel: "Équipe",
  },
  {
    href: "/gacha",
    heading: "Boutique gacha",
    navigationLabel: "Gacha",
  },
] as const;

// Ces formats représentent le petit ordinateur, le portable courant et
// l'écran de bureau retenus pour le MVP. Les téléphones restent hors périmètre.
const SUPPORTED_DESKTOP_VIEWPORTS = [
  { label: "petit ordinateur", width: 1024, height: 768 },
  { label: "ordinateur portable", width: 1366, height: 768 },
  { label: "écran de bureau", width: 1920, height: 1080 },
] as const;

/** Connecte un joueur déjà onboardé sans dépendre d'un envoi Resend. */
async function loginApplicationUser(
  page: Page,
  user: ApplicationTestUser,
): Promise<void> {
  await page.goto("/login");
  await page
    .getByLabel("Adresse e-mail ou nom d'utilisateur")
    .fill(user.email);
  await page.getByRole("textbox", { name: "Mot de passe" }).fill(E2E_PASSWORD);

  // Attendre l'hydratation évite que le formulaire soit soumis nativement
  // avant que le client Better Auth ait attaché son gestionnaire.
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Échoue clairement si la fixture attendue n'a pas pu être préparée. */
function requireApplicationTestUser(
  user: ApplicationTestUser | undefined,
): ApplicationTestUser {
  if (!user) {
    throw new Error("APPLICATION_TEST_USER_MISSING");
  }

  return user;
}

/**
 * Reproduit une navigation Tab réelle jusqu'à la cible. La limite empêche une
 * régression du focus de transformer le test en boucle infinie.
 */
async function focusWithKeyboard(
  page: Page,
  target: Locator,
  maximumTabs = 24,
): Promise<void> {
  for (let index = 0; index < maximumTabs; index += 1) {
    await page.keyboard.press("Tab");
    const reachedTarget = await target.evaluate(
      (element) => element === document.activeElement,
    );

    if (reachedTarget) return;
  }

  throw new Error("KEYBOARD_TARGET_NOT_REACHED");
}

/** Vérifie que l'élément actif possède un indicateur visuel perceptible. */
async function expectVisibleFocus(target: Locator): Promise<void> {
  await expect(target).toBeFocused();
  const outline = await target.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    };
  });

  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThan(0);
}

test.describe("navigation principale de l'application", () => {
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

  test("parcourt les quatre espaces et revient à l'accueil uniquement au clavier", async ({
    page,
  }) => {
    const user = requireApplicationTestUser(testUser);
    await loginApplicationUser(page, user);

    for (const area of APPLICATION_AREAS) {
      const card = page.locator(`a.dashboard-mode-card[href="${area.href}"]`);

      await focusWithKeyboard(page, card);
      await expectVisibleFocus(card);
      await page.keyboard.press("Enter");

      await expect(page).toHaveURL(new RegExp(`${area.href}$`));
      await expect(
        page.getByRole("heading", { name: area.heading, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", {
          name: area.navigationLabel,
          exact: true,
        }),
      ).toHaveAttribute("aria-current", "page");

      const backLink = page.getByRole("link", {
        name: "Retour à l'accueil",
      });
      await focusWithKeyboard(page, backLink);
      await expectVisibleFocus(backLink);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/dashboard$/);
    }
  });

  test("respecte l'historique du navigateur", async ({ page }) => {
    const user = requireApplicationTestUser(testUser);
    await loginApplicationUser(page, user);

    // Un parcours représentatif suffit ici : les quatre destinations utilisent
    // les mêmes composants Next Link et le même lien de retour.
    await page.locator('a.dashboard-mode-card[href="/campaign"]').click();
    await expect(page).toHaveURL(/\/campaign$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole("heading", { name: new RegExp(user.username) }),
    ).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/campaign$/);
  });

  test("garde les quatre parcours accessibles aux trois tailles d'écran", async ({
    page,
  }) => {
    const user = requireApplicationTestUser(testUser);

    // Une seule connexion est réutilisée pour toutes les tailles. Répéter la
    // connexion pour chaque viewport déclencherait légitimement la limitation
    // de requêtes de Better Auth et ne testerait pas davantage le responsive.
    await page.setViewportSize(SUPPORTED_DESKTOP_VIEWPORTS[0]);
    await loginApplicationUser(page, user);

    for (const viewport of SUPPORTED_DESKTOP_VIEWPORTS) {
      await test.step(
        `${viewport.label} (${viewport.width}x${viewport.height})`,
        async () => {
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height,
          });
          await expect(page.locator(".mobile-unsupported")).toBeHidden();

          // Aucun contenu ne doit imposer un défilement horizontal, même
          // lorsque les cartes passent sur deux colonnes à faible largeur.
          const pageWidth = await page.evaluate(() => ({
            client: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
          }));
          expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client);

          for (const area of APPLICATION_AREAS) {
            const card = page.locator(
              `a.dashboard-mode-card[href="${area.href}"]`,
            );
            await expect(card).toBeVisible();
            await card.scrollIntoViewIfNeeded();

            const bounds = await card.boundingBox();
            if (!bounds) {
              throw new Error(`APPLICATION_CARD_NOT_RENDERED:${area.href}`);
            }

            expect(bounds.x).toBeGreaterThanOrEqual(-1);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(
              viewport.width + 1,
            );
          }
        },
      );
    }
  });
});

test("affiche l'avertissement prévu sur un téléphone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  // Le mobile est volontairement hors MVP : le contenu du jeu doit être
  // masqué au profit d'un message explicite, et non devenir inutilisable.
  await expect(page.locator(".desktop-application")).toBeHidden();
  await expect(page.locator(".mobile-unsupported")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Le jeu arrive sur grand écran" }),
  ).toBeVisible();
});

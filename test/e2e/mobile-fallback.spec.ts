import { expect, test } from "@playwright/test";

test.describe("fallback pour les appareils mobiles non pris en charge", () => {
  test("masque le jeu et propose la landing page", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".desktop-application")).toBeHidden();
    await expect(page.locator(".mobile-unsupported")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Le jeu arrive sur grand écran" }),
    ).toBeVisible();
    await expect(
      page.getByText("HEIG Odyssey n'est pas encore disponible sur mobile."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Retour à la landing page" }),
    ).toHaveAttribute("href", "https://heig-odyssey.online");
  });
});

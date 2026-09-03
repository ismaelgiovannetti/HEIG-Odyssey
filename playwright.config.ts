import { defineConfig, devices } from "@playwright/test";
import nextEnvironment from "@next/env";

const { loadEnvConfig } = nextEnvironment;

// Playwright et Prisma s'exécutent hors de Next.js : les variables locales
// doivent donc être chargées explicitement avant l'import des tests.
loadEnvConfig(process.cwd());

const playwrightPort = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${playwrightPort}`;

export default defineConfig({
  testDir: "./test/e2e",
  outputDir: "./test-results/playwright",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  failOnFlakyTests: Boolean(process.env.CI),
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    // Un port dédié empêche de tester par erreur un ancien conteneur local
    // qui occuperait déjà le port 3000.
    command: `npm run dev -- --hostname 127.0.0.1 --port ${playwrightPort}`,
    url: `${baseURL}/api/health`,
    // Réutiliser un ancien processus masque les serveurs bloqués et peut faire
    // attendre Playwright indéfiniment avant même la découverte des tests.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // Ces valeurs sont réservées au serveur local éphémère. Les données E2E
      // sont créées directement en base : aucun e-mail Resend n'est envoyé.
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ??
        "playwright-only-auth-secret-at-least-32-characters",
      BETTER_AUTH_URL: baseURL,
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_DIST_DIR: ".next-playwright",
      RESEND_API_KEY: process.env.RESEND_API_KEY ?? "re_playwright_placeholder",
      RESEND_FROM_EMAIL:
        process.env.RESEND_FROM_EMAIL ??
        "HEIG Odyssey <noreply@heig-odyssey.online>",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/accessibility\.spec\.ts/, /mobile-fallback\.spec\.ts/],
    },
    {
      name: "mobile-fallback",
      use: { ...devices["Pixel 7"], browserName: "chromium" },
      testMatch: /mobile-fallback\.spec\.ts/,
    },
    {
      name: "accessibility",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /accessibility\.spec\.ts/,
    },
  ],
});

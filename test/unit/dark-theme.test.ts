import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Lit les sources qui définissent le thème des deux déploiements du projet. */
function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const applicationLayout = readSource("src/app/layout.tsx");
const applicationStyles = readSource("src/app/globals.css");
const landingHtml = readSource("landing-page/index.html");
const landingStyles = [
  ...landingHtml.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g),
]
  .map(([, href]) => href.split("?")[0])
  .map((href) => readSource(`landing-page/${href}`))
  .join("\n");
const landingScript = readSource("landing-page/js/main.js");

describe("palette sombre unique", () => {
  it("déclare uniquement le color scheme sombre", () => {
    expect(applicationStyles).toMatch(/:root\s*\{[\s\S]*?color-scheme:\s*dark/);
    expect(landingStyles).toMatch(/:root\s*\{[\s\S]*?color-scheme:\s*dark/);
    expect(applicationStyles).not.toContain("color-scheme: light");
    expect(landingStyles).not.toContain("color-scheme: light");
  });

  it("n'expose plus de sélecteur ni de préférence de thème", () => {
    const themeSources = [
      applicationLayout,
      applicationStyles,
      landingHtml,
      landingStyles,
      landingScript,
    ].join("\n");

    expect(themeSources).not.toMatch(
      /heig-odyssey-theme|data-theme|theme-toggle|themeToggle|ThemeToggle/,
    );
  });

  it("annonce la palette sombre aux navigateurs", () => {
    expect(applicationLayout).toContain('colorScheme: "dark"');
    expect(applicationLayout).toContain('themeColor: "#10141A"');
    expect(landingHtml).toMatch(
      /<meta name="theme-color" content="#10141A"\s*\/?>/,
    );
    expect(landingHtml).toMatch(
      /<meta name="color-scheme" content="dark"\s*\/?>/,
    );
  });
});

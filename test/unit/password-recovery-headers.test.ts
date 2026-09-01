import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("en-têtes de la page de réinitialisation", () => {
  it("protège l'URL contenant le jeton contre les fuites et le cache", async () => {
    if (typeof nextConfig.headers !== "function") {
      throw new Error("NEXT_SECURITY_HEADERS_MISSING");
    }

    const rules = await nextConfig.headers();
    const resetRule = rules.find((rule) => rule.source === "/reset-password");

    expect(resetRule?.headers).toEqual(
      expect.arrayContaining([
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Cache-Control", value: "no-store" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ]),
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  ACCESS_ROUTES,
  getAccessDestination,
  getPlayerAccessState,
  getSafeGameDestination,
} from "@/lib/auth/route-access";

describe("matrice d'accès aux routes", () => {
  // La matrice pure est testée indépendamment de Next.js et de PostgreSQL afin
  // qu'une régression de routage soit rapide à identifier.
  it("distingue les trois états à partir de la session et du profil", () => {
    expect(getPlayerAccessState(undefined, undefined)).toBe("anonymous");
    expect(getPlayerAccessState("user-1", undefined)).toBe(
      "onboarding-required",
    );
    expect(getPlayerAccessState("user-1", false)).toBe("onboarding-required");
    expect(getPlayerAccessState("user-1", true)).toBe("ready");
  });

  // La destination demandée ne peut jamais contourner l'étape imposée par
  // l'état du compte.
  it.each([
    ["anonymous", ACCESS_ROUTES.login],
    ["onboarding-required", ACCESS_ROUTES.onboarding],
    ["ready", ACCESS_ROUTES.dashboard],
  ] as const)("redirige l'état %s vers %s", (state, expectedDestination) => {
    expect(getAccessDestination(state)).toBe(expectedDestination);
  });

  it("conserve une destination interne pour un joueur prêt", () => {
    expect(getAccessDestination("ready", "/campaign?world=bachelor-1")).toBe(
      "/campaign?world=bachelor-1",
    );
  });

  // Ces routes pourraient renvoyer vers le garde et multiplier les
  // redirections. Elles reviennent toutes à une destination de jeu stable.
  it.each([
    "/login",
    "/signup",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
    "/logout",
    "/auth/continue",
    "/onboarding",
  ])("refuse la destination hors jeu %s", (destination) => {
    expect(getSafeGameDestination(destination)).toBe(ACCESS_ROUTES.dashboard);
    expect(getSafeGameDestination(`${destination}?next=/campaign`)).toBe(
      ACCESS_ROUTES.dashboard,
    );
  });

  it.each(["https://malicious.example", "//malicious.example", "/%2fescape"])(
    "remplace la destination ambiguë %s",
    (destination) => {
      expect(getSafeGameDestination(destination)).toBe(ACCESS_ROUTES.dashboard);
    },
  );
});

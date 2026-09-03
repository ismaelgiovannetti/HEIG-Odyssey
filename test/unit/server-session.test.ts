import { beforeEach, describe, expect, it, vi } from "vitest";

const serverSessionMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  headers: vi.fn(),
}));

// Le marqueur server-only n'a aucun comportement à reproduire dans Vitest.
vi.mock("server-only", () => ({}));

// React cache est neutralisé pour que chaque test maîtrise son propre résultat.
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    cache: <T extends (...arguments_: never[]) => unknown>(callback: T) =>
      callback,
  };
});

vi.mock("next/headers", () => ({
  headers: serverSessionMocks.headers,
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: serverSessionMocks.getSession,
    },
  },
}));

import { getServerSession } from "@/lib/auth/server-session";

describe("lecture de la session serveur", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("transmet les en-têtes de la requête à Better Auth", async () => {
    const requestHeaders = new Headers({
      cookie: "better-auth.session_token=test",
    });
    const validSession = { user: { id: "user-1", name: "Kim" } };
    serverSessionMocks.headers.mockResolvedValue(requestHeaders);
    serverSessionMocks.getSession.mockResolvedValue(validSession);

    await expect(getServerSession()).resolves.toBe(validSession);
    expect(serverSessionMocks.getSession).toHaveBeenCalledWith({
      headers: requestHeaders,
    });
  });

  it("conserve une session absente comme résultat anonyme", async () => {
    const requestHeaders = new Headers();
    serverSessionMocks.headers.mockResolvedValue(requestHeaders);
    serverSessionMocks.getSession.mockResolvedValue(null);

    await expect(getServerSession()).resolves.toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const guardMocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  getServerSession: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    cache: <T extends (...arguments_: never[]) => unknown>(callback: T) =>
      callback,
  };
});

vi.mock("next/navigation", () => ({
  redirect: guardMocks.redirect,
}));

vi.mock("@/lib/auth/server-session", () => ({
  getServerSession: guardMocks.getServerSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: guardMocks.findUser,
    },
  },
}));

import {
  isCurrentSessionAdmin,
  requireAdminSession,
} from "@/lib/auth/admin-guard";

describe("admin guard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    guardMocks.redirect.mockImplementation((destination: string) => {
      throw new Error(`NEXT_REDIRECT:${destination}`);
    });
  });

  describe("requireAdminSession", () => {
    it("redirige vers /login si aucune session", async () => {
      guardMocks.getServerSession.mockResolvedValue(null);

      await expect(requireAdminSession()).rejects.toThrow(
        "NEXT_REDIRECT:/login",
      );
      expect(guardMocks.findUser).not.toHaveBeenCalled();
    });

    it("redirige vers /dashboard si l'utilisateur a le rôle 'user'", async () => {
      guardMocks.getServerSession.mockResolvedValue({
        user: { id: "user-123" },
      });
      guardMocks.findUser.mockResolvedValue({
        id: "user-123",
        name: "Test User",
        email: "test@example.com",
        role: "user",
      });

      await expect(requireAdminSession()).rejects.toThrow(
        "NEXT_REDIRECT:/dashboard",
      );
    });

    it("autorise et retourne la session si l'utilisateur est admin", async () => {
      guardMocks.getServerSession.mockResolvedValue({
        user: { id: "admin-456" },
      });
      guardMocks.findUser.mockResolvedValue({
        id: "admin-456",
        name: "Admin Boss",
        email: "admin@heig-odyssey.ch",
        role: "admin",
      });

      const admin = await requireAdminSession();
      expect(admin).toEqual({
        userId: "admin-456",
        name: "Admin Boss",
        email: "admin@heig-odyssey.ch",
        role: "admin",
      });
    });
  });

  describe("isCurrentSessionAdmin", () => {
    it("retourne false si non connecté", async () => {
      guardMocks.getServerSession.mockResolvedValue(null);
      await expect(isCurrentSessionAdmin()).resolves.toBe(false);
    });

    it("retourne false si rôle non admin", async () => {
      guardMocks.getServerSession.mockResolvedValue({ user: { id: "user-1" } });
      guardMocks.findUser.mockResolvedValue({ role: "user" });
      await expect(isCurrentSessionAdmin()).resolves.toBe(false);
    });

    it("retourne true si rôle admin", async () => {
      guardMocks.getServerSession.mockResolvedValue({
        user: { id: "admin-1" },
      });
      guardMocks.findUser.mockResolvedValue({ role: "admin" });
      await expect(isCurrentSessionAdmin()).resolves.toBe(true);
    });
  });
});

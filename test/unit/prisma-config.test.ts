import { afterEach, describe, expect, it, vi } from "vitest";

// Le .env local ne doit pas masquer l'absence de DATABASE_URL en CI.
vi.mock("dotenv/config", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("configuration Prisma", () => {
  it("se charge sans DATABASE_URL pour la génération du client à l'installation", async () => {
    vi.stubEnv("DATABASE_URL", undefined);

    await expect(import("../../prisma.config")).resolves.toHaveProperty(
      "default",
    );
  });
});

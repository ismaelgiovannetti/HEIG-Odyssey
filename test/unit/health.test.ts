import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/events/redis-client";
import { GET } from "@/app/api/health/route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

const { ping } = vi.hoisted(() => ({
  ping: vi.fn(),
}));

vi.mock("@/lib/events/redis-client", () => ({
  getRedisClient: vi.fn(() => ({ ping })),
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);
    ping.mockResolvedValue("PONG");
  });

  it("reports healthy dependencies without caching the response", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      services: {
        database: "ok",
        redis: "ok",
      },
    });
    expect(getRedisClient).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "PostgreSQL",
      () =>
        vi
          .mocked(prisma.$queryRaw)
          .mockRejectedValue(new Error("database offline")),
    ],
    ["Redis", () => ping.mockRejectedValue(new Error("redis offline"))],
  ])(
    "returns 503 when %s is unavailable",
    async (_service, makeUnavailable) => {
      makeUnavailable();

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.status).toBe("degraded");
      expect(Object.values(body.services)).toContain("unavailable");
    },
  );
});

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/events/redis-client";

export async function GET() {
  const [database, redis] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    getRedisClient().ping(),
  ]);
  const services = {
    database: database.status === "fulfilled" ? "ok" : "unavailable",
    redis: redis.status === "fulfilled" ? "ok" : "unavailable",
  };
  const healthy = Object.values(services).every((status) => status === "ok");

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      services,
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

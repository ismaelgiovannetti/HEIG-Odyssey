import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchAdminDashboardData } from "@/lib/admin/admin-analytics-service";
import { getRequestId, logger } from "@/lib/logger";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user.id) {
      return json({ success: false, error: "Non authentifié." }, 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || user.role !== "admin") {
      return json(
        {
          success: false,
          error: "Accès refusé. Privilèges administrateur requis.",
        },
        403,
      );
    }

    const data = await fetchAdminDashboardData();

    return json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error(
      "Échec de la récupération des données admin",
      { requestId, action: "admin.stats" },
      error,
    );
    return json(
      {
        success: false,
        error:
          "Erreur serveur lors de la récupération des données d'administration.",
      },
      500,
    );
  }
}

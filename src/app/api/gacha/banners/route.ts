import { NextResponse } from "next/server";
import { getActiveBanners } from "@/lib/gacha/gacha-service";
import { getRequestId, logger } from "@/lib/logger";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const banners = getActiveBanners();
    return NextResponse.json({
      success: true,
      data: banners,
    });
  } catch (error) {
    logger.error(
      "Échec du chargement des bannières",
      { requestId, action: "gacha.banners.list" },
      error,
    );
    return NextResponse.json(
      { success: false, error: "Impossible de récupérer les bannières." },
      { status: 500 },
    );
  }
}

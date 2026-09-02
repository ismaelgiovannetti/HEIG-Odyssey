import { NextResponse } from "next/server";
import { getActiveBanners } from "@/lib/gacha/gacha-service";

export async function GET() {
  try {
    const banners = getActiveBanners();
    return NextResponse.json({
      success: true,
      data: banners,
    });
  } catch (error) {
    console.error("[API /api/gacha/banners] Erreur :", error);
    return NextResponse.json(
      { success: false, error: "Impossible de récupérer les bannières." },
      { status: 500 }
    );
  }
}

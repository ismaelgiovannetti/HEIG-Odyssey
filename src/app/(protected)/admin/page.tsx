import type { Metadata } from "next";
import { ApplicationShell } from "@/components/application/application-shell";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { fetchAdminDashboardData } from "@/lib/admin/admin-analytics-service";
import { getApplicationPlayer } from "@/lib/player/application-player";

export const metadata: Metadata = {
  title: "Administration & Statistiques - HEIG Odyssey",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // 1. Barrière de sécurité : redirige automatiquement si l'utilisateur n'est pas admin
  await requireAdminSession();

  // 2. Contexte joueur pour le shell applicatif
  const player = await getApplicationPlayer();

  // 3. Récupération des métriques complètes
  const data = await fetchAdminDashboardData();

  return (
    <ApplicationShell
      activeSection="admin"
      playerName={player.name}
      pokedollars={player.pokedollars}
      role={player.role}
    >
      <AdminDashboard initialData={data} />
    </ApplicationShell>
  );
}

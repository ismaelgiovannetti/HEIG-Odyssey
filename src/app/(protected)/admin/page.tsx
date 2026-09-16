import type { Metadata } from "next";
import {
  ApplicationShell,
  type ApplicationSection,
} from "@/components/application/application-shell";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { fetchAdminDashboardData } from "@/lib/admin/admin-analytics-service";
import { getApplicationPlayer } from "@/lib/player/application-player";

export const metadata: Metadata = {
  title: "Administration & Statistiques - HEIG Odyssey",
};

export const dynamic = "force-dynamic";

interface AdminPageProps {
  searchParams?: Promise<{ tab?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  // 1. Barrière de sécurité : redirige automatiquement si l'utilisateur n'est pas admin
  await requireAdminSession();

  // 2. Contexte joueur pour le shell applicatif (avec permission admin)
  const player = await getApplicationPlayer({ allowAdmin: true });

  // 3. Récupération des métriques complètes
  const data = await fetchAdminDashboardData();

  // 4. Onglet actif selon le paramètre URL
  const resolvedParams = searchParams ? await searchParams : undefined;
  const rawTab = resolvedParams?.tab;
  const validSections: ApplicationSection[] = [
    "overview",
    "players",
    "combats",
    "gacha",
    "system",
  ];
  const activeSection: ApplicationSection =
    rawTab && validSections.includes(rawTab as ApplicationSection)
      ? (rawTab as ApplicationSection)
      : "overview";

  return (
    <ApplicationShell
      activeSection={activeSection}
      playerName={player.name}
      pokedollars={player.pokedollars}
      role={player.role}
    >
      <AdminDashboard initialData={data} activeSection={activeSection} />
    </ApplicationShell>
  );
}

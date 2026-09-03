import type { Metadata } from "next";

import "../../battle.css";

import { ApplicationShell } from "@/components/application/application-shell";
import { CampaignMap } from "@/components/campaign/campaign-map";
import { getCampaignProgressForUser } from "@/lib/campaign/campaign-service";
import { getApplicationPlayer } from "@/lib/player/application-player";

export const metadata: Metadata = {
  title: "Campagne - HEIG Odyssey",
  description:
    "Explorez les 8 mondes de HEIG Odyssey, affrontez les dresseurs académiques et remportez les épreuves jusqu'au Doctorat.",
};

/**
 * Page principale de progression de la campagne solo.
 * Charge l'état persistant du joueur connecté et restitue la carte interactive.
 */
export default async function CampaignPage() {
  const player = await getApplicationPlayer();
  const overview = await getCampaignProgressForUser(player.id);

  return (
    <ApplicationShell
      activeSection="campaign"
      playerName={player.name}
      pokedollars={player.pokedollars}
    >
      <CampaignMap overview={overview} />
    </ApplicationShell>
  );
}

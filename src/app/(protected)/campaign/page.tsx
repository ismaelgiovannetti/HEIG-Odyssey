import type { Metadata } from "next";
import { Map } from "lucide-react";

import { ApplicationShell } from "@/components/application/application-shell";
import { ModePlaceholder } from "@/components/application/mode-placeholder";
import { getApplicationPlayer } from "@/lib/player/application-player";

export const metadata: Metadata = {
  title: "Campagne - HEIG Odyssey",
};

/** Espace réservé à la progression dans les huit mondes de la campagne. */
export default async function CampaignPage() {
  const player = await getApplicationPlayer();

  return (
    <ApplicationShell
      activeSection="campaign"
      playerName={player.name}
      pokedollars={player.pokedollars}
    >
      <ModePlaceholder
        eyebrow="Mode aventure"
        title="Campagne"
        description="Parcourez les mondes Bachelor, Master et Doctorat, puis affrontez leurs dresseurs et leurs Boss."
        nextStep="La carte de progression de la campagne sera bientôt disponible."
        icon={Map}
        accent="campaign"
      />
    </ApplicationShell>
  );
}

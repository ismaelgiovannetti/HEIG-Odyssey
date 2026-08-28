import type { Metadata } from "next";
import { BrainCircuit } from "lucide-react";

import { ApplicationShell } from "@/components/application/application-shell";
import { ModePlaceholder } from "@/components/application/mode-placeholder";
import { getApplicationPlayer } from "@/lib/player/application-player";

export const metadata: Metadata = {
  title: "Entraînement - HEIG Odyssey",
};

/** Espace réservé aux combats procéduraux adaptés à l'équipe du joueur. */
export default async function TrainingPage() {
  const player = await getApplicationPlayer();

  return (
    <ApplicationShell
      activeSection="training"
      playerName={player.name}
      pokedollars={player.pokedollars}
    >
      <ModePlaceholder
        eyebrow="Progression ciblée"
        title="Entraînement"
        description="Testez votre équipe contre une IA random, heuristique ou expectiminimax et gagnez des récompenses adaptées."
        nextStep="Le choix du niveau d'IA sera bientôt disponible."
        icon={BrainCircuit}
        accent="training"
      />
    </ApplicationShell>
  );
}

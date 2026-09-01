import type { Metadata } from "next";

import { ApplicationShell } from "@/components/application/application-shell";
import { TrainingHub } from "@/components/training/training-hub";
import { getApplicationPlayer } from "@/lib/player/application-player";

export const metadata: Metadata = {
  title: "Entraînement - HEIG Odyssey",
};

/** Préparation et lancement des combats procéduraux adaptés à l'équipe. */
export default async function TrainingPage() {
  const player = await getApplicationPlayer();

  return (
    <ApplicationShell
      activeSection="training"
      playerName={player.name}
      pokedollars={player.pokedollars}
    >
      <TrainingHub playerName={player.name} />
    </ApplicationShell>
  );
}

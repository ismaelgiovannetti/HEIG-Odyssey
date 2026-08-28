import type { Metadata } from "next";
import { UsersRound } from "lucide-react";

import { ApplicationShell } from "@/components/application/application-shell";
import { ModePlaceholder } from "@/components/application/mode-placeholder";
import { getApplicationPlayer } from "@/lib/player/application-player";

export const metadata: Metadata = {
  title: "Gestion d'équipe - HEIG Odyssey",
};

/** Espace réservé à la collection et à la composition de l'équipe active. */
export default async function TeamPage() {
  const player = await getApplicationPlayer();

  return (
    <ApplicationShell
      activeSection="team"
      playerName={player.name}
      pokedollars={player.pokedollars}
    >
      <ModePlaceholder
        eyebrow="Collection du dresseur"
        title="Gestion d'équipe"
        description="Consultez votre collection et composez librement une équipe active comprenant jusqu'à six Pokémon."
        nextStep="La collection interactive sera bientôt disponible."
        icon={UsersRound}
        accent="team"
      />
    </ApplicationShell>
  );
}

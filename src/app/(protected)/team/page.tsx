import type { Metadata } from "next";

import { ApplicationShell } from "@/components/application/application-shell";
import { TeamManager } from "@/components/team/team-manager";
import { getApplicationPlayer } from "@/lib/player/application-player";

export const metadata: Metadata = {
  title: "Gestion d'équipe - HEIG Odyssey",
};

/** La garde serveur reste obligatoire, même si la collection est chargée côté client. */
export default async function TeamPage() {
  const player = await getApplicationPlayer();

  return (
    <ApplicationShell
      activeSection="team"
      playerName={player.name}
      pokedollars={player.pokedollars}
    >
      {/* Le PC affiche le nom de la session serveur, comme l'en-tête du jeu. */}
      <TeamManager playerName={player.name} />
    </ApplicationShell>
  );
}

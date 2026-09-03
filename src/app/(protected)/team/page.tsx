import type { Metadata } from "next";

import { ApplicationShell } from "@/components/application/application-shell";
import { MenuSoundtrack } from "@/components/audio/menu-soundtrack";
import { TeamManager } from "@/components/team/team-manager";
import { MENU_TRACKS } from "@/lib/audio/soundtrack-tracks";
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
      <MenuSoundtrack trackId={MENU_TRACKS.team} />
      {/* Le PC affiche le nom de la session serveur, comme l'en-tête du jeu. */}
      <TeamManager playerName={player.name} />
    </ApplicationShell>
  );
}

import type { Metadata } from "next";
import { Dices } from "lucide-react";

import { ApplicationShell } from "@/components/application/application-shell";
import { ModePlaceholder } from "@/components/application/mode-placeholder";
import { getApplicationPlayer } from "@/lib/player/application-player";

export const metadata: Metadata = {
  title: "Boutique gacha - HEIG Odyssey",
};

/** Espace réservé aux portails financés uniquement par la monnaie du jeu. */
export default async function GachaPage() {
  const player = await getApplicationPlayer();

  return (
    <ApplicationShell
      activeSection="gacha"
      playerName={player.name}
      pokedollars={player.pokedollars}
    >
      <ModePlaceholder
        eyebrow="Recrutement sans achat réel"
        title="Boutique gacha"
        description="Choisissez un portail et recrutez de nouveaux Pokémon avec les Pokédollars gagnés en jouant."
        nextStep="Les portails et leurs probabilités seront bientôt disponibles."
        icon={Dices}
        accent="gacha"
      />
    </ApplicationShell>
  );
}

import type { Metadata } from "next";

import { ApplicationShell } from "@/components/application/application-shell";
import { MenuSoundtrack } from "@/components/audio/menu-soundtrack";
import { GachaShop } from "@/components/gacha/gacha-shop";
import { MENU_TRACKS } from "@/lib/audio/soundtrack-tracks";
import type { GachaPreviewSpecies } from "@/components/gacha/gacha-preview-dialog";
import { loadSpecies } from "@/lib/content/loader";
import {
  determineSpeciesRarity,
  getActiveBanners,
} from "@/lib/gacha/gacha-service";
import { getApplicationPlayer } from "@/lib/player/application-player";

export const metadata: Metadata = {
  title: "Invocations Pokémon - HEIG Odyssey",
};

/** Boutique privée : le serveur fournit uniquement les portails actifs. */
export default async function GachaPage() {
  const player = await getApplicationPlayer();
  const banners = getActiveBanners();
  const species = loadSpecies();
  const previewSpecies: GachaPreviewSpecies[] = Array.from(
    new Set(banners.flatMap((banner) => banner.poolSpecies)),
  ).flatMap((speciesId) => {
    const pokemon = species.get(speciesId);
    return pokemon
      ? [
          {
            id: pokemon.id,
            name: pokemon.name,
            dexNumber: pokemon.dexNumber,
            rarity: determineSpeciesRarity(pokemon),
          },
        ]
      : [];
  });

  return (
    <ApplicationShell
      activeSection="gacha"
      playerName={player.name}
      pokedollars={player.pokedollars}
    >
      <MenuSoundtrack trackId={MENU_TRACKS.gacha} />
      <GachaShop
        banners={banners}
        initialBalance={player.pokedollars}
        previewSpecies={previewSpecies}
      />
    </ApplicationShell>
  );
}

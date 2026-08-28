import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  Dices,
  Map,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { ApplicationShell } from "@/components/application/application-shell";
import { SpriteProvider } from "@/components/SpriteProvider";
import { getSpecies } from "@/lib/content/loader";
import { getApplicationPlayer } from "@/lib/player/application-player";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Accueil du jeu - HEIG Odyssey",
};

// Ces données pilotent à la fois le texte, l'icône, la couleur et la route de
// chaque choix. Ajouter un futur mode ne demande ainsi pas de dupliquer le JSX.
const GAME_MODES = [
  {
    href: "/campaign",
    title: "Campagne",
    description:
      "Explorez huit mondes et affrontez leurs dresseurs jusqu'au Doctorat.",
    action: "Continuer l'aventure",
    icon: Map,
    className: "dashboard-mode-card dashboard-mode-card--campaign",
  },
  {
    href: "/training",
    title: "Entraînement",
    description:
      "Progressez avec des combats adaptés et trois profils d'intelligence artificielle.",
    action: "Choisir un entraînement",
    icon: BrainCircuit,
    className: "dashboard-mode-card dashboard-mode-card--training",
  },
  {
    href: "/team",
    title: "Gestion d'équipe",
    description:
      "Consultez votre collection et préparez jusqu'à six partenaires actifs.",
    action: "Composer mon équipe",
    icon: UsersRound,
    className: "dashboard-mode-card dashboard-mode-card--team",
  },
  {
    href: "/gacha",
    title: "Boutique gacha",
    description:
      "Recrutez via différents portails avec la monnaie gagnée en jouant.",
    action: "Voir les portails",
    icon: Dices,
    className: "dashboard-mode-card dashboard-mode-card--gacha",
  },
] as const;

/**
 * Accueil privé du jeu. Les quatre choix principaux et l'équipe active donnent
 * immédiatement au joueur les informations nécessaires pour poursuivre.
 */
export default async function DashboardPage() {
  const player = await getApplicationPlayer();

  // Seules les créatures placées dans l'équipe active sont nécessaires ici :
  // la collection complète appartient à l'espace de gestion d'équipe.
  const activePokemon = await prisma.userPokemon.findMany({
    where: {
      userId: player.id,
      teamPosition: { not: null },
    },
    orderBy: { teamPosition: "asc" },
    take: 6,
    select: {
      id: true,
      speciesId: true,
      nickname: true,
      level: true,
      teamPosition: true,
      isShiny: true,
    },
  });

  // Les six emplacements restent fixes pour que la composition soit lisible,
  // même lorsque le joueur commence avec un seul partenaire.
  const teamSlots = Array.from({ length: 6 }, (_, index) => {
    const position = index + 1;
    const pokemon = activePokemon.find(
      (member) => member.teamPosition === position,
    );

    if (!pokemon) {
      return { position, pokemon: null };
    }

    const species = getSpecies(pokemon.speciesId);
    return {
      position,
      pokemon: {
        ...pokemon,
        displayName: pokemon.nickname || species?.name || pokemon.speciesId,
      },
    };
  });

  return (
    <ApplicationShell
      activeSection="home"
      playerName={player.name}
      pokedollars={player.pokedollars}
    >
      <header className="dashboard-heading">
        <div>
          <p className="dashboard-heading__eyebrow">
            <ShieldCheck aria-hidden="true" size={16} />
            Progression chargée
          </p>
          <h1>Bienvenue, {player.name} !</h1>
          <p>Que souhaitez-vous faire aujourd&apos;hui ?</p>
        </div>

        <div
          className="dashboard-heading__status"
          aria-label="Résumé de l'équipe"
        >
          <strong>{activePokemon.length}/6</strong>
          <span>Pokémon dans l&apos;équipe</span>
        </div>
      </header>

      <section
        className="dashboard-modes"
        aria-labelledby="dashboard-modes-title"
      >
        <h2 className="visually-hidden" id="dashboard-modes-title">
          Choisir un espace
        </h2>
        {GAME_MODES.map(
          ({ href, title, description, action, icon: Icon, className }) => (
            <Link className={className} href={href} key={href}>
              <span className="dashboard-mode-card__icon" aria-hidden="true">
                <Icon size={34} strokeWidth={1.8} />
              </span>
              <span className="dashboard-mode-card__content">
                <strong>{title}</strong>
                <span>{description}</span>
              </span>
              <span className="dashboard-mode-card__action">
                {action}
                <ArrowRight aria-hidden="true" size={17} />
              </span>
            </Link>
          ),
        )}
      </section>

      <section
        className="dashboard-team"
        aria-labelledby="dashboard-team-title"
      >
        <div className="dashboard-team__heading">
          <div>
            <p>Formation active</p>
            <h2 id="dashboard-team-title">Mon équipe actuelle</h2>
          </div>
          <Link href="/team">
            Gérer l&apos;équipe
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>

        <div className="dashboard-team__slots">
          {teamSlots.map(({ position, pokemon }) => (
            <article
              className={
                pokemon
                  ? "dashboard-team-slot is-filled"
                  : "dashboard-team-slot"
              }
              key={position}
            >
              <span className="dashboard-team-slot__number">{position}</span>
              {pokemon ? (
                <>
                  <SpriteProvider
                    speciesId={pokemon.speciesId}
                    variant={pokemon.isShiny ? "front_shiny" : "front"}
                    alt={pokemon.displayName}
                    width={74}
                    height={74}
                  />
                  <strong>{pokemon.displayName}</strong>
                  <span>Niveau {pokemon.level}</span>
                </>
              ) : (
                <>
                  <span
                    className="dashboard-team-slot__empty"
                    aria-hidden="true"
                  >
                    +
                  </span>
                  <strong>Emplacement libre</strong>
                  <span>Ajoutez un Pokémon</span>
                </>
              )}
            </article>
          ))}
        </div>
      </section>
    </ApplicationShell>
  );
}

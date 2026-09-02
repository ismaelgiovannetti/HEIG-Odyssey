import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  Dices,
  MapPinned,
  Swords,
  Trophy,
  UsersRound,
} from "lucide-react";

import { ApplicationShell } from "@/components/application/application-shell";
import { SpriteProvider } from "@/components/SpriteProvider";
import {
  getCampaignStagePoint,
  getCampaignWorldMap,
} from "@/lib/campaign/campaign-map-config";
import { getCampaignProgressForUser } from "@/lib/campaign/campaign-service";
import { getSpecies } from "@/lib/content/loader";
import { getApplicationPlayer } from "@/lib/player/application-player";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Accueil du jeu - HEIG Odyssey",
};

const MAP_ZOOM = 2.05;

// Les deux accès compacts complètent l'équipe, qui dispose de sa propre ligne
// pour rendre les six partenaires visibles dès l'accueil.
const SECONDARY_GAME_MODES = [
  {
    href: "/training",
    title: "Entraînement",
    description:
      "Affrontez une équipe adaptée à votre niveau et choisissez votre difficulté.",
    action: "Préparer un combat",
    icon: BrainCircuit,
    className: "dashboard-mode-card--training",
  },
  {
    href: "/gacha",
    title: "Boutique gacha",
    description:
      "Recrutez de nouvelles créatures avec la monnaie gagnée en jouant.",
    action: "Voir les portails",
    icon: Dices,
    className: "dashboard-mode-card--gacha",
  },
] as const;

const shortWorldName = (name: string) => name.split(" - ")[0];

/**
 * Accueil privé du jeu. La moitié gauche reprend précisément la case active de
 * la campagne ; les trois autres destinations remplissent la moitié droite.
 */
export default async function DashboardPage() {
  const player = await getApplicationPlayer();
  const [campaign, activePokemon] = await Promise.all([
    getCampaignProgressForUser(player.id),
    prisma.userPokemon.findMany({
      where: {
        userId: player.id,
        // La carte d'accueil ignore toute position hors de l'équipe légale.
        teamPosition: { gte: 1, lte: 6 },
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
    }),
  ]);

  // Les six positions restent stables : un emplacement vide ne décale jamais
  // les autres Pokémon et conduit toujours vers le gestionnaire d'équipe.
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
  // La moyenne ne tient compte que des partenaires réellement présents dans
  // l'équipe active ; les emplacements libres ne diminuent donc pas le niveau.
  const averageTeamLevel = activePokemon.length
    ? Math.round(
        activePokemon.reduce((total, pokemon) => total + pokemon.level, 0) /
          activePokemon.length,
      )
    : null;
  const currentWorld = campaign.nextRecommendedStage
    ? (campaign.worlds.find(
        (world) => world.id === campaign.currentWorldId,
      ) ?? campaign.worlds[0])
    : (campaign.worlds.at(-1) ?? campaign.worlds[0]);

  // La première étape accessible est la position actuelle. Une campagne
  // terminée reste cadrée sur sa dernière arène au lieu d'afficher du vide.
  const currentStage =
    campaign.nextRecommendedStage ?? currentWorld?.stages.at(-1) ?? null;
  const currentStageIndex =
    currentWorld && currentStage
      ? Math.max(
          0,
          currentWorld.stages.findIndex(
            (stage) => stage.id === currentStage.id,
          ),
        )
      : 0;
  const currentPoint = getCampaignStagePoint(
    currentWorld?.id ?? "bachelor-1",
    currentStageIndex,
    currentWorld?.stages.length ?? 1,
  );
  const worldBoss = currentWorld?.stages.at(-1) ?? null;
  const currentMap = getCampaignWorldMap(
    currentWorld?.id ?? "bachelor-1",
  );
  const currentWorldProgress = currentWorld?.totalStagesCount
    ? Math.round(
        (currentWorld.completedStagesCount / currentWorld.totalStagesCount) *
          100,
      )
    : 0;
  const totalCampaignProgress = campaign.totalStages
    ? Math.round(
        (campaign.totalCompletedStages / campaign.totalStages) * 100,
      )
    : 0;

  // L'image conserve son ratio natif. Sa translation place les coordonnées
  // de la plateforme exactement au centre de la fenêtre avant le zoom.
  const focusedMapStyle = {
    width: `${MAP_ZOOM * 100}%`,
    left: "50%",
    top: "50%",
    transform: `translate(-${currentPoint.left}%, -${currentPoint.top}%)`,
  };

  return (
    <ApplicationShell
      activeSection="home"
      playerName={player.name}
      pokedollars={player.pokedollars}
    >
      <div className="dashboard-home">
        <header className="dashboard-heading">
          <h1>Bienvenue, {player.name} !</h1>
          <p>Choisissez votre prochaine destination.</p>
        </header>

        <section
          className="dashboard-mode-layout"
          aria-labelledby="dashboard-modes-title"
        >
          <h2 className="visually-hidden" id="dashboard-modes-title">
            Choisir un espace
          </h2>

          <Link
            className="dashboard-mode-card dashboard-campaign-card"
            href="/campaign"
          >
            <span
              className="dashboard-campaign-card__map"
              style={{ backgroundImage: `url(${currentMap})` }}
            >
              <Image
                alt={`Carte de ${currentWorld?.name ?? "la campagne"}, centrée sur ${currentStage?.name ?? "la dernière étape"}`}
                className="dashboard-campaign-card__map-image"
                height={941}
                priority
                src={currentMap}
                style={focusedMapStyle}
                width={1672}
              />
              <span
                aria-hidden="true"
                className="dashboard-campaign-card__position"
              >
                <MapPinned size={24} strokeWidth={2.4} />
              </span>
              <span className="dashboard-campaign-card__location">
                <span>Position actuelle</span>
                <strong>{currentStage?.name ?? "Cursus terminé"}</strong>
              </span>
            </span>

            <span className="dashboard-campaign-card__content">
              <span className="dashboard-campaign-card__heading">
                <span>
                  <span className="dashboard-campaign-card__eyebrow">
                    Campagne
                  </span>
                  <strong>
                    {currentWorld
                      ? shortWorldName(currentWorld.name)
                      : "Parcours terminé"}
                  </strong>
                </span>
                <span className="dashboard-campaign-card__progressions">
                  <span className="dashboard-campaign-card__progression">
                    <span className="dashboard-campaign-card__progress-copy">
                      <span>Monde actuel</span>
                      <strong>
                        {currentWorld?.completedStagesCount ?? 0}/
                        {currentWorld?.totalStagesCount ?? 0}
                      </strong>
                    </span>
                    <span
                      aria-label={`Progression du monde actuel : ${currentWorldProgress} %`}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={currentWorldProgress}
                      className="dashboard-campaign-card__progress"
                      role="progressbar"
                    >
                      <span style={{ width: `${currentWorldProgress}%` }} />
                    </span>
                  </span>
                  <span className="dashboard-campaign-card__progression">
                    <span className="dashboard-campaign-card__progress-copy">
                      <span>Campagne totale</span>
                      <strong>
                        {campaign.totalCompletedStages}/{campaign.totalStages}
                      </strong>
                    </span>
                    <span
                      aria-label={`Progression totale de la campagne : ${totalCampaignProgress} %`}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={totalCampaignProgress}
                      className="dashboard-campaign-card__progress"
                      role="progressbar"
                    >
                      <span style={{ width: `${totalCampaignProgress}%` }} />
                    </span>
                  </span>
                </span>
              </span>

              <span className="dashboard-campaign-card__details">
                <span>
                  <Swords aria-hidden="true" size={20} />
                  <span>
                    <small>Prochain combat</small>
                    <span className="dashboard-campaign-card__detail-line">
                      <strong>
                        {currentStage?.trainerName ?? "Campagne terminée"}
                      </strong>
                      <span>
                        {currentStage
                          ? `: Niv. conseillé ${currentStage.recommendedLevel}`
                          : ": Toutes les étapes sont terminées"}
                      </span>
                    </span>
                  </span>
                </span>
                <span>
                  <Trophy aria-hidden="true" size={20} />
                  <span>
                    <small>Boss du monde</small>
                    <span className="dashboard-campaign-card__detail-line">
                      <strong>{worldBoss?.trainerName ?? "Terminé"}</strong>
                      <span>
                        : {worldBoss?.trainerTitle ?? "Cursus validé"}
                      </span>
                    </span>
                  </span>
                </span>
              </span>

              <span className="dashboard-campaign-card__action">
                Continuer la campagne
                <ArrowRight aria-hidden="true" size={24} />
              </span>
            </span>
          </Link>

          <div className="dashboard-secondary-modes">
            <Link
              className="dashboard-mode-card dashboard-team-mode dashboard-mode-card--team"
              href="/team"
            >
              <div className="dashboard-team-mode__body">
                <div className="dashboard-team-mode__heading">
                  <span
                    className="dashboard-mode-card__icon"
                    aria-hidden="true"
                  >
                    <UsersRound size={34} strokeWidth={1.8} />
                  </span>
                  <div className="dashboard-team-mode__heading-copy">
                    <strong>Gestion d&apos;équipe</strong>
                    <span className="dashboard-team-mode__stats">
                      <strong>{activePokemon.length}/6</strong> partenaires actifs
                      <span aria-hidden="true">-</span>
                      Niveau moyen de l&apos;équipe :
                      <strong>{averageTeamLevel ?? "-"}</strong>
                    </span>
                  </div>
                  <span className="dashboard-team-mode__action">
                    Composer mon équipe
                    <ArrowRight aria-hidden="true" size={24} />
                  </span>
                </div>

                <div className="dashboard-team-mode__roster">
                  {teamSlots.map(({ position, pokemon }) => (
                    <div
                      className={
                        pokemon
                          ? "dashboard-team-mode__slot is-filled"
                          : "dashboard-team-mode__slot"
                      }
                      key={position}
                    >
                      <div className="dashboard-team-mode__visual">
                        {pokemon ? (
                          <SpriteProvider
                            speciesId={pokemon.speciesId}
                            variant={pokemon.isShiny ? "front_shiny" : "front"}
                            alt={pokemon.displayName}
                            className="dashboard-team-mode__sprite"
                            height={82}
                            normalizeVisibleSize
                            width={82}
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="dashboard-team-mode__empty"
                          >
                            +
                          </span>
                        )}
                      </div>
                      <div className="dashboard-team-mode__caption">
                        {pokemon ? (
                          <>
                            <strong>{pokemon.displayName}</strong>
                            <span>
                              Niv. <strong>{pokemon.level}</strong>
                            </span>
                          </>
                        ) : (
                          <strong>Libre</strong>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Link>

            {SECONDARY_GAME_MODES.map(
              ({ href, title, description, action, icon: Icon, className }) => (
                <Link
                  className={`dashboard-mode-card dashboard-secondary-mode ${className}`}
                  href={href}
                  key={href}
                >
                  <span
                    aria-hidden="true"
                    className="dashboard-mode-card__icon"
                  >
                    <Icon size={38} strokeWidth={1.8} />
                  </span>
                  <span className="dashboard-mode-card__content">
                    <strong>{title}</strong>
                    <span>{description}</span>
                    <span className="dashboard-mode-card__action">
                      {action}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="dashboard-secondary-mode__arrow"
                    size={24}
                  />
                </Link>
              ),
            )}
          </div>
        </section>
      </div>
    </ApplicationShell>
  );
}

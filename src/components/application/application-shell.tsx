import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  BrainCircuit,
  Dices,
  Home,
  Layers,
  LogOut,
  Map,
  Swords,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { AudioControls } from "@/components/audio/audio-controls";
import { UiSoundEffects } from "@/components/audio/ui-sound-effects";
import { GamepadController } from "@/components/gamepad/gamepad-controller";
import { PlayerBalance } from "@/components/application/player-balance";
import { QuestPanel } from "@/components/quests/quest-panel";

export type ApplicationSection =
  | "home"
  | "campaign"
  | "training"
  | "team"
  | "gacha"
  | "admin"
  | "overview"
  | "players"
  | "combats"
  | "system";

interface NavigationItem {
  section: ApplicationSection;
  href: string;
  label: string;
  icon: LucideIcon;
}

// La navigation joueur standard
const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { section: "home", href: "/dashboard", label: "Accueil", icon: Home },
  { section: "campaign", href: "/campaign", label: "Campagne", icon: Map },
  {
    section: "training",
    href: "/training",
    label: "Entraînement",
    icon: BrainCircuit,
  },
  { section: "team", href: "/team", label: "Équipe", icon: UsersRound },
  { section: "gacha", href: "/gacha", label: "Gacha", icon: Dices },
];

// La navigation réservée aux administrateurs remplace les menus du jeu
const ADMIN_NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    section: "overview",
    href: "/admin?tab=overview",
    label: "Vue d'ensemble",
    icon: Activity,
  },
  {
    section: "players",
    href: "/admin?tab=players",
    label: "Joueurs",
    icon: UsersRound,
  },
  {
    section: "combats",
    href: "/admin?tab=combats",
    label: "Combats",
    icon: Swords,
  },
  {
    section: "gacha",
    href: "/admin?tab=gacha",
    label: "Gacha & Éco",
    icon: Dices,
  },
  {
    section: "system",
    href: "/admin?tab=system",
    label: "Système",
    icon: Layers,
  },
];

interface ApplicationShellProps {
  activeSection: ApplicationSection;
  playerName: string;
  pokedollars: number;
  role?: string;
  children: ReactNode;
}

/**
 * Cadre commun des pages de jeu et d'administration.
 * Pour les comptes administrateurs, les menus du jeu sont remplacés par les onglets d'administration.
 */
export function ApplicationShell({
  activeSection,
  playerName,
  pokedollars,
  role,
  children,
}: Readonly<ApplicationShellProps>) {
  const isAdmin = role === "admin";
  const navItems = isAdmin ? ADMIN_NAVIGATION_ITEMS : NAVIGATION_ITEMS;
  const brandHref = isAdmin ? "/admin" : "/dashboard";
  const brandLabel = isAdmin
    ? "Administration HEIG Odyssey"
    : "Accueil HEIG Odyssey";

  return (
    <div className="application-page">
      <UiSoundEffects />
      <GamepadController activeSection={activeSection} role={role} />
      <div
        className="application-background-mark application-background-mark--one"
        aria-hidden="true"
      />
      <div
        className="application-background-mark application-background-mark--two"
        aria-hidden="true"
      />

      <header className="application-site-header">
        <div className="application-navbar">
          <Link
            className="application-brand"
            href={brandHref}
            aria-label={brandLabel}
          >
            <Image
              src="/heig-odyssey-logo.png"
              alt="HEIG Odyssey"
              width={300}
              height={100}
              priority
            />
          </Link>

          <nav
            className="application-navigation"
            aria-label={
              isAdmin ? "Navigation administration" : "Navigation principale"
            }
          >
            <div className="application-navigation__wrapper">
              <span
                className="gamepad-hint gamepad-hint--bumper"
                aria-hidden="true"
                title="Manette : Touche LB (L1)"
              >
                LB
              </span>
              <ul>
                {navItems.map(({ section, href, label, icon: Icon }) => {
                  const isActive =
                    activeSection === section ||
                    (isAdmin &&
                      activeSection === "admin" &&
                      section === "overview");

                  return (
                    <li key={section}>
                      <Link
                        className={isActive ? "is-active" : undefined}
                        href={href}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon aria-hidden="true" size={16} />
                        <span>{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <span
                className="gamepad-hint gamepad-hint--bumper"
                aria-hidden="true"
                title="Manette : Touche RB (R1)"
              >
                RB
              </span>
            </div>
          </nav>

          <div className="application-player">
            {/* Les modules de jeu (quêtes, solde) ne sont affichés que pour les joueurs normaux */}
            {!isAdmin && (
              <>
                <QuestPanel />
                <PlayerBalance initialBalance={pokedollars} />
              </>
            )}
            <AudioControls className="application-player__audio" />
            <span className="application-player__name">
              {playerName}
              {isAdmin && (
                <span
                  style={{
                    marginLeft: "6px",
                    padding: "2px 6px",
                    background: "rgba(245, 158, 11, 0.2)",
                    border: "1px solid #f59e0b",
                    borderRadius: "4px",
                    color: "#fbbf24",
                    fontSize: "10px",
                    fontWeight: "700",
                    textTransform: "uppercase",
                  }}
                >
                  Admin
                </span>
              )}
            </span>
            <Link
              className="application-player__logout"
              href="/logout"
              aria-label="Se déconnecter"
            >
              <LogOut aria-hidden="true" size={18} />
            </Link>
          </div>
        </div>
      </header>

      <main className="application-stage">
        <section className="application-shell" aria-label="HEIG Odyssey">
          <div className="application-shell__topbar" aria-hidden="true">
            <span>HEIG-ODYSSEY</span>
            <span>PDG 2026</span>
          </div>

          <div className="application-shell__content">
            {/* Cette surface virtuelle se réduit avec la hauteur disponible :
                aucune commande ne doit être coupée par le cadre du jeu. */}
            <div className="application-shell__viewport">{children}</div>
          </div>
        </section>
      </main>

      <footer className="application-footer">
        <div className="application-footer__inner">
          <span className="application-footer__copyright">
            © 2026 HEIG Odyssey - Sprites Pokémon via PokeAPI © Nintendo /
            Creatures Inc. / GAME FREAK inc.
          </span>
        </div>
      </footer>
    </div>
  );
}

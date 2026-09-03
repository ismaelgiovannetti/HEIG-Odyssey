import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BrainCircuit,
  Dices,
  Home,
  LogOut,
  Map,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { AudioControls } from "@/components/audio/audio-controls";
import { UiSoundEffects } from "@/components/audio/ui-sound-effects";
import { PlayerBalance } from "@/components/application/player-balance";
import { QuestPanel } from "@/components/quests/quest-panel";

export type ApplicationSection =
  "home" | "campaign" | "training" | "team" | "gacha";

interface NavigationItem {
  section: ApplicationSection;
  href: string;
  label: string;
  icon: LucideIcon;
}

// La navigation est déclarée une seule fois afin que toutes les pages du jeu
// conservent les mêmes routes, libellés et icônes.
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

interface ApplicationShellProps {
  activeSection: ApplicationSection;
  playerName: string;
  pokedollars: number;
  children: ReactNode;
}

/**
 * Cadre commun des pages de jeu. La navigation et le pied de page restent
 * hors du panneau pixel afin que le contenu dispose de tout l'espace central.
 */
export function ApplicationShell({
  activeSection,
  playerName,
  pokedollars,
  children,
}: Readonly<ApplicationShellProps>) {
  return (
    <div className="application-page">
      <UiSoundEffects />
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
            href="/dashboard"
            aria-label="Accueil HEIG Odyssey"
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
            aria-label="Navigation principale"
          >
            <ul>
              {NAVIGATION_ITEMS.map(({ section, href, label, icon: Icon }) => {
                const isActive = activeSection === section;

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
          </nav>

          <div className="application-player">
            {/* Les informations dynamiques restent groupées à droite, dans le
                même ordre sur chacune des pages authentifiées. */}
            <QuestPanel />
            <PlayerBalance initialBalance={pokedollars} />
            <AudioControls className="application-player__audio" />
            <span className="application-player__name">{playerName}</span>
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

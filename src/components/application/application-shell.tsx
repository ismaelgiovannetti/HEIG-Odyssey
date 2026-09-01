import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BrainCircuit,
  Coins,
  Dices,
  Home,
  LogOut,
  Map,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { QuestPanel } from "@/components/quests/quest-panel";

export type ApplicationSection =
  | "home"
  | "campaign"
  | "training"
  | "team"
  | "gacha";

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
 * Cadre commun des pages de jeu. Le même en-tête conserve les repères du
 * joueur entre les modes et expose les informations de session utiles.
 */
export function ApplicationShell({
  activeSection,
  playerName,
  pokedollars,
  children,
}: Readonly<ApplicationShellProps>) {
  // Le format suisse ajoute les séparateurs de milliers sans modifier la
  // valeur entière conservée dans PostgreSQL.
  const formattedBalance = new Intl.NumberFormat("fr-CH").format(pokedollars);

  return (
    <main className="application-page">
      <div
        className="application-background-mark application-background-mark--one"
        aria-hidden="true"
      />
      <div
        className="application-background-mark application-background-mark--two"
        aria-hidden="true"
      />

      <section className="application-shell" aria-label="HEIG Odyssey">
        <div className="application-shell__topbar" aria-hidden="true">
          <span>HEIG-ODYSSEY</span>
          <span>PDG</span>
        </div>

        <header className="application-header">
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
            {/* Le raccourci reste proche des informations du joueur sans faire
                partie des destinations de la navigation principale. */}
            <QuestPanel />
            <span
              className="application-player__balance"
              title="Solde de Pokédollars"
              aria-label={`${formattedBalance} Pokédollars`}
            >
              <Coins aria-hidden="true" size={18} />
              <strong>{formattedBalance}</strong>
              <span aria-hidden="true">₽</span>
            </span>
            <span className="application-player__name">{playerName}</span>
            <Link
              className="application-player__logout"
              href="/logout"
              aria-label="Se déconnecter"
            >
              <LogOut aria-hidden="true" size={18} />
            </Link>
          </div>
        </header>

        <div
          className="application-shell__content"
          id="application-content"
          tabIndex={-1}
        >
          {children}
        </div>

        <footer className="application-shell__footer">
          <span>Votre aventure tactique, votre équipe, vos choix.</span>
        </footer>
      </section>
    </main>
  );
}

import "./home.css";
import "./onboarding.css";

import Image from "next/image";
import Link from "next/link";
import {
  BrainCircuit,
  Compass,
  LogIn,
  Sparkles,
  Swords,
  UserPlus,
} from "lucide-react";
import { StarterShowcase } from "@/components/onboarding/starter-showcase";

const GAME_PILLARS = [
  {
    title: "Partez à l'aventure",
    description:
      "Explorez huit mondes, affrontez leurs dresseurs et atteignez le Doctorat.",
    icon: Compass,
    iconClassName: "home-pillar__icon home-pillar__icon--campaign",
    label: "Campagne",
  },
  {
    title: "Progressez à votre rythme",
    description:
      "Entraînez votre équipe avec une IA random, heuristique ou expectiminimax.",
    icon: BrainCircuit,
    iconClassName: "home-pillar__icon home-pillar__icon--training",
    label: "Entraînement",
  },
  {
    title: "Maîtrisez la Génération 4",
    description:
      "Préparez vos choix, exploitez les types et remportez des combats tactiques.",
    icon: Swords,
    iconClassName: "home-pillar__icon home-pillar__icon--battle",
    label: "Combats",
  },
] as const;

/**
 * Porte d'entrée publique de l'application. Elle présente immédiatement la
 * rencontre entre aventure et stratégie avant de conduire vers le compte.
 */
export default function HomePage() {
  return (
    <main className="home-page" id="main-content">
      <a className="skip-link" href="#home-actions">
        Aller aux actions
      </a>

      <section className="home-window" aria-labelledby="home-title">
        <div className="home-window__topbar" aria-hidden="true">
          <span>HEIG-ODYSSEY</span>
          <span className="home-window__status">
            <i /> Serveur en ligne
          </span>
          <span>GEN-04</span>
        </div>

        <div className="home-hero">
          <div className="home-hero__content">
            <Image
              className="home-logo"
              src="/heig-odyssey-logo.png"
              alt="HEIG Odyssey"
              width={440}
              height={147}
              priority
            />

            <p className="home-eyebrow">
              <Sparkles aria-hidden="true" size={16} />
              Votre aventure tactique commence ici
            </p>

            <h1 id="home-title">
              L&apos;aventure rencontre
              <span> la stratégie.</span>
            </h1>

            <p className="home-lead">
              Construisez votre équipe, explorez une campagne inédite et révélez
              votre talent dans des combats inspirés des règles compétitives de
              la Génération 4.
            </p>

            <div className="home-actions" id="home-actions">
              <Link
                className="home-action home-action--primary pixel-btn"
                href="/login"
              >
                <LogIn aria-hidden="true" size={19} />
                Se connecter
              </Link>
              <Link
                className="home-action home-action--secondary pixel-btn"
                href="/signup"
              >
                <UserPlus aria-hidden="true" size={19} />
                Créer un compte
              </Link>
            </div>

            <p className="home-reassurance">
              <span aria-hidden="true">●</span> Jeu solo · progression
              persistante
            </p>
          </div>

          <div
            className="home-showcase"
            aria-label="Trois Pokémon partenaires disponibles"
          >
            <div className="home-showcase__header">
              <span>Choisissez votre premier partenaire</span>
              <strong>Recrutement offert</strong>
            </div>

            <StarterShowcase />

            <div className="home-showcase__message">
              <span aria-hidden="true">▶</span>
              Un partenaire gratuit vous attend après votre inscription.
            </div>
          </div>
        </div>

        <div
          className="home-pillars"
          aria-label="Les trois piliers de HEIG Odyssey"
        >
          {GAME_PILLARS.map(
            ({ title, description, icon: Icon, iconClassName, label }) => (
              <article className="home-pillar" key={label}>
                <div className={iconClassName} aria-hidden="true">
                  <Icon size={22} />
                </div>
                <div>
                  <span>{label}</span>
                  <h2>{title}</h2>
                  <p>{description}</p>
                </div>
              </article>
            ),
          )}
        </div>

        <footer className="home-footer">
          <span>493 Pokémon disponibles</span>
          <span aria-hidden="true">◆</span>
          <span>Une équipe de 1 à 6 partenaires</span>
          <span aria-hidden="true">◆</span>
          <span>Votre stratégie, votre aventure</span>
        </footer>
      </section>
    </main>
  );
}

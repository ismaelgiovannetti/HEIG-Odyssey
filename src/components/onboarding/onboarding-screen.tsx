import Image from "next/image";
import Link from "next/link";
import { LogOut, Sparkles } from "lucide-react";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

/** Structure visuelle commune à toutes les étapes du premier lancement. */
export function OnboardingScreen({
  playerName,
}: Readonly<{ playerName: string }>) {
  return (
    <main className="onboarding-page" id="main-content">
      <a className="skip-link" href="#onboarding-content">
        Aller au recrutement
      </a>

      <div
        className="onboarding-background-mark onboarding-background-mark--one"
        aria-hidden="true"
      />
      <div
        className="onboarding-background-mark onboarding-background-mark--two"
        aria-hidden="true"
      />

      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <div className="onboarding-card__topline" aria-hidden="true">
          <span>HEIG-ODYSSEY</span>
          <span>INITIALISATION JOUEUR</span>
        </div>

        <header className="onboarding-card__header">
          <Link
            className="onboarding-brand"
            href="/"
            aria-label="Retour à l'accueil HEIG Odyssey"
          >
            <Image
              src="/heig-odyssey-logo.png"
              alt="HEIG Odyssey"
              width={360}
              height={120}
              priority
            />
          </Link>

          <div className="onboarding-heading">
            <span className="onboarding-eyebrow">
              <Sparkles aria-hidden="true" size={14} />
              Première connexion
            </span>
            <h1 id="onboarding-title">Bienvenue, {playerName}</h1>
            <p>
              Découvrez votre aventure et recrutez gratuitement votre premier
              partenaire.
            </p>
          </div>

          <Link className="onboarding-logout" href="/logout">
            <LogOut aria-hidden="true" size={16} />
            Changer de compte
          </Link>
        </header>

        <div id="onboarding-content" className="onboarding-card__content">
          <OnboardingFlow />
        </div>
      </section>
    </main>
  );
}

import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Coins,
  Dices,
  Users,
} from "lucide-react";
import type { Ref } from "react";

import { StarterShowcase } from "@/components/onboarding/starter-showcase";
import type { StarterView } from "@/lib/starter/starter-contract";

type OnboardingIntroPhaseProps = Readonly<{
  catalog: StarterView[];
  headingRef: Ref<HTMLHeadingElement>;
  onContinue: () => void;
}>;

export function OnboardingIntroPhase({
  catalog,
  headingRef,
  onContinue,
}: OnboardingIntroPhaseProps) {
  return (
    <section
      className="onboarding-intro"
      aria-labelledby="onboarding-intro-title"
    >
      <div className="onboarding-intro__lead">
        <div>
          <span className="onboarding-kicker">Votre aventure commence ici</span>
          <h2 id="onboarding-intro-title" ref={headingRef} tabIndex={-1}>
            Un partenaire, quatre façons de progresser
          </h2>
          <p>
            Recrutez votre première créature gratuitement. Elle rejoint
            immédiatement votre collection et le premier emplacement de votre
            équipe.
          </p>
          <div className="onboarding-free-note">
            <Coins aria-hidden="true" size={20} />
            <span>
              Coût du recrutement : <strong>0 Pokédollar</strong>
            </span>
          </div>
        </div>

        <StarterShowcase catalog={catalog} />
      </div>

      <div
        className="onboarding-features"
        aria-label="Les quatre espaces du jeu"
      >
        <article className="onboarding-feature onboarding-feature--campaign">
          <BookOpen aria-hidden="true" size={22} />
          <div>
            <h3>Campagne</h3>
            <p>Explorez huit mondes et affrontez leurs dresseurs.</p>
          </div>
        </article>
        <article className="onboarding-feature onboarding-feature--training">
          <BrainCircuit aria-hidden="true" size={22} />
          <div>
            <h3>Entraînement</h3>
            <p>Progressez contre trois niveaux d’intelligence artificielle.</p>
          </div>
        </article>
        <article className="onboarding-feature onboarding-feature--team">
          <Users aria-hidden="true" size={22} />
          <div>
            <h3>Équipe</h3>
            <p>Composez librement une équipe d’une à six créatures.</p>
          </div>
        </article>
        <article className="onboarding-feature onboarding-feature--gacha">
          <Dices aria-hidden="true" size={22} />
          <div>
            <h3>Boutique gacha</h3>
            <p>Recrutez avec la monnaie gagnée en jouant, sans achat réel.</p>
          </div>
        </article>
      </div>

      <button
        className="onboarding-primary-button"
        type="button"
        onClick={onContinue}
      >
        Choisir mon premier partenaire{" "}
        <ArrowRight aria-hidden="true" size={18} />
      </button>
    </section>
  );
}

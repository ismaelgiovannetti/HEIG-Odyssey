import { Gamepad2, Sparkles } from "lucide-react";
import type { Ref } from "react";

import { SpriteProvider } from "@/components/pokemon/sprite-provider";
import type { StarterClaimResult } from "@/lib/starter/starter-contract";

type ClaimedStarter = StarterClaimResult["pokemon"];

type StarterSuccessPhaseProps = Readonly<{
  headingRef: Ref<HTMLHeadingElement>;
  pokemon: ClaimedStarter;
  onEnterDashboard: () => void;
}>;

export function StarterSuccessPhase({
  headingRef,
  pokemon,
  onEnterDashboard,
}: StarterSuccessPhaseProps) {
  return (
    <section
      className="starter-success"
      aria-labelledby="starter-success-title"
      role="status"
    >
      <div className="starter-success__visual">
        <div className="starter-success__burst" aria-hidden="true">
          <Sparkles size={25} />
        </div>
        <div className="starter-success__pokemon">
          <SpriteProvider
            speciesId={pokemon.speciesId}
            variant={pokemon.isShiny ? "front_shiny" : "front"}
            alt={pokemon.name}
            width={210}
            height={210}
            priority
          />
          {pokemon.isShiny ? (
            <span>
              <Sparkles aria-hidden="true" size={14} /> Version chromatique
            </span>
          ) : null}
        </div>
      </div>

      <div className="starter-success__content">
        <span className="onboarding-kicker">Recrutement confirmé</span>
        <h2 id="starter-success-title" ref={headingRef} tabIndex={-1}>
          {pokemon.name} rejoint votre équipe !
        </h2>
        <p>
          {pokemon.name} rejoint votre collection au niveau {pokemon.level} et
          occupe le premier emplacement de votre équipe. La première zone de la
          campagne est débloquée.
        </p>
        <button
          className="onboarding-primary-button"
          type="button"
          onClick={onEnterDashboard}
        >
          <Gamepad2 aria-hidden="true" size={18} /> Accéder à l’accueil
        </button>
      </div>
    </section>
  );
}

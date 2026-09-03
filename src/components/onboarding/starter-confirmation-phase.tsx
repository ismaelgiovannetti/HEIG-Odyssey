import { ArrowLeft, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import type { Ref } from "react";

import { SpriteProvider } from "@/components/pokemon/sprite-provider";
import type { StarterView } from "@/lib/starter/starter-contract";

type StarterConfirmationPhaseProps = Readonly<{
  candidate: StarterView;
  claimError: string | null;
  headingRef: Ref<HTMLHeadingElement>;
  isClaiming: boolean;
  nickname: string;
  onBack: () => void;
  onConfirm: () => Promise<void>;
  onNicknameChange: (nickname: string) => void;
}>;

export function StarterConfirmationPhase({
  candidate,
  claimError,
  headingRef,
  isClaiming,
  nickname,
  onBack,
  onConfirm,
  onNicknameChange,
}: StarterConfirmationPhaseProps) {
  return (
    <section
      className="starter-confirmation"
      aria-labelledby="starter-confirmation-title"
    >
      <div className="starter-confirmation__portrait">
        <Sparkles aria-hidden="true" size={24} />
        <SpriteProvider
          speciesId={candidate.speciesId}
          alt={candidate.name}
          width={174}
          height={174}
          priority
        />
      </div>
      <div className="starter-confirmation__content">
        <span className="onboarding-kicker">Dernière vérification</span>
        <h2 id="starter-confirmation-title" ref={headingRef} tabIndex={-1}>
          Recruter {candidate.name} ?
        </h2>
        <p>
          {candidate.name} rejoindra votre collection au niveau{" "}
          {candidate.level} et prendra le premier emplacement de votre équipe.
          Ce recrutement gratuit est unique.
        </p>
        <label className="starter-nickname">
          <span>
            Surnom <small>(facultatif)</small>
          </span>
          <input
            type="text"
            value={nickname}
            maxLength={20}
            placeholder={candidate.name}
            disabled={isClaiming}
            onChange={(event) => onNicknameChange(event.target.value)}
          />
          <small>{nickname.length}/20 caractères</small>
        </label>
        {claimError ? (
          <p className="starter-claim-error" role="alert">
            {claimError}
          </p>
        ) : null}
        <div className="starter-confirmation__actions">
          <button
            className="onboarding-secondary-button"
            type="button"
            disabled={isClaiming}
            onClick={onBack}
          >
            <ArrowLeft aria-hidden="true" size={16} /> Modifier mon choix
          </button>
          <button
            className="onboarding-primary-button"
            type="button"
            disabled={isClaiming}
            onClick={() => void onConfirm()}
          >
            {isClaiming ? (
              <LoaderCircle
                className="starter-loading-icon"
                aria-hidden="true"
                size={17}
              />
            ) : (
              <ShieldCheck aria-hidden="true" size={17} />
            )}
            {isClaiming ? "Recrutement..." : "Confirmer le recrutement"}
          </button>
        </div>
      </div>
    </section>
  );
}

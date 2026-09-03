import { ArrowRight, Check } from "lucide-react";
import { Fragment } from "react";

type OnboardingProgressProps = Readonly<{
  currentStep: 1 | 2 | 3;
}>;

const STEPS = ["Découverte", "Sélection", "Recrutement"] as const;

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  return (
    <div
      className="onboarding-progress"
      role="list"
      aria-label={"Étape " + currentStep + " sur 3"}
    >
      {STEPS.map((label, index) => {
        const step = (index + 1) as 1 | 2 | 3;

        return (
          <Fragment key={label}>
            <span
              className={
                step <= currentStep
                  ? "onboarding-progress__step is-active"
                  : "onboarding-progress__step"
              }
              role="listitem"
              aria-current={step === currentStep ? "step" : undefined}
            >
              <span>
                {step < currentStep ? (
                  <Check aria-hidden="true" size={15} />
                ) : (
                  step
                )}
              </span>
              {label}
            </span>
            {step < 3 ? (
              <ArrowRight
                className={
                  step < currentStep
                    ? "onboarding-progress__arrow is-active"
                    : "onboarding-progress__arrow"
                }
                aria-hidden="true"
                size={25}
              />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

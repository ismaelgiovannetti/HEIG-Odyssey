import Link from "next/link";
import { ArrowLeft, Construction, type LucideIcon } from "lucide-react";

interface ModePlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
  nextStep: string;
  icon: LucideIcon;
  accent: "campaign" | "training" | "team" | "gacha";
}

/**
 * Point d'arrivée temporaire d'un mode. Il confirme la navigation sans
 * simuler une fonctionnalité qui sera développée dans une tâche dédiée.
 */
export function ModePlaceholder({
  eyebrow,
  title,
  description,
  nextStep,
  icon: Icon,
  accent,
}: Readonly<ModePlaceholderProps>) {
  return (
    <section
      className={`mode-placeholder mode-placeholder--${accent}`}
      aria-labelledby="mode-title"
    >
      <div className="mode-placeholder__visual" aria-hidden="true">
        <span>
          <Icon size={58} strokeWidth={1.8} />
        </span>
      </div>

      <div className="mode-placeholder__content">
        <p className="mode-placeholder__eyebrow">{eyebrow}</p>
        <h1 id="mode-title">{title}</h1>
        <p>{description}</p>

        <div className="mode-placeholder__status">
          <Construction aria-hidden="true" size={20} />
          <span>{nextStep}</span>
        </div>

        <Link className="mode-placeholder__back pixel-btn" href="/dashboard">
          <ArrowLeft aria-hidden="true" size={18} />
          Retour à l&apos;accueil
        </Link>
      </div>
    </section>
  );
}

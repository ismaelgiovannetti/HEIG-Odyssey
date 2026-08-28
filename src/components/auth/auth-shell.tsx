import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  eyebrow?: string;
  /** Permet une variante visuelle ciblée sans dupliquer la structure. */
  className?: string;
  /** La note reste active par défaut sur les écrans qui saisissent un compte. */
  showSecurityNote?: boolean;
};

/**
 * Structure visuelle partagée par les écrans du parcours de compte. Elle
 * centralise l'identité graphique et les éléments d'accessibilité communs.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
  eyebrow = "Terminal dresseur",
  className = "",
  showSecurityNote = true,
}: AuthShellProps) {
  return (
    <main className="auth-page" id="main-content">
      {/* Ce lien devient visible au clavier et évite de parcourir l'en-tête. */}
      <a className="skip-link" href="#auth-form">
        Aller au formulaire
      </a>

      {/* Ces marques sont décoratives et sont ignorées par les lecteurs d'écran. */}
      <div
        className="auth-background-mark auth-background-mark--one"
        aria-hidden="true"
      />
      <div
        className="auth-background-mark auth-background-mark--two"
        aria-hidden="true"
      />

      <section
        className={`auth-card${className ? ` ${className}` : ""}`}
        aria-labelledby="auth-title"
      >
        <div className="auth-card__topline" aria-hidden="true">
          <span>HEIG-ODYSSEY</span>
          <span>PDG</span>
        </div>

        <header className="auth-card__header">
          <Link
            className="auth-brand"
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

          <span className="auth-eyebrow">
            <Sparkles aria-hidden="true" size={14} />
            {eyebrow}
          </span>
          <h1 id="auth-title">{title}</h1>
          <p>{description}</p>
        </header>

        <div id="auth-form" className="auth-card__content">
          {children}
        </div>

        {footer ? (
          <footer className="auth-card__footer">{footer}</footer>
        ) : null}

        {/* Le dashboard et le logout peuvent masquer cette note, car aucune
            donnée d'authentification n'y est saisie. */}
        {showSecurityNote ? (
          <div className="auth-security-note">
            <ShieldCheck aria-hidden="true" size={17} />
            <span>
              Connexion protégée - vos informations restent confidentielles.
            </span>
          </div>
        ) : null}
      </section>
    </main>
  );
}

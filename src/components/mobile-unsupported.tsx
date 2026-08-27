import Image from "next/image";
import { ExternalLink, Monitor } from "lucide-react";

const LANDING_PAGE_URL = "https://heig-odyssey.online";

/**
 * Écran affiché à la place du jeu sur les téléphones. La limitation est
 * volontaire pour le MVP : seule la landing page reste adaptée au mobile.
 */
export function MobileUnsupported() {
  return (
    <main
      className="mobile-unsupported"
      aria-labelledby="mobile-unsupported-title"
    >
      <div className="mobile-unsupported__card">
        <div className="mobile-unsupported__topbar" aria-hidden="true">
          <span>HEIG-ODYSSEY</span>
          <span>GEN-04</span>
        </div>

        <div className="mobile-unsupported__content">
          <Image
            className="mobile-unsupported__logo"
            src="/heig-odyssey-logo.png"
            alt="HEIG Odyssey"
            width={360}
            height={120}
            priority
          />

          <span className="mobile-unsupported__icon" aria-hidden="true">
            <Monitor size={34} strokeWidth={2.5} />
          </span>

          <p className="mobile-unsupported__eyebrow">VERSION ORDINATEUR</p>
          <h1 id="mobile-unsupported-title">Le jeu arrive sur grand écran</h1>
          <p>
            HEIG Odyssey n&apos;est pas encore disponible sur mobile. Ouvrez le
            jeu depuis un ordinateur pour commencer votre aventure.
          </p>

          <a
            className="mobile-unsupported__link"
            href={LANDING_PAGE_URL}
            rel="noreferrer"
          >
            {/* La landing page possède son propre rendu adapté au mobile. */}
            Retour à la landing page
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </main>
  );
}

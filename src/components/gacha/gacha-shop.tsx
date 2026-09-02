"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dices, Eye, Gem, ShieldCheck, Sparkles, Star } from "lucide-react";
import type { GachaBannerConfig } from "@/lib/content/schemas";
import type { GachaExecutionResult } from "@/lib/gacha/gacha-service";
import {
  GACHA_HATCH_DURATION_MS,
  GACHA_SEARCH_DURATION_MS,
  GachaSoundPlayer,
} from "@/lib/audio/gacha-sound-effects";
import { publishPlayerBalance } from "@/lib/player/player-balance-events";
import { GachaEgg } from "./gacha-egg";
import {
  GachaPreviewDialog,
  type GachaPreviewSpecies,
} from "./gacha-preview-dialog";
import { GachaPullDialog, type PullPhase } from "./gacha-pull-dialog";
import styles from "./gacha-shop.module.css";

interface GachaShopProps {
  banners: GachaBannerConfig[];
  initialBalance: number;
  previewSpecies: GachaPreviewSpecies[];
}

interface PullDialogState {
  banner: GachaBannerConfig;
  phase: PullPhase;
  result: GachaExecutionResult | null;
}

interface PullResponse {
  success?: boolean;
  error?: string;
  data?: GachaExecutionResult;
}

const THEMES = ["standard", "mid", "legendary"] as const;
type BannerTheme = (typeof THEMES)[number];

const BANNER_THEMES: Readonly<Record<string, BannerTheme>> = {
  "banner-standard": "standard",
  "banner-mid": "mid",
  "banner-legendary": "legendary",
};

function resolveBannerTheme(bannerId: string, index: number): BannerTheme {
  return BANNER_THEMES[bannerId] ?? THEMES[index % THEMES.length];
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

function percent(value: number) {
  return `${Math.round(value * 100)} %`;
}

function hasValidResult(value: PullResponse["data"]): value is GachaExecutionResult {
  return Boolean(
    value?.success &&
      value.pokemon?.id &&
      value.pokemon.speciesId &&
      value.pokemon.name &&
      Number.isSafeInteger(value.newBalance) &&
      value.newBalance >= 0,
  );
}

/** Achat direct depuis chaque portail et restitution sans recharger la page. */
export function GachaShop({ banners, initialBalance, previewSpecies }: GachaShopProps) {
  const soundPlayerRef = useRef<GachaSoundPlayer | null>(null);
  const speciesById = useMemo(
    () => new Map(previewSpecies.map((pokemon) => [pokemon.id, pokemon])),
    [previewSpecies],
  );
  const [balance, setBalance] = useState(initialBalance);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<PullDialogState | null>(null);
  const [previewBanner, setPreviewBanner] = useState<GachaBannerConfig | null>(null);

  useEffect(() => () => {
    soundPlayerRef.current?.destroy();
    soundPlayerRef.current = null;
  }, []);

  useEffect(() => {
    if (dialog?.phase !== "hatching") return;
    const timer = window.setTimeout(
      () => setDialog((current) => current ? { ...current, phase: "revealed" } : null),
      GACHA_HATCH_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [dialog?.phase]);

  useEffect(() => {
    const soundPlayer = soundPlayerRef.current;
    if (!soundPlayer) return;

    if (dialog?.phase === "hatching") {
      soundPlayer.startEggHatching();
    } else if (dialog?.phase === "revealed" && dialog.result) {
      void soundPlayer.playPokemonCry(dialog.result.pokemon.speciesId);
    }
  }, [dialog?.phase, dialog?.result]);

  function getSoundPlayer() {
    soundPlayerRef.current ??= new GachaSoundPlayer();
    return soundPlayerRef.current;
  }

  async function pull(banner: GachaBannerConfig) {
    if (pending || balance < banner.costPokedollars) return;

    setPending(true);
    setError(null);
    setDialog({ banner, phase: "requesting", result: null });
    // Initialisé pendant le clic afin de respecter la politique d'autoplay.
    getSoundPlayer().startPortalSearch();
    // La réponse serveur et le temps de mise en scène avancent en parallèle :
    // une requête lente n'est donc jamais prolongée artificiellement.
    const minimumRequestDuration = wait(GACHA_SEARCH_DURATION_MS);

    try {
      const response = await fetch("/api/gacha/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bannerId: banner.id,
          // Chaque intention de tirage est unique ; un double envoi réseau ne
          // pourra être débité qu'une seule fois par le serveur.
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as PullResponse | null;
      await minimumRequestDuration;
      if (!response.ok || !payload?.success || !hasValidResult(payload.data)) {
        throw new Error(payload?.error || "Le portail ne répond pas pour le moment.");
      }

      setBalance(payload.data.newBalance);
      publishPlayerBalance(payload.data.newBalance);
      setDialog({ banner, phase: "hatching", result: payload.data });
    } catch (cause) {
      await minimumRequestDuration;
      soundPlayerRef.current?.stop();
      setDialog(null);
      setError(cause instanceof Error ? cause.message : "Le tirage a échoué. Réessayez.");
    } finally {
      setPending(false);
    }
  }

  function closeDialog() {
    soundPlayerRef.current?.stop();
    setDialog(null);
  }

  if (banners.length === 0) {
    return (
      <div className={styles.emptyState} role="status">
        Aucun portail n’est disponible pour le moment.
      </div>
    );
  }

  return (
    <div className={styles.shop}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}><Dices size={15} aria-hidden="true" /> Recrutement du dresseur</p>
        <div className={styles.headingLine}>
          <h1>Invocations Pokémon</h1>
          <p>Choisissez votre portail.</p>
        </div>
      </header>

      <section className={styles.portalSection} aria-labelledby="gacha-portals-title">
        <h2 className="visually-hidden" id="gacha-portals-title">Portails disponibles</h2>
        <div className={styles.portalGrid}>
          {banners.map((banner, index) => {
            const affordable = balance >= banner.costPokedollars;
            const isCurrentPull = pending && dialog?.banner.id === banner.id;
            return (
              <article
                key={banner.id}
                className={styles.portalCard}
                data-theme={resolveBannerTheme(banner.id, index)}
              >
                <span className={styles.portalVisual} aria-hidden="true">
                  <span className={styles.portalLandscape} />
                  <Sparkles className={styles.portalSparkles} size={25} />
                  <span className={styles.portalNest}>
                    <span className={styles.portalEgg}><GachaEgg /></span>
                  </span>
                </span>
                <span className={styles.portalCopy}>
                  <span className={styles.portalTitle}>{banner.name}</span>
                  <span className={styles.portalDescription}>{banner.description}</span>
                </span>
                <span className={styles.rateGrid} aria-label="Probabilités du portail">
                  <span className={styles.rateItem} data-rarity="common">
                    <span className={styles.rateIcon}><ShieldCheck size={16} aria-hidden="true" /></span>
                    <span className={styles.rateCopy}><small>Commun</small><strong>{percent(banner.rates.common)}</strong></span>
                  </span>
                  <span className={styles.rateItem} data-rarity="rare">
                    <span className={styles.rateIcon}><Star size={16} aria-hidden="true" /></span>
                    <span className={styles.rateCopy}><small>Rare</small><strong>{percent(banner.rates.rare)}</strong></span>
                  </span>
                  <span className={styles.rateItem} data-rarity="epic">
                    <span className={styles.rateIcon}><Sparkles size={16} aria-hidden="true" /></span>
                    <span className={styles.rateCopy}><small>Épique</small><strong>{percent(banner.rates.epic)}</strong></span>
                  </span>
                  <span className={styles.rateItem} data-rarity="shiny">
                    <span className={styles.rateIcon}><Gem size={16} aria-hidden="true" /></span>
                    <span className={styles.rateCopy}><small>Chromatique</small><strong>{percent(banner.rates.shinyRate)}</strong></span>
                  </span>
                </span>
                <span className={styles.portalActions}>
                  <button
                    type="button"
                    className={styles.previewButton}
                    disabled={pending}
                    onClick={() => setPreviewBanner(banner)}
                  >
                    <Eye size={18} aria-hidden="true" /> Aperçu
                  </button>
                  <button
                    type="button"
                    className={styles.portalAction}
                    disabled={pending || !affordable}
                    onClick={() => pull(banner)}
                  >
                    {isCurrentPull ? (
                      <><span className={styles.buttonSpinner} aria-hidden="true" /> Invocation en cours…</>
                    ) : affordable ? (
                      <><Sparkles size={18} aria-hidden="true" /> Invoquer pour {banner.costPokedollars} ₱</>
                    ) : (
                      <>Solde insuffisant</>
                    )}
                  </button>
                </span>
              </article>
            );
          })}
        </div>
      </section>

      {error ? <div className={styles.errorMessage} role="alert">{error}</div> : null}

      {previewBanner ? (
        <GachaPreviewDialog
          banner={previewBanner}
          species={previewBanner.poolSpecies.flatMap((speciesId) => {
            const pokemon = speciesById.get(speciesId);
            return pokemon ? [pokemon] : [];
          })}
          onClose={() => setPreviewBanner(null)}
        />
      ) : null}

      {dialog ? (
        <GachaPullDialog
          banner={dialog.banner}
          phase={dialog.phase}
          result={dialog.result}
          canPullAgain={balance >= dialog.banner.costPokedollars}
          onClose={closeDialog}
          onPullAgain={() => pull(dialog.banner)}
          onSkip={() => setDialog((current) => current ? { ...current, phase: "revealed" } : null)}
        />
      ) : null}
    </div>
  );
}

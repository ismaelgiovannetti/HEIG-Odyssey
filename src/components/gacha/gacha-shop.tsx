"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleDot,
  Crown,
  Dices,
  Egg,
  Eye,
  Sparkles,
  Star,
} from "lucide-react";
import type { GachaBannerConfig } from "@/lib/content/schemas";
import {
  parseGachaPullResponse,
  type GachaExecutionResult,
} from "@/lib/gacha/gacha-contract";
import {
  GACHA_HATCH_DURATION_MS,
  GACHA_SEARCH_DURATION_MS,
  GachaSoundPlayer,
} from "@/lib/audio/gacha-sound-effects";
import { publishPlayerBalance } from "@/lib/player/player-balance-events";
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

const THEMES = ["standard", "mid", "legendary"] as const;
type BannerTheme = (typeof THEMES)[number];

const BANNER_THEMES: Readonly<Record<string, BannerTheme>> = {
  "banner-standard": "standard",
  "banner-mid": "mid",
  "banner-legendary": "legendary",
};

const BANNER_ARTWORK: Readonly<Record<BannerTheme, string>> = {
  standard: "/images/gacha/banner-standard.webp",
  mid: "/images/gacha/banner-mid.webp",
  legendary: "/images/gacha/banner-legendary.webp",
};

function resolveBannerTheme(bannerId: string, index: number): BannerTheme {
  return BANNER_THEMES[bannerId] ?? THEMES[index % THEMES.length];
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) =>
    window.setTimeout(resolve, milliseconds),
  );
}

function percent(value: number) {
  return `${Math.round(value * 100)} %`;
}

/** Achat direct depuis chaque portail et restitution sans recharger la page. */
export function GachaShop({
  banners,
  initialBalance,
  previewSpecies,
}: GachaShopProps) {
  const soundPlayerRef = useRef<GachaSoundPlayer | null>(null);
  const lastCryPullIdRef = useRef<string | null>(null);
  const pendingRef = useRef(false);
  const speciesById = useMemo(
    () => new Map(previewSpecies.map((pokemon) => [pokemon.id, pokemon])),
    [previewSpecies],
  );
  const [balance, setBalance] = useState(initialBalance);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<PullDialogState | null>(null);
  const [previewBanner, setPreviewBanner] = useState<GachaBannerConfig | null>(
    null,
  );

  useEffect(
    () => () => {
      soundPlayerRef.current?.destroy();
      soundPlayerRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (dialog?.phase !== "hatching") return;
    const timer = window.setTimeout(
      () =>
        setDialog((current) =>
          current ? { ...current, phase: "revealed" } : null,
        ),
      GACHA_HATCH_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [dialog?.phase]);

  useEffect(() => {
    const soundPlayer = soundPlayerRef.current;
    if (!soundPlayer) return;

    if (dialog?.phase === "hatching") {
      soundPlayer.startEggHatching();
      if (dialog.result) {
        // Les métadonnées PokeAPI sont chargées pendant l'animation pour que
        // le cri puisse démarrer sans délai au moment de la révélation.
        void soundPlayer.preparePokemonCry(dialog.result.pokemon.speciesId);
      }
    } else if (
      dialog?.phase === "revealed" &&
      dialog.result &&
      lastCryPullIdRef.current !== dialog.result.pullId
    ) {
      // Le cri accompagne exactement la révélation et reste unique, même si
      // React rejoue l'effet pendant le développement.
      lastCryPullIdRef.current = dialog.result.pullId;
      void soundPlayer.playPokemonCry(dialog.result.pokemon.speciesId);
    }
  }, [dialog?.phase, dialog?.result]);

  function getSoundPlayer() {
    soundPlayerRef.current ??= new GachaSoundPlayer();
    return soundPlayerRef.current;
  }

  async function pull(banner: GachaBannerConfig) {
    // Le ref verrouille immédiatement l'intention, avant le prochain rendu :
    // deux clics très rapprochés ne peuvent donc pas créer deux achats distincts.
    if (pendingRef.current || balance < banner.costPokedollars) return;

    pendingRef.current = true;
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
      const body: unknown = await response.json().catch(() => null);
      const payload = parseGachaPullResponse(body);
      await minimumRequestDuration;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? "Le portail ne répond pas pour le moment."
            : payload.error || "Le portail ne répond pas pour le moment.",
        );
      }

      setBalance(payload.data.newBalance);
      publishPlayerBalance(payload.data.newBalance);
      setDialog({ banner, phase: "hatching", result: payload.data });
    } catch (cause) {
      await minimumRequestDuration;
      soundPlayerRef.current?.stop();
      setDialog(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Le tirage a échoué. Réessayez.",
      );
    } finally {
      pendingRef.current = false;
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
        <p className={styles.eyebrow}>
          <Dices size={15} aria-hidden="true" /> Recrutement du dresseur
        </p>
        <div className={styles.headingLine}>
          <h1>Invocations Pokémon</h1>
          <p>Choisissez votre portail.</p>
        </div>
      </header>

      <section
        className={styles.portalSection}
        aria-labelledby="gacha-portals-title"
      >
        <h2 className="visually-hidden" id="gacha-portals-title">
          Portails disponibles
        </h2>
        <div className={styles.portalGrid}>
          {banners.map((banner, index) => {
            const affordable = balance >= banner.costPokedollars;
            const isCurrentPull = pending && dialog?.banner.id === banner.id;
            const theme = resolveBannerTheme(banner.id, index);
            return (
              <article
                key={banner.id}
                className={styles.portalCard}
                data-theme={theme}
              >
                <span className={styles.portalVisual} aria-hidden="true">
                  <Image
                    className={styles.portalArtwork}
                    src={BANNER_ARTWORK[theme]}
                    alt=""
                    fill
                    sizes="(max-width: 1120px) 31vw, 30vw"
                    priority
                  />
                </span>
                <span className={styles.portalCopy}>
                  <span className={styles.portalTitle}>{banner.name}</span>
                  <span className={styles.portalDescription}>
                    {banner.description}
                  </span>
                </span>
                <span className={styles.rateBlock}>
                  <span className={styles.rateTitle}>Probabilités</span>
                  <span
                    className={styles.rateGrid}
                    role="group"
                    aria-label="Probabilités du portail"
                  >
                    <span className={styles.rateItem} data-rarity="common">
                      <span className={styles.rateIcon}>
                        <CircleDot
                          size={24}
                          strokeWidth={2.8}
                          aria-hidden="true"
                        />
                      </span>
                      <span className={styles.rateCopy}>
                        <small>Commun</small>
                        <strong>{percent(banner.rates.common)}</strong>
                      </span>
                    </span>
                    <span className={styles.rateItem} data-rarity="rare">
                      <span className={styles.rateIcon}>
                        <Star size={24} strokeWidth={2.8} aria-hidden="true" />
                      </span>
                      <span className={styles.rateCopy}>
                        <small>Rare</small>
                        <strong>{percent(banner.rates.rare)}</strong>
                      </span>
                    </span>
                    <span className={styles.rateItem} data-rarity="epic">
                      <span className={styles.rateIcon}>
                        <Crown size={24} strokeWidth={2.8} aria-hidden="true" />
                      </span>
                      <span className={styles.rateCopy}>
                        <small>Épique</small>
                        <strong>{percent(banner.rates.epic)}</strong>
                      </span>
                    </span>
                    <span className={styles.rateItem} data-rarity="shiny">
                      <span className={styles.rateIcon}>
                        <Sparkles
                          size={24}
                          strokeWidth={2.8}
                          aria-hidden="true"
                        />
                      </span>
                      <span className={styles.rateCopy}>
                        <small>Chromatique</small>
                        <strong>{percent(banner.rates.shinyRate)}</strong>
                      </span>
                    </span>
                  </span>
                </span>
                <span className={styles.portalActions}>
                  <button
                    type="button"
                    className={styles.previewButton}
                    aria-label={`Aperçu de ${banner.name}`}
                    disabled={pending}
                    onClick={() => setPreviewBanner(banner)}
                  >
                    <Eye size={18} aria-hidden="true" />
                    <span className={styles.actionLabel}>Aperçu</span>
                  </button>
                  <button
                    type="button"
                    className={styles.portalAction}
                    disabled={pending || !affordable}
                    onClick={() => pull(banner)}
                  >
                    {isCurrentPull ? (
                      <>
                        <span
                          className={styles.buttonSpinner}
                          aria-hidden="true"
                        />
                        <span className={styles.actionLabel}>
                          Invocation en cours…
                        </span>
                      </>
                    ) : affordable ? (
                      <>
                        <Egg size={18} aria-hidden="true" />
                        <span className={styles.actionLabel}>
                          Invoquer pour {banner.costPokedollars} ₽
                        </span>
                      </>
                    ) : (
                      <span className={styles.actionLabel}>
                        Solde insuffisant - ₽ {banner.costPokedollars}
                      </span>
                    )}
                  </button>
                </span>
              </article>
            );
          })}
        </div>
      </section>

      {error ? (
        <div className={styles.errorMessage} role="alert">
          {error}
        </div>
      ) : null}

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
        />
      ) : null}
    </div>
  );
}

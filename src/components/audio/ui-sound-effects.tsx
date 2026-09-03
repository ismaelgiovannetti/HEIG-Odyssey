"use client";

import { useEffect } from "react";
import { playUiSfx, type UiSfxType } from "@/lib/audio/ui-sfx";

const INTERACTIVE_SELECTOR = [
  "button",
  "a[href]",
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="menuitem"]',
  "summary",
  'input[type="checkbox"]',
  'input[type="radio"]',
].join(",");

function interactiveTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  const el = node.closest<HTMLElement>(INTERACTIVE_SELECTOR);
  if (!el) return null;
  if (el.closest("[data-no-sfx]")) return null;
  if (
    el.hasAttribute("disabled") ||
    el.getAttribute("aria-disabled") === "true"
  ) {
    return null;
  }
  return el;
}

function classNameOf(el: HTMLElement): string {
  return typeof el.className === "string" ? el.className.toLowerCase() : "";
}

/** Choisit le bruitage d'un clic selon l'intention du bouton. */
function clickSfxFor(el: HTMLElement): UiSfxType {
  const explicit = el.closest<HTMLElement>("[data-sfx]")?.dataset.sfx;
  if (explicit === "confirm" || explicit === "select" || explicit === "back") {
    return explicit;
  }

  const label = (el.getAttribute("aria-label") || el.textContent || "")
    .toLowerCase()
    .trim();
  const cls = classNameOf(el);

  if (
    /retour|annuler|fermer|quitter|précédent|revenir|back/.test(label) ||
    /quiet|cancel|-back|return|close|dismiss/.test(cls)
  ) {
    return "back";
  }
  if (
    el.getAttribute("type") === "submit" ||
    /confirmer|valider|lancer|combattre|générer|invoquer|enregistrer|démarrer|entrer/.test(
      label,
    ) ||
    /primary|confirm|fight-button|--primary|submit/.test(cls)
  ) {
    return "confirm";
  }
  return "select";
}

/**
 * Bruitages d'interface globaux (survol / clic) via délégation d'événements :
 * un seul jeu d'écouteurs couvre tous les boutons et liens du jeu, présents et
 * à venir. Un élément peut se retirer avec `data-no-sfx` ou forcer un son avec
 * `data-sfx="confirm|select|back"`.
 */
export function UiSoundEffects() {
  useEffect(() => {
    let hovered: HTMLElement | null = null;
    let lastHoverAt = 0;

    const onPointerOver = (event: Event) => {
      const el = interactiveTarget(event.target);
      if (!el || el === hovered) return;
      hovered = el;
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastHoverAt < 35) return;
      lastHoverAt = now;
      playUiSfx("hover");
    };

    const onPointerOut = (event: Event) => {
      const from = interactiveTarget(event.target);
      if (from && from === hovered) {
        const to = interactiveTarget((event as PointerEvent).relatedTarget);
        if (to !== hovered) hovered = null;
      }
    };

    const onClick = (event: Event) => {
      const el = interactiveTarget(event.target);
      if (!el) return;
      playUiSfx(clickSfxFor(el));
    };

    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    document.addEventListener("click", onClick, {
      passive: true,
      capture: true,
    });

    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, []);

  return null;
}

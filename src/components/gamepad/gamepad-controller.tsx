"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { startGamepadLoop } from "@/lib/gamepad/gamepad-listener";
import { navigateSpatially } from "@/lib/gamepad/spatial-navigation";
import {
  GAMEPAD_EVENTS,
  type GamepadActionEventDetail,
  type GamepadNavEventDetail,
} from "@/lib/gamepad/gamepad-types";
import type { ApplicationSection } from "@/components/application/application-shell";
import { playUiSfx } from "@/lib/audio/ui-sfx";

interface GamepadControllerProps {
  activeSection: ApplicationSection;
  role?: string;
}

const SECTION_ORDER: readonly { section: ApplicationSection; href: string }[] =
  [
    { section: "home", href: "/dashboard" },
    { section: "campaign", href: "/campaign" },
    { section: "training", href: "/training" },
    { section: "team", href: "/team" },
    { section: "gacha", href: "/gacha" },
  ];

const ADMIN_SECTION_ORDER: readonly {
  section: ApplicationSection;
  href: string;
}[] = [
  { section: "overview", href: "/admin?tab=overview" },
  { section: "players", href: "/admin?tab=players" },
  { section: "combats", href: "/admin?tab=combats" },
  { section: "gacha", href: "/admin?tab=gacha" },
  { section: "system", href: "/admin?tab=system" },
];

export function GamepadController({
  activeSection,
  role,
}: Readonly<GamepadControllerProps>) {
  const router = useRouter();
  const activeSectionRef = useRef(activeSection);
  activeSectionRef.current = activeSection;

  useEffect(() => {
    const stopLoop = startGamepadLoop();

    const onGamepadAction = (e: Event) => {
      const customEvent = e as CustomEvent<GamepadActionEventDetail>;
      const detail = customEvent.detail;
      if (!detail) return;

      const isInBattle =
        typeof document !== "undefined" &&
        document.body.classList.contains("in-battle-mode");

      const sectionList =
        role === "admin" ? ADMIN_SECTION_ORDER : SECTION_ORDER;

      // LB (L1) -> Onglet précédent
      if (detail.action === "prev_tab") {
        if (customEvent.defaultPrevented || isInBattle) return;
        const currentSection =
          activeSectionRef.current === "admin"
            ? "overview"
            : activeSectionRef.current;
        const currentIndex = sectionList.findIndex(
          (item) => item.section === currentSection,
        );
        if (currentIndex !== -1) {
          const prevIndex =
            (currentIndex - 1 + sectionList.length) % sectionList.length;
          playUiSfx("select");
          router.push(sectionList[prevIndex].href);
        }
        return;
      }

      // RB (R1) -> Onglet suivant
      if (detail.action === "next_tab") {
        if (customEvent.defaultPrevented || isInBattle) return;
        const currentSection =
          activeSectionRef.current === "admin"
            ? "overview"
            : activeSectionRef.current;
        const currentIndex = sectionList.findIndex(
          (item) => item.section === currentSection,
        );
        if (currentIndex !== -1) {
          const nextIndex = (currentIndex + 1) % sectionList.length;
          playUiSfx("select");
          router.push(sectionList[nextIndex].href);
        }
        return;
      }

      // A -> Confirmer / Cliquer
      if (detail.action === "confirm") {
        if (customEvent.defaultPrevented) return;
        const active = document.activeElement as HTMLElement | null;
        if (
          active &&
          active !== document.body &&
          typeof active.click === "function"
        ) {
          active.click();
        } else {
          const primary = document.querySelector<HTMLElement>(
            ".battle-primary-button, [data-gamepad-primary]",
          );
          if (primary && !primary.hasAttribute("disabled")) {
            primary.click();
          }
        }
        return;
      }

      // B -> Annuler / Retour
      if (detail.action === "cancel") {
        if (customEvent.defaultPrevented) return;
        const closeBtn = document.querySelector<HTMLElement>(
          "[role='dialog'] button[aria-label*='Fermer' i], [role='dialog'] button[aria-label*='fermer' i], .battle-quiet-button, [data-gamepad-back]",
        );
        if (closeBtn && !closeBtn.hasAttribute("disabled")) {
          closeBtn.click();
        }
      }
    };

    const onGamepadNav = (e: Event) => {
      const customEvent = e as CustomEvent<GamepadNavEventDetail>;
      if (customEvent.defaultPrevented) return;
      const detail = customEvent.detail;
      if (!detail) return;

      const navigated = navigateSpatially(detail.direction);
      if (navigated) {
        playUiSfx("hover");
      }
    };

    window.addEventListener(GAMEPAD_EVENTS.ACTION, onGamepadAction);
    window.addEventListener(GAMEPAD_EVENTS.NAV, onGamepadNav);

    return () => {
      window.removeEventListener(GAMEPAD_EVENTS.ACTION, onGamepadAction);
      window.removeEventListener(GAMEPAD_EVENTS.NAV, onGamepadNav);
      stopLoop();
    };
  }, [router, role]);

  return null;
}

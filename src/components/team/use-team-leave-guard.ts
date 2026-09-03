"use client";

import { useEffect, useRef } from "react";

interface TeamLeaveGuardState {
  active: boolean;
  saving: boolean;
}

const UNSAVED_MESSAGE =
  "Quitter cette page et abandonner les modifications non enregistrées ?";
const SAVING_MESSAGE =
  "Une modification de la collection est en cours. Quitter cette page malgré tout ?";

function navigationLink(event: MouseEvent): HTMLAnchorElement | null {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return null;
  }

  const link =
    event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (
    !(link instanceof HTMLAnchorElement) ||
    link.target === "_blank" ||
    link.hasAttribute("download")
  ) {
    return null;
  }

  const target = new URL(link.href);
  if (
    target.pathname === window.location.pathname &&
    target.search === window.location.search &&
    target.origin === window.location.origin
  ) {
    return null;
  }
  return link;
}

/** Protège un rangement non confirmé sans conserver de données côté navigateur. */
export function useTeamLeaveGuard({ active, saving }: TeamLeaveGuardState) {
  const state = useRef<TeamLeaveGuardState>({ active, saving });
  // Un ancien écouteur peut survivre jusqu'au nettoyage de l'effet suivant.
  // La référence lui donne toujours l'état du dernier rendu.
  state.current = { active, saving };

  useEffect(() => {
    if (!active) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!state.current.active) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const leave = (event: MouseEvent) => {
      if (!state.current.active || !navigationLink(event)) return;
      if (
        !window.confirm(state.current.saving ? SAVING_MESSAGE : UNSAVED_MESSAGE)
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", leave, true);
    };
  }, [active]);
}

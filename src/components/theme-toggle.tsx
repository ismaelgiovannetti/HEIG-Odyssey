"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "heig-odyssey-theme";

/** Applique le thème au document et synchronise la couleur du navigateur. */
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#10141A" : "#F8FAFC");
}

/**
 * Permet de basculer entre les thèmes sombre et clair. Le choix est conservé
 * localement, mais le mode sombre reste la valeur de repli du projet.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  // Le script du layout a déjà choisi le thème avant l'hydratation. Le
  // composant reprend cette valeur pour afficher le bon bouton sans clignoter.
  useEffect(() => {
    const currentTheme =
      document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(currentTheme);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    setTheme(nextTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Le changement reste actif même lorsque le stockage est indisponible.
    }
  }

  const isDark = theme === "dark";
  const actionLabel = isDark ? "Activer le mode clair" : "Activer le mode sombre";

  return (
    <button
      className="app-theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={actionLabel}
      aria-pressed={isDark}
      data-tooltip={isDark ? "Mode clair" : "Mode sombre"}
    >
      <span className="app-theme-toggle__orb" aria-hidden="true">
        <Sun className="app-theme-toggle__sun" size={25} />
        <Moon className="app-theme-toggle__moon" size={25} />
      </span>
      <span className="visually-hidden" aria-live="polite">
        {isDark ? "Mode sombre activé" : "Mode clair activé"}
      </span>
    </button>
  );
}

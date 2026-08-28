import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Les classes Tailwind utilisent les mêmes variables CSS que les
      // composants afin de suivre automatiquement le thème clair ou sombre.
      colors: {
        background: "var(--color-bg)",
        "background-alt": "var(--color-bg-alt)",
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        outline: "var(--color-outline)",
        primary: {
          DEFAULT: "var(--color-primary)",
          light: "var(--color-primary-light)",
          dark: "var(--color-primary-dark)",
        },
        secondary: "var(--color-secondary)",
        text: {
          DEFAULT: "var(--color-text)",
          muted: "var(--color-text-muted)",
        },
        border: "var(--color-border)",
        success: "var(--color-success)",
        nav: {
          bg: "var(--color-nav-bg)",
          text: "var(--color-nav-text)",
          muted: "var(--color-nav-muted)",
          control: "var(--color-nav-control)",
        },
      },
      fontFamily: {
        display: ['"Press Start 2P"', "Courier New", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        pixel: "4px 4px 0 var(--color-outline)",
        "pixel-sm": "2px 2px 0 var(--color-outline)",
        "pixel-lg": "6px 6px 0 var(--color-outline)",
      },
    },
  },
  plugins: [],
};

export default config;

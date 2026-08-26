import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        "background-alt": "var(--color-bg-alt)",
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        outline: "var(--color-outline)",
        primary: {
          DEFAULT: "#C94036",
          light: "#B72F28",
          dark: "#8F251F",
        },
        secondary: "#2C2C2C",
        text: {
          DEFAULT: "#202020",
          muted: "#566170",
        },
        border: "#8B96A5",
        success: "#1F7545",
        nav: {
          bg: "#A2332C",
          text: "#FFFFFF",
          muted: "#FBECEA",
          control: "#7C241F",
        },
      },
      fontFamily: {
        display: ['"Press Start 2P"', "Courier New", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        pixel: "4px 4px 0 #202020",
        "pixel-sm": "2px 2px 0 #202020",
        "pixel-lg": "6px 6px 0 #202020",
      },
    },
  },
  plugins: [],
};

export default config;

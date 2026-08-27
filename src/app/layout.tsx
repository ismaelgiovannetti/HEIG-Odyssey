import type { Metadata, Viewport } from "next";
import "./globals.css";

import { MobileUnsupported } from "@/components/mobile-unsupported";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "HEIG Odyssey",
  description: "Jeu web Pokémon compétitif Gen 4 - HEIG-VD",
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: "#10141A",
};

// Ce script s'exécute avant l'affichage afin d'éviter un flash clair. En
// l'absence de préférence enregistrée, HEIG Odyssey démarre en mode sombre.
const themeBootstrapScript = `
  (() => {
    let theme = "dark";

    try {
      const savedTheme = window.localStorage.getItem("heig-odyssey-theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        theme = savedTheme;
      }
    } catch {}

    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      theme === "dark" ? "#10141A" : "#F8FAFC"
    );
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-screen flex flex-col bg-background text-text antialiased">
        <div className="desktop-application">{children}</div>
        <MobileUnsupported />
        <ThemeToggle />
      </body>
    </html>
  );
}

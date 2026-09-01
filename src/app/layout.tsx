import type { Metadata, Viewport } from "next";
import "./globals.css";

import { MobileUnsupported } from "@/components/mobile-unsupported";

export const metadata: Metadata = {
  title: "HEIG Odyssey",
  description: "Jeu web Pokémon compétitif Gen 4 - HEIG-VD",
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#10141A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col bg-background text-text antialiased">
        <div className="desktop-application">{children}</div>
        <MobileUnsupported />
      </body>
    </html>
  );
}

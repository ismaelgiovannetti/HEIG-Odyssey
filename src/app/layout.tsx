import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HEIG Odyssey",
  description: "Jeu web Pokémon compétitif Gen 4 - HEIG-VD",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col bg-background text-text antialiased">
        {children}
      </body>
    </html>
  );
}

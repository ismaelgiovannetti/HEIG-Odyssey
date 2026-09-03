import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 6 lit DATABASE_URL dans le schéma pour les commandes qui en ont besoin.
// Ne pas l'exiger ici : npm ci génère le client sans connexion à une base.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});

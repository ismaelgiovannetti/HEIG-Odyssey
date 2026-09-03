# HEIG Odyssey

HEIG Odyssey est un jeu web solo qui combine l'aventure d'un jeu Pokémon avec la profondeur tactique de combats compétitifs utilisant les règles de la Génération 4.

## MVP

- **Campagne :** 5 mondes Bachelor, 2 mondes Master et 1 monde Doctorat ;
- **Entraînement procédural :** trois niveaux d'IA (facile, normal et difficile) ;
- **Gestion d'équipe et progression persistante :** 1 à 6 créatures actives ;
- **Gacha sans microtransactions :** recrutement exclusif avec la monnaie gagnée en jeu ;
- **Quêtes quotidiennes et hebdomadaires :** objectifs communs et progression individuelle.

## Landing page

La présentation du projet est disponible sur [heig-odyssey.online](https://heig-odyssey.online).

## Stack Technique

- **Frontend & Backend :** Next.js 15 (App Router), React 19, TypeScript strict, Tailwind CSS.
- **Base de données & ORM :** PostgreSQL, Prisma ORM.
- **Cache & Événements :** Redis, Redis Streams.
- **Authentification & Emails :** Better Auth, Resend.
- **Moteur de combat :** `@pkmn/sim` (Génération 4).
- **Conteneurs & CI/CD :** Docker Compose, GitHub Actions, GHCR.

## Démarrage rapide en local (US-18)

### 1. Prérequis
- [Node.js](https://nodejs.org/) version 22 ou supérieure
- [Docker](https://www.docker.com/) et Docker Compose

### 2. Installation
```bash
# Cloner le dépôt et copier l'environnement
cp .env.example .env

# Installer les dépendances
npm ci
```

### 3. Démarrer les dépendances (PostgreSQL & Redis)
```bash
docker compose up -d postgres redis
```

### 4. Appliquer les migrations et le seed initial
```bash
npm run db:deploy
npm run db:seed
```

### 5. Lancer le worker de quêtes et le serveur de développement
```bash
# Le worker traite les événements de combat et actualise les quêtes.
docker compose up -d worker

npm run dev
```
L'application est accessible sur [http://localhost:3000](http://localhost:3000). Le contrôle de santé est disponible sur `GET /api/health`.

Le worker doit rester actif pendant le développement. Son état et ses journaux
peuvent être consultés avec `docker compose ps worker` et
`docker compose logs -f worker`.

### 6. Commandes de contrôle qualité (US-19)
```bash
npm run lint          # Analyse statique ESLint
npm run typecheck     # Validation stricte des types TypeScript
npm run test:unit      # Tests unitaires Vitest
npm run test:combat    # Tests du moteur de combat Gen 4
npm run build          # Compilation de production Next.js
```

## Documentation

- [Kick-off](docs/01-kickoff/HEIG_Odyssey_Kickoff.md)
- [Personas](docs/02-conception/HEIG_Odyssey_Personas.md)
- [User stories](docs/02-conception/HEIG_Odyssey_User_Stories.md)
- [Modèle de données](docs/02-conception/HEIG_Odyssey_Modele_Donnees.md)
- [Tâches et estimations](docs/03-planification/HEIG_Odyssey_Taches.md)
- [Guide de création des tâches GitHub](docs/03-planification/HEIG_Odyssey_Guide_Creation_Taches_GitHub.md)
- [Sprint 1](docs/04-sprints/HEIG_Odyssey_Taches_Sprint1.md)

## Workflow Git

Chaque modification est réalisée dans une branche `feature/*` ou `fix/*` créée depuis `dev`.

Une Pull Request avec revue humaine et CI verte est obligatoire pour intégrer une modification dans `dev`. À la fin de chaque sprint, une Pull Request de release permet de promouvoir `dev` vers `main`.

Les branches `dev` et `main` sont protégées et n'acceptent aucun push direct.

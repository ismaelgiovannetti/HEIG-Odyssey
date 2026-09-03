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

Le dossier [`landing-page/`](landing-page/) contient une application statique
déployée indépendamment du jeu Next.js. Les assets qu'elle partage avec le jeu
ont [`public/`](public/) comme source canonique et sont synchronisés par les
commandes décrites dans [son guide](landing-page/README.md).

## Stack Technique

- **Frontend & Backend :** Next.js 15 (App Router), React 19, TypeScript strict, Tailwind CSS.
- **Base de données & ORM :** PostgreSQL, Prisma ORM.
- **Cache & Événements :** Redis, Redis Streams.
- **Authentification & Emails :** Better Auth, Resend.
- **Moteur de combat :** `@pkmn/sim` (Génération 4).
- **Conteneurs & CI/CD :** Docker Compose, GitHub Actions, GHCR.

## Démarrage rapide en local

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

L'application est accessible sur [http://localhost:3000](http://localhost:3000).
Le contrôle `GET /api/health` vérifie PostgreSQL et Redis et renvoie un statut
`503` si l'une de ces dépendances est indisponible.

Le worker doit rester actif pendant le développement. Son état et ses journaux
peuvent être consultés avec `docker compose ps worker` et
`docker compose logs -f worker`.

### 6. Commandes de contrôle qualité

```bash
npm run lint              # Analyse ESLint de l'ensemble du code
npm run format:check      # Vérification du formatage Prettier
npm run typecheck         # Validation stricte des types TypeScript
npm test                  # Tests unitaires et moteur de combat
npm run test:coverage     # Tests avec seuils de couverture
npm run test:integration  # Intégration PostgreSQL et Redis
npm run build             # Compilation de production Next.js
```

Les tests d'intégration nécessitent les services locaux :

```bash
docker compose up -d postgres redis
npm run db:deploy
npm run test:integration
```

Pour les contrôles navigateur, installez d'abord Chromium :

```bash
npx playwright install chromium
npm run test:e2e           # Parcours desktop, fallback mobile et accessibilité
npm run test:e2e:chromium  # Parcours fonctionnels rapides sur Chromium
npm run test:a11y          # Accessibilité uniquement
```

## Documentation

- [Architecture du dépôt](docs/ARCHITECTURE.md)
- [Guide de la landing page et des assets partagés](landing-page/README.md)
- [Maquettes](docs/design/mockups/)
- [Storyboards](docs/design/storyboards/)
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

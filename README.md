# HEIG Odyssey

HEIG Odyssey est un jeu web solo qui combine l'aventure d'un jeu Pokémon avec la profondeur tactique de combats compétitifs utilisant les règles de la Génération 4.

## MVP

- campagne : 5 mondes Bachelor, 2 mondes Master et 1 monde Doctorat ;
- entraînement procédural avec trois niveaux d'IA ;
- gestion d'équipe et progression persistante ;
- gacha sans microtransactions ;
- quêtes quotidiennes et hebdomadaires.

## Landing page

La présentation du projet est disponible sur [heig-odyssey.online](https://heig-odyssey.online).

## Stack

Next.js, TypeScript, PostgreSQL, Prisma, Redis/Redis Streams, Better Auth, `@pkmn/sim`, Docker et GitHub Actions.

## Documentation

- [Kick-off](deliverables/HEIG_Odyssey_Kickoff_Semaine_1.md)
- [Personas](deliverables/HEIG_Odyssey_Personas.md)
- [User stories](deliverables/HEIG_Odyssey_User_Stories.md)
- [Tâches](deliverables/HEIG_Odyssey_Taches.md)

## Workflow

Chaque modification est réalisée dans une branche `feature/*` ou `fix/*` créée depuis `dev`.

Une Pull Request avec revue humaine et CI verte est obligatoire pour intégrer une modification dans `dev`. À la fin de chaque sprint, une Pull Request de release permet de promouvoir `dev` vers `main`.

Les branches `dev` et `main` sont protégées et n'acceptent aucun push direct.

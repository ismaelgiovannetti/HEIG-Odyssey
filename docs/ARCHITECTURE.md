# Architecture du dépôt

Ce dépôt contient deux applications déployables et les services nécessaires au
jeu HEIG Odyssey.

## Arborescence

```text
.
├── content/                  Données éditoriales canoniques du jeu
├── docs/                     Documentation du projet et livrables de conception
│   └── design/
│       ├── mockups/
│       └── storyboards/
├── landing-page/             Site public statique, déployé séparément
├── prisma/                   Schéma, migrations et données initiales
├── public/                   Ressources servies par l'application Next.js
├── scripts/
│   ├── dev/                  Outils locaux modifiant les données de développement
│   ├── import/               Imports reproductibles de ressources
│   └── ops/                  Contrôles utilisés par Docker et la CI
├── src/
│   ├── app/                  Routes et points d'entrée Next.js
│   ├── components/           Interfaces regroupées par domaine
│   ├── lib/                  Métier, contrats et accès aux infrastructures
│   └── worker/               Consommateur des événements asynchrones
└── test/
    ├── combat/               Tests spécialisés du moteur de combat
    ├── e2e/                  Parcours navigateur et accessibilité
    ├── integration/          Tests avec PostgreSQL ou Redis réels
    └── unit/                 Tests isolés et rapides
```

## Sources de vérité

Les fichiers de `content/` sont la source de vérité des mondes, dresseurs,
quêtes, bannières et pistes audio. Ils sont validés à leur chargement par les
schémas de `src/lib/content/`. Aucun script ne doit les réécrire à partir d'une
copie codée en dur.

Les libellés Pokémon partagés appartiennent à `src/lib/pokemon/`. Les composants
ne doivent pas maintenir leur propre table de traduction.

## Frontières client et serveur

Les objets échangés avec le navigateur sont définis dans des modules de contrat
purs, sans dépendance à Prisma, Redis ou au système de fichiers. Les réponses
réseau sont validées avant leur utilisation côté client.

Les modules qui ouvrent une connexion, lisent le disque ou manipulent des
données privées sont réservés au serveur avec `server-only`. Un composant client
peut importer un type partagé, mais jamais une implémentation de service serveur.

## Scripts

Chaque utilitaire conservé doit être documenté dans `scripts/README.md`, être
accessible par une commande explicite et annoncer les données qu'il lit ou
modifie. Les scripts destructifs exigent toujours une cible et une action
explicites.

## Assets de la landing page

La landing page possède son propre contexte de déploiement. Les quelques assets
également utilisés par l'application ont `public/` comme source canonique. Leur
copie dans `landing-page/assets/` est contrôlée automatiquement afin d'empêcher
les divergences silencieuses.

## Règles de dépendance

- `src/app` assemble les pages et appelle les services ;
- `src/components` dépend des contrats et utilitaires purs ;
- `src/lib` ne dépend pas des composants React ;
- `src/worker` consomme les contrats d'événements et les services métier ;
- les tests unitaires n'utilisent aucun service réel ;
- les tests d'intégration annoncent et démarrent leurs dépendances externes.

Toute nouvelle exception à ces règles doit être documentée ici avec sa raison.

# Landing page

Cette application statique possède son propre contexte Docker afin de pouvoir
être construite et déployée indépendamment du jeu Next.js.

Les sprites de présentation lui appartiennent. Quelques éléments visuels
communs (logo, favicon, arène, portraits et sprite du joueur) sont toutefois
copiés depuis `public/` pour que l'image Docker reste autonome.

- `npm run landing:assets:check` vérifie que ces copies sont identiques.
- `npm run landing:assets:sync` les resynchronise depuis leur source canonique.

Après une modification d'un asset partagé, exécutez la synchronisation depuis
la racine du dépôt et versionnez les copies mises à jour.

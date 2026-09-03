# Scripts de maintenance

Exécutez ces commandes depuis la racine du dépôt. Les fichiers JSON de
`content/` constituent la source de vérité du jeu : aucun script ne doit les
regénérer silencieusement.

## Import

- `npm run sprites:import` télécharge les sprites manquants depuis PokéAPI et
  met à jour `public/sprites/manifest.json`.

## Développement

- `TARGET_EMAIL=toi@exemple.ch npx tsx scripts/dev/unlock-campaign.ts --unlock`
  déverrouille la campagne du compte indiqué.
- `TARGET_EMAIL=toi@exemple.ch npx tsx scripts/dev/unlock-campaign.ts --reset`
  supprime sa progression de campagne.

Ces deux commandes modifient la base de données. L'adresse et l'action sont
volontairement obligatoires.

## Exploitation

`scripts/ops/worker-healthcheck.mjs` est lancé automatiquement par Docker. Il
contrôle PostgreSQL, Redis et la présence du groupe de consommateurs du worker.

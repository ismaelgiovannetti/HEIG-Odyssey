# T-US20-06 — Logs structurés et corrélation

## Format

Les journaux applicatifs sont émis en JSON par `src/lib/logger.ts`. Chaque
entrée contient `timestamp`, `level` et `message`, ainsi qu'un identifiant de
corrélation :

- `requestId` pour une requête HTTP ;
- `eventId` pour un événement métier, un traitement asynchrone ou une étape
  d'exploitation.

Le contexte complémentaire est placé dans `data`. Une erreur est représentée
par son nom, son message et, hors production, sa stack.

## Corrélation HTTP et événements

Le middleware des routes `/api/*` accepte un en-tête `x-request-id` uniquement
s'il respecte le format autorisé. Sinon, il génère un UUID préfixé par `req_`.
Le même identifiant est transmis à la route et renvoyé dans la réponse.

Les publications Redis conservent l'`eventId` de l'enveloppe métier dans tous
les logs de publication, de retry, de dispatch et de traitement par le worker.
Les événements d'exploitation sans enveloppe métier reçoivent un nouvel
identifiant préfixé par `evt_`.

## Protection des secrets

Le logger masque récursivement les champs sensibles et les secrets présents
dans les chaînes, messages d'erreur et stacks. Les mots de passe, jetons,
cookies, clés API, en-têtes Bearer et identifiants de connexion PostgreSQL ne
doivent jamais être journalisés en clair.

La CI exécute Gitleaks sur l'historique Git avant le lint, les tests, la
construction et le déploiement. Une détection interrompt donc le pipeline avant
la publication d'une image ou une connexion au serveur de production.

# HEIG Odyssey - Instructions reproductibles de lancement local

## 1. Objectif et environnement retenu

Cette procédure décrit un premier lancement du jeu avec Next.js sur la machine de développement, PostgreSQL et Redis dans Docker, puis le worker de quêtes dans son propre conteneur. Elle ne nécessite aucun accès au VPS ni aux secrets de production.

Les commandes sont prévues pour un terminal Bash sous Linux, macOS ou WSL2. Sous Windows, utilisez de préférence une distribution WSL2 avec l'intégration Docker activée et conservez le dépôt dans son système de fichiers Linux. N'alternez pas les installations npm Windows et Linux dans le même dossier.

Le document correspond aux fichiers du dépôt lus le 3 septembre 2026, sur la base du commit `d8230c5`. Les versions exactes des dépendances sont verrouillées dans `package-lock.json`. Les images d'infrastructure sont référencées par empreinte dans les fichiers Compose.

## 2. Prérequis

Préparez Git, Node.js 22 avec npm, Docker Engine ou Docker Desktop et le plugin Docker Compose v2. Node.js 22 correspond à la version utilisée par la CI et les images du projet. Une connexion Internet est nécessaire pour télécharger le dépôt, les dépendances et les images. Chromium sera installé séparément si vous souhaitez lancer les tests navigateur.

Vérifiez leur disponibilité :

```bash
git --version
node --version
npm --version
docker version
docker compose version
```

Le moteur Docker doit être démarré et utilisable par votre compte. Les ports locaux 3000, 5432 et 6379 doivent être libres. Les tests Playwright utilisent aussi le port 3100 ; la présentation statique peut être lancée séparément sur 8080.

Pour effectuer une véritable inscription, prévoyez une clé Resend utilisable et une adresse d'expédition autorisée pour cette clé. Sans envoi d'e-mail fonctionnel, l'application peut démarrer, mais le nouveau compte ne pourra pas terminer le parcours normal de vérification. Demandez une configuration de développement aux mainteneurs ou utilisez votre propre compte Resend ; ne récupérez pas les secrets de production.

## 3. Récupérer le dépôt

Pour obtenir la version d'intégration :

```bash
git clone --branch dev https://github.com/ismaelgiovannetti/HEIG-Odyssey.git
cd HEIG-Odyssey
git rev-parse HEAD
```

Conservez le SHA affiché si vous devez communiquer précisément la version utilisée. Si le dépôt n'est pas accessible à votre compte, demandez d'abord l'accès aux mainteneurs. Pour contribuer, créez ensuite une branche suivant le [guide de contribution](04-contribution.md).

Toutes les commandes qui suivent, sauf indication contraire, sont exécutées depuis la racine `HEIG-Odyssey`.

## 4. Configurer les variables locales

Lors du premier lancement uniquement, si aucun `.env` n'existe encore :

```bash
cp .env.example .env
```

Ouvrez `.env` dans votre éditeur. Ne remplacez pas un fichier existant sans conserver sa configuration. Ce fichier est exclu de Git et ne doit jamais être joint à une Pull Request.

Pour la procédure décrite ici :

- Conservez `NODE_ENV=development`.
- Utilisez `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/heig_odyssey?schema=public`. Ces identifiants sont ceux du PostgreSQL local déclaré dans `docker-compose.yml` et ne doivent pas être réutilisés en production.
- Utilisez `REDIS_URL=redis://localhost:6379`.
- Définissez `BETTER_AUTH_URL=http://localhost:3000` et `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
- Remplacez `BETTER_AUTH_SECRET` par un secret aléatoire d'au moins 32 caractères, propre à cet environnement.
- Remplacez `RESEND_API_KEY` et `RESEND_FROM_EMAIL` par vos paramètres de développement. L'adresse d'expédition doit être autorisée par votre configuration Resend.

Un secret peut être généré localement avec :

```bash
openssl rand -base64 32
```

Copiez le résultat dans `.env`, sans l'ajouter à un document versionné. Gardez le même secret entre les redémarrages ordinaires.

L'URL Better Auth doit représenter une origine, sans chemin de page ni paramètres. Utilisez ensuite la même adresse dans le navigateur : ne mélangez pas `localhost` et `127.0.0.1` dans le parcours manuel. HTTP est accepté pour le développement local ; une origine publique doit utiliser HTTPS.

Même lorsque vous ne démarrez que PostgreSQL et Redis, Compose analyse les substitutions du fichier complet. Les variables exigées pour le service applicatif doivent donc être renseignées dans `.env`.

## 5. Installer les dépendances

```bash
npm ci
```

Cette commande installe les versions du fichier de verrouillage et exécute `prisma generate` via le script `postinstall`. La génération du client ne demande pas de base démarrée ni de `DATABASE_URL`. En revanche, les commandes qui consultent ou modifient la base ont besoin de l'URL.

Des avertissements de dépréciation peuvent être affichés pour les versions actuelles de certaines dépendances. Ils ne constituent pas, à eux seuls, un échec d'installation. Consultez le code de sortie et les erreurs finales. N'exécutez pas de mise à niveau majeure ni `npm audit fix --force` pour masquer ces messages.

## 6. Démarrer PostgreSQL et Redis

```bash
docker compose up -d --wait postgres redis
docker compose ps
```

Les deux services doivent être démarrés et sains. Ils exposent leurs ports uniquement sur l'interface locale de la machine. Les données sont conservées dans les volumes Docker `postgres_data` et `redis_data` du projet Compose.

Pour diagnostiquer un démarrage :

```bash
docker compose logs --tail=100 postgres redis
```

## 7. Initialiser la base

Appliquez les migrations versionnées, puis les données initiales :

```bash
npm run db:deploy
npx prisma db seed
```

La seconde commande charge `prisma.config.ts`, qui charge l'environnement local et définit le programme de seed `tsx prisma/seed.ts`. Le seed initialise les définitions de quêtes et une bannière de base au moyen d'upserts. Il ne crée pas de compte de démonstration, de mot de passe partagé ou de collection de joueur.

Les bannières effectivement proposées par la boutique proviennent de `content/gacha-banners.json`. Le seed ne remplace pas ce catalogue par la bannière historique qu'il conserve en base.

`npm run db:deploy` applique seulement les migrations présentes dans le dépôt. N'utilisez pas `prisma db push` pour remplacer cette étape. `npm run db:migrate` est réservé au développement d'une nouvelle migration, pas au simple lancement du projet.

## 8. Lancer le worker et le jeu

Construisez et démarrez le worker :

```bash
docker compose up -d --build --wait worker
docker compose ps worker
```

Le worker récupère les événements de combat et met à jour les quêtes. Il doit rester actif pendant les sessions de jeu. Il communique avec PostgreSQL et Redis par leurs noms de services Docker ; vous ne devez pas remplacer les adresses locales du `.env` utilisé par Next.js par ces noms internes.

Lancez ensuite Next.js et gardez ce terminal ouvert :

```bash
npm run dev
```

Ouvrez `http://localhost:3000` sur un ordinateur. Pour cette procédure, ne démarrez pas également le service Docker `app` : il utiliserait lui aussi le port 3000.

Le worker conteneurisé ne se recharge pas automatiquement lorsque ses sources changent. Après une modification le concernant, relancez `docker compose up -d --build --wait worker`.

## 9. Vérifier le fonctionnement

Dans un second terminal, depuis la racine du dépôt :

```bash
curl --fail --silent --show-error http://localhost:3000/api/health
docker compose exec -T worker node scripts/ops/worker-healthcheck.mjs
```

Le premier contrôle doit renvoyer un état `ok` avec PostgreSQL et Redis disponibles. Il renvoie HTTP 503 si une de ces dépendances est indisponible. Le second contrôle vérifie aussi l'existence du groupe Redis du worker ; il réussit sans produire de message.

Effectuez ensuite un contrôle fonctionnel : créez un compte, recevez et validez son e-mail, connectez-vous, terminez le recrutement initial, lancez un entraînement et consultez les missions. Vérifiez enfin que la collection et la progression sont retrouvées après reconnexion.

Un contrôle de santé réussi ne valide pas l'envoi d'e-mails et ne remplace pas ce parcours. Les sessions de combat en cours sont en mémoire : un redémarrage du serveur peut interrompre un combat, même si les gains déjà enregistrés restent conservés.

## 10. Lancer les contrôles locaux avant une contribution

### 10.1. Code, sécurité des dépendances et build

```bash
npm audit --audit-level=high &&
npm run lint &&
npm run format:check &&
npm run landing:assets:check &&
npm run typecheck &&
npm run test:coverage &&
npm run test:performance &&
npm run build
```

La séquence s'arrête au premier échec. La couverture inclut les tests unitaires et de combat ; les tests de performance sont exécutés séparément avec un seul worker pour limiter la concurrence entre mesures. Un build Next.js peut demander les variables d'authentification même s'il n'effectue pas de connexion utilisateur.

### 10.2. Intégration et navigateur

Utilisez exclusivement une base de développement ou une base de tests jetable, jamais la production. Ces tests créent et nettoient des données. Les tests d'intégration nécessitent PostgreSQL et Redis réels.

```bash
npm run db:deploy &&
npm run test:integration
```

Installez Chromium avant le premier lancement Playwright. Sous Linux ou WSL, l'installation des bibliothèques système peut demander des droits administrateur :

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

Playwright démarre lui-même un serveur sur `127.0.0.1:3100`, avec un répertoire de compilation `.next-playwright` distinct. Il attend que `/api/health` soit prêt. Laissez ce port libre et ne démarrez pas manuellement un second serveur de test dessus.

La commande E2E exécute les parcours fonctionnels, le remplacement de l'interface sur mobile et l'accessibilité, tous sur Chromium. Pour cibler un groupe, utilisez `npm run test:e2e:chromium` ou `npm run test:a11y`. Les comptes navigateur sont préparés par les tests ; ce parcours automatisé ne valide pas la livraison réelle d'e-mails Resend.

Les captures, traces et vidéos d'échec sont placées dans `test-results/playwright/`. Le rapport HTML est activé par la configuration CI ; un lancement local standard utilise le rapport texte.

Les erreurs Prisma émises par les tests qui vérifient volontairement des contraintes de base ne constituent pas un échec si les assertions et le bilan final passent. Un rapport `failed` reste à traiter.

## 11. Site statique de présentation, facultatif

Ce site est indépendant du jeu. Pour le consulter localement sans démarrer Next.js :

```bash
docker build -t heig-odyssey-landing-local ./landing-page
docker run --rm --name heig-odyssey-landing-local -p 127.0.0.1:8080:80 heig-odyssey-landing-local
```

Ouvrez `http://localhost:8080`. Le conteneur utilise Nginx et s'arrête avec `Ctrl+C`. Les liens vers le jeu peuvent toujours viser le domaine public prévu dans la présentation.

## 12. Arrêt, reprise et problèmes fréquents

Arrêtez Next.js avec `Ctrl+C`. Pour arrêter les services locaux en conservant leurs données :

```bash
docker compose stop worker postgres redis
```

Pour reprendre, démarrez les services, appliquez les éventuelles nouvelles migrations, reconstruisez le worker si nécessaire et relancez `npm run dev`. Après une modification de `package-lock.json`, réexécutez `npm ci`.

N'utilisez pas `docker compose down -v` pour un arrêt ordinaire : cette commande supprimerait les volumes et leurs données. La suppression de données ne fait pas partie de cette procédure.

Si un port est occupé, identifiez le service existant avant de l'arrêter ; ne tuez pas tous les processus Node. Si PostgreSQL refuse la connexion, comparez `.env` et le service Compose. Un ancien volume peut conserver les identifiants utilisés lors de sa création.

Si une inscription semble envoyée mais qu'aucun message n'arrive, vérifiez les paramètres Resend, les destinataires autorisés et les journaux serveur. Le code ne journalise pas les liens de vérification pour fournir un contournement local.

Si les quêtes ne progressent pas, consultez `docker compose logs --tail=100 worker` et l'état du worker. Si `npm run worker` est utilisé à la place de Docker, l'environnement doit être fourni explicitement au processus ; la procédure principale évite cette ambiguïté avec les variables du conteneur.

Si une interface mobile de remplacement apparaît, agrandissez la fenêtre et utilisez un ordinateur. Ce comportement est une limite volontaire du jeu actuel.

## 13. Sources de la procédure

- [Variables d'exemple](../../.env.example) et [Compose local](../../docker-compose.yml).
- [Scripts npm](../../package.json), [configuration Prisma](../../prisma.config.ts) et [seed](../../prisma/seed.ts).
- [Configuration Playwright](../../playwright.config.ts) et [configuration Vitest](../../vitest.config.ts).
- [Santé du jeu](../../src/app/api/health/route.ts) et [santé du worker](../../scripts/ops/worker-healthcheck.mjs).
- [Déploiement](03-deploiement-ci-cd.md) et [contribution](04-contribution.md).

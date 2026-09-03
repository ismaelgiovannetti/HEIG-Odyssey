# HEIG Odyssey - Déployer une nouvelle fonctionnalité avec la CI/CD

## 1. Objet et source de vérité

Ce document décrit le parcours d'une fonctionnalité depuis sa branche de travail jusqu'au VPS de production. Il s'appuie sur le workflow `.github/workflows/ci-cd.yml`, les fichiers Compose et les Dockerfiles présents dans le dépôt, lus le 3 septembre 2026 sur la base du commit `d8230c5`.

Il distingue les opérations réalisées par un contributeur, les validations des mainteneurs et les prérequis d'administration. Les commandes présentées ne supposent pas que les secrets ou protections GitHub soient déjà correctement configurés : ces réglages externes doivent être vérifiés par un mainteneur.

Le pipeline effectif fait foi pour les déclencheurs et les commandes. Certaines descriptions historiques dans la documentation de protection des branches ne détaillent plus toutes les étapes actuelles.

## 2. Principe de livraison

Une modification est développée sur une branche `feature/*` ou `fix/*` issue de `dev`. Une première Pull Request l'intègre dans `dev`. Une seconde Pull Request, de `dev` vers `main`, prépare la livraison de production.

La fusion dans `dev` ne déploie pas le jeu sur le VPS. Le déploiement est déclenché par le push sur `main` produit par la fusion de la Pull Request de livraison. Aucune étape du workflow ne déploie une branche de fonctionnalité ou une Pull Request directement en production.

La méthode normale ne consiste donc pas à se connecter au serveur pour y exécuter un `git pull` et reconstruire le jeu. GitHub Actions construit les images, teste ces images, les publie et demande au VPS d'utiliser exactement les références correspondantes.

## 3. Préparation de GitHub, à effectuer par les mainteneurs

### 3.1. Accès et protections

Les Actions doivent être activées pour le dépôt. La politique documentée prévoit des Pull Requests, au moins une approbation humaine et des vérifications réussies avant fusion. Les branches `dev` et `main` ne doivent pas être utilisées pour des pushs directs de fonctionnalités.

Configurez ou vérifiez les protections dans GitHub. Les noms des contrôles à prendre en compte sont `Validate pull request source`, `Quick CI`, `Integration CI (PostgreSQL & Redis)` et `Full release validation`. Le dernier contrôle s'exécute actuellement sur toutes les Pull Requests vers `dev` ou `main`. Son caractère obligatoire dans les règles de fusion doit être vérifié dans les paramètres réels du dépôt ; la présence du fichier YAML n'active pas, à elle seule, une protection de branche.

Le workflow donne par défaut une permission de lecture du contenu. Le job de publication dispose en plus de `packages: write`. Ne remplacez pas ces permissions ciblées par des droits d'écriture généraux pour contourner un échec.

### 3.2. Secrets Actions requis pour la production

Renseignez les secrets suivants dans les paramètres Actions du dépôt, sans les écrire dans le code, un ticket ou une capture :

- `HOST` : adresse du VPS joignable en SSH depuis le runner.
- `USERNAME` : compte de déploiement sur le VPS.
- `SSH_KEY` : clé privée correspondant à une clé publique autorisée pour ce compte.
- `PORT` : port du service SSH.
- `CR_PAT` : jeton permettant au VPS de lire les quatre images privées éventuelles dans GHCR. Le workflow utilise `github.actor` comme nom de connexion GHCR ; assurez-vous de la compatibilité de ce compte et du jeton pour les personnes autorisées à déclencher une livraison.
- `POSTGRES_PASSWORD` : mot de passe de PostgreSQL en production. Le Compose l'insère également dans une URL de connexion ; choisissez une valeur aléatoire longue compatible avec cette utilisation, par exemple une chaîne hexadécimale, sans la réutiliser ailleurs.
- `BETTER_AUTH_SECRET` : secret aléatoire d'authentification d'au moins 32 caractères, distinct de celui du développement.
- `RESEND_API_KEY` : clé d'envoi des messages de production.
- `RESEND_FROM_EMAIL` : expéditeur autorisé par cette configuration Resend.

`GITHUB_TOKEN` est fourni automatiquement par GitHub Actions. Il est utilisé pour les opérations du workflow, notamment la publication GHCR ; il ne remplace pas le secret `CR_PAT` transmis au VPS par ce pipeline.

### 3.3. Variables Actions requises

Définissez les variables de dépôt suivantes :

- `BETTER_AUTH_URL` : `https://play.heig-odyssey.online` pour la topologie actuelle.
- `NEXT_PUBLIC_APP_URL` : la même origine publique du jeu.

Le site statique utilise `heig-odyssey.online` et `www.heig-odyssey.online`. Ces hôtes, celui du jeu et l'adresse ACME sont définis dans les fichiers de production. Une installation sous d'autres domaines nécessite une modification versionnée de ces configurations et des contrôles publics du pipeline, pas seulement un changement de variables GitHub.

## 4. Préparation du VPS, à effectuer avant la première livraison

Le serveur doit disposer de Docker, de Docker Compose v2, de Bash et de `curl`. Les images sont construites sans configuration multiarchitecture sur les runners Ubuntu du workflow ; prévoyez un VPS compatible avec leur architecture, en pratique Linux x86-64 pour cette configuration.

Le compte SSH de déploiement doit pouvoir exécuter Docker et écrire dans `/home/app/heig-odyssey`, chemin fixé par le workflow. Un administrateur doit préparer ce répertoire et les accès correspondants. L'accès au moteur Docker confère des capacités élevées sur l'hôte ; il doit être réservé au compte de confiance utilisé pour le déploiement.

Préparez les enregistrements DNS des trois hôtes vers le VPS et autorisez les ports 80 et 443 nécessaires au routage et aux certificats, ainsi que le port SSH choisi. Le serveur doit pouvoir télécharger les images GHCR. PostgreSQL et Redis n'ont pas à être publiés sur Internet.

Traefik est lancé par `compose.prod.yml`. Sa configuration est montée depuis `traefik.dynamic.yml`, sans accès au socket Docker. Les certificats sont conservés dans le dossier `letsencrypt` sous le répertoire de déploiement. Préservez ce dossier et ses droits lors des interventions.

La production utilise des volumes nommés pour PostgreSQL et Redis. Le répertoire de travail et le nom du projet Compose doivent rester stables afin de ne pas démarrer par erreur des volumes neufs. Aucun `down -v` ne doit faire partie d'un déploiement courant.

Le workflow ne crée pas le VPS, le compte SSH, les entrées DNS, les sauvegardes externes ou les secrets GitHub. Il ne définit pas non plus d'environnement GitHub nommé avec approbation manuelle de déploiement. Une étape de validation de ce type ne doit pas être supposée présente si elle n'a pas été configurée séparément.

## 5. Préparer la fonctionnalité

Sur un dépôt propre, depuis la racine :

```bash
git switch dev
git pull --ff-only origin dev
git switch -c feature/nom-de-la-fonctionnalite
```

Remplacez le suffixe par un nom descriptif. Si une branche de travail existe déjà, utilisez-la au lieu d'en créer une seconde. Suivez le [guide de lancement local](02-lancement-local.md), réalisez la modification et ajoutez les tests adaptés.

Si le schéma Prisma change, créez une nouvelle migration sur une base de développement et versionnez le fichier SQL produit avec le schéma :

```bash
npm run db:migrate -- --name nom_de_la_migration
```

Examinez ce SQL. Une migration déjà appliquée ne doit pas être réécrite. Les nouvelles migrations doivent rester compatibles avec l'ancienne application pendant la mise à jour et, autant que possible, pendant un retour arrière. Une suppression de colonne ou une transformation irréversible demande un plan spécifique, une sauvegarde et une validation humaine explicite.

Exécutez les contrôles locaux décrits dans le guide de lancement, puis préparez un commit contenant uniquement les changements de la fonctionnalité. Un message de commit peut suivre la forme anglaise `feat: ...`, `fix: ...` ou `docs: ...`.

```bash
git status
git add -A
git diff --cached --check
git diff --cached
git commit -m "feat: describe the delivered functionality"
git push -u origin feature/nom-de-la-fonctionnalite
```

Avant le commit, vérifiez que le diff préparé ne contient ni `.env`, ni secrets, ni données de joueurs, ni rapports générés.

## 6. Intégrer dans dev et préparer la livraison

Créez une Pull Request dont la base est `dev` et la source votre branche `feature/*` ou `fix/*`. Décrivez le besoin, les changements, les vérifications réalisées et les éventuelles migrations ou nouvelles variables nécessaires.

Le push de branche déclenche les contrôles rapides. La Pull Request déclenche en plus les vérifications d'intégration et de livraison. Corrigez les échecs et les commentaires de revue avant la fusion. Le workflow refuse une Pull Request vers `dev` dont le nom de branche source ne commence ni par `feature/` ni par `fix/`.

Après intégration et validation de l'ensemble de `dev`, un mainteneur crée une Pull Request dont la base est `main` et la source `dev`. Le workflow refuse une autre branche source pour cette destination. La livraison doit être revue et fusionnée avec la méthode autorisée par les protections du dépôt, sans les contourner.

## 7. Contrôles exécutés par le pipeline

### 7.1. Contrôles rapides

Le job `Quick CI` s'exécute sur les pushs vers `dev`, `main`, `feature/*` et `fix/*`, ainsi que sur les Pull Requests vers `dev` et `main`.

Il recherche les secrets avec Gitleaks, vérifie les fichiers et scripts attendus, installe Node.js 22, exécute `npm ci`, puis l'audit des dépendances au seuil `high`. Il lance le lint, Prettier, la vérification des assets partagés, TypeScript, les tests avec couverture, les seuils de performance et le build Next.js.

Le rapport `results.sarif` est un artefact généré, exclu du formatage et du dépôt. La configuration Gitleaks conserve les règles par défaut et une exception étroite pour un identifiant fictif de test ; elle ne désactive pas l'analyse générale des tests.

### 7.2. Intégration et validation des Pull Requests

`Integration CI (PostgreSQL & Redis)` s'exécute sur les pushs vers `dev` et les Pull Requests. Il prépare PostgreSQL et Redis, applique les migrations, lance les tests d'intégration et contrôle le Compose.

`Full release validation` s'exécute sur chaque Pull Request, après les contrôles précédents. Il prépare une base et un Redis de tests, applique les migrations, installe Chromium et lance les parcours Playwright, y compris l'accessibilité et l'écran mobile de remplacement. Les diagnostics navigateur sont conservés sept jours lorsqu'ils sont présents.

Ce job valide également les configurations Compose, construit les quatre images et les démarre ensemble avec `compose.ci.yml`. Les contrôles portent sur la migration, la santé du jeu, la présentation et la présence du groupe de consommateurs du worker.

### 7.3. Publication après fusion dans main

Sur un push vers `main`, `Test and publish SHA images` attend la réussite de `Quick CI`. Il construit quatre images, les teste ensemble, se connecte à GHCR puis pousse ces mêmes images sans les reconstruire.

Pour ce dépôt, les références prennent la forme suivante, avec le SHA complet du commit de `main` :

- `ghcr.io/ismaelgiovannetti/heig-odyssey:SHA` pour le jeu.
- `ghcr.io/ismaelgiovannetti/heig-odyssey-worker:SHA` pour le worker.
- `ghcr.io/ismaelgiovannetti/heig-odyssey-migrate:SHA` pour les migrations.
- `ghcr.io/ismaelgiovannetti/heig-odyssey-landing:SHA` pour la présentation.

Ce sont des tags identifiés par commit, et non un tag `latest`. La publication de `main` ne rejoue pas séparément tous les tests d'intégration et E2E de la Pull Request : l'obligation de faire passer la Pull Request de livraison est donc importante.

## 8. Ce qui est exécuté sur le VPS

Le job `Deploy exact SHA to VPS` attend la publication. Une concurrence nommée `production-vps` empêche deux déploiements de modifier simultanément le serveur.

Le job copie les fichiers `compose.prod.yml` et `traefik.dynamic.yml` du commit livré dans `/home/app/heig-odyssey`. Il transmet les paramètres nécessaires à la session SSH, lit le précédent SHA dans `.deployed_sha` s'il existe, définit les quatre références d'images, se connecte à GHCR et télécharge les images requises.

Il démarre PostgreSQL et Redis en conservant les volumes, puis synchronise le mot de passe du rôle PostgreSQL avec le secret de production. Il applique ensuite les migrations au moyen de l'image dédiée, avant de démarrer ou mettre à jour Traefik, le jeu, le worker et la présentation.

Le pipeline ne lance pas le seed de développement. Si une fonctionnalité dépend de nouvelles données persistantes, leur initialisation doit être prévue explicitement, par exemple par une migration de données adaptée ou une procédure d'exploitation validée. La présence d'un changement dans `prisma/seed.ts` ne signifie pas qu'il sera automatiquement exécuté sur le VPS.

Les vérifications finales interrogent le jeu et la présentation en local sur le VPS, les endpoints publics HTTPS et le contrôle de santé du worker. En cas de réussite, `.deployed_sha` est mis à jour avec le SHA livré.

## 9. Vérifier une livraison réussie

Dans GitHub Actions, vérifiez que les jobs de publication et de déploiement de la bonne exécution sont réussis. Comparez son SHA avec les images publiées. Vérifiez ensuite les endpoints publics :

```bash
curl --fail --silent --show-error https://play.heig-odyssey.online/api/health
curl --fail --silent --show-error https://heig-odyssey.online/health
```

Pour un diagnostic autorisé sur le VPS, depuis une session SSH du compte de déploiement :

```bash
cd /home/app/heig-odyssey
cat .deployed_sha
docker ps
docker exec heig-odyssey-worker node scripts/ops/worker-healthcheck.mjs
docker logs --tail=100 webapp
docker logs --tail=100 heig-odyssey-worker
```

Ces commandes n'exigent pas d'afficher les secrets. Une nouvelle session SSH ne possède pas automatiquement les variables injectées temporairement par le pipeline ; une commande `docker compose -f compose.prod.yml ...` peut donc exiger de les charger de manière sécurisée. Évitez de copier un rendu complet de `docker compose config` dans un ticket, car il peut contenir les valeurs substituées.

Complétez les vérifications techniques par un parcours fonctionnel raisonnable : connexion, lecture de la collection, navigation et vérification de la nouvelle fonctionnalité. Une réponse de santé correcte ne prouve pas que tous les parcours utilisateur fonctionnent.

## 10. Échec, retour arrière et protection des données

En cas d'échec de migration, de démarrage des services ou des vérifications finales, le script tente de redémarrer les images du SHA précédemment enregistré. Le job reste en échec même si cette restauration réussit, afin de signaler que la nouvelle livraison n'a pas été acceptée.

Ce mécanisme a des limites importantes :

- Il nécessite un `.deployed_sha` précédent et des images encore accessibles. Une première installation n'a pas de version connue à restaurer.
- Les migrations déjà appliquées ne sont pas annulées. La version précédente doit pouvoir fonctionner avec le schéma atteint.
- Le retour arrière réutilise les fichiers Compose et Traefik copiés pour la nouvelle livraison ; il ne restaure pas automatiquement leurs versions précédentes.
- Les échecs préliminaires de connexion, de configuration ou de téléchargement ne sont pas tous traités par les blocs de restauration.
- Les combats en mémoire peuvent être interrompus lors du remplacement de l'application.

Avant une livraison modifiant les données, effectuez et vérifiez une sauvegarde. Le pipeline actuel ne la réalise pas. Par exemple, depuis un dossier de sauvegarde protégé hors du dépôt et avec les droits d'exploitation nécessaires :

```bash
umask 077
docker exec heig-odyssey-postgres pg_dump -U postgres -d heig_odyssey -Fc > "heig-odyssey-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Vérifiez la réussite de la commande, protégez ce fichier contenant des données personnelles et conservez une copie adaptée hors du VPS. La procédure de restauration doit être testée sur un environnement isolé avant d'être utilisée en production. Les certificats et l'état Redis nécessitent également une stratégie d'exploitation adaptée ; un dump PostgreSQL n'en constitue pas une copie.

N'effacez jamais les volumes pour résoudre un déploiement. Si la restauration automatique échoue, interrompez les livraisons suivantes, examinez les journaux et faites intervenir un mainteneur. Une correction ou une annulation de code doit ensuite suivre le parcours habituel par Pull Request jusqu'à `main`. Restaurer une base demande une décision distincte, car cela peut supprimer des données créées depuis la sauvegarde.

## 11. Références opérationnelles

- [Workflow CI/CD](../../.github/workflows/ci-cd.yml).
- [Dockerfile du jeu, worker et migrateur](../../Dockerfile) et [Dockerfile de présentation](../../landing-page/Dockerfile).
- [Compose de validation](../../compose.ci.yml), [Compose de production](../../compose.prod.yml) et [routage Traefik](../../traefik.dynamic.yml).
- [Politique de protection à vérifier dans GitHub](../../.github/BRANCH_PROTECTION.md).
- [Lancement local](02-lancement-local.md) et [contribution](04-contribution.md).

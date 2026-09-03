# HEIG Odyssey - Description du problème et de la solution

## 1. Objet du livrable

Ce document présente le besoin auquel répond HEIG Odyssey, la solution réalisée et ses limites. Il décrit l'application présente dans le dépôt, et non l'ensemble des intentions formulées au début du projet.

La lecture de référence a été effectuée le 3 septembre 2026, sur la base du commit `d8230c5`, intégré dans `dev` avant la création de la branche des livrables.

Les procédures opérationnelles sont détaillées dans les documents [Lancement local](02-lancement-local.md), [Déploiement avec la CI/CD](03-deploiement-ci-cd.md) et [Contribution](04-contribution.md).

## 2. Problème identifié

Le projet part d'un besoin de réunir deux expériences complémentaires. D'une part, l'aventure et la collection donnent au joueur des objectifs, un attachement à son équipe et une progression personnelle. D'autre part, les combats tactiques donnent de l'importance à la composition de l'équipe, aux types, aux capacités et aux changements de créature.

Le public visé souhaite pouvoir découvrir ces décisions tactiques progressivement, dans un parcours solo, sans devoir participer à des combats entre joueurs ni construire immédiatement une équipe compétitive complète. Une succession de combats sans progression ne répondrait pas entièrement à ce besoin. À l'inverse, une campagne dans laquelle la préparation n'aurait aucune importance laisserait peu de place à l'apprentissage stratégique.

La problématique retenue est donc la suivante : comment proposer une aventure accessible, avec une collection persistante, tout en faisant de la préparation et des décisions de combat une partie centrale de l'expérience ?

Le contexte pédagogique impose également une solution dont le contenu, les règles métier, les tests et le déploiement peuvent être compris et repris par une autre équipe.

## 3. Solution réalisée

HEIG Odyssey est un jeu web solo inspiré de l'univers Pokémon. Son identité visuelle repose sur une présentation pixelisée et son univers de campagne reprend un parcours académique, du Bachelor au Doctorat.

Le jeu utilise les règles de combat de la Génération 4 au travers du moteur `@pkmn/sim`. Chaque camp dispose d'une équipe, mais une seule créature est active à la fois. Le joueur choisit une capacité ou un remplacement parmi les actions autorisées ; la résolution du tour et les décisions adverses sont effectuées côté serveur.

L'application comporte deux sites distincts. Le site statique de présentation explique le projet. Le jeu Next.js fournit l'inscription, la progression et les interactions authentifiées. Les domaines prévus par la configuration de production sont `heig-odyssey.online` pour la présentation et `play.heig-odyssey.online` pour le jeu. Cette configuration ne constitue pas une vérification de leur disponibilité à un instant donné.

## 4. Parcours du joueur

### 4.1. Création du compte et premier recrutement

Le joueur crée un compte avec une adresse électronique, un nom d'utilisateur et un mot de passe. Le formulaire vérifie la disponibilité du nom, tandis que le serveur conserve les contrôles définitifs de validité et d'unicité. L'adresse électronique doit être vérifiée avant la connexion. Un parcours de récupération du mot de passe est également prévu.

Après sa première connexion, le joueur suit une introduction et choisit gratuitement une créature de départ. Ce recrutement crée son équipe initiale. Il ne doit avoir lieu qu'une fois par compte : la validation du recrutement et la création des données initiales sont réalisées dans une transaction.

### 4.2. Campagne

La campagne propose huit mondes : cinq années de Bachelor, deux années de Master et un Doctorat. À la date de référence, leur configuration contient 69 étapes. Chaque étape possède un adversaire, une identité visuelle, des récompenses et, lorsqu'il y en a un, un prérequis de progression.

Le joueur consulte la carte, change de monde et sélectionne une étape. Le panneau de l'étape indique notamment son état d'accès, l'adversaire, le niveau recommandé et les récompenses. Le niveau recommandé est une information de préparation, et non une condition supplémentaire d'accès. Le déblocage dépend des prérequis de campagne contrôlés par le serveur.

Les profils d'intelligence artificielle des adversaires de campagne sont définis dans le contenu. Le joueur ne choisit pas leur difficulté.

### 4.3. Entraînement

L'entraînement permet de progresser sans dépendre du prochain combat de campagne. Le joueur sélectionne une difficulté, puis le serveur génère l'adversaire et lance le combat sans écran intermédiaire de confirmation.

Le niveau adverse est fondé sur la moyenne arrondie des niveaux des membres de l'équipe active, bornée entre 5 et 100. Une équipe incomplète reste possible. La difficulté modifie principalement le comportement de l'adversaire : actions aléatoires en facile, évaluation heuristique en normal et anticipation bornée avec expectiminimax en difficile. Les récompenses utilisent des multiplicateurs associés à cette difficulté.

### 4.4. Gestion de l'équipe et de la collection

Le joueur compose une équipe de une à six créatures et range les autres dans un PC de vingt boîtes de trente-cinq emplacements. Il peut consulter ses créatures, organiser leur placement et utiliser les fonctionnalités de gestion des capacités et d'évolution proposées par l'interface.

Les opérations de rangement prennent en compte une révision de la collection. Un ancien onglet ne doit pas écraser silencieusement une modification plus récente. Les règles d'appartenance, les limites de capacité et les restrictions liées aux combats sont également vérifiées côté serveur.

### 4.5. Recrutement et monnaie virtuelle

La monnaie gagnée dans le jeu permet d'effectuer des invocations sur trois bannières : « Pré des Compagnons », « Étoiles de Sinnoh » et « Antre des Légendes ». Le joueur peut consulter leur contenu et leurs probabilités avant un tirage. Le catalogue couvre les 493 espèces des quatre premières générations.

Le serveur effectue le tirage et enregistre, dans une transaction, la dépense et l'ajout de la créature. L'état chromatique est tiré séparément de la rareté. Aucun achat avec de l'argent réel n'est implémenté.

### 4.6. Quêtes et progression persistante

Des quêtes quotidiennes et hebdomadaires proposent des objectifs de victoires ou de tours joués. Les rotations sont communes, mais les compteurs et les récompenses appartiennent à chaque joueur. Le panneau de missions permet de suivre cette progression et de réclamer les récompenses disponibles.

Les comptes, collections, gains validés, progressions de campagne et quêtes sont conservés dans PostgreSQL. La déconnexion ne supprime donc pas cette progression.

## 5. Organisation technique de la solution

Next.js 15 et React 19 assurent les interfaces et les routes serveur. TypeScript, les contrats partagés et les validations Zod rendent explicites les données échangées. Prisma 6 gère l'accès à PostgreSQL et les migrations de schéma. Better Auth prend en charge l'authentification et Resend les messages de vérification et de récupération.

Les données éditoriales des espèces, premiers recrutements, mondes, dresseurs, bannières et pistes audio sont versionnées dans `content/`. Elles sont validées lors de leur chargement. Les définitions de quêtes se trouvent dans `src/lib/quests/definitions.ts`, avec leur initialisation et leur rotation côté serveur. Il ne faut pas confondre ces sources avec les données personnelles enregistrées en base.

Redis sert notamment aux limites de requêtes et au transport des événements de jeu. Un processus worker distinct consomme les événements destinés aux quêtes. Une table Outbox conserve les événements à publier avec les opérations métier : le worker peut reprendre ceux qui sont restés en attente après une interruption. Les traitements prévoient la déduplication afin de ne pas compter plusieurs fois le même événement.

Docker fournit des images distinctes pour le jeu, le worker, les migrations et le site statique. GitHub Actions contrôle le code, teste les images, les publie dans GHCR puis déploie la version identifiée par son commit sur un VPS.

## 6. Qualité et fiabilité recherchées

Les mutations sensibles sont autorisées à partir de la session serveur, et non d'une identité librement fournie par le navigateur. Les routes contrôlent les données reçues, l'origine des requêtes et les règles métier. Des limites de requêtes protègent notamment l'authentification et certaines opérations de jeu.

L'attribution des gains et les tirages disposent de mécanismes empêchant la répétition d'une même opération de produire plusieurs récompenses. Les tests couvrent aussi les conflits de collection, les droits d'accès, la récupération de compte et les reprises de traitement événementiel.

Les contrôles automatisés comprennent le formatage, l'analyse statique, les types, l'audit des dépendances, la détection de secrets, les tests unitaires et de combat, les seuils de performance, les tests avec PostgreSQL et Redis réels, ainsi que les parcours navigateur et l'accessibilité avec axe-core. Les parcours Playwright utilisent Chromium. Leur réussite ne remplace pas une évaluation manuelle de l'ergonomie et de l'accessibilité.

## 7. Limites du périmètre livré

Le jeu est solo : les combats entre joueurs, échanges, guildes et classements ne font pas partie de cette version. Le jeu sur téléphone n'est pas pris en charge ; un écran dédié invite à utiliser un ordinateur. Le site de présentation possède son propre affichage mobile.

Les combats en cours sont conservés en mémoire dans le processus serveur et expirent après une période d'inactivité. Ils ne constituent pas une sauvegarde durable de combat et peuvent être perdus lors d'un redémarrage. La progression déjà enregistrée en PostgreSQL est distincte de cet état temporaire. Une exécution du jeu sur plusieurs instances indépendantes demanderait une évolution de ce stockage.

L'avancement des quêtes dépend du worker et peut être différé pendant une interruption de service. L'endpoint de santé du jeu vérifie PostgreSQL et Redis, mais ne prouve pas à lui seul que chaque événement a été consommé ni que l'envoi d'e-mails fonctionne.

La sauvegarde et la restauration des données de production ne sont pas automatisées par le pipeline actuel. Le retour arrière porte sur les images applicatives, pas sur l'annulation des migrations. Cette limite doit être prise en compte avant chaque livraison modifiant le schéma.

Le projet est pédagogique et non officiel. Le dépôt ne contient pas de fichier de licence générale à la date de référence. Il ne faut donc pas déduire de sa consultation une autorisation générale de réutiliser tous les éléments, notamment les ressources graphiques et sonores liées à Pokémon.

## 8. Critères concrets de réussite

La solution répond au besoin lorsqu'un nouveau joueur peut vérifier son compte, recruter son premier partenaire, constituer son équipe, terminer un entraînement, obtenir des gains, avancer dans la campagne et retrouver sa progression après reconnexion.

Du point de vue de la reprise du projet, une autre personne doit également pouvoir lancer cet environnement à partir du dépôt, comprendre les sources de vérité, proposer une modification par Pull Request et suivre son passage jusqu'à une version déployée identifiable.

## 9. Références dans le dépôt

- [Cadrage initial](../01-kickoff/HEIG_Odyssey_Kickoff.md).
- [Campagne actuelle](../../content/campaign.json) et [bannières actuelles](../../content/gacha-banners.json).
- [Chargement et validation du contenu](../../src/lib/content/loader.ts).
- [Configuration de l'authentification](../../src/lib/auth.ts).
- [Contrat de gestion d'équipe](../../src/lib/team/team-contract.ts).
- [Sessions de combat](../../src/lib/combat/battle-session-store.ts).
- [Définitions des quêtes](../../src/lib/quests/definitions.ts) et [processus worker](../../src/worker/index.ts).
- [Pipeline effectif](../../.github/workflows/ci-cd.yml).

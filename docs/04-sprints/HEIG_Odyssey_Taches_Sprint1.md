# HEIG Odyssey - Tâches sélectionnées pour le Sprint 1

## Objectif du Sprint 1

Le Sprint 1 doit produire une première tranche verticale jouable et réduire les principaux risques techniques avant l'intégration du contenu complet.

Il se concentre sur :

- le modèle PostgreSQL commun et sa première migration Prisma ;
- un environnement Next.js/TypeScript reproductible avec Docker Compose ;
- la création de compte, la vérification et la connexion ;
- l'onboarding unique et l'attribution d'une première créature ;
- une équipe active valide comprenant de une à six créatures ;
- l'accueil donnant accès aux quatre espaces principaux ;
- un combat simple Gen 4 de bout en bout contre une IA aléatoire légale ;
- l'attribution persistante et idempotente des premiers gains ;
- un premier contenu configuré et des sprites servis localement ;
- le remplacement des contrôles fictifs du POC par de vrais contrôles CI.

> Cette sélection est préparée avant le sprint. Pendant le Sprint Planning du premier jour, l'équipe confirme les dépendances et la capacité, attribue chaque tâche dans GitHub et place les tâches retenues dans **Ready**. Une tâche passe dans **In progress** lorsqu'un membre commence réellement le travail.

## Capacité et règle d'engagement

L'équipe comprend quatre personnes disponibles cinq jours à raison d'environ huit heures par jour.

| Élément | Charge |
|---|---:|
| Capacité théorique | 160 h-personnes |
| Charge attendue sélectionnée | 145 h-personnes |
| Marge brute provisoire | 15 h-personnes |
| Part de capacité engagée | 90,6 % |

La marge brute provisoire de 15 heures doit absorber une partie de la coordination, des revues, de l'intégration, des anomalies et de la préparation de la démonstration. La sélection n'est pas encore équilibrée définitivement : elle sera revue collectivement pendant le Sprint Planning, sans ajouter de tâches au seul motif que la capacité théorique n'est pas entièrement utilisée.

Tiago coordonne l'organisation du groupe et le Sprint Planning. Les responsables d'implémentation sont attribués dans GitHub le premier jour en fonction des compétences et de la charge ; ils peuvent changer pendant le sprint. L'ensemble du groupe reste responsable de la revue et de la validation finale.

Chaque membre garde au maximum une tâche principale dans **In progress**. Cette limite informelle fixe le travail principal en cours à quatre tâches pour l'équipe et réduit le risque d'ouvrir plusieurs sujets sans les terminer.

## État réel du socle DevOps au démarrage

Le dépôt dispose déjà d'un POC CI/CD utile, mais celui-ci ne doit pas être confondu avec le pipeline final. Le tree actuel contient les documents, mockups, storyboards, deux Dockerfiles et une landing page statique ; il ne contient pas encore de `package.json`, d'application Next.js ou de Docker Compose versionné.

### Déjà disponible

- dépôt GitHub, GitHub Project de base, branches `dev` et `main` ;
- protection de `main` ;
- workflow GitHub Actions déclenché sur `dev`, `main` et les Pull Requests vers `main` ;
- construction d'une image POC à la racine et de l'image de la landing page statique ;
- publication dans GHCR avec des tags `latest` et SHA ;
- déploiement SSH sur le VPS avec GitHub Actions Secrets ;
- endpoint de santé et smoke test élémentaire après déploiement.

### À compléter

- initialisation réelle de Next.js/TypeScript, création de `package.json` et du lockfile ;
- Docker Compose local avec l'application, PostgreSQL et Redis ;
- remplacement du job `Dummy Lint & Test` par lint, typecheck, tests et build réels ;
- contrôles complets de Pull Request ;
- déploiement explicite du tag SHA plutôt que dépendance au tag flottant `latest` ;
- ajout de `prisma migrate deploy` ;
- vérification de HTTPS et de l'isolation réseau ;
- stack éphémère, concurrence de déploiement et rollback automatique.

Avant l'initialisation de Next.js, la CI peut réellement vérifier la présence des fichiers attendus et construire les images Docker, mais elle ne peut pas encore exécuter de lint, typecheck ou tests npm. Les compléments nécessaires au développement local et au contrôle qualité sont engagés ci-dessous. La finalisation du déploiement, du HTTPS et du rollback reste planifiée pour le Sprint 2.

## Tâches sélectionnées

Les intitulés et estimations ci-dessous sont identiques à ceux du catalogue général.

| ID | Story liée | Tâche | Label | Optimiste | Attendu | Pessimiste |
|---|---|---|---|---:|---:|---:|
| T-ARC-01 | Transverse | Concevoir collectivement le modèle PostgreSQL initial couvrant comptes, collection, équipe, progression, combats, gacha et quêtes | Architecture / Data | 4 h | 8 h | 12 h |
| T-ARC-02 | Transverse | Créer le schéma Prisma initial, la première migration et les données minimales de développement | Data | 2 h | 3 h | 5 h |
| T-US18-01 | US-18 | Initialiser Next.js/TypeScript strict, le lockfile et les scripts communs | Outillage | 1 h | 2 h | 3 h |
| T-US18-02 | US-18 | Configurer Docker Compose pour l'application, PostgreSQL et Redis | DevOps | 3 h | 4 h | 6 h |
| T-US18-03 | US-18 | Ajouter `.env.example`, volumes, réseau et contrôles de santé locaux | DevOps | 1 h | 2 h | 4 h |
| T-US18-04 | US-18 | Rédiger et faire tester la procédure de démarrage par un autre membre | Documentation / QA | 1 h | 2 h | 3 h |
| T-US19-01 | US-19 | Normaliser les scripts lint, typecheck, tests et build | CI / Outillage | 1 h | 2 h | 3 h |
| T-US19-02 | US-19 | Remplacer le contrôle fictif du POC par la CI réelle déclenchée sur `dev` | CI | 2 h | 3 h | 5 h |
| T-US19-03 | US-19 | Compléter le workflow de PR avec services éphémères, E2E, accessibilité et validation d'image | CI / QA | 4 h | 8 h | 12 h |
| T-US01-01 | US-01 | Définir le parcours de compte, les états de vérification et les contraintes de session | Fonctionnel / Sécurité | 1 h | 2 h | 3 h |
| T-US01-02 | US-01 | Intégrer Better Auth avec Prisma et l'envoi de vérification via Resend | Backend / Sécurité | 4 h | 7 h | 12 h |
| T-US01-03 | US-01 | Réaliser les écrans d'inscription, vérification, connexion et déconnexion | Frontend | 3 h | 4 h | 6 h |
| T-US01-04 | US-01 | Tester la session, les routes protégées et les erreurs d'authentification | QA / Sécurité | 1 h | 2 h | 4 h |
| T-US03-01 | US-03 | Définir le pool initial et les règles du recrutement gratuit | Fonctionnel / Contenu | 1 h | 2 h | 3 h |
| T-US03-02 | US-03 | Implémenter l'attribution atomique et unique de la première créature et créer une équipe initiale valide | Backend / Data | 2 h | 3 h | 5 h |
| T-US03-03 | US-03 | Réaliser l'interface d'onboarding et la redirection vers l'accueil | Frontend | 2 h | 3 h | 5 h |
| T-US03-04 | US-03 | Tester le premier lancement, l'équipe initiale, le retour ultérieur et le rejeu d'une requête | QA | 1 h | 2 h | 4 h |
| T-US04-01 | US-04 | Créer le shell applicatif et l'accueil à quatre choix | Frontend | 2 h | 3 h | 5 h |
| T-US04-02 | US-04 | Mettre en place les routes et gardes de session/onboarding | Frontend / Sécurité | 1 h | 2 h | 3 h |
| T-US04-03 | US-04 | Vérifier la navigation retour, le clavier et les tailles d'écran retenues | QA / Accessibilité | 1 h | 2 h | 3 h |
| T-US05-01 | US-05 | Finaliser le modèle collection/équipe et les contraintes de validité de une à six créatures | Data / Fonctionnel | 1 h | 2 h | 4 h |
| T-US05-02 | US-05 | Implémenter les lectures et mutations serveur de l'équipe active | Backend | 3 h | 4 h | 6 h |
| T-US05-03 | US-05 | Réaliser l'interface de collection et de composition d'équipe | Frontend | 3 h | 4 h | 7 h |
| T-US05-04 | US-05 | Tester les équipes vides, de plus de six créatures et contenant une créature non possédée | QA | 1 h | 2 h | 4 h |
| T-US06-01 | US-06 | Réaliser un spike `@pkmn/sim` en format simple Gen 4 avec un scénario reproductible | Combat / Recherche | 4 h | 6 h | 10 h |
| T-US06-02 | US-06 | Définir l'adaptateur, les types d'action et le format d'état exposé à l'interface | Architecture / Combat | 3 h | 4 h | 7 h |
| T-US06-03 | US-06 | Implémenter la création du combat, la validation des actions et la résolution des tours | Backend / Combat | 4 h | 7 h | 11 h |
| T-US06-04 | US-06 | Réaliser l'interface minimale d'attaque, de changement et d'affichage de l'état | Frontend / Combat | 4 h | 6 h | 10 h |
| T-US06-05 | US-06 | Créer des fixtures Gen 4 et des tests de résultat/invariants | QA / Combat | 2 h | 4 h | 6 h |
| T-US06-06 | US-06 | Relier contenu configuré, équipe active, adversaire, IA aléatoire, interface et résultat dans une tranche verticale | Intégration / Combat | 3 h | 5 h | 8 h |
| T-US10-01 | US-10 | Implémenter une IA aléatoire qui ne produit que des actions légales | IA | 1 h | 2 h | 3 h |
| T-US11-01 | US-11 | Définir le calcul des gains et la clé d'idempotence d'une attribution | Fonctionnel / Data | 1 h | 2 h | 3 h |
| T-US11-02 | US-11 | Implémenter la transaction XP, monnaie et déblocages | Backend / Data | 3 h | 4 h | 6 h |
| T-US11-03 | US-11 | Afficher les gains et le nouveau solde après le combat | Frontend | 1 h | 2 h | 3 h |
| T-US11-04 | US-11 | Tester le rejeu, l'échec partiel et deux requêtes concurrentes | QA / Data | 2 h | 3 h | 5 h |
| T-US15-01 | US-15 | Définir les schémas et inventaires versionnés des mondes, adversaires et portails | Contenu / Data | 2 h | 3 h | 5 h |
| T-US15-02 | US-15 | Implémenter le chargement et la validation des références de contenu | Backend / Contenu | 2 h | 3 h | 5 h |
| T-US15-03 | US-15 | Créer des configurations représentatives pour un monde, un Boss et un portail | Contenu | 2 h | 3 h | 5 h |
| T-US15-04 | US-15 | Ajouter un contrôle automatisé qui refuse une configuration invalide | QA / Contenu | 1 h | 2 h | 3 h |
| T-US16-01 | US-16 | Inventorier les sprites requis et définir le manifeste de source/version | Assets / Documentation | 1 h | 2 h | 3 h |
| T-US16-02 | US-16 | Développer le script d'import ciblé depuis PokéAPI | Assets / Outillage | 2 h | 3 h | 5 h |
| T-US16-03 | US-16 | Implémenter le `SpriteProvider` local et son fallback | Frontend / Assets | 1 h | 2 h | 4 h |
| T-US16-04 | US-16 | Vérifier automatiquement les références et fichiers manquants | QA / Assets | 1 h | 2 h | 3 h |
| T-US07-01 | US-07 | Définir le modèle des mondes, étapes, prérequis, niveaux recommandés et déblocages | Data / Fonctionnel | 1 h | 2 h | 4 h |

## Charge estimée

| Estimation | Total |
|---|---:|
| Optimiste | 87 h |
| Attendu | 145 h |
| Pessimiste | 236 h |

Le scénario pessimiste dépasse volontairement la capacité : il représente l'accumulation de plusieurs problèmes d'intégration et impose alors de renégocier le Sprint Backlog. L'engagement est fondé sur l'estimation attendue et sur le suivi quotidien des dépendances, pas sur l'hypothèse que les 236 heures seraient absorbables.

## Axes de travail du sprint

| Axe | Résultat attendu |
|---|---|
| Modèle et environnement | PostgreSQL, Prisma, Next.js, Redis et Docker Compose fonctionnent sur chaque poste. |
| Authentification et parcours | Un compte vérifié atteint l'onboarding puis l'accueil. |
| Équipe et contenu initial | La première créature crée une équipe valide ; la collection peut être organisée de une à six créatures. |
| Combat et gains | Un combat Gen 4 contre l'IA aléatoire va jusqu'au résultat et attribue les gains une seule fois. |
| Sprites et configuration | Un contenu représentatif est validé et ses sprites sont servis localement. |
| Validation | Les vrais scripts de lint, typecheck, tests et build remplacent le contrôle fictif du POC. |

## Ordre de réalisation recommandé

1. L'équipe valide le modèle PostgreSQL, les contrats de contenu et les interfaces entre domaines.
2. Next.js, Prisma et Docker Compose sont préparés pendant le spike `@pkmn/sim`.
3. Les scripts réels de lint, typecheck, tests et build remplacent immédiatement le job fictif.
4. Le compte, l'onboarding, la première créature et l'équipe active sont reliés.
5. L'IA aléatoire est branchée sur l'adaptateur de combat, puis sur l'interface.
6. Le contenu représentatif et les sprites locaux alimentent le combat de bout en bout.
7. Les gains, l'idempotence et le parcours navigateur sont vérifiés dans la CI.
8. L'équipe réalise la démonstration complète et corrige les anomalies bloquantes.

## Point de contrôle à mi-sprint

À mi-sprint, l'équipe vérifie dans cet ordre :

1. environnement local reproductible ;
2. compte et onboarding fonctionnels ;
3. combat exécutable avec deux équipes valides ;
4. adversaire contrôlé par l'IA aléatoire ;
5. résultat et gains persistés ;
6. contrôles CI réels.

À la fin du deuxième jour, l'équipe compare également les heures attendues aux heures réellement consommées. Un écart cumulé supérieur à environ 20 % déclenche la réestimation collective des tâches restantes, en particulier celles utilisant Better Auth, Resend, `@pkmn/sim`, Redis Streams ou Playwright pour la première fois.

Si l'un des quatre premiers points est bloqué, aucune tâche candidate n'est ajoutée. L'équipe réattribue le travail et peut retirer du Sprint Backlog, en priorité, l'interface complète de gestion d'équipe ou les compléments de sprites, tout en conservant le contrat minimal nécessaire à la tranche verticale. Ces éléments restent obligatoires pour la version finale.

## Résultat attendu en fin de Sprint 1

À la fin du sprint, l'équipe doit pouvoir démontrer le parcours suivant :

1. lancer l'application, PostgreSQL et Redis avec Docker Compose ;
2. créer et vérifier un compte ;
3. terminer l'onboarding une seule fois ;
4. recevoir une première créature dans une équipe active valide ;
5. consulter la collection et composer une équipe de une à six créatures ;
6. atteindre l'accueil à quatre choix ;
7. lancer un combat Gen 4 depuis un contenu configuré ;
8. jouer contre une IA aléatoire légale jusqu'à la victoire ou la défaite ;
9. recevoir les gains une seule fois et les retrouver après reconnexion ;
10. exécuter les contrôles réels dans GitHub Actions sur `dev` et sur la Pull Request vers `main`.

## Tâches candidates si le sprint avance plus vite

Ces tâches restent dans **Backlog** et ne sont ajoutées au sprint que lorsque la tranche verticale est sécurisée :

| ID | Story liée | Tâche | Attendu |
|---|---|---|---:|
| T-NFR03-01 | Transverse | Mesurer la première tranche verticale et fixer les seuils de réponse et de décision IA à valider avant la release | 3 h |
| T-US07-02 | US-07 | Implémenter le chargement de la campagne et l'affichage de la carte | 4 h |
| T-US07-03 | US-07 | Enregistrer atomiquement la victoire et le déblocage suivant | 4 h |
| T-US09-01 | US-09 | Définir l'algorithme de niveau moyen, les bornes et les cas limites | 2 h |
| T-US09-02 | US-09 | Générer une équipe adverse légale depuis le pool de contenu | 4 h |
| T-US10-02 | US-10 | Définir et implémenter l'heuristique du niveau normal | 4 h |
| T-US20-02 | US-20 | Garantir que l'image publiée dans GHCR et déployée est identifiée par le SHA, sans dépendre de `latest` | 2 h |
| T-US20-04 | US-20 | Ajouter `prisma migrate deploy` et remplacer l'attente fixe par un smoke test avec tentatives bornées | 3 h |

Ces candidates représentent **26 heures attendues**. Elles ne sont pas incluses dans les 145 heures de la sélection provisoire et ne sont tirées qu'après sécurisation du Sprint Goal et vérification de la capacité restante. Toute candidate terminée réduit d'autant la charge restant à planifier pour le Sprint 2.

## Éléments maintenus dans le Backlog pour le Sprint 2

Le kick-off reste la source de vérité du MVP et des éléments hors MVP. Le Sprint 2 couvre toutes les stories et tâches obligatoires non terminées du catalogue, sans recopier ici les quantités de contenu. Ses principaux risques sont la campagne complète, les IA encore non validées, le traitement Redis Streams, l'intégration du gacha et des quêtes, puis la finalisation du déploiement et du rollback.

Cette liste représente encore une charge importante. Elle doit être ordonnée et distribuée dès le Sprint Planning du Sprint 2 ; le caractère obligatoire du périmètre ne dispense pas l'équipe de suivre quotidiennement la charge restante.
 
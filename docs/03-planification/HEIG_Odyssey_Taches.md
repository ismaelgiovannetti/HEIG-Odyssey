# HEIG Odyssey - Tâches et estimations

Ce document décompose les user stories en tâches utilisables comme sous-issues GitHub. Il reste un catalogue de planification : les informations opérationnelles qui évoluent pendant le projet sont gérées dans GitHub Projects.

Tiago coordonne l'organisation du groupe et la préparation des sprints. Au début de chaque sprint, l'équipe sélectionne collectivement les tâches, leur attribue un responsable dans GitHub et vérifie leur charge. Une attribution peut ensuite changer si cela sert le Sprint Goal. La validation fonctionnelle et technique reste collective.

## Convention d'estimation

Les estimations sont exprimées en **heures-personnes** selon trois points :

- **Optimiste :** durée si l'implémentation se déroule sans difficulté notable.
- **Attendu :** durée la plus probable avec les revues et tests prévus.
- **Pessimiste :** durée si une intégration, une règle métier ou une dépendance pose problème.

Une estimation couvre l'implémentation, les tests associés et la mise à jour minimale de la documentation. Elle ne représente pas un engagement individuel définitif.

La capacité théorique est de **160 heures-personnes par sprint** : quatre membres, cinq jours et huit heures par jour. L'équipe ne planifie pas 100 % de cette capacité afin de conserver du temps pour les réunions, revues, intégrations, anomalies et démonstrations.

### Validation des estimations

Les estimations sont des hypothèses initiales, pas une contrainte destinée à faire artificiellement tenir le périmètre dans la capacité disponible. L'équipe maîtrise déjà Next.js, Prisma, GitHub Actions et Docker. Better Auth, Resend, `@pkmn/sim`, Redis Streams et Playwright comportent davantage de découverte ; leurs estimations doivent donc être validées par les premiers travaux réels.

- Le temps réellement consommé est renseigné à la fermeture de chaque tâche.
- Si l'écart cumulé dépasse environ 20 %, les estimations des tâches restantes sont recalculées collectivement.
- Pour une tâche de contenu, l'estimation reste provisoire jusqu'à la définition de son inventaire versionné.
- Si le total recalculé dépasse la capacité, l'équipe rend le risque visible et simplifie l'implémentation dans les limites du MVP ; elle ne réduit pas arbitrairement les heures annoncées.

## Kanban retenu

| Colonne | Utilisation |
|---|---|
| Backlog | Story ou tâche identifiée, mais non sélectionnée. |
| Ready | Objectif, parent, priorité, dépendances, estimation, responsable et condition de sortie compris. |
| In progress | Travail actuellement en cours. |
| In review | Implémentation terminée, en validation ou en intégration. |
| Done | Critères validés, tests verts et changement présent sur `dev`. |

Les éléments bloqués restent dans leur colonne et reçoivent le label `blocked` avec la cause du blocage.

Pour limiter la dispersion, chaque membre ne garde qu'une tâche principale dans **In progress**. Le tableau vise donc un maximum de quatre tâches principales actives ; une exception est possible pour une tâche en binôme ou une action très courte explicitement liée à la tâche principale.

## Tâches transversales

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-ARC-01 | Concevoir collectivement le modèle PostgreSQL initial couvrant comptes, collection, équipe, progression, combats, gacha et quêtes | Architecture / Data | 4 h | 8 h | 12 h |
| T-ARC-02 | Créer le schéma Prisma initial, la première migration et les données minimales de développement | Data | 2 h | 3 h | 5 h |
| T-NFR03-01 | Mesurer la première tranche verticale et fixer les seuils de réponse et de décision IA à valider avant la release | QA / Performance | 2 h | 3 h | 5 h |

## Tâches par user story

### US-01 - Créer un compte et se connecter

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US01-01 | Définir le parcours de compte, les états de vérification et les contraintes de session | Fonctionnel / Sécurité | 1 h | 2 h | 3 h |
| T-US01-02 | Intégrer Better Auth avec Prisma et l'envoi de vérification via Resend | Backend / Sécurité | 4 h | 7 h | 12 h |
| T-US01-03 | Réaliser les écrans d'inscription, vérification, connexion et déconnexion | Frontend | 3 h | 4 h | 6 h |
| T-US01-04 | Tester la session, les routes protégées et les erreurs d'authentification | QA / Sécurité | 1 h | 2 h | 4 h |

### US-02 - Récupérer l'accès à son compte

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US02-01 | Configurer le flux et le modèle d'e-mail de récupération | Backend | 1 h | 2 h | 3 h |
| T-US02-02 | Créer les écrans de demande et de réinitialisation | Frontend | 2 h | 3 h | 5 h |
| T-US02-03 | Tester l'expiration, l'usage unique et l'absence d'énumération des comptes | QA / Sécurité | 1 h | 2 h | 4 h |

### US-03 - Effectuer l'onboarding et recruter une première créature

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US03-01 | Définir le pool initial et les règles du recrutement gratuit | Fonctionnel / Contenu | 1 h | 2 h | 3 h |
| T-US03-02 | Implémenter l'attribution atomique et unique de la première créature et créer une équipe initiale valide | Backend / Data | 2 h | 3 h | 5 h |
| T-US03-03 | Réaliser l'interface d'onboarding et la redirection vers l'accueil | Frontend | 2 h | 3 h | 5 h |
| T-US03-04 | Tester le premier lancement, l'équipe initiale, le retour ultérieur et le rejeu d'une requête | QA | 1 h | 2 h | 4 h |

### US-04 - Accéder aux quatre espaces principaux

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US04-01 | Créer le shell applicatif et l'accueil à quatre choix | Frontend | 2 h | 3 h | 5 h |
| T-US04-02 | Mettre en place les routes et gardes de session/onboarding | Frontend / Sécurité | 1 h | 2 h | 3 h |
| T-US04-03 | Vérifier la navigation retour, le clavier et les tailles d'écran retenues | QA / Accessibilité | 1 h | 2 h | 3 h |

### US-05 - Consulter sa collection et préparer son équipe

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US05-01 | Finaliser le modèle collection/équipe et les contraintes de validité de une à six créatures | Data / Fonctionnel | 1 h | 2 h | 4 h |
| T-US05-02 | Implémenter les lectures et mutations serveur de l'équipe active | Backend | 3 h | 4 h | 6 h |
| T-US05-03 | Réaliser l'interface de collection et de composition d'équipe | Frontend | 3 h | 4 h | 7 h |
| T-US05-04 | Tester les équipes vides, de plus de six créatures et contenant une créature non possédée | QA | 1 h | 2 h | 4 h |

### US-06 - Jouer un combat simple selon les règles Gen 4

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US06-01 | Réaliser un spike `@pkmn/sim` en format simple Gen 4 avec un scénario reproductible | Combat / Recherche | 4 h | 6 h | 10 h |
| T-US06-02 | Définir l'adaptateur, les types d'action et le format d'état exposé à l'interface | Architecture / Combat | 3 h | 4 h | 7 h |
| T-US06-03 | Implémenter la création du combat, la validation des actions et la résolution des tours | Backend / Combat | 4 h | 7 h | 11 h |
| T-US06-04 | Réaliser l'interface minimale d'attaque, de changement et d'affichage de l'état | Frontend / Combat | 4 h | 6 h | 10 h |
| T-US06-05 | Créer des fixtures Gen 4 et des tests de résultat/invariants | QA / Combat | 2 h | 4 h | 6 h |
| T-US06-06 | Relier contenu configuré, équipe active, adversaire, IA aléatoire, interface et résultat dans une tranche verticale | Intégration / Combat | 3 h | 5 h | 8 h |

### US-07 - Progresser dans la campagne

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US07-01 | Définir le modèle des mondes, étapes, prérequis, niveaux recommandés et déblocages | Data / Fonctionnel | 1 h | 2 h | 4 h |
| T-US07-02 | Implémenter le chargement de la campagne et l'affichage de la carte | Backend / Frontend | 3 h | 4 h | 7 h |
| T-US07-03 | Enregistrer atomiquement la victoire et le déblocage suivant | Backend / Data | 3 h | 4 h | 7 h |
| T-US07-04 | Tester les accès verrouillés, la reprise, le niveau recommandé non bloquant et la fin de monde | QA | 1 h | 2 h | 4 h |
| T-US07-05 | Configurer la progression complète de la campagne définie dans le kick-off | Contenu | 3 h | 5 h | 8 h |

### US-08 - Affronter des dresseurs et Boss identifiables

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US08-01 | Définir le schéma de configuration d'un dresseur ou Boss | Contenu / Data | 1 h | 2 h | 3 h |
| T-US08-02 | Implémenter l'affichage des catchlines d'introduction et de résultat | Frontend | 2 h | 3 h | 5 h |
| T-US08-03 | Intégrer la musique configurée et un contrôle muet | Frontend / Audio | 2 h | 3 h | 5 h |
| T-US08-04 | Ajouter un dresseur et un Boss représentatifs avec leurs assets | Contenu | 2 h | 3 h | 5 h |
| T-US08-05 | Compléter l'inventaire des adversaires du MVP avec équipe, IA, catchlines, musique référencée et sprite local | Contenu | 4 h | 6 h | 10 h |

### US-09 - Générer un entraînement adapté à son équipe

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US09-01 | Définir l'algorithme de niveau moyen, les bornes et les cas limites | IA / Fonctionnel | 1 h | 2 h | 4 h |
| T-US09-02 | Générer une équipe adverse légale depuis le pool de contenu | IA / Backend | 3 h | 4 h | 7 h |
| T-US09-03 | Intégrer le lancement et la fin d'un combat d'entraînement | Backend / Combat | 3 h | 4 h | 7 h |
| T-US09-04 | Tester les équipes faibles, fortes, incomplètes et les bornes de niveau | QA / IA | 1 h | 2 h | 4 h |

### US-10 - Choisir la difficulté de l'entraînement

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US10-01 | Implémenter une IA aléatoire qui ne produit que des actions légales | IA | 1 h | 2 h | 3 h |
| T-US10-02 | Définir et implémenter l'heuristique du niveau normal | IA | 3 h | 4 h | 7 h |
| T-US10-03 | Prototyper Expectiminimax avec budget et stratégie de repli | IA / Recherche | 6 h | 10 h | 18 h |
| T-US10-04 | Configurer les multiplicateurs de récompense par difficulté | Équilibrage / Backend | 1 h | 2 h | 4 h |
| T-US10-05 | Mesurer le temps de décision, fixer le budget et tester les différences de comportement | QA / Performance | 2 h | 3 h | 5 h |

### US-11 - Recevoir et conserver ses gains

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US11-01 | Définir le calcul des gains et la clé d'idempotence d'une attribution | Fonctionnel / Data | 1 h | 2 h | 3 h |
| T-US11-02 | Implémenter la transaction XP, monnaie et déblocages | Backend / Data | 3 h | 4 h | 6 h |
| T-US11-03 | Afficher les gains et le nouveau solde après le combat | Frontend | 1 h | 2 h | 3 h |
| T-US11-04 | Tester le rejeu, l'échec partiel et deux requêtes concurrentes | QA / Data | 2 h | 3 h | 5 h |

### US-12 - Recruter une créature dans la boutique gacha

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US12-01 | Définir les portails, coûts, taux de drop et règle de doublon | Gacha / Équilibrage | 1 h | 2 h | 3 h |
| T-US12-02 | Implémenter le tirage pondéré et la transaction monnaie/collection | Backend / Gacha | 3 h | 4 h | 7 h |
| T-US12-03 | Réaliser l'interface des portails, du tirage et du résultat | Frontend / Gacha | 3 h | 4 h | 7 h |
| T-US12-04 | Tester les probabilités, le solde insuffisant, le rejeu et la concurrence | QA / Gacha | 2 h | 3 h | 5 h |
| T-US12-05 | Créer et valider les configurations des portails retenus pour le MVP | Contenu / Gacha | 2 h | 3 h | 5 h |

### US-13 - Accomplir des quêtes communes avec une progression individuelle

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US13-01 | Modéliser définitions, rotations, instances joueur et récompenses | Data / Quêtes | 2 h | 3 h | 5 h |
| T-US13-02 | Implémenter les rotations quotidiennes et hebdomadaires avec fuseau défini | Backend / Quêtes | 2 h | 3 h | 5 h |
| T-US13-03 | Implémenter les compteurs individuels et l'attribution unique | Backend / Quêtes | 3 h | 4 h | 7 h |
| T-US13-04 | Réaliser l'interface de consultation des quêtes et de leur progression | Frontend / Quêtes | 3 h | 4 h | 7 h |
| T-US13-05 | Tester deux joueurs, deux rotations et une récompense rejouée | QA / Quêtes | 2 h | 3 h | 5 h |

### US-14 - Utiliser les parcours principaux de manière accessible

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US14-01 | Définir et appliquer les règles de focus, clavier et messages d'état | Accessibilité / Frontend | 1 h | 2 h | 3 h |
| T-US14-02 | Ajouter les contrôles audio et persister la préférence muette | Frontend / Audio | 1 h | 2 h | 3 h |
| T-US14-03 | Automatiser les contrôles axe-core sur les écrans principaux | QA / Accessibilité | 1 h | 2 h | 3 h |

### US-15 - Ajouter du contenu sans modifier le moteur

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US15-01 | Définir les schémas et inventaires versionnés des mondes, adversaires et portails | Contenu / Data | 2 h | 3 h | 5 h |
| T-US15-02 | Implémenter le chargement et la validation des références de contenu | Backend / Contenu | 2 h | 3 h | 5 h |
| T-US15-03 | Créer des configurations représentatives pour un monde, un Boss et un portail | Contenu | 2 h | 3 h | 5 h |
| T-US15-04 | Ajouter un contrôle automatisé qui refuse une configuration invalide | QA / Contenu | 1 h | 2 h | 3 h |

### US-16 - Importer et servir les sprites localement

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US16-01 | Inventorier les sprites requis et définir le manifeste de source/version | Assets / Documentation | 1 h | 2 h | 3 h |
| T-US16-02 | Développer le script d'import ciblé depuis PokéAPI | Assets / Outillage | 2 h | 3 h | 5 h |
| T-US16-03 | Implémenter le `SpriteProvider` local et son fallback | Frontend / Assets | 1 h | 2 h | 4 h |
| T-US16-04 | Vérifier automatiquement les références et fichiers manquants | QA / Assets | 1 h | 2 h | 3 h |

### US-17 - Traiter les événements de quête de manière fiable

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US17-01 | Définir les contrats d'événement, l'`eventId` et la stratégie de publication garantie | Architecture / Redis | 2 h | 3 h | 5 h |
| T-US17-02 | Implémenter l'écriture transactionnelle du résultat et de l'événement en attente | Backend / Data | 3 h | 4 h | 7 h |
| T-US17-03 | Publier les événements en attente dans Redis Streams avec reprise | Backend / Redis | 3 h | 4 h | 7 h |
| T-US17-04 | Implémenter le consumer group, l'acquittement et la reprise des messages abandonnés | Worker / Redis | 3 h | 4 h | 7 h |
| T-US17-05 | Tester perte Redis, arrêt worker, rejeu et absence de double récompense | QA / Intégration | 2 h | 3 h | 5 h |

### US-18 - Lancer un environnement local reproductible

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US18-01 | Initialiser Next.js/TypeScript strict, le lockfile et les scripts communs | Outillage | 1 h | 2 h | 3 h |
| T-US18-02 | Configurer Docker Compose pour l'application, PostgreSQL et Redis | DevOps | 3 h | 4 h | 6 h |
| T-US18-03 | Ajouter `.env.example`, volumes, réseau et contrôles de santé locaux | DevOps | 1 h | 2 h | 4 h |
| T-US18-04 | Rédiger et faire tester la procédure de démarrage par un autre membre | Documentation / QA | 1 h | 2 h | 3 h |

### US-19 - Contrôler automatiquement chaque intégration

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US19-01 | Normaliser les scripts lint, typecheck, tests et build | CI / Outillage | 1 h | 2 h | 3 h |
| T-US19-02 | Remplacer le contrôle fictif du POC par la CI réelle déclenchée sur `dev` | CI | 2 h | 3 h | 5 h |
| T-US19-03 | Compléter le workflow de PR avec services éphémères, E2E, accessibilité et validation d'image | CI / QA | 4 h | 8 h | 12 h |
| T-US19-04 | Protéger `main` et configurer les checks obligatoires | GitHub / Sécurité | 1 h | 1 h | 2 h |
| T-US19-05 | Test E2E de la boucle principale | QA | 2 h | 4 h | 7 h |

### US-20 - Déployer et restaurer une version identifiable

| ID | Tâche | Label | Optimiste | Attendu | Pessimiste |
| --- | --- | --- | ---: | ---: | ---: |
| T-US20-01 | Finaliser Docker Compose de production, vérifier HTTPS et isoler PostgreSQL/Redis sur le réseau privé du VPS | DevOps / Sécurité | 3 h | 6 h | 10 h |
| T-US20-02 | Garantir que l'image publiée dans GHCR et déployée est identifiée par le SHA, sans dépendre de `latest` | CD / Docker | 1 h | 2 h | 3 h |
| T-US20-03 | Compléter GitHub Actions Secrets, la connexion SSH et la concurrence de déploiement | CD / Sécurité | 1 h | 2 h | 4 h |
| T-US20-04 | Ajouter `prisma migrate deploy` et remplacer l'attente fixe par un smoke test avec tentatives bornées | CD / Prisma | 2 h | 3 h | 5 h |
| T-US20-05 | Tester l'image SHA dans une stack éphémère avant publication et automatiser le redéploiement du SHA précédent | QA / CD | 4 h | 8 h | 12 h |
| T-US20-06 | Ajouter des logs structurés avec `requestId`/`eventId` et vérifier l'absence de secrets | Exploitabilité / Sécurité | 2 h | 3 h | 5 h |

## Charge globale du catalogue

| Estimation | Total |
|---|---:|
| Optimiste | 187 h |
| Attendu | 300 h |
| Pessimiste | 500 h |

Les deux sprints représentent une capacité théorique totale de 320 heures-personnes. Le scénario attendu initial utilise environ **93,8 %** de cette capacité et laisse 20 heures pour la coordination et les imprévus. 

Le scénario pessimiste ne tient pas dans la capacité disponible. Si plusieurs tâches atteignent leur estimation pessimiste, l'équipe doit redécouper, paralléliser ou simplifier l'implémentation sans retirer les fonctionnalités obligatoires.

## Dépendances principales

| Élément | Dépend de |
|---|---|
| US-03 Onboarding | US-01, modèle initial, US-15 et US-16 pour le pool et le sprite de départ. |
| US-05 Équipe | Modèle initial et US-03 pour disposer d'une première créature. |
| US-06 Combat | Une équipe valide de une à six créatures et US-15 pour les données de créatures. Au Sprint 1, l'équipe issue de l'onboarding suffit ; l'interface complète US-05 n'est pas un prérequis technique. |
| US-07 Campagne | US-06, US-11 et US-15. |
| US-09 Entraînement | US-05, US-06 et US-15. |
| US-10 Difficultés | US-06 et US-09. |
| US-12 Gacha | US-11 et US-15. |
| US-13 Quêtes | US-11 et US-17. |
| US-17 Événements | Modèle initial, PostgreSQL, Redis et résultats de combat. |
| US-19 CI | US-18 et les scripts de test disponibles. |
| US-20 Déploiement | US-18, image Docker et contrôles essentiels de US-19. |

## Règle de découpage dans GitHub

- Une table de ce document correspond à une story parente et à plusieurs issues de tâche.
- L'issue de story contient la valeur utilisateur et les critères d'acceptation.
- Chaque tâche devient une sous-issue et référence sa story parente, son estimation à trois points et ses dépendances.
- La priorité est héritée de la story, sauf exception explicitement décidée pendant le Sprint Planning.
- Le responsable n'est pas figé dans ce document : il est renseigné avec le champ **Assignees** de GitHub lorsque la tâche entre dans le sprint.
- Une tâche de contenu ne passe dans **Ready** que lorsque son inventaire et les assets attendus sont identifiés dans l'issue ou la configuration versionnée.
- Une tâche dépassant environ deux journées doit être redécoupée avant son passage dans **Ready**.

### Structure d'une issue Story

```markdown
Profil concerné : <proto-persona ou acteur technique>
Priorité : <P1, P2 ou P3>

## User Story

En tant que <profil>, je veux <capacité>, afin de <valeur>.

## Critères d'acceptation

- <critère vérifiable>
- <critère vérifiable>

## Sous-issues

- T-USxx-01 ...
- T-USxx-02 ...
```

### Structure d'une sous-issue de tâche

```markdown
Lié à : #<numéro de la story parente>
Dépend de : #<numéro d'issue ou "aucune">

## Objectif

<Résultat précis attendu de cette tâche>

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| <x h> | <y h> | <z h> |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```

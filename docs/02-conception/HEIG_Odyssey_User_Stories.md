# HEIG Odyssey - User stories

> Les stories commencent dans la colonne **Backlog** du GitHub Project. Elles passent dans **Ready** lorsque leurs critères d'acceptation, leurs dépendances et leur priorité sont compris par l'équipe.

Le kick-off reste la source de vérité du périmètre MVP et hors MVP. Ce document traduit ce périmètre en valeur utilisateur et en critères vérifiables sans recopier inutilement les quantités de contenu. Les inventaires détaillés sont fixés dans les configurations versionnées ou dans les issues concernées avant leur passage dans **Ready**.

## Convention

- **P1 - Socle critique :** nécessaire pour obtenir une boucle jouable ou livrer le prototype de manière sûre.
- **P2 - Complément du MVP :** nécessaire pour couvrir tout le périmètre annoncé, après stabilisation du socle.
- **P3 - Amélioration :** utile, mais simplifiable ou reportable sans casser la boucle principale.
- Une **story joueur** décrit une valeur directement observable par un joueur.
- Un **enabler technique** couvre une exigence de maintenabilité, de fiabilité ou de livraison indispensable au MVP. Il peut être géré comme une issue parente au même titre qu'une story joueur.

## Vue d'ensemble

| ID | Titre | Type | Priorité | Profils concernés | Exigences liées |
|---|---|---|---|---|---|
| US-01 | Créer un compte et se connecter | Joueur | P1 | Kim Possible | FR-01, NFR-02 |
| US-02 | Récupérer l'accès à son compte | Joueur | P2 | Kim Possible | FR-01, NFR-02 |
| US-03 | Effectuer l'onboarding et recruter une première créature | Joueur | P1 | Kim Possible | FR-02, NFR-01 |
| US-04 | Accéder aux quatre espaces principaux | Joueur | P1 | Kim Possible | FR-03, NFR-06, NFR-10 |
| US-05 | Consulter sa collection et préparer son équipe | Joueur | P1 | Son Goku, Katniss Everdeen | FR-05 |
| US-06 | Jouer un combat simple selon les règles Gen 4 | Joueur | P1 | Son Goku | FR-06 |
| US-07 | Progresser dans la campagne | Joueur | P1 | Kim Possible, Son Goku | FR-04, FR-09 |
| US-08 | Affronter des dresseurs et Boss identifiables | Joueur | P2 | Kim Possible, Son Goku | FR-08 |
| US-09 | Générer un entraînement adapté à son équipe | Joueur | P1 | Son Goku | FR-07 |
| US-10 | Choisir la difficulté de l'entraînement | Joueur | P2 | Son Goku | FR-07, FR-09, NFR-04 |
| US-11 | Recevoir et conserver ses gains | Joueur | P1 | Kim Possible, Katniss Everdeen | FR-09, NFR-01 |
| US-12 | Recruter une créature dans la boutique gacha | Joueur | P2 | Katniss Everdeen | FR-10, NFR-01 |
| US-13 | Accomplir des quêtes communes avec une progression individuelle | Joueur | P2 | Katniss Everdeen | FR-11, NFR-09 |
| US-14 | Utiliser les parcours principaux de manière accessible | Joueur | P2 | Kim Possible | NFR-06, NFR-10 |
| US-15 | Ajouter du contenu sans modifier le moteur | Enabler technique | P1 | Patrick Jane | FR-08, NFR-05 |
| US-16 | Importer et servir les sprites localement | Enabler technique | P1 | Patrick Jane | NFR-05, NFR-08 |
| US-17 | Traiter les événements de quête de manière fiable | Enabler technique | P2 | Patrick Jane, Katniss Everdeen | NFR-01, NFR-07, NFR-09 |
| US-18 | Lancer un environnement local reproductible | Enabler technique | P1 | Patrick Jane | NFR-08 |
| US-19 | Contrôler automatiquement chaque intégration | Enabler technique | P1 | Patrick Jane | NFR-05, NFR-08 |
| US-20 | Déployer et restaurer une version identifiable | Enabler technique | P1 | Patrick Jane | NFR-02, NFR-07, NFR-08 |

## Stories joueur

### US-01 - Créer un compte et se connecter

**Priorité :** P1  
**Proto-persona concerné :** Kim Possible  
**Exigences liées :** FR-01, NFR-02

**Story :**  
En tant que nouvelle joueuse, je veux créer un compte, vérifier mon adresse e-mail et me connecter, afin de conserver une progression personnelle protégée.

**Critères d'acceptation :**

- Un compte peut être créé avec une adresse e-mail qui n'est pas déjà utilisée.
- Un message de vérification est envoyé et l'état de vérification est conservé.
- Un compte valide peut ouvrir et fermer une session.
- Les pages protégées refusent un utilisateur sans session valide.
- Les erreurs affichées ne révèlent ni secret ni information sensible.

### US-02 - Récupérer l'accès à son compte

**Priorité :** P2  
**Proto-persona concerné :** Kim Possible  
**Exigences liées :** FR-01, NFR-02

**Story :**  
En tant que joueuse ayant oublié ses identifiants, je veux recevoir un lien de récupération, afin de retrouver l'accès à ma progression.

**Critères d'acceptation :**

- Une demande de récupération peut être envoyée depuis l'écran de connexion.
- La réponse ne permet pas de déterminer si une adresse est enregistrée.
- Le lien envoyé expire et ne peut être utilisé qu'une fois.
- Après la réinitialisation, la joueuse peut se connecter avec son nouvel accès.

### US-03 - Effectuer l'onboarding et recruter une première créature

**Priorité :** P1  
**Proto-persona concerné :** Kim Possible  
**Exigences liées :** FR-02, NFR-01

**Story :**  
En tant que nouvelle joueuse, je veux suivre un onboarding et recruter gratuitement ma première créature, afin de disposer immédiatement d'une équipe jouable.

**Critères d'acceptation :**

- L'onboarding est proposé uniquement lorsque le compte ne l'a pas encore terminé.
- Il présente brièvement la campagne, l'entraînement, la gestion d'équipe et le gacha.
- Une créature issue du pool initial configuré est ajoutée gratuitement à la collection et à l'équipe active.
- Aucune monnaie virtuelle n'est retirée.
- Une répétition ou une requête rejouée ne peut pas attribuer une seconde créature gratuite.

### US-04 - Accéder aux quatre espaces principaux

**Priorité :** P1  
**Proto-persona concerné :** Kim Possible  
**Exigences liées :** FR-03, NFR-06, NFR-10

**Story :**  
En tant que joueuse connectée, je veux choisir clairement entre la campagne, l'entraînement, la gestion d'équipe et la boutique gacha, afin d'accéder rapidement à l'activité souhaitée.

**Critères d'acceptation :**

- L'accueil présente les quatre choix après l'onboarding.
- Chaque choix mène à l'espace attendu et permet de revenir à l'accueil.
- Un compte qui n'a pas terminé l'onboarding est redirigé vers celui-ci.
- Les quatre choix sont utilisables au clavier dans Chromium.

### US-05 - Consulter sa collection et préparer son équipe

**Priorité :** P1  
**Proto-personas concernés :** Son Goku, Katniss Everdeen  
**Exigence liée :** FR-05

**Story :**  
En tant que joueuse, je veux consulter mes créatures et composer une équipe valide, afin d'utiliser la même préparation en campagne et en entraînement.

**Critères d'acceptation :**

- La collection affiche les créatures possédées et les informations nécessaires à la sélection.
- Une créature possédée peut être ajoutée ou retirée de l'équipe active.
- Le serveur accepte une équipe comprenant de une à six créatures possédées et refuse les autres compositions.
- L'équipe active est persistée et réutilisée dans les deux modes de combat.

### US-06 - Jouer un combat simple selon les règles Gen 4

**Priorité :** P1  
**Proto-persona concerné :** Son Goku  
**Exigence liée :** FR-06

**Story :**  
En tant que joueur tactique, je veux choisir une attaque ou changer de créature pendant un combat simple Gen 4, afin que mes décisions déterminent l'issue de l'affrontement.

**Critères d'acceptation :**

- Une seule créature est active par camp.
- Le joueur peut sélectionner une attaque légale ou remplacer sa créature active lorsque le changement est autorisé.
- Le serveur valide les actions et résout le tour avec `@pkmn/sim` configuré pour la Génération 4.
- L'état visible est actualisé après chaque tour jusqu'à la victoire ou la défaite.
- Le résultat final est enregistré une seule fois.

### US-07 - Progresser dans la campagne

**Priorité :** P1  
**Proto-personas concernés :** Kim Possible, Son Goku  
**Exigences liées :** FR-04, FR-09

**Story :**  
En tant que joueuse, je veux parcourir les mondes et débloquer les combats suivants après une victoire, afin d'avancer dans l'aventure jusqu'au Doctorat.

**Critères d'acceptation :**

- La carte distingue les combats disponibles, terminés et verrouillés.
- Chaque combat affiche un niveau recommandé à titre informatif ; une équipe valide de une à six créatures peut néanmoins tenter le combat.
- Un combat verrouillé ne peut pas être lancé par un appel direct au serveur.
- Une victoire enregistre la progression et débloque l'étape prévue par la configuration.
- La configuration de campagne respecte le périmètre MVP défini dans le kick-off.
- La progression est retrouvée après une nouvelle connexion.

### US-08 - Affronter des dresseurs et Boss identifiables

**Priorité :** P2  
**Proto-personas concernés :** Kim Possible, Son Goku  
**Exigence liée :** FR-08

**Story :**  
En tant que joueuse de la campagne, je veux que chaque dresseur ou Boss possède une identité et une mise en scène, afin que les combats participent à l'aventure.

**Critères d'acceptation :**

- Le nom, le sprite, l'équipe, la difficulté fixe et l'`aiProfile` proviennent de la configuration.
- La catchline d'introduction apparaît avant le combat.
- La catchline correspondant à la victoire ou à la défaite apparaît après le combat.
- La musique référencée par la configuration est utilisée pendant l'affrontement et peut être coupée par le joueur ; une même piste peut être partagée par plusieurs adversaires.
- Une configuration incomplète produit une erreur exploitable avant le déploiement.

### US-09 - Générer un entraînement adapté à son équipe

**Priorité :** P1  
**Proto-persona concerné :** Son Goku  
**Exigence liée :** FR-07

**Story :**  
En tant que joueur souhaitant tester son équipe, je veux obtenir un adversaire généré autour du niveau de mon équipe active, afin de pouvoir m'entraîner quelle que soit ma progression.

**Critères d'acceptation :**

- Le niveau de référence est calculé à partir de l'équipe active.
- Les niveaux générés respectent les bornes minimales et maximales définies.
- L'équipe adverse respecte les règles de validité du format de combat.
- Deux générations peuvent produire des compositions différentes pour une même tranche de niveau.
- Une équipe de faible niveau peut lancer chacune des difficultés disponibles.

### US-10 - Choisir la difficulté de l'entraînement

**Priorité :** P2  
**Proto-persona concerné :** Son Goku  
**Exigences liées :** FR-07, FR-09, NFR-04

**Story :**  
En tant que joueur tactique, je veux choisir entre facile, normal et difficile, afin d'affronter une IA adaptée au défi recherché et de recevoir une récompense correspondante.

**Critères d'acceptation :**

- Le mode facile utilise des choix légaux aléatoires.
- Le mode normal utilise une heuristique tenant compte au minimum des types, des PV et d'une possibilité de KO.
- Le mode difficile utilise Expectiminimax avec un budget configurable et un comportement de repli si le budget est atteint.
- La difficulté modifie le comportement de l'IA, pas artificiellement le niveau des créatures.
- À niveau adverse comparable, les récompenses augmentent avec la difficulté.
- Le temps de décision des trois IA est mesuré sur un scénario de référence ; le budget maximal de l'IA difficile est fixé dans l'issue avant la validation de la story.

### US-11 - Recevoir et conserver ses gains

**Priorité :** P1  
**Proto-personas concernés :** Kim Possible, Katniss Everdeen  
**Exigences liées :** FR-09, NFR-01

**Story :**  
En tant que joueuse, je veux recevoir l'expérience, la monnaie et les déblocages gagnés, afin de faire progresser durablement mon équipe.

**Critères d'acceptation :**

- Le serveur calcule les gains à partir du résultat validé.
- La monnaie, l'expérience et les déblocages sont appliqués dans une opération cohérente.
- La même opération rejouée ne peut pas attribuer les gains une seconde fois.
- Le nouveau solde et la progression sont visibles après le combat et après reconnexion.

### US-12 - Recruter une créature dans la boutique gacha

**Priorité :** P2  
**Proto-persona concerné :** Katniss Everdeen  
**Exigences liées :** FR-10, NFR-01

**Story :**  
En tant que collectionneuse, je veux dépenser ma monnaie virtuelle sur un portail configuré, afin de recruter une nouvelle créature sans microtransaction.

**Critères d'acceptation :**

- La boutique affiche les portails retenus dans la configuration versionnée, leur coût et les informations de probabilité prévues par l'équipe.
- Un tirage est refusé si le solde est insuffisant.
- Le serveur sélectionne le résultat selon la configuration du portail.
- Le coût et l'ajout à la collection sont enregistrés atomiquement.
- Une requête rejouée ne retire pas deux fois la monnaie et ne produit pas un second résultat.

### US-13 - Accomplir des quêtes communes avec une progression individuelle

**Priorité :** P2  
**Proto-persona concerné :** Katniss Everdeen  
**Exigences liées :** FR-11, NFR-09

**Story :**  
En tant que joueuse régulière, je veux progresser dans des quêtes quotidiennes et hebdomadaires communes, afin d'obtenir des objectifs récurrents tout en conservant mes propres compteurs.

**Critères d'acceptation :**

- Tous les joueurs reçoivent la même rotation quotidienne et hebdomadaire, sélectionnée depuis les définitions versionnées pour une période donnée.
- La rotation et le fuseau horaire de référence sont persistés.
- Chaque joueur possède ses propres compteurs et statuts.
- Les combats de campagne et d'entraînement mettent à jour les quêtes concernées.
- Une récompense de quête terminée ne peut être attribuée qu'une fois, même après rejeu d'un événement.

### US-14 - Utiliser les parcours principaux de manière accessible

**Priorité :** P2  
**Proto-persona concerné :** Kim Possible  
**Exigences liées :** NFR-06, NFR-10

**Story :**  
En tant que joueuse utilisant un ordinateur portable, je veux naviguer au clavier et comprendre l'état de l'application, afin d'utiliser les parcours principaux sans dépendre uniquement de la souris ou du son.

**Critères d'acceptation :**

- L'onboarding, l'accueil et les actions principales sont utilisables au clavier.
- Le focus est visible et suit un ordre cohérent.
- Les erreurs, chargements et résultats importants sont annoncés textuellement.
- Le son peut être coupé sans perdre une information nécessaire au jeu.
- Les parcours principaux sont vérifiés sur la version récente de Chromium retenue pour la démonstration.

## Enablers techniques

### US-15 - Ajouter du contenu sans modifier le moteur

**Priorité :** P1  
**Acteur technique concerné :** Patrick Jane  
**Exigences liées :** FR-08, NFR-05

**Story :**  
En tant qu'intégrateur de contenu, je veux décrire les mondes, dresseurs, Boss et portails dans des fichiers validés, afin d'ajouter du contenu sans modifier le moteur de jeu.

**Critères d'acceptation :**

- Un schéma versionné décrit les champs obligatoires de chaque type de contenu.
- Avant le passage d'une issue de contenu dans **Ready**, un inventaire versionné identifie les éléments et assets attendus pour cette issue.
- Les identifiants et références entre contenus sont validés.
- Une configuration invalide fait échouer le contrôle prévu avant déploiement.
- Un exemple de dresseur, de Boss et de portail peut être chargé sans modification du moteur.

### US-16 - Importer et servir les sprites localement

**Priorité :** P1  
**Acteur technique concerné :** Patrick Jane  
**Exigences liées :** NFR-05, NFR-08

**Story :**  
En tant qu'intégrateur, je veux importer les sprites nécessaires et les servir localement, afin que le jeu ne dépende pas de PokéAPI pendant une partie.

**Critères d'acceptation :**

- Un script importe uniquement les sprites référencés par le contenu du MVP.
- Un manifeste conserve la source et la version des assets importés.
- Le `SpriteProvider` retourne une ressource locale ou un fallback connu.
- Les sprites de dresseurs et Boss sont chargés depuis les assets du projet.
- Aucun écran de jeu ne contacte PokéAPI au runtime.

### US-17 - Traiter les événements de quête de manière fiable

**Priorité :** P2  
**Profils concernés :** Patrick Jane, Katniss Everdeen  
**Exigences liées :** NFR-01, NFR-07, NFR-09

**Story :**  
En tant que mainteneur, je veux pouvoir reprendre et rejouer le traitement d'un événement de jeu, afin qu'une interruption du worker ne perde ni ne duplique la progression de quête.

**Critères d'acceptation :**

- Chaque événement métier possède un `eventId` unique et un contrat versionné.
- Un résultat validé ne peut pas être durablement enregistré sans qu'un événement en attente puisse être retrouvé.
- Le worker acquitte un message seulement après la transaction PostgreSQL réussie.
- Un message non acquitté peut être repris après une interruption.
- Le rejeu d'un `eventId` déjà traité ne modifie pas une seconde fois les compteurs ou récompenses.
- Les logs du worker permettent de suivre un `eventId` sans exposer de secret ni de donnée sensible inutile.

### US-18 - Lancer un environnement local reproductible

**Priorité :** P1  
**Acteur technique concerné :** Patrick Jane  
**Exigence liée :** NFR-08

**Story :**  
En tant que développeur, je veux lancer l'application, PostgreSQL et Redis à partir du dépôt, afin de travailler dans un environnement comparable à celui de l'équipe.

**Critères d'acceptation :**

- Le dépôt contient le lockfile, `.env.example`, les migrations et les commandes nécessaires.
- Docker Compose démarre les services attendus avec des contrôles de santé.
- Les volumes persistants et les réseaux nécessaires sont déclarés.
- Une procédure documentée permet à un nouveau membre de lancer le socle et les tests.

### US-19 - Contrôler automatiquement chaque intégration

**Priorité :** P1  
**Acteur technique concerné :** Patrick Jane  
**Exigences liées :** NFR-05, NFR-08

**Story :**  
En tant que développeur, je veux recevoir un résultat de CI après chaque push sur `dev` et avant une promotion vers `main`, afin de détecter rapidement les régressions.

**Critères d'acceptation :**

- Un push sur `dev` exécute l'installation reproductible, le lint, le typecheck, les tests disponibles et le build.
- La Pull Request `dev` vers `main` exécute les contrôles complets disponibles, notamment E2E, accessibilité et validation Compose.
- Un contrôle obligatoire en échec empêche la fusion vers `main`.
- `main` interdit les pushes directs et les force-pushes.

### US-20 - Déployer et restaurer une version identifiable

**Priorité :** P1  
**Acteur technique concerné :** Patrick Jane  
**Exigences liées :** NFR-02, NFR-07, NFR-08

**Story :**  
En tant que responsable de livraison, je veux déployer sur le VPS une image identifiée par le SHA Git et pouvoir restaurer la précédente, afin de démontrer une livraison reproductible.

**Critères d'acceptation :**

- L'image de production est construite depuis `main`, testée puis publiée dans GHCR sans reconstruction.
- Les secrets proviennent de GitHub Actions Secrets et ne sont ni versionnés ni intégrés à l'image.
- Le VPS applique `prisma migrate deploy` et démarre les services avec le SHA demandé.
- Seule l'application HTTPS est exposée ; PostgreSQL et Redis restent internes au réseau Docker.
- Le smoke test vérifie l'application et ses dépendances essentielles.
- Un échec redéploie un SHA précédemment validé et un seul déploiement peut s'exécuter à la fois.
- Les logs applicatifs et de déploiement sont structurés, incluent un `requestId` ou un `eventId` lorsque pertinent et ne contiennent aucun secret.

## Critères de performance à préciser pendant la réalisation

Aucun seuil chiffré n'est imposé au kick-off pour le temps de réponse de l'application ou le temps de décision de l'IA difficile. Il serait arbitraire d'en inventer avant de disposer d'une tranche verticale mesurable. L'équipe procédera donc ainsi :

1. mesurer un parcours applicatif représentatif et les trois IA sur un scénario de référence ;
2. fixer dans les issues concernées une cible et une limite maximale compatibles avec le VPS ;
3. ajouter le contrôle correspondant avant de déclarer les stories concernées terminées.

L'absence de valeur initiale est acceptable à ce stade préliminaire ; l'absence de mesure et de seuil au moment de la validation finale ne le serait pas.

## Traçabilité avec les exigences

| Exigence | Stories correspondantes |
|---|---|
| FR-01 | US-01, US-02 |
| FR-02 | US-03 |
| FR-03 | US-04 |
| FR-04 | US-07 |
| FR-05 | US-05 |
| FR-06 | US-06 |
| FR-07 | US-09, US-10 |
| FR-08 | US-08, US-15 |
| FR-09 | US-07, US-10, US-11 |
| FR-10 | US-12 |
| FR-11 | US-13 |
| NFR-01 | US-03, US-11, US-12, US-17 |
| NFR-02 | US-01, US-02, US-20 |
| NFR-03 | US-04, US-06, US-10 ; seuils fixés après mesure de la première tranche verticale |
| NFR-04 | US-10 |
| NFR-05 | US-15, US-16, US-19 |
| NFR-06 | US-04, US-14 |
| NFR-07 | US-17, US-20 |
| NFR-08 | US-16, US-18, US-19, US-20 |
| NFR-09 | US-13, US-17 |
| NFR-10 | US-04, US-14 |

## Transposition dans GitHub

- Chaque `US-xx` devient une issue parente de type **Story** ou **Enabler technique**.
- L'issue référence le périmètre du kick-off au lieu d'en recopier les quantités ; l'inventaire détaillé reste dans la configuration ou les sous-issues concernées.
- L'issue reprend le persona ou l'acteur concerné, la formulation de la story, sa priorité et ses critères d'acceptation.
- Les tâches `T-USxx-yy` sont ajoutées comme sous-issues de cette issue parente.
- La story reste dans **Backlog** tant que l'équipe n'a pas sélectionné ses tâches pour un sprint.
- La progression de la story est suivie par l'avancement de ses sous-issues ; elle est fermée lorsque ses critères d'acceptation sont tous vérifiés.
# HEIG Odyssey - Seuils de performance de la tranche verticale de combat

| Élément | Valeur |
|---|---|
| Tâche | T-NFR03-01 |
| Nature | QA / Performance |
| Dépend de | T-US06-06 (tranche verticale de combat), T-US10-05 (mesure du temps de décision IA), T-US19-02 (CI réelle) |
| Estimation | 2 h / 3 h / 5 h |
| Statut | Protocole exécuté, seuils fixés et vérifiés automatiquement en CI |

## 1. Objectif

Mesurer une tranche verticale représentative du combat (T-US06-06) et documenter des seuils réalistes pour le temps de réponse et pour le temps de décision de l'IA (T-US10-05), afin de les intégrer aux critères de validation de la release.

Le périmètre couvre la couche applicative pure du moteur de combat (`BattleEngine`, `selectAIAction`), c'est-à-dire la logique métier qui s'exécute côté serveur sans dépendance réseau ni base de données. Le temps de réponse HTTP perçu par le joueur (`POST /api/battle/start`, `POST /api/battle/action`) ajoute à ces seuils la latence d'authentification (Better Auth), d'accès à PostgreSQL et du réseau, qui relève d'une mesure d'infrastructure hors du périmètre de cette tâche et devra être couverte séparément (par ex. test de charge sur l'environnement déployé) si le besoin apparaît en Sprint 2.

## 2. Protocole de mesure

### 2.1 Scénario représentatif

Un combat 6 contre 6, plutôt qu'un combat 1 contre 1 comme dans les tests fonctionnels existants, afin de représenter la charge de calcul maximale attendue en fin de campagne :

- 6 Pokémon par équipe, chacun avec 4 capacités (le maximum autorisé) ;
- un mélange de capacités offensives (physiques et spéciales) et de capacités de statut, pour que l'heuristique et l'expectiminimax évaluent réellement toutes les branches de leur boucle de score ;
- les trois profils d'IA du jeu (`random`, `heuristic`, `expectiminimax`) sont mesurés séparément, car ils n'ont pas le même coût de calcul.

### 2.2 Étapes mesurées

| Étape mesurée | Représente | Fonctions exercées |
|---|---|---|
| Démarrage du combat | Cœur de `POST /api/battle/start` | `new BattleEngine(...)` + `getState()` |
| Décision de l'IA | Cœur du choix d'action adverse | `selectAIAction(profile, engine, "p2")` |
| Tour complet | Cœur de `POST /api/battle/action` | action du joueur + décision IA + `executeTurn()` |

### 2.3 Méthode

Chaque étape est chronométrée avec `performance.now()` sur un moteur fraîchement instancié (pas de réutilisation d'état entre les mesures, pour éviter les biais liés au JIT ou au cache). Une première campagne exploratoire de 100 à 200 itérations par profil a servi à établir une distribution (p50 / p95 / max) avant de fixer les seuils. Ces mesures ont été exécutées en local ; les seuils retenus incluent une marge pour absorber la variance d'un exécuteur CI plus lent.

## 3. Résultats mesurés (référence)

Mesures locales, 200 itérations pour la décision IA seule et 100 itérations pour le tour complet et le démarrage, équipe complète 6v6 décrite en 2.1 :

| Mesure | p50 | p95 | max |
|---|---:|---:|---:|
| Décision IA `random` | 0.01 ms | 0.08 ms | 0.52 ms |
| Décision IA `heuristic` | 0.14 ms | 0.35 ms | 4.39 ms |
| Décision IA `expectiminimax` | 0.21 ms | 0.44 ms | 0.73 ms |
| Tour complet `random` | 2.82 ms | 7.46 ms | 26.19 ms |
| Tour complet `heuristic` | 2.30 ms | 4.22 ms | 10.61 ms |
| Tour complet `expectiminimax` | 2.29 ms | 3.56 ms | 5.06 ms |
| Démarrage du combat | 1.17 ms | 2.21 ms | 5.53 ms |

Ces valeurs de référence datent de la mise en place du protocole. Elles ne sont pas rejouées automatiquement telles quelles : c'est la vérification des seuils (section 4) qui s'exécute en continu.

## 4. Seuils retenus

| Seuil | Valeur | Justification |
|---|---:|---|
| `AI_DECISION_BUDGET_MS` | 20 ms | ≈ 45x le max observé (4.39 ms sur `heuristic`) ; assez serré pour détecter une régression algorithmique (ex. boucle imbriquée ajoutée par erreur), assez large pour absorber un exécuteur CI lent ou une machine de développement chargée. |
| `BATTLE_TURN_BUDGET_MS` | 50 ms | ≈ 2x le max observé (26.19 ms sur `random`) pour un tour complet (action joueur + décision IA + résolution), tous profils confondus. |
| `BATTLE_INIT_BUDGET_MS` | 50 ms | ≈ 9x le max observé (5.53 ms) pour la construction du moteur et le calcul de l'état initial. |

Ces seuils sont volontairement identiques pour les trois profils d'IA : le choix du profil (aléatoire, heuristique ou compétitif) est une décision de contenu par dresseur, pas une garantie de performance différenciée. Une IA qui dépasserait ces seuils sur l'équipe représentative doit être revue avant la release, quel que soit son profil.

Les trois profils d'IA produisent des actions différentes sur un même état de combat (`test/combat/ai.test.ts`), ce qui couvre la partie « comportements distincts » attendue par T-US10-05 ; la mesure et la vérification systématique du budget de calcul, elles, sont couvertes ici.

## 5. Vérification automatique

Les seuils sont vérifiés à chaque exécution par [test/combat/performance-thresholds.test.ts](../../test/combat/performance-thresholds.test.ts), exécuté via `npm run test:combat`.

Ce script est déjà intégré aux critères de validation de la release dans `.github/workflows/ci-cd.yml` :

- il s'exécute dans le job `integration-checks`, déclenché sur chaque Pull Request et sur chaque push vers `dev` ;
- le job `release-validation` (Pull Request vers `main`) dépend de `integration-checks` : une régression de performance bloque donc la release avant même d'atteindre les vérifications Docker et Playwright.

Aucune modification du workflow n'était nécessaire : l'intégration se fait par l'ajout du fichier de test dans le dossier déjà couvert par `test:combat`.

## 6. Limites et suites possibles

- Les seuils portent sur la logique pure du moteur de combat, pas sur la requête HTTP de bout en bout (authentification, Prisma, réseau). Une mesure de charge sur l'environnement de staging reste à envisager si des régressions de latence perçue sont rapportées en Sprint 2.
- Les seuils ont été calibrés sur une exécution locale ; s'ils s'avèrent trop stricts ou trop larges une fois observés sur les runners GitHub Actions, ils doivent être ajustés dans `test/combat/performance-thresholds.test.ts` avec la même méthode de marge documentée en section 4.
- T-US10-05 (comparaison fine des trois IA, budget de calcul par profil) peut affiner ces seuils par profil si un futur profil d'IA plus coûteux (ex. minimax à profondeur supérieure) est introduit.

# T-US10-05 - Mesure du temps de décision et budget des IA

**US-10** - Choisir la difficulté de l'entraînement
**Implémentation** : `test/combat/ai-decision-benchmark.test.ts`

## Scénario de référence

Réutilise le scénario déjà établi dans `test/combat/ai.test.ts` : Turtwig
(niveau 20, un move Normal) contre Chimchar (niveau 20, trois moves —
Griffe/Normal, Flammèche/Fire super efficace + STAB, Groz'Yeux/statut). Ce
scénario a été choisi plutôt qu'un nouveau cas pour ne pas dupliquer de
fixture, et parce qu'il offre déjà un choix rationnel non ambigu (Flammèche)
tout en laissant assez d'options pour observer la variance du profil aléatoire.

## Mesures

30 exécutions de `selectAIAction` par profil sur le scénario de référence
(`performance.now()` autour de chaque appel, sans mock du moteur) :

| Profil | Temps observé |
|---|---|
| random | < 1 ms |
| heuristic | < 1 ms |
| expectiminimax | < 1 ms |

Aucun des trois profils ne fait de recherche récursive en profondeur :
`expectiminimax` reste un lookahead à 1 niveau (voir `src/lib/combat/ai.ts`),
ce qui explique des temps sub-milliseconde constants plutôt qu'une croissance
exponentielle. Le "budget" documenté ici couvre donc une marge de sécurité
contre une régression future, pas un mécanisme de repli actif (aucune des
implémentations actuelles n'a de chemin où elle pourrait le dépasser).

## Budget retenu

**50 ms** par décision, sur le scénario de référence — une marge d'environ
50× au-dessus des temps mesurés, pour absorber la variance d'une machine de
CI chargée sans masquer une vraie régression de performance. Vérifié
automatiquement par `test/combat/ai-decision-benchmark.test.ts`.

## Différences de comportement observées

- **heuristic** et **expectiminimax** convergent de façon **déterministe**
  vers Flammèche (index 1, seul choix rationnel) sur les 30 exécutions.
- **random** produit une **réelle variance** : plusieurs indices de move
  différents apparaissent sur les 30 tirages.

C'est la distinction qualitative vérifiée par le test : les deux profils non
aléatoires cherchent systématiquement l'optimum, contrairement au profil
aléatoire — sans exiger artificiellement que heuristic et expectiminimax
diffèrent l'un de l'autre sur un scénario où ils convergent légitimement
vers le même choix rationnel.

## Hors périmètre

Le remplacement de l'expectiminimax 1-ply par une recherche plus profonde
avec un vrai mécanisme de budget/repli relève de T-US10-03, pas de cette
tâche (qui mesure et documente l'existant, elle ne le modifie pas).

# T-US09-01 - Algorithme de niveau moyen d'entraînement

**US-09** - Générer un entraînement adapté à son équipe
**Implémentation** : `src/lib/training/level-algorithm.ts`
**Tests** : `test/unit/training-level-algorithm.test.ts`

## Formule

Le niveau de référence est la **moyenne arrondie** des niveaux des Pokémon de
l'équipe active :

```
référence = round(somme(niveaux) / nombre de Pokémon)
```

L'arrondi suit la règle JavaScript standard (`Math.round`) : une moitié
arrondit vers le haut (ex. 5.5 → 6).

Le niveau final envoyé à la génération d'adversaire (T-US09-02) est ce niveau
de référence **borné** :

```
niveau adversaire = clamp(référence, TRAINING_MIN_LEVEL, TRAINING_MAX_LEVEL)
```

## Bornes

| Constante | Valeur | Justification |
|---|---|---|
| `TRAINING_MIN_LEVEL` | 5 | Niveau du starter à la fin de l'onboarding (US-03) — plancher naturel du jeu. |
| `TRAINING_MAX_LEVEL` | 100 | Plafond Gen 4 déjà appliqué au reste du contenu (`TrainerPokemonSchema.level`, `src/lib/content/schemas.ts`). |

## Comportements aux cas limites

| Cas | Comportement |
|---|---|
| Équipe complète (6 membres), niveaux homogènes | Moyenne simple, aucun clamp attendu en pratique. |
| Équipe incomplète (1 à 5 membres) | Traitée identiquement à une équipe complète : la moyenne porte sur les membres présents. Une équipe US-05 valide contient toujours 1 à 6 membres, jamais 0. |
| Équipe très faible (proche du plancher, ex. sortie d'onboarding) | Aucun clamp nécessaire en pratique car le niveau de départ (5) coïncide avec `TRAINING_MIN_LEVEL`. La fonction reste sûre si un niveau plus bas était atteignable : elle ramène au plancher plutôt que de générer un adversaire de niveau invalide. Répond au critère d'acceptation US-09 : *"Une équipe de faible niveau peut lancer chacune des difficultés disponibles."* |
| Équipe très forte (proche ou au niveau 100) | Le niveau de référence est plafonné à 100 ; jamais d'adversaire hors bornes. |
| Équipe vide | Ne peut pas survenir via l'API (US-05 impose 1 à 6 membres), mais la fonction refuse explicitement ce cas (`Error`) plutôt que de retourner `NaN`, pour rester sûre si un jour appelée hors du flux HTTP normal. |
| Créature K.O. (`currentHp = 0`) dans l'équipe | Compte normalement dans la moyenne : le niveau de référence reflète la composition de l'équipe, pas son état de combat au moment du calcul. |

## Hors périmètre de cette tâche

- La génération de l'équipe adverse elle-même (pool de contenu, contraintes Gen 4) : **T-US09-02**.
- Le câblage dans une route API et le déroulement du combat : **T-US09-03**.
- Les tests de bout en bout sur des équipes faibles/fortes/incomplètes réelles : **T-US09-04**.
- Le choix de la difficulté (facile/normal/difficile) : **US-10**, indépendant du niveau (cf. critère d'acceptation *"La difficulté modifie le comportement de l'IA, pas artificiellement le niveau des créatures"*).

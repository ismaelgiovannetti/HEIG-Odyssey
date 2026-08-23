# HEIG Odyssey - Guide de création des tâches GitHub

Ce document sert d'aide à la création des issues de tâche dans GitHub. Il reprend les **90 tâches** du catalogue de planification et fournit, pour chacune, un bloc directement copiable dans la description de l'issue.

## Mode d'emploi

1. Créer d'abord les issues parentes des user stories `US-01` à `US-20`.
2. Créer ensuite les tâches transversales, puis les tâches de chaque story.
3. Remplacer chaque placeholder `#<numéro de ...>` par le numéro GitHub réellement attribué.
4. Ajouter chaque tâche comme sous-issue de sa story parente dans GitHub.
5. Vérifier les dépendances au début du sprint : elles expriment un ordre technique conseillé et peuvent être ajustées si l'implémentation retenue change.
6. Attribuer les responsables pendant la planification du sprint, conformément au fonctionnement prévu par l'équipe.

> Les estimations proviennent du catalogue de tâches validé. Le champ **Dépend de** indique les prérequis directs proposés ; il ne remplace pas la discussion de planification du sprint.

## Tâches transversales

Ces tâches ne dépendent pas d'une user story fonctionnelle unique. L'équipe peut les conserver comme issues autonomes ou créer une issue parente de type *Enabler*, par exemple **Architecture et qualité transversales**.

### Sous-issues

```markdown
- T-ARC-01 - Concevoir collectivement le modèle PostgreSQL initial couvrant comptes, collection, équipe, progression, combats, gacha et quêtes
- T-ARC-02 - Créer le schéma Prisma initial, la première migration et les données minimales de développement
- T-NFR03-01 - Mesurer la première tranche verticale et fixer les seuils de réponse et de décision IA à valider avant la release
```

### T-ARC-01 - Concevoir collectivement le modèle PostgreSQL initial couvrant comptes, collection, équipe, progression, combats, gacha et quêtes

```markdown
Lié à : #<numéro de l'enabler transverse> (ou aucune si la tâche reste autonome)
Dépend de : aucune
Label suggéré : `Architecture / Data`

## Objectif

Produire un modèle de données commun couvrant les comptes, la collection, l'équipe active, la progression, les combats, le gacha et les quêtes. La tâche est terminée lorsque les entités, relations, contraintes et décisions ouvertes sont revues et validées par toute l'équipe.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 4 h | 8 h | 12 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-ARC-02 - Créer le schéma Prisma initial, la première migration et les données minimales de développement

```markdown
Lié à : #<numéro de l'enabler transverse> (ou aucune si la tâche reste autonome)
Dépend de : T-ARC-01 (#<numéro de T-ARC-01>)
Label suggéré : `Data`

## Objectif

Traduire le modèle validé en schéma Prisma exécutable. La tâche est terminée lorsqu'une base vide accepte la première migration et peut être remplie avec les données minimales de développement.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-NFR03-01 - Mesurer la première tranche verticale et fixer les seuils de réponse et de décision IA à valider avant la release

```markdown
Lié à : #<numéro de l'enabler transverse> (ou aucune si la tâche reste autonome)
Dépend de : T-US06-06 (#<numéro de T-US06-06>), T-US10-05 (#<numéro de T-US10-05>), T-US19-02 (#<numéro de T-US19-02>)
Label suggéré : `QA / Performance`

## Objectif

Mesurer une tranche verticale représentative et documenter des seuils réalistes pour le temps de réponse et la décision de l'IA. La tâche est terminée lorsque le protocole, les mesures et les seuils retenus sont intégrés aux critères de validation de la release.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-01 - Créer un compte et se connecter

### Sous-issues

```markdown
- T-US01-01 - Définir le parcours de compte, les états de vérification et les contraintes de session
- T-US01-02 - Intégrer Better Auth avec Prisma et l'envoi de vérification via Resend
- T-US01-03 - Réaliser les écrans d'inscription, vérification, connexion et déconnexion
- T-US01-04 - Tester la session, les routes protégées et les erreurs d'authentification
```

### T-US01-01 - Définir le parcours de compte, les états de vérification et les contraintes de session

```markdown
Lié à : #<numéro de US-01>
Dépend de : aucune
Label suggéré : `Fonctionnel / Sécurité`

## Objectif

Décrire le parcours complet d'inscription, de vérification, de connexion, de déconnexion et d'expiration de session. La tâche est terminée lorsque chaque état, transition et erreur attendue possède une règle non ambiguë.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US01-02 - Intégrer Better Auth avec Prisma et l'envoi de vérification via Resend

```markdown
Lié à : #<numéro de US-01>
Dépend de : T-ARC-02 (#<numéro de T-ARC-02>), T-US01-01 (#<numéro de T-US01-01>), T-US18-01 (#<numéro de T-US18-01>)
Label suggéré : `Backend / Sécurité`

## Objectif

Configurer Better Auth avec Prisma et Resend selon le parcours validé. La tâche est terminée lorsqu'un compte peut être créé, vérifié et authentifié sans exposer de secret ni contourner la vérification requise.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 4 h | 7 h | 12 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US01-03 - Réaliser les écrans d'inscription, vérification, connexion et déconnexion

```markdown
Lié à : #<numéro de US-01>
Dépend de : T-US01-01 (#<numéro de T-US01-01>), T-US01-02 (#<numéro de T-US01-02>)
Label suggéré : `Frontend`

## Objectif

Fournir les interfaces d'inscription, de vérification, de connexion et de déconnexion. La tâche est terminée lorsque les états de chargement, de succès et d'erreur sont utilisables et reliés au service d'authentification.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 6 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US01-04 - Tester la session, les routes protégées et les erreurs d'authentification

```markdown
Lié à : #<numéro de US-01>
Dépend de : T-US01-02 (#<numéro de T-US01-02>), T-US01-03 (#<numéro de T-US01-03>)
Label suggéré : `QA / Sécurité`

## Objectif

Sécuriser le parcours d'authentification par des tests automatisés. La tâche est terminée lorsque les sessions valides et invalides, les routes protégées et les principales erreurs sont couvertes et passent en CI.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 4 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-02 - Récupérer l'accès à son compte

### Sous-issues

```markdown
- T-US02-01 - Configurer le flux et le modèle d'e-mail de récupération
- T-US02-02 - Créer les écrans de demande et de réinitialisation
- T-US02-03 - Tester l'expiration, l'usage unique et l'absence d'énumération des comptes
```

### T-US02-01 - Configurer le flux et le modèle d'e-mail de récupération

```markdown
Lié à : #<numéro de US-02>
Dépend de : T-US01-02 (#<numéro de T-US01-02>)
Label suggéré : `Backend`

## Objectif

Configurer la demande de récupération, le jeton temporaire et l'e-mail envoyé par Resend. La tâche est terminée lorsqu'une demande valide produit un lien utilisable sans révéler l'existence d'un compte.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US02-02 - Créer les écrans de demande et de réinitialisation

```markdown
Lié à : #<numéro de US-02>
Dépend de : T-US02-01 (#<numéro de T-US02-01>)
Label suggéré : `Frontend`

## Objectif

Créer les écrans de demande et de choix d'un nouveau mot de passe. La tâche est terminée lorsque le parcours complet fonctionne avec des messages neutres et des états d'erreur compréhensibles.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US02-03 - Tester l'expiration, l'usage unique et l'absence d'énumération des comptes

```markdown
Lié à : #<numéro de US-02>
Dépend de : T-US02-01 (#<numéro de T-US02-01>), T-US02-02 (#<numéro de T-US02-02>)
Label suggéré : `QA / Sécurité`

## Objectif

Vérifier les garanties de sécurité de la récupération de compte. La tâche est terminée lorsque des tests couvrent l'expiration, l'usage unique du jeton et l'absence d'énumération des comptes.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 4 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-03 - Effectuer l'onboarding et recruter une première créature

### Sous-issues

```markdown
- T-US03-01 - Définir le pool initial et les règles du recrutement gratuit
- T-US03-02 - Implémenter l'attribution atomique et unique de la première créature et créer une équipe initiale valide
- T-US03-03 - Réaliser l'interface d'onboarding et la redirection vers l'accueil
- T-US03-04 - Tester le premier lancement, l'équipe initiale, le retour ultérieur et le rejeu d'une requête
```

### T-US03-01 - Définir le pool initial et les règles du recrutement gratuit

```markdown
Lié à : #<numéro de US-03>
Dépend de : T-US15-01 (#<numéro de T-US15-01>), T-US16-01 (#<numéro de T-US16-01>)
Label suggéré : `Fonctionnel / Contenu`

## Objectif

Définir la liste des créatures recrutables gratuitement et les règles d'éligibilité du premier lancement. La tâche est terminée lorsque le pool, les données nécessaires et les cas limites sont validés par l'équipe.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US03-02 - Implémenter l'attribution atomique et unique de la première créature et créer une équipe initiale valide

```markdown
Lié à : #<numéro de US-03>
Dépend de : T-ARC-02 (#<numéro de T-ARC-02>), T-US03-01 (#<numéro de T-US03-01>), T-US01-02 (#<numéro de T-US01-02>)
Label suggéré : `Backend / Data`

## Objectif

Attribuer exactement une première créature et créer une équipe initiale valide dans une seule opération cohérente. La tâche est terminée lorsque les appels répétés ou concurrents ne peuvent produire ni doublon ni état partiel.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US03-03 - Réaliser l'interface d'onboarding et la redirection vers l'accueil

```markdown
Lié à : #<numéro de US-03>
Dépend de : T-US03-02 (#<numéro de T-US03-02>), T-US04-01 (#<numéro de T-US04-01>)
Label suggéré : `Frontend`

## Objectif

Présenter le recrutement initial au premier lancement puis diriger le joueur vers l'accueil. La tâche est terminée lorsque le parcours ne s'affiche qu'aux comptes éligibles et confirme clairement la créature obtenue.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US03-04 - Tester le premier lancement, l'équipe initiale, le retour ultérieur et le rejeu d'une requête

```markdown
Lié à : #<numéro de US-03>
Dépend de : T-US03-02 (#<numéro de T-US03-02>), T-US03-03 (#<numéro de T-US03-03>)
Label suggéré : `QA`

## Objectif

Tester l'onboarding de bout en bout et ses cas de rejeu. La tâche est terminée lorsque le premier passage, les connexions suivantes, l'équipe créée et les requêtes répétées sont vérifiés automatiquement.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 4 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-04 - Accéder aux quatre espaces principaux

### Sous-issues

```markdown
- T-US04-01 - Créer le shell applicatif et l'accueil à quatre choix
- T-US04-02 - Mettre en place les routes et gardes de session/onboarding
- T-US04-03 - Vérifier la navigation retour, le clavier et les tailles d'écran retenues
```

### T-US04-01 - Créer le shell applicatif et l'accueil à quatre choix

```markdown
Lié à : #<numéro de US-04>
Dépend de : T-US18-01 (#<numéro de T-US18-01>)
Label suggéré : `Frontend`

## Objectif

Créer le cadre de navigation et l'accueil proposant Campagne, Entraînement, Gestion d'équipe et Boutique gacha. La tâche est terminée lorsque les quatre choix sont identifiables et mènent vers leur espace.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US04-02 - Mettre en place les routes et gardes de session/onboarding

```markdown
Lié à : #<numéro de US-04>
Dépend de : T-US01-02 (#<numéro de T-US01-02>), T-US03-02 (#<numéro de T-US03-02>), T-US04-01 (#<numéro de T-US04-01>)
Label suggéré : `Frontend / Sécurité`

## Objectif

Protéger les routes selon l'état de session et d'onboarding. La tâche est terminée lorsqu'un utilisateur non connecté ou non onboardé est redirigé vers l'étape correcte sans boucle de navigation.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US04-03 - Vérifier la navigation retour, le clavier et les tailles d'écran retenues

```markdown
Lié à : #<numéro de US-04>
Dépend de : T-US04-01 (#<numéro de T-US04-01>), T-US04-02 (#<numéro de T-US04-02>)
Label suggéré : `QA / Accessibilité`

## Objectif

Valider la navigation principale sur les appareils et modes d'entrée retenus. La tâche est terminée lorsque le retour, le clavier et les tailles d'écran ciblées ne bloquent aucun des quatre parcours.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-05 - Consulter sa collection et préparer son équipe

### Sous-issues

```markdown
- T-US05-01 - Finaliser le modèle collection/équipe et les contraintes de validité de une à six créatures
- T-US05-02 - Implémenter les lectures et mutations serveur de l'équipe active
- T-US05-03 - Réaliser l'interface de collection et de composition d'équipe
- T-US05-04 - Tester les équipes vides, de plus de six créatures et contenant une créature non possédée
```

### T-US05-01 - Finaliser le modèle collection/équipe et les contraintes de validité de une à six créatures

```markdown
Lié à : #<numéro de US-05>
Dépend de : T-ARC-01 (#<numéro de T-ARC-01>), T-US03-02 (#<numéro de T-US03-02>)
Label suggéré : `Data / Fonctionnel`

## Objectif

Finaliser les données et règles garantissant qu'une équipe contient entre une et six créatures possédées. La tâche est terminée lorsque ces contraintes sont définies au bon niveau et ne peuvent être contournées par l'API.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 4 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US05-02 - Implémenter les lectures et mutations serveur de l'équipe active

```markdown
Lié à : #<numéro de US-05>
Dépend de : T-ARC-02 (#<numéro de T-ARC-02>), T-US05-01 (#<numéro de T-US05-01>)
Label suggéré : `Backend`

## Objectif

Exposer les lectures et mutations nécessaires pour consulter la collection et modifier l'équipe active. La tâche est terminée lorsque les opérations autorisées réussissent et que les compositions invalides sont refusées.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 6 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US05-03 - Réaliser l'interface de collection et de composition d'équipe

```markdown
Lié à : #<numéro de US-05>
Dépend de : T-US05-02 (#<numéro de T-US05-02>), T-US16-03 (#<numéro de T-US16-03>)
Label suggéré : `Frontend`

## Objectif

Permettre au joueur de consulter sa collection et de composer son équipe active. La tâche est terminée lorsque l'interface reflète l'état serveur, explique les refus et fonctionne avec une collection représentative.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 7 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US05-04 - Tester les équipes vides, de plus de six créatures et contenant une créature non possédée

```markdown
Lié à : #<numéro de US-05>
Dépend de : T-US05-01 (#<numéro de T-US05-01>), T-US05-02 (#<numéro de T-US05-02>), T-US05-03 (#<numéro de T-US05-03>)
Label suggéré : `QA`

## Objectif

Tester les invariants de composition d'équipe. La tâche est terminée lorsque les équipes vides, trop grandes ou contenant une créature non possédée sont systématiquement rejetées.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 4 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-06 - Jouer un combat simple selon les règles Gen 4

### Sous-issues

```markdown
- T-US06-01 - Réaliser un spike `@pkmn/sim` en format simple Gen 4 avec un scénario reproductible
- T-US06-02 - Définir l'adaptateur, les types d'action et le format d'état exposé à l'interface
- T-US06-03 - Implémenter la création du combat, la validation des actions et la résolution des tours
- T-US06-04 - Réaliser l'interface minimale d'attaque, de changement et d'affichage de l'état
- T-US06-05 - Créer des fixtures Gen 4 et des tests de résultat/invariants
- T-US06-06 - Relier contenu configuré, équipe active, adversaire, IA aléatoire, interface et résultat dans une tranche verticale
```

### T-US06-01 - Réaliser un spike `@pkmn/sim` en format simple Gen 4 avec un scénario reproductible

```markdown
Lié à : #<numéro de US-06>
Dépend de : T-US18-01 (#<numéro de T-US18-01>)
Label suggéré : `Combat / Recherche`

## Objectif

Valider l'usage de `@pkmn/sim` pour un combat simple au format Gen 4. La tâche est terminée lorsqu'un scénario déterministe peut être lancé, reproduit et documenté avec ses limites connues.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 4 h | 6 h | 10 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US06-02 - Définir l'adaptateur, les types d'action et le format d'état exposé à l'interface

```markdown
Lié à : #<numéro de US-06>
Dépend de : T-US06-01 (#<numéro de T-US06-01>)
Label suggéré : `Architecture / Combat`

## Objectif

Définir la frontière entre le domaine, le simulateur et l'interface. La tâche est terminée lorsque les actions autorisées et l'état de combat possèdent des types stables utilisables sans dépendre directement des structures internes de `@pkmn/sim`.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 7 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US06-03 - Implémenter la création du combat, la validation des actions et la résolution des tours

```markdown
Lié à : #<numéro de US-06>
Dépend de : T-US05-01 (#<numéro de T-US05-01>), T-US06-01 (#<numéro de T-US06-01>), T-US06-02 (#<numéro de T-US06-02>)
Label suggéré : `Backend / Combat`

## Objectif

Implémenter le cycle serveur d'un combat, de sa création à la résolution des tours. La tâche est terminée lorsque seules les actions légales sont acceptées et que l'état final ne peut être enregistré qu'une fois.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 4 h | 7 h | 11 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US06-04 - Réaliser l'interface minimale d'attaque, de changement et d'affichage de l'état

```markdown
Lié à : #<numéro de US-06>
Dépend de : T-US06-02 (#<numéro de T-US06-02>), T-US06-03 (#<numéro de T-US06-03>)
Label suggéré : `Frontend / Combat`

## Objectif

Créer l'interface minimale d'un combat jouable. La tâche est terminée lorsque le joueur peut attaquer, changer de créature et comprendre l'état courant ainsi que le résultat.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 4 h | 6 h | 10 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US06-05 - Créer des fixtures Gen 4 et des tests de résultat/invariants

```markdown
Lié à : #<numéro de US-06>
Dépend de : T-US06-01 (#<numéro de T-US06-01>), T-US06-02 (#<numéro de T-US06-02>), T-US06-03 (#<numéro de T-US06-03>)
Label suggéré : `QA / Combat`

## Objectif

Constituer des scénarios Gen 4 reproductibles et tester les invariants du moteur. La tâche est terminée lorsque les résultats attendus et les règles critiques choisies sont vérifiés automatiquement.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 4 h | 6 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US06-06 - Relier contenu configuré, équipe active, adversaire, IA aléatoire, interface et résultat dans une tranche verticale

```markdown
Lié à : #<numéro de US-06>
Dépend de : T-US03-02 (#<numéro de T-US03-02>), T-US06-03 (#<numéro de T-US06-03>), T-US06-04 (#<numéro de T-US06-04>), T-US10-01 (#<numéro de T-US10-01>), T-US15-03 (#<numéro de T-US15-03>), T-US16-03 (#<numéro de T-US16-03>)
Label suggéré : `Intégration / Combat`

## Objectif

Assembler une tranche verticale de combat utilisant du contenu configuré, l'équipe active, un adversaire et l'IA aléatoire. La tâche est terminée lorsqu'un joueur authentifié peut lancer, jouer et terminer ce combat depuis l'interface.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 5 h | 8 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-07 - Progresser dans la campagne

### Sous-issues

```markdown
- T-US07-01 - Définir le modèle des mondes, étapes, prérequis, niveaux recommandés et déblocages
- T-US07-02 - Implémenter le chargement de la campagne et l'affichage de la carte
- T-US07-03 - Enregistrer atomiquement la victoire et le déblocage suivant
- T-US07-04 - Tester les accès verrouillés, la reprise, le niveau recommandé non bloquant et la fin de monde
- T-US07-05 - Configurer la progression complète de la campagne définie dans le kick-off
```

### T-US07-01 - Définir le modèle des mondes, étapes, prérequis, niveaux recommandés et déblocages

```markdown
Lié à : #<numéro de US-07>
Dépend de : T-ARC-01 (#<numéro de T-ARC-01>), T-US15-01 (#<numéro de T-US15-01>)
Label suggéré : `Data / Fonctionnel`

## Objectif

Définir la structure de la campagne, ses mondes, étapes, prérequis, niveaux recommandés et déblocages. La tâche est terminée lorsque les règles permettent de représenter toute la progression décrite dans le kick-off.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 4 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US07-02 - Implémenter le chargement de la campagne et l'affichage de la carte

```markdown
Lié à : #<numéro de US-07>
Dépend de : T-US07-01 (#<numéro de T-US07-01>), T-US15-02 (#<numéro de T-US15-02>)
Label suggéré : `Backend / Frontend`

## Objectif

Charger la campagne configurée et afficher la progression sur une carte. La tâche est terminée lorsque les étapes accessibles, terminées et verrouillées sont distinguées à partir de l'état persistant du joueur.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 7 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US07-03 - Enregistrer atomiquement la victoire et le déblocage suivant

```markdown
Lié à : #<numéro de US-07>
Dépend de : T-US06-03 (#<numéro de T-US06-03>), T-US07-01 (#<numéro de T-US07-01>), T-US11-02 (#<numéro de T-US11-02>)
Label suggéré : `Backend / Data`

## Objectif

Enregistrer une victoire et le déblocage correspondant de manière atomique. La tâche est terminée lorsqu'une répétition ou une concurrence ne peut créer ni double progression ni récompense incohérente.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 7 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US07-04 - Tester les accès verrouillés, la reprise, le niveau recommandé non bloquant et la fin de monde

```markdown
Lié à : #<numéro de US-07>
Dépend de : T-US07-02 (#<numéro de T-US07-02>), T-US07-03 (#<numéro de T-US07-03>)
Label suggéré : `QA`

## Objectif

Tester les principales règles de progression de campagne. La tâche est terminée lorsque les accès verrouillés, la reprise, le niveau recommandé informatif et la fin d'un monde sont couverts.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 4 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US07-05 - Configurer la progression complète de la campagne définie dans le kick-off

```markdown
Lié à : #<numéro de US-07>
Dépend de : T-US07-01 (#<numéro de T-US07-01>), T-US08-01 (#<numéro de T-US08-01>), T-US15-02 (#<numéro de T-US15-02>)
Label suggéré : `Contenu`

## Objectif

Encoder l'ensemble de la progression prévue dans le kick-off. La tâche est terminée lorsque les cinq mondes Bachelor, les deux mondes Master et le Doctorat de cinq Boss sont chargeables et reliés sans référence invalide.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 5 h | 8 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-08 - Affronter des dresseurs et Boss identifiables

### Sous-issues

```markdown
- T-US08-01 - Définir le schéma de configuration d'un dresseur ou Boss
- T-US08-02 - Implémenter l'affichage des catchlines d'introduction et de résultat
- T-US08-03 - Intégrer la musique configurée et un contrôle muet
- T-US08-04 - Ajouter un dresseur et un Boss représentatifs avec leurs assets
- T-US08-05 - Compléter l'inventaire des adversaires du MVP avec équipe, IA, catchlines, musique référencée et sprite local
```

### T-US08-01 - Définir le schéma de configuration d'un dresseur ou Boss

```markdown
Lié à : #<numéro de US-08>
Dépend de : T-US15-01 (#<numéro de T-US15-01>)
Label suggéré : `Contenu / Data`

## Objectif

Définir un format versionné pour l'identité, l'équipe, la difficulté fixe, le profil IA, les catchlines, la musique et le sprite d'un adversaire. La tâche est terminée lorsqu'un dresseur et un Boss peuvent être validés avec ce schéma.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US08-02 - Implémenter l'affichage des catchlines d'introduction et de résultat

```markdown
Lié à : #<numéro de US-08>
Dépend de : T-US06-04 (#<numéro de T-US06-04>), T-US08-01 (#<numéro de T-US08-01>)
Label suggéré : `Frontend`

## Objectif

Afficher les phrases configurées avant et après un combat. La tâche est terminée lorsque l'introduction et le résultat correct sont visibles pour une victoire comme pour une défaite.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US08-03 - Intégrer la musique configurée et un contrôle muet

```markdown
Lié à : #<numéro de US-08>
Dépend de : T-US08-01 (#<numéro de T-US08-01>)
Label suggéré : `Frontend / Audio`

## Objectif

Jouer la musique associée à l'adversaire tout en respectant le contrôle muet. La tâche est terminée lorsque le changement de combat, l'arrêt et la préférence audio ne produisent pas de lecture incohérente.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US08-04 - Ajouter un dresseur et un Boss représentatifs avec leurs assets

```markdown
Lié à : #<numéro de US-08>
Dépend de : T-US08-01 (#<numéro de T-US08-01>), T-US15-02 (#<numéro de T-US15-02>), T-US16-03 (#<numéro de T-US16-03>)
Label suggéré : `Contenu`

## Objectif

Créer un dresseur et un Boss de référence avec une configuration et des assets complets. La tâche est terminée lorsque chacun est chargeable, visible et jouable dans un scénario représentatif.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US08-05 - Compléter l'inventaire des adversaires du MVP avec équipe, IA, catchlines, musique référencée et sprite local

```markdown
Lié à : #<numéro de US-08>
Dépend de : T-US07-05 (#<numéro de T-US07-05>), T-US08-04 (#<numéro de T-US08-04>), T-US16-04 (#<numéro de T-US16-04>)
Label suggéré : `Contenu`

## Objectif

Compléter le contenu des adversaires requis par le MVP. La tâche est terminée lorsque chaque adversaire attendu possède une équipe, une difficulté fixe, un profil IA, ses catchlines, une musique référencée et un sprite local valides.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 4 h | 6 h | 10 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-09 - Générer un entraînement adapté à son équipe

### Sous-issues

```markdown
- T-US09-01 - Définir l'algorithme de niveau moyen, les bornes et les cas limites
- T-US09-02 - Générer une équipe adverse légale depuis le pool de contenu
- T-US09-03 - Intégrer le lancement et la fin d'un combat d'entraînement
- T-US09-04 - Tester les équipes faibles, fortes, incomplètes et les bornes de niveau
```

### T-US09-01 - Définir l'algorithme de niveau moyen, les bornes et les cas limites

```markdown
Lié à : #<numéro de US-09>
Dépend de : T-US05-01 (#<numéro de T-US05-01>), T-US15-01 (#<numéro de T-US15-01>)
Label suggéré : `IA / Fonctionnel`

## Objectif

Définir comment le niveau de l'adversaire d'entraînement est calculé depuis l'équipe active. La tâche est terminée lorsque la formule, ses bornes et les comportements des équipes faibles, fortes ou incomplètes sont documentés.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 4 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US09-02 - Générer une équipe adverse légale depuis le pool de contenu

```markdown
Lié à : #<numéro de US-09>
Dépend de : T-US09-01 (#<numéro de T-US09-01>), T-US15-02 (#<numéro de T-US15-02>)
Label suggéré : `IA / Backend`

## Objectif

Générer une équipe adverse légale et cohérente avec le niveau calculé. La tâche est terminée lorsque la génération respecte le pool, les contraintes Gen 4 et les bornes définies.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 7 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US09-03 - Intégrer le lancement et la fin d'un combat d'entraînement

```markdown
Lié à : #<numéro de US-09>
Dépend de : T-US06-06 (#<numéro de T-US06-06>), T-US09-02 (#<numéro de T-US09-02>)
Label suggéré : `Backend / Combat`

## Objectif

Relier la génération procédurale au cycle complet d'un combat d'entraînement. La tâche est terminée lorsqu'un joueur peut lancer puis terminer un entraînement sans modifier la progression de campagne.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 7 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US09-04 - Tester les équipes faibles, fortes, incomplètes et les bornes de niveau

```markdown
Lié à : #<numéro de US-09>
Dépend de : T-US09-01 (#<numéro de T-US09-01>), T-US09-02 (#<numéro de T-US09-02>), T-US09-03 (#<numéro de T-US09-03>)
Label suggéré : `QA / IA`

## Objectif

Tester la mise à l'échelle procédurale de l'entraînement. La tâche est terminée lorsque les équipes faibles, fortes, incomplètes et les valeurs aux bornes produisent des adversaires valides.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 4 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-10 - Choisir la difficulté de l'entraînement

### Sous-issues

```markdown
- T-US10-01 - Implémenter une IA aléatoire qui ne produit que des actions légales
- T-US10-02 - Définir et implémenter l'heuristique du niveau normal
- T-US10-03 - Prototyper Expectiminimax avec budget et stratégie de repli
- T-US10-04 - Configurer les multiplicateurs de récompense par difficulté
- T-US10-05 - Mesurer le temps de décision, fixer le budget et tester les différences de comportement
```

### T-US10-01 - Implémenter une IA aléatoire qui ne produit que des actions légales

```markdown
Lié à : #<numéro de US-10>
Dépend de : T-US06-02 (#<numéro de T-US06-02>)
Label suggéré : `IA`

## Objectif

Fournir une IA facile choisissant aléatoirement parmi les actions légales. La tâche est terminée lorsqu'aucune action invalide n'est produite sur les états de test.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US10-02 - Définir et implémenter l'heuristique du niveau normal

```markdown
Lié à : #<numéro de US-10>
Dépend de : T-US06-02 (#<numéro de T-US06-02>), T-US09-02 (#<numéro de T-US09-02>)
Label suggéré : `IA`

## Objectif

Définir puis implémenter une IA normale fondée sur une heuristique explicable. La tâche est terminée lorsque ses critères sont documentés et qu'elle privilégie les choix attendus dans les scénarios représentatifs.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 7 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US10-03 - Prototyper Expectiminimax avec budget et stratégie de repli

```markdown
Lié à : #<numéro de US-10>
Dépend de : T-US06-02 (#<numéro de T-US06-02>), T-US09-02 (#<numéro de T-US09-02>)
Label suggéré : `IA / Recherche`

## Objectif

Évaluer puis intégrer un prototype d'Expectiminimax borné pour l'IA difficile. La tâche est terminée lorsque l'algorithme respecte un budget mesurable et bascule vers une stratégie de repli valide si ce budget est atteint.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 6 h | 10 h | 18 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US10-04 - Configurer les multiplicateurs de récompense par difficulté

```markdown
Lié à : #<numéro de US-10>
Dépend de : T-US09-03 (#<numéro de T-US09-03>), T-US11-01 (#<numéro de T-US11-01>)
Label suggéré : `Équilibrage / Backend`

## Objectif

Associer à chaque difficulté les multiplicateurs configurés d'expérience et de monnaie. La tâche est terminée lorsque les gains calculés reflètent la difficulté choisie sans duplication.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 4 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US10-05 - Mesurer le temps de décision, fixer le budget et tester les différences de comportement

```markdown
Lié à : #<numéro de US-10>
Dépend de : T-US10-01 (#<numéro de T-US10-01>), T-US10-02 (#<numéro de T-US10-02>), T-US10-03 (#<numéro de T-US10-03>)
Label suggéré : `QA / Performance`

## Objectif

Comparer les trois IA et mesurer leur temps de décision. La tâche est terminée lorsque les scénarios démontrent des comportements distincts et qu'un budget de calcul documenté est vérifié automatiquement.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-11 - Recevoir et conserver ses gains

### Sous-issues

```markdown
- T-US11-01 - Définir le calcul des gains et la clé d'idempotence d'une attribution
- T-US11-02 - Implémenter la transaction XP, monnaie et déblocages
- T-US11-03 - Afficher les gains et le nouveau solde après le combat
- T-US11-04 - Tester le rejeu, l'échec partiel et deux requêtes concurrentes
```

### T-US11-01 - Définir le calcul des gains et la clé d'idempotence d'une attribution

```markdown
Lié à : #<numéro de US-11>
Dépend de : T-ARC-01 (#<numéro de T-ARC-01>), T-US06-03 (#<numéro de T-US06-03>)
Label suggéré : `Fonctionnel / Data`

## Objectif

Définir les règles de calcul des gains et l'identifiant stable d'une attribution. La tâche est terminée lorsque la même issue de combat ne peut légitimement produire qu'une seule attribution.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US11-02 - Implémenter la transaction XP, monnaie et déblocages

```markdown
Lié à : #<numéro de US-11>
Dépend de : T-ARC-02 (#<numéro de T-ARC-02>), T-US11-01 (#<numéro de T-US11-01>)
Label suggéré : `Backend / Data`

## Objectif

Appliquer XP, monnaie et déblocages dans une transaction idempotente. La tâche est terminée lorsque tout le résultat est enregistré ou qu'aucune modification partielle ne subsiste.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 6 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US11-03 - Afficher les gains et le nouveau solde après le combat

```markdown
Lié à : #<numéro de US-11>
Dépend de : T-US06-04 (#<numéro de T-US06-04>), T-US11-02 (#<numéro de T-US11-02>)
Label suggéré : `Frontend`

## Objectif

Présenter après le combat les gains appliqués et le nouveau solde. La tâche est terminée lorsque les valeurs affichées correspondent à l'état persistant confirmé par le serveur.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US11-04 - Tester le rejeu, l'échec partiel et deux requêtes concurrentes

```markdown
Lié à : #<numéro de US-11>
Dépend de : T-US11-01 (#<numéro de T-US11-01>), T-US11-02 (#<numéro de T-US11-02>)
Label suggéré : `QA / Data`

## Objectif

Tester la robustesse de l'attribution des gains. La tâche est terminée lorsque le rejeu, l'échec partiel et deux requêtes concurrentes ne provoquent aucune double récompense.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-12 - Recruter une créature dans la boutique gacha

### Sous-issues

```markdown
- T-US12-01 - Définir les portails, coûts, taux de drop et règle de doublon
- T-US12-02 - Implémenter le tirage pondéré et la transaction monnaie/collection
- T-US12-03 - Réaliser l'interface des portails, du tirage et du résultat
- T-US12-04 - Tester les probabilités, le solde insuffisant, le rejeu et la concurrence
- T-US12-05 - Créer et valider les configurations des portails retenus pour le MVP
```

### T-US12-01 - Définir les portails, coûts, taux de drop et règle de doublon

```markdown
Lié à : #<numéro de US-12>
Dépend de : T-US15-01 (#<numéro de T-US15-01>)
Label suggéré : `Gacha / Équilibrage`

## Objectif

Définir les portails, leurs coûts, leurs distributions et le traitement des doublons. La tâche est terminée lorsque chaque probabilité est valide, explicite et liée à du contenu existant.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US12-02 - Implémenter le tirage pondéré et la transaction monnaie/collection

```markdown
Lié à : #<numéro de US-12>
Dépend de : T-US05-01 (#<numéro de T-US05-01>), T-US11-02 (#<numéro de T-US11-02>), T-US12-01 (#<numéro de T-US12-01>)
Label suggéré : `Backend / Gacha`

## Objectif

Exécuter le tirage et mettre à jour monnaie et collection dans une transaction unique. La tâche est terminée lorsqu'un tirage valide débite exactement son coût et attribue exactement son résultat.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 7 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US12-03 - Réaliser l'interface des portails, du tirage et du résultat

```markdown
Lié à : #<numéro de US-12>
Dépend de : T-US12-01 (#<numéro de T-US12-01>), T-US12-02 (#<numéro de T-US12-02>), T-US16-03 (#<numéro de T-US16-03>)
Label suggéré : `Frontend / Gacha`

## Objectif

Créer le parcours de sélection d'un portail, de tirage et d'affichage du résultat. La tâche est terminée lorsque l'interface indique le coût, bloque un solde insuffisant et reflète la collection mise à jour.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 7 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US12-04 - Tester les probabilités, le solde insuffisant, le rejeu et la concurrence

```markdown
Lié à : #<numéro de US-12>
Dépend de : T-US12-01 (#<numéro de T-US12-01>), T-US12-02 (#<numéro de T-US12-02>)
Label suggéré : `QA / Gacha`

## Objectif

Tester la distribution et les garanties transactionnelles du gacha. La tâche est terminée lorsque les taux, le solde insuffisant, le rejeu et la concurrence sont couverts par des tests appropriés.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US12-05 - Créer et valider les configurations des portails retenus pour le MVP

```markdown
Lié à : #<numéro de US-12>
Dépend de : T-US12-01 (#<numéro de T-US12-01>), T-US15-02 (#<numéro de T-US15-02>), T-US16-04 (#<numéro de T-US16-04>)
Label suggéré : `Contenu / Gacha`

## Objectif

Créer les configurations de tous les portails retenus pour le MVP. La tâche est terminée lorsque leurs coûts, taux et références passent la validation automatisée et totalisent une distribution correcte.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-13 - Accomplir des quêtes communes avec une progression individuelle

### Sous-issues

```markdown
- T-US13-01 - Modéliser définitions, rotations, instances joueur et récompenses
- T-US13-02 - Implémenter les rotations quotidiennes et hebdomadaires avec fuseau défini
- T-US13-03 - Implémenter les compteurs individuels et l'attribution unique
- T-US13-04 - Réaliser l'interface de consultation des quêtes et de leur progression
- T-US13-05 - Tester deux joueurs, deux rotations et une récompense rejouée
```

### T-US13-01 - Modéliser définitions, rotations, instances joueur et récompenses

```markdown
Lié à : #<numéro de US-13>
Dépend de : T-ARC-01 (#<numéro de T-ARC-01>)
Label suggéré : `Data / Quêtes`

## Objectif

Modéliser les définitions communes, les rotations et la progression propre à chaque joueur. La tâche est terminée lorsque le modèle distingue clairement contenu partagé, état individuel et attribution de récompense.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US13-02 - Implémenter les rotations quotidiennes et hebdomadaires avec fuseau défini

```markdown
Lié à : #<numéro de US-13>
Dépend de : T-US13-01 (#<numéro de T-US13-01>)
Label suggéré : `Backend / Quêtes`

## Objectif

Générer les rotations quotidiennes et hebdomadaires dans un fuseau horaire explicite. La tâche est terminée lorsque les limites de période sont déterministes et qu'une seule rotation active existe par type.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US13-03 - Implémenter les compteurs individuels et l'attribution unique

```markdown
Lié à : #<numéro de US-13>
Dépend de : T-US13-01 (#<numéro de T-US13-01>), T-US17-04 (#<numéro de T-US17-04>)
Label suggéré : `Backend / Quêtes`

## Objectif

Mettre à jour les compteurs individuels et attribuer chaque récompense une seule fois. La tâche est terminée lorsque deux joueurs progressent indépendamment à partir des mêmes définitions.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 7 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US13-04 - Réaliser l'interface de consultation des quêtes et de leur progression

```markdown
Lié à : #<numéro de US-13>
Dépend de : T-US13-02 (#<numéro de T-US13-02>), T-US13-03 (#<numéro de T-US13-03>)
Label suggéré : `Frontend / Quêtes`

## Objectif

Afficher les quêtes actives, leur progression et leur état de récompense. La tâche est terminée lorsque les données présentées correspondent à la rotation et au joueur connectés.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 7 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US13-05 - Tester deux joueurs, deux rotations et une récompense rejouée

```markdown
Lié à : #<numéro de US-13>
Dépend de : T-US13-02 (#<numéro de T-US13-02>), T-US13-03 (#<numéro de T-US13-03>), T-US17-05 (#<numéro de T-US17-05>)
Label suggéré : `QA / Quêtes`

## Objectif

Tester l'isolation et l'idempotence du système de quêtes. La tâche est terminée lorsque deux joueurs, deux rotations et une attribution rejouée conservent des états corrects.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-14 - Utiliser les parcours principaux de manière accessible

### Sous-issues

```markdown
- T-US14-01 - Définir et appliquer les règles de focus, clavier et messages d'état
- T-US14-02 - Ajouter les contrôles audio et persister la préférence muette
- T-US14-03 - Automatiser les contrôles axe-core sur les écrans principaux
```

### T-US14-01 - Définir et appliquer les règles de focus, clavier et messages d'état

```markdown
Lié à : #<numéro de US-14>
Dépend de : T-US04-01 (#<numéro de T-US04-01>), T-US06-04 (#<numéro de T-US06-04>), T-US13-04 (#<numéro de T-US13-04>)
Label suggéré : `Accessibilité / Frontend`

## Objectif

Appliquer des règles communes de focus, navigation clavier et annonce des changements d'état. La tâche est terminée lorsque les parcours principaux sont utilisables au clavier et communiquent leurs états importants.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US14-02 - Ajouter les contrôles audio et persister la préférence muette

```markdown
Lié à : #<numéro de US-14>
Dépend de : T-US08-03 (#<numéro de T-US08-03>)
Label suggéré : `Frontend / Audio`

## Objectif

Fournir un contrôle audio accessible et mémoriser le choix du joueur. La tâche est terminée lorsque la préférence muette reste appliquée entre les pages et les sessions prévues.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US14-03 - Automatiser les contrôles axe-core sur les écrans principaux

```markdown
Lié à : #<numéro de US-14>
Dépend de : T-US14-01 (#<numéro de T-US14-01>), T-US19-03 (#<numéro de T-US19-03>)
Label suggéré : `QA / Accessibilité`

## Objectif

Ajouter des contrôles axe-core aux écrans principaux. La tâche est terminée lorsque ces contrôles s'exécutent automatiquement en CI et échouent sur les violations bloquantes retenues.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-15 - Ajouter du contenu sans modifier le moteur

### Sous-issues

```markdown
- T-US15-01 - Définir les schémas et inventaires versionnés des mondes, adversaires et portails
- T-US15-02 - Implémenter le chargement et la validation des références de contenu
- T-US15-03 - Créer des configurations représentatives pour un monde, un Boss et un portail
- T-US15-04 - Ajouter un contrôle automatisé qui refuse une configuration invalide
```

### T-US15-01 - Définir les schémas et inventaires versionnés des mondes, adversaires et portails

```markdown
Lié à : #<numéro de US-15>
Dépend de : T-ARC-01 (#<numéro de T-ARC-01>)
Label suggéré : `Contenu / Data`

## Objectif

Définir les schémas et inventaires versionnés du contenu de campagne, des adversaires et des portails. La tâche est terminée lorsque chaque type de contenu possède des champs, identifiants et références non ambigus.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US15-02 - Implémenter le chargement et la validation des références de contenu

```markdown
Lié à : #<numéro de US-15>
Dépend de : T-US15-01 (#<numéro de T-US15-01>)
Label suggéré : `Backend / Contenu`

## Objectif

Charger le contenu déclaratif et valider ses références avant utilisation. La tâche est terminée lorsqu'une configuration invalide produit une erreur explicite et ne peut démarrer l'application comme contenu valide.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US15-03 - Créer des configurations représentatives pour un monde, un Boss et un portail

```markdown
Lié à : #<numéro de US-15>
Dépend de : T-US15-01 (#<numéro de T-US15-01>), T-US15-02 (#<numéro de T-US15-02>)
Label suggéré : `Contenu`

## Objectif

Créer un monde, un Boss et un portail servant de références d'implémentation. La tâche est terminée lorsque les trois configurations sont validées, chargées et utilisables par leur module.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US15-04 - Ajouter un contrôle automatisé qui refuse une configuration invalide

```markdown
Lié à : #<numéro de US-15>
Dépend de : T-US15-01 (#<numéro de T-US15-01>), T-US15-02 (#<numéro de T-US15-02>)
Label suggéré : `QA / Contenu`

## Objectif

Automatiser la validation de tout le contenu versionné. La tâche est terminée lorsqu'une référence absente, un identifiant dupliqué ou une valeur invalide fait échouer le contrôle.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-16 - Importer et servir les sprites localement

### Sous-issues

```markdown
- T-US16-01 - Inventorier les sprites requis et définir le manifeste de source/version
- T-US16-02 - Développer le script d'import ciblé depuis PokéAPI
- T-US16-03 - Implémenter le `SpriteProvider` local et son fallback
- T-US16-04 - Vérifier automatiquement les références et fichiers manquants
```

### T-US16-01 - Inventorier les sprites requis et définir le manifeste de source/version

```markdown
Lié à : #<numéro de US-16>
Dépend de : T-US15-01 (#<numéro de T-US15-01>)
Label suggéré : `Assets / Documentation`

## Objectif

Établir la liste des sprites nécessaires et tracer leur source ainsi que leur version. La tâche est terminée lorsque chaque sprite attendu possède une entrée de manifeste exploitable et documentée.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US16-02 - Développer le script d'import ciblé depuis PokéAPI

```markdown
Lié à : #<numéro de US-16>
Dépend de : T-US16-01 (#<numéro de T-US16-01>)
Label suggéré : `Assets / Outillage`

## Objectif

Créer un outil reproductible important uniquement les sprites Pokémon listés. La tâche est terminée lorsque le script peut être rejoué et signale clairement une ressource distante absente ou invalide.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US16-03 - Implémenter le `SpriteProvider` local et son fallback

```markdown
Lié à : #<numéro de US-16>
Dépend de : T-US16-01 (#<numéro de T-US16-01>), T-US16-02 (#<numéro de T-US16-02>)
Label suggéré : `Frontend / Assets`

## Objectif

Servir les sprites depuis les assets locaux derrière une interface `SpriteProvider`. La tâche est terminée lorsqu'une ressource connue s'affiche localement et qu'un fallback contrôlé couvre une référence manquante.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 4 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US16-04 - Vérifier automatiquement les références et fichiers manquants

```markdown
Lié à : #<numéro de US-16>
Dépend de : T-US16-01 (#<numéro de T-US16-01>), T-US16-02 (#<numéro de T-US16-02>), T-US16-03 (#<numéro de T-US16-03>)
Label suggéré : `QA / Assets`

## Objectif

Contrôler la cohérence entre manifeste, configurations et fichiers locaux. La tâche est terminée lorsqu'un fichier ou une référence manquante est détecté automatiquement.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-17 - Traiter les événements de quête de manière fiable

### Sous-issues

```markdown
- T-US17-01 - Définir les contrats d'événement, l'`eventId` et la stratégie de publication garantie
- T-US17-02 - Implémenter l'écriture transactionnelle du résultat et de l'événement en attente
- T-US17-03 - Publier les événements en attente dans Redis Streams avec reprise
- T-US17-04 - Implémenter le consumer group, l'acquittement et la reprise des messages abandonnés
- T-US17-05 - Tester perte Redis, arrêt worker, rejeu et absence de double récompense
```

### T-US17-01 - Définir les contrats d'événement, l'`eventId` et la stratégie de publication garantie

```markdown
Lié à : #<numéro de US-17>
Dépend de : T-ARC-01 (#<numéro de T-ARC-01>), T-US13-01 (#<numéro de T-US13-01>)
Label suggéré : `Architecture / Redis`

## Objectif

Définir le contrat des événements de quête, leur `eventId` et le mécanisme garantissant leur publication. La tâche est terminée lorsque producteurs et consommateurs partagent un format versionné et une règle d'idempotence.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US17-02 - Implémenter l'écriture transactionnelle du résultat et de l'événement en attente

```markdown
Lié à : #<numéro de US-17>
Dépend de : T-ARC-02 (#<numéro de T-ARC-02>), T-US17-01 (#<numéro de T-US17-01>)
Label suggéré : `Backend / Data`

## Objectif

Enregistrer dans la même transaction le résultat métier et l'événement à publier. La tâche est terminée lorsqu'aucun résultat validé ne peut perdre définitivement son événement associé.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 7 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US17-03 - Publier les événements en attente dans Redis Streams avec reprise

```markdown
Lié à : #<numéro de US-17>
Dépend de : T-US17-01 (#<numéro de T-US17-01>), T-US17-02 (#<numéro de T-US17-02>), T-US18-02 (#<numéro de T-US18-02>)
Label suggéré : `Backend / Redis`

## Objectif

Publier vers Redis Streams les événements persistés en attente. La tâche est terminée lorsque le processus reprend après interruption et marque sans ambiguïté ce qui a été publié.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 7 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US17-04 - Implémenter le consumer group, l'acquittement et la reprise des messages abandonnés

```markdown
Lié à : #<numéro de US-17>
Dépend de : T-US17-01 (#<numéro de T-US17-01>), T-US17-03 (#<numéro de T-US17-03>), T-US18-02 (#<numéro de T-US18-02>)
Label suggéré : `Worker / Redis`

## Objectif

Consommer les événements avec un consumer group, acquitter les succès et reprendre les messages abandonnés. La tâche est terminée lorsque le worker redémarre sans perdre d'événement ni appliquer deux fois un effet.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 7 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US17-05 - Tester perte Redis, arrêt worker, rejeu et absence de double récompense

```markdown
Lié à : #<numéro de US-17>
Dépend de : T-US17-02 (#<numéro de T-US17-02>), T-US17-03 (#<numéro de T-US17-03>), T-US17-04 (#<numéro de T-US17-04>)
Label suggéré : `QA / Intégration`

## Objectif

Tester les modes de panne de la chaîne d'événements. La tâche est terminée lorsque la perte de Redis, l'arrêt du worker et le rejeu ne causent ni perte définitive ni double récompense.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-18 - Lancer un environnement local reproductible

### Sous-issues

```markdown
- T-US18-01 - Initialiser Next.js/TypeScript strict, le lockfile et les scripts communs
- T-US18-02 - Configurer Docker Compose pour l'application, PostgreSQL et Redis
- T-US18-03 - Ajouter `.env.example`, volumes, réseau et contrôles de santé locaux
- T-US18-04 - Rédiger et faire tester la procédure de démarrage par un autre membre
```

### T-US18-01 - Initialiser Next.js/TypeScript strict, le lockfile et les scripts communs

```markdown
Lié à : #<numéro de US-18>
Dépend de : aucune
Label suggéré : `Outillage`

## Objectif

Initialiser le projet avec Next.js, TypeScript strict, un lockfile et des scripts communs. La tâche est terminée lorsqu'une installation propre permet d'exécuter les commandes prévues de façon reproductible.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US18-02 - Configurer Docker Compose pour l'application, PostgreSQL et Redis

```markdown
Lié à : #<numéro de US-18>
Dépend de : T-US18-01 (#<numéro de T-US18-01>)
Label suggéré : `DevOps`

## Objectif

Décrire l'application, PostgreSQL et Redis dans Docker Compose pour le développement. La tâche est terminée lorsque les trois services démarrent ensemble et communiquent sur le réseau prévu.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 4 h | 6 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US18-03 - Ajouter `.env.example`, volumes, réseau et contrôles de santé locaux

```markdown
Lié à : #<numéro de US-18>
Dépend de : T-US18-02 (#<numéro de T-US18-02>)
Label suggéré : `DevOps`

## Objectif

Documenter les variables attendues et configurer volumes, réseau et contrôles de santé locaux. La tâche est terminée lorsqu'un nouvel environnement peut être préparé sans secret versionné et que l'état des services est observable.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 4 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US18-04 - Rédiger et faire tester la procédure de démarrage par un autre membre

```markdown
Lié à : #<numéro de US-18>
Dépend de : T-US18-01 (#<numéro de T-US18-01>), T-US18-02 (#<numéro de T-US18-02>), T-US18-03 (#<numéro de T-US18-03>)
Label suggéré : `Documentation / QA`

## Objectif

Rédiger une procédure de démarrage puis la faire exécuter par un autre membre. La tâche est terminée lorsque ce membre lance l'environnement sans aide orale et que les ambiguïtés découvertes sont corrigées.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-19 - Contrôler automatiquement chaque intégration

### Sous-issues

```markdown
- T-US19-01 - Normaliser les scripts lint, typecheck, tests et build
- T-US19-02 - Remplacer le contrôle fictif du POC par la CI réelle déclenchée sur `dev`
- T-US19-03 - Compléter le workflow de PR avec services éphémères, E2E, accessibilité et validation d'image
- T-US19-04 - Protéger `main` et configurer les checks obligatoires
```

### T-US19-01 - Normaliser les scripts lint, typecheck, tests et build

```markdown
Lié à : #<numéro de US-19>
Dépend de : T-US18-01 (#<numéro de T-US18-01>)
Label suggéré : `CI / Outillage`

## Objectif

Normaliser les commandes de lint, typecheck, tests et build utilisées localement et en CI. La tâche est terminée lorsque chaque commande possède un résultat fiable et un code de sortie exploitable.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US19-02 - Remplacer le contrôle fictif du POC par la CI réelle déclenchée sur `dev`

```markdown
Lié à : #<numéro de US-19>
Dépend de : T-US19-01 (#<numéro de T-US19-01>)
Label suggéré : `CI`

## Objectif

Remplacer les commandes fictives du POC par les contrôles réels sur `dev`. La tâche est terminée lorsqu'une erreur de lint, de typage, de test ou de build fait effectivement échouer le workflow.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US19-03 - Compléter le workflow de PR avec services éphémères, E2E, accessibilité et validation d'image

```markdown
Lié à : #<numéro de US-19>
Dépend de : T-US18-02 (#<numéro de T-US18-02>), T-US19-01 (#<numéro de T-US19-01>), T-US19-02 (#<numéro de T-US19-02>)
Label suggéré : `CI / QA`

## Objectif

Compléter les contrôles de Pull Request avec dépendances éphémères, E2E, accessibilité et validation de l'image. La tâche est terminée lorsque la PR vers `main` ne peut être validée si l'un de ces contrôles échoue.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 4 h | 8 h | 12 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US19-04 - Protéger `main` et configurer les checks obligatoires

```markdown
Lié à : #<numéro de US-19>
Dépend de : T-US19-02 (#<numéro de T-US19-02>)
Label suggéré : `GitHub / Sécurité`

## Objectif

Configurer la protection de `main` et les checks obligatoires. La tâche est terminée lorsqu'un push direct ou une fusion sans revue et sans checks verts est refusé selon les règles de l'équipe.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 1 h | 2 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## US-20 - Déployer et restaurer une version identifiable

### Sous-issues

```markdown
- T-US20-01 - Finaliser Docker Compose de production, vérifier HTTPS et isoler PostgreSQL/Redis sur le réseau privé du VPS
- T-US20-02 - Garantir que l'image publiée dans GHCR et déployée est identifiée par le SHA, sans dépendre de `latest`
- T-US20-03 - Compléter GitHub Actions Secrets, la connexion SSH et la concurrence de déploiement
- T-US20-04 - Ajouter `prisma migrate deploy` et remplacer l'attente fixe par un smoke test avec tentatives bornées
- T-US20-05 - Tester l'image SHA dans une stack éphémère avant publication et automatiser le redéploiement du SHA précédent
- T-US20-06 - Ajouter des logs structurés avec `requestId`/`eventId` et vérifier l'absence de secrets
```

### T-US20-01 - Finaliser Docker Compose de production, vérifier HTTPS et isoler PostgreSQL/Redis sur le réseau privé du VPS

```markdown
Lié à : #<numéro de US-20>
Dépend de : T-US18-02 (#<numéro de T-US18-02>), T-US18-03 (#<numéro de T-US18-03>)
Label suggéré : `DevOps / Sécurité`

## Objectif

Préparer l'environnement de production avec HTTPS et un réseau privé pour PostgreSQL et Redis. La tâche est terminée lorsque seule l'application est exposée publiquement et que la configuration Compose de production est reproductible.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 3 h | 6 h | 10 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US20-02 - Garantir que l'image publiée dans GHCR et déployée est identifiée par le SHA, sans dépendre de `latest`

```markdown
Lié à : #<numéro de US-20>
Dépend de : T-US19-02 (#<numéro de T-US19-02>), T-US19-03 (#<numéro de T-US19-03>)
Label suggéré : `CD / Docker`

## Objectif

Publier et déployer une image immuable identifiée par le SHA Git. La tâche est terminée lorsque le même digest testé et poussé est celui demandé au VPS, sans dépendre du tag `latest`.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 3 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US20-03 - Compléter GitHub Actions Secrets, la connexion SSH et la concurrence de déploiement

```markdown
Lié à : #<numéro de US-20>
Dépend de : T-US20-01 (#<numéro de T-US20-01>), T-US20-02 (#<numéro de T-US20-02>)
Label suggéré : `CD / Sécurité`

## Objectif

Configurer les secrets, l'accès SSH et l'exclusion mutuelle des déploiements. La tâche est terminée lorsqu'aucun secret n'est versionné et que deux déploiements ne peuvent modifier le VPS simultanément.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 1 h | 2 h | 4 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US20-04 - Ajouter `prisma migrate deploy` et remplacer l'attente fixe par un smoke test avec tentatives bornées

```markdown
Lié à : #<numéro de US-20>
Dépend de : T-ARC-02 (#<numéro de T-ARC-02>), T-US20-01 (#<numéro de T-US20-01>), T-US20-02 (#<numéro de T-US20-02>), T-US20-03 (#<numéro de T-US20-03>)
Label suggéré : `CD / Prisma`

## Objectif

Appliquer les migrations Prisma puis vérifier le service avec des tentatives bornées. La tâche est terminée lorsque le pipeline n'utilise plus d'attente fixe et échoue clairement si l'application ne devient pas saine.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US20-05 - Tester l'image SHA dans une stack éphémère avant publication et automatiser le redéploiement du SHA précédent

```markdown
Lié à : #<numéro de US-20>
Dépend de : T-US20-02 (#<numéro de T-US20-02>), T-US20-03 (#<numéro de T-US20-03>), T-US20-04 (#<numéro de T-US20-04>)
Label suggéré : `QA / CD`

## Objectif

Valider l'image SHA dans une stack éphémère avant publication et automatiser le retour à la version précédente. La tâche est terminée lorsqu'une image invalide n'est pas publiée et qu'un smoke test en échec restaure un SHA déjà validé.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 4 h | 8 h | 12 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
### T-US20-06 - Ajouter des logs structurés avec `requestId`/`eventId` et vérifier l'absence de secrets

```markdown
Lié à : #<numéro de US-20>
Dépend de : T-US17-01 (#<numéro de T-US17-01>), T-US20-01 (#<numéro de T-US20-01>), T-US20-04 (#<numéro de T-US20-04>)
Label suggéré : `Exploitabilité / Sécurité`

## Objectif

Produire des logs structurés corrélables sans information sensible. La tâche est terminée lorsque les événements applicatifs et de déploiement pertinents incluent un `requestId` ou un `eventId` et qu'un contrôle ne détecte aucun secret.

## Estimation

| Optimiste | Attendu | Pessimiste |
|---:|---:|---:|
| 2 h | 3 h | 5 h |

## Definition of Done

- Objectif et condition de sortie de la tâche vérifiés.
- Code ou contenu revu par au moins un autre membre.
- Tests concernés passants.
- Documentation ou configuration mise à jour si nécessaire.
- Pull Request ou commit lié à l'issue.
```
## Contrôle de cohérence

- Nombre de tâches : **90**
- Total optimiste : **187 h**
- Total attendu : **300 h**
- Total pessimiste : **500 h**
- Tâches sans dépendance préalable proposée : **T-ARC-01, T-US01-01, T-US18-01**

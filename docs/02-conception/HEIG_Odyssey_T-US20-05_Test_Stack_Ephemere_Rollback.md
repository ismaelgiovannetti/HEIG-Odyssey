# T-US20-05 - Test de la stack éphémère et rollback automatique

| Élément | Valeur |
|---|---|
| Tâche | T-US20-05 |
| Nature | QA / CD |
| Dépend de | T-US20-02 (SHA immuable), T-US20-03 (secrets/SSH/concurrence), T-US20-04 (migration + smoke test borné) |
| Statut | Mécanisme déjà implémenté dans `.github/workflows/ci-cd.yml` (jobs `package`/`deploy`) ; vérifié empiriquement par cette tâche |

## 1. Constat de départ

Les deux exigences de T-US20-05 étaient déjà couvertes par le code existant du pipeline, construit au fil de T-US20-02/03/04 :

- **"Valider l'image SHA dans une stack éphémère avant publication"** → job `package`, étape *Test exact production images* (`.github/workflows/ci-cd.yml:383-409`) : construit les 3 images taguées par `$GITHUB_SHA`, les démarre via `compose.ci.yml` (stack locale, aucun secret réel), migre puis attend un smoke test réussi. Le push vers GHCR (étape suivante, ligne 418) n'est atteint que si tout précède réussit.
- **"Automatiser le retour à la version précédente"** → job `deploy`, fonction `restore_previous()` (`.github/workflows/ci-cd.yml:505-517`), déclenchée sur échec de migration (534), échec de démarrage (544) ou échec du smoke test (554).

Cette tâche ne modifie donc pas le pipeline : elle **vérifie empiriquement** que ce mécanisme tient ses promesses, ce que "Tests concernés passants" exige pour une tâche QA/CD.

## 2. Vérification empirique — stack éphémère (`compose.ci.yml`)

`compose.ci.yml` ne contient aucun secret réel (identifiants Postgres/Redis locaux, `BETTER_AUTH_SECRET` factice) : reproductible intégralement en local, sans risque, sans toucher GHCR ni le VPS de production.

### 2.1 Cas positif

Construction locale des 3 images (`docker build` sur `Dockerfile` cibles `runner`/`migrator`, et `landing-page/Dockerfile`), puis reproduction exacte de l'étape du job `package` :

```
docker compose -f compose.ci.yml run --rm migrate   → migrations appliquées avec succès
docker compose -f compose.ci.yml up -d --wait app landing → tous les conteneurs "Healthy"
curl /api/health (port 3000) + curl / (port 8080)    → succès dès la 1re tentative
```

### 2.2 Cas négatif

Remplacement de `APP_IMAGE` par une image délibérément cassée (`alpine:latest` retaguée — ne sert rien sur le port 3000, le conteneur se termine immédiatement) :

```
docker compose -f compose.ci.yml up -d --wait app landing
→ code de sortie : 1 (le conteneur app ne devient jamais "Healthy")
→ smoke test (boucle curl) : échoue également, en secours
```

Avec `set -euo pipefail` du vrai workflow, cet échec **arrête l'étape immédiatement** — l'étape *Log in to GHCR* / *Push* n'est jamais atteinte. Preuve empirique directe qu'une image invalide ne peut pas être publiée.

## 3. Revue de la logique de rollback (`deploy`)

Le job `deploy` dépend de secrets réels (SSH, `CR_PAT`, VPS de production) : **non exécutable ni testable en local en toute sécurité**. Vérification par relecture systématique de chaque branche d'échec du script (`.github/workflows/ci-cd.yml:472-568`) :

| Étape | Échec géré par `restore_previous()` ? | Remarque |
|---|---|---|
| `docker login` GHCR | Non | Aucun état du VPS modifié avant ce point : rien à restaurer. |
| `dc config` / `dc pull` (nouvelles images) | Non | La version précédente tourne encore, intacte, tant que `dc up` n'a pas été appelé. |
| Synchronisation du mot de passe Postgres | Non | `dc up -d --wait postgres redis` est idempotent si la config est inchangée ; risque résiduel faible. |
| **Migration** (`dc --profile tools run --rm migrate`) | **Oui** (ligne 534) | Explicitement couvert par la DoD. |
| **Démarrage** (`dc up -d ... webapp ...`) | **Oui** (ligne 544) | Au-delà de la DoD littérale (qui ne mentionne que le smoke test), défense en profondeur. |
| **Smoke test post-déploiement** | **Oui** (ligne 554) | Cas explicitement nommé par la DoD. |

`restore_previous()` elle-même (lignes 505-517) :
- refuse proprement le rollback si `.deployed_sha` est vide (premier déploiement jamais réussi) plutôt que d'échouer silencieusement ;
- reconfigure les images sur `$PREVIOUS_SHA`, relance `dc pull`/`dc up` (chacun avec sa propre garde `|| return 1`) ;
- **revérifie la santé de la version restaurée** via son propre appel à `smoke_test()` — ce n'est pas un rollback "à l'aveugle", l'ancien SHA doit lui aussi repasser le smoke test.
- Les migrations ne sont jamais annulées automatiquement (commentaire ligne 513-514) : limitation connue et documentée, cohérente avec la pratique standard (les migrations doivent rester rétrocompatibles).

**Conclusion de la revue** : la logique couvre bien le critère de la DoD ("un smoke test en échec restaure un SHA déjà validé") et va au-delà en couvrant aussi l'échec de migration et de démarrage. Les trois cas non couverts (login, pull, sync mot de passe) sont des échecs *pré-déploiement* où rien n'a encore été modifié sur le VPS — un rollback y serait un no-op, pas une lacune.

## 4. Limites

- La revue du job `deploy` reste **statique** (lecture de code), faute de pouvoir exécuter ce script contre un vrai VPS sans risque. Une vérification dynamique complète nécessiterait un environnement de staging dédié — hors périmètre de cette tâche.
- Le cas négatif utilise une image générique cassée (`alpine`) plutôt qu'une vraie régression applicative, car construire une image `app` volontairement buguée aurait dupliqué inutilement le Dockerfile réel. Le point vérifié (le smoke test bloque une image non fonctionnelle) est le même dans les deux cas.

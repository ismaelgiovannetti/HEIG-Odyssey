# Politique de Protection des Branches & Checks Obligatoires (T-US19-04)

Ce document définit la configuration requise pour la protection des branches principales du dépôt **HEIG-Odyssey** sur GitHub.

---

## 🛡️ 1. Règles de protection pour la branche `main`

La branche `main` représente la version de production déployée automatiquement sur le serveur VPS.

### Paramètres de la règle (`Settings > Branches > Branch protection rules > main`) :
* **Require a pull request before merging :**
  * ✅ **Require approvals :** Minimum **1 revue obligatoire** par un pair.
  * ✅ **Dismiss stale pull request approvals when new commits are pushed :** Activé (invalide les approbations précédentes dès qu'un nouveau commit est poussé).
  * ✅ **Require review from Code Owners :** Activé si applicable.
* **Require status checks to pass before merging :**
  * ✅ **Require branches to be up to date before merging :** Activé.
  * **Status checks obligatoires (bloquants) :**
    * `Validate pull request source` (vérifie que la PR provient obligatoirement de `dev`).
    * `Quick CI` (`lint`, `typecheck`, `test:unit`, `build`).
    * `Integration CI (PostgreSQL & Redis)` (`test:combat`, `test:integration`).
    * `Full release validation` (`test:e2e`, `test:a11y`, validation des images Docker).
* **Require conversation resolution before merging :**
  * ✅ Activé (tous les commentaires de revue doivent être résolus).
* **Require signed commits :**
  * Recommandé.
* **Require linear history :**
  * ✅ Activé.
* **Do not allow bypassing the above settings :**
  * ✅ Activé (s'applique également aux administrateurs).
* **Allow force pushes :** ❌ Désactivé.
* **Allow deletions :** ❌ Désactivé.

---

## 🌿 2. Règles de protection pour la branche `dev`

La branche `dev` intègre les développements terminés des différentes fonctionnalités (`feature/*`, `fix/*`).

### Paramètres de la règle (`dev`) :
* **Require a pull request before merging :**
  * ✅ **Require approvals :** Au moins **1 approbation** de revue.
* **Require status checks to pass before merging :**
  * ✅ `Validate pull request source` (vérifie que la PR provient d'une branche `feature/*` ou `fix/*`).
  * ✅ `Quick CI` (`lint`, `typecheck`, `test:unit`, `build`).
  * ✅ `Integration CI (PostgreSQL & Redis)`.
* **Allow force pushes :** ❌ Désactivé.
* **Allow deletions :** ❌ Désactivé.

---

## ⚙️ 3. Matrice des Contrôles CI GitHub Actions

| Job CI | Trigger | Rôle & Commandes | Statut Bloquant |
|---|---|---|:---:|
| **`pull-request-policy`** | PR (`dev`, `main`) | Valide l'origine autorisée (`dev` vers `main`, `feature/*` vers `dev`). | **Oui** |
| **`quick-checks`** | Push & PR | Exécute `lint`, `typecheck`, `test:unit`, et `npm run build`. | **Oui** |
| **`integration-checks`** | Push `dev` & PR | Démarre PostgreSQL + Redis, applique les migrations Prisma et joue `test:combat` + `test:integration`. | **Oui** |
| **`release-validation`** | PR vers `main` | Lance Playwright (`test:e2e`), `test:a11y` (axe-core) et valide les images Docker de production. | **Oui** |
| **`package` & `deploy`** | Push sur `main` | Construit les images SHA, les pousse sur GHCR et exécute le déploiement sécurisé avec smoke test et rollback automatique. | **Oui** |

# HEIG Odyssey - Instructions de contribution

## 1. Objet et principes

Ce guide explique comment proposer une amélioration, préparer une modification et la faire intégrer dans HEIG Odyssey. Il s'adresse aux membres du projet comme aux personnes externes disposant d'un accès au dépôt.

Il décrit le workflow observé dans les configurations lues le 3 septembre 2026, sur la base du commit `d8230c5`. La règle centrale est de travailler sur une branche dédiée, puis de soumettre une Pull Request relue et vérifiée. Une contribution ne donne pas directement accès à la production.

Avant de commencer, consultez la [présentation du problème et de la solution](01-probleme-et-solution.md), puis suivez le [guide de lancement local](02-lancement-local.md).

## 2. Proposer un sujet avant de modifier le code

Consultez les issues et Pull Requests existantes afin d'éviter de traiter le même sujet en parallèle. Pour une anomalie, décrivez le comportement attendu, le résultat observé, les étapes de reproduction et l'environnement concerné. Ajoutez une capture ou un extrait de journal uniquement s'il ne contient aucune donnée sensible.

Pour une amélioration, expliquez le besoin utilisateur, le périmètre proposé et les critères permettant de considérer le travail comme terminé. Faites valider les changements qui affectent les règles de jeu, la direction artistique, la base de données, l'architecture ou le déploiement avant de les développer.

Séparez les sujets indépendants. Une correction d'affichage ne doit pas être accompagnée d'une migration majeure de dépendances ou d'une refonte générale non convenue. Les améliorations futures doivent être discutées dans leur propre tâche.

## 3. Comprendre les branches

`main` représente la version destinée à la production. `dev` rassemble les contributions validées avant une livraison. Les branches de travail utilisent le préfixe `feature/` pour une fonctionnalité ou `fix/` pour une correction.

Le workflow contrôle explicitement les noms : une Pull Request vers `dev` doit provenir d'une branche `feature/*` ou `fix/*`. Une Pull Request vers `main` doit provenir de `dev`. Pour une tâche documentaire, utilisez également un préfixe accepté, par exemple `feature/update-project-documentation`, plutôt qu'une branche `docs/*` que ce contrôle refuserait.

Le dépôt documente une revue humaine avec au moins une approbation et des contrôles réussis. Les protections réellement activées et la méthode de fusion autorisée doivent être vérifiées par les mainteneurs dans GitHub. Ne contournez pas ces règles par un push direct, un force push ou une désactivation des contrôles.

## 4. Contribuer avec un accès en écriture au dépôt

Avant de changer de branche, vérifiez que votre travail en cours est enregistré. Depuis un dépôt propre :

```bash
git switch dev
git pull --ff-only origin dev
git switch -c feature/nom-de-la-contribution
```

Choisissez un nom court, descriptif et sans espace. Si une branche distante a déjà été créée pour la tâche, utilisez-la au lieu de créer une branche concurrente :

```bash
git fetch origin
git switch --track origin/feature/nom-de-la-contribution
```

Cette dernière commande concerne une branche qui n'existe pas encore localement. Si elle existe déjà, utilisez simplement `git switch feature/nom-de-la-contribution`.

## 5. Contribuer depuis l'extérieur avec un fork

Si vous n'avez pas de droit d'écriture, créez un fork dans GitHub lorsque les paramètres du dépôt l'autorisent. Pour un dépôt non accessible ou dont le fork est désactivé, contactez d'abord les mainteneurs afin de convenir d'un mode de contribution autorisé.

Dans les commandes suivantes, remplacez `VOTRE_COMPTE` par le compte qui possède votre fork :

```bash
git clone https://github.com/VOTRE_COMPTE/HEIG-Odyssey.git
cd HEIG-Odyssey
git remote add upstream https://github.com/ismaelgiovannetti/HEIG-Odyssey.git
git fetch upstream
git switch -c feature/nom-de-la-contribution upstream/dev
```

`origin` désigne alors votre fork et `upstream` le dépôt du projet. Vous publiez la branche sur votre fork :

```bash
git push -u origin feature/nom-de-la-contribution
```

Créez ensuite une Pull Request vers la branche `dev` du dépôt original, avec votre branche comme source. Le préfixe `feature/` ou `fix/` reste obligatoire même pour un fork.

Un premier contributeur externe peut avoir besoin d'une autorisation d'exécution des Actions par un mainteneur. Les permissions du jeton et l'accès aux secrets peuvent être plus restreints sur une Pull Request externe. Cela ne justifie pas de copier des secrets dans le fork ni d'affaiblir le workflow. Si un contrôle requiert une intervention, demandez aux mainteneurs de l'examiner dans le cadre des permissions prévues. Les jobs de déploiement ne s'exécutent pas sur votre Pull Request.

## 6. Se repérer dans le code

Les pages et routes API se trouvent dans `src/app`. Les interfaces sont regroupées par domaine dans `src/components`. Les services métier, contrats, accès aux données et utilitaires partagés appartiennent à `src/lib`. Le consommateur d'événements de quêtes se trouve dans `src/worker`.

Les contrats destinés au navigateur doivent rester indépendants de Prisma, Redis et du système de fichiers. Les services utilisant ces ressources sont réservés au serveur. N'importez pas un module serveur dans un composant client ; partagez un contrat ou un type approprié.

Le schéma et les migrations sont dans `prisma`. Les données éditoriales du jeu sont versionnées dans `content`, tandis que les définitions de quêtes sont centralisées dans `src/lib/quests/definitions.ts`. La collection d'un joueur et sa progression sont des données de base, pas des modifications à apporter aux JSON du dépôt.

Le site de présentation statique est dans `landing-page`. Il possède son propre contexte Docker. Pour les ressources visuelles communes, `public` est la source canonique et les copies de présentation doivent rester synchronisées.

## 7. Règles de réalisation

### 7.1. Code, interfaces et commentaires

Respectez TypeScript strict, les conventions des modules voisins et les outils de lint et de formatage. Privilégiez des fonctions et composants dont la responsabilité reste lisible. Réutilisez les contrats et les utilitaires partagés au lieu de recopier des règles métier ou des traductions.

Les contrôles du navigateur ne remplacent pas les validations serveur. L'identité du joueur provient de la session authentifiée ; un client ne doit pas décider de ses récompenses, de ses droits d'accès ou de l'appartenance d'une créature.

Les nouveaux messages d'interface et la documentation destinée à l'équipe sont rédigés en français. Les noms techniques peuvent suivre les conventions anglaises existantes. Les commentaires doivent expliquer une décision, une contrainte ou un comportement non évident, plutôt que paraphraser le code.

Pour une modification d'interface, préservez la cohérence avec les pages existantes, les tailles d'écran prises en charge, la navigation clavier, le focus et la réduction des animations. Un test axe-core réussi ne dispense pas d'une vérification manuelle du parcours modifié.

### 7.2. Données, migrations et ressources

Lorsqu'une modification nécessite un changement de schéma, créez une migration sur une base de développement, relisez le SQL et versionnez-le avec le schéma. Ne réécrivez pas une migration déjà appliquée et ne proposez pas de réinitialiser la base de production. Signalez toute incompatibilité avec la version précédente dans la Pull Request.

Pour du contenu éditorial, conservez des identifiants stables et vérifiez les références croisées : espèces, dresseurs, étapes, prérequis et ressources locales. Le chargeur de contenu contrôle notamment que les espèces restent disponibles dans les bannières actives. Ne remplacez pas ces données par une génération implicite provenant d'un script non documenté.

Après la modification d'une ressource partagée avec la présentation :

```bash
npm run landing:assets:sync
npm run landing:assets:check
```

Incluez les copies effectivement mises à jour dans votre contribution. N'ajoutez pas de fichiers temporaires, d'exports graphiques inutilisés ou de doublons sans usage identifié.

### 7.3. Dépendances et sécurité

Une modification de dépendance doit être intentionnelle et inclure `package-lock.json`. Utilisez `npm ci` pour reproduire l'installation. Ne modifiez pas manuellement le fichier de verrouillage et ne lancez pas de correction forcée des dépendances pour faire disparaître un avertissement sans analyser les changements incompatibles.

Ne versionnez jamais de clé API, mot de passe réel, clé SSH privée, `.env`, sauvegarde de base ou donnée de joueur. Ne placez pas de secret dans une variable `NEXT_PUBLIC_*`, qui est destinée au navigateur.

Pour une suspicion de fuite, ne publiez pas la valeur dans une issue : contactez les mainteneurs par un canal privé convenu. Retirer un secret d'un nouveau commit ne le supprime pas de l'historique ; sa révocation et la suite à donner doivent être coordonnées.

La configuration Gitleaks ne doit pas exclure un dossier de tests entier pour éviter un faux positif. Une éventuelle exception doit être justifiée et aussi étroite que possible.

Le dépôt ne comporte pas de fichier de licence générale à la date de référence. Discutez avec les mainteneurs des autorisations nécessaires pour une réutilisation ou l'ajout de ressources tierces, notamment graphiques et sonores. N'attribuez pas arbitrairement une licence à des contenus que vous ne possédez pas.

## 8. Valider avant le commit

Suivez la séquence de [validation locale](02-lancement-local.md#10-lancer-les-contrôles-locaux-avant-une-contribution). Les tests unitaires vont dans `test/unit`, ceux du moteur dans `test/combat`, les scénarios avec de vrais services dans `test/integration`, et les parcours navigateur dans `test/e2e`.

Pour une correction, ajoutez si possible un test qui échoue avant le correctif et réussit après. Réutilisez les fixtures de `test/helpers`, isolez les données temporaires et nettoyez uniquement les données créées pour le test. Ne réduisez pas un contrôle de couverture, de sécurité ou de performance pour obtenir artificiellement une CI verte.

Le contrôle de couverture impose actuellement un minimum de 50 % pour les lignes, instructions, branches et fonctions du périmètre configuré. Les parcours navigateur utilisent Chromium ; les groupes d'accessibilité et de remplacement mobile ne représentent pas des navigateurs supplémentaires.

Les documents historiques, certains contenus canoniques et les trois grosses feuilles de style de campagne, équipe et gacha font l'objet d'exclusions de formatage existantes. Une contribution sans rapport avec ces fichiers ne doit pas déclencher leur reformatage massif.

Les rapports générés, dont `results.sarif`, `coverage`, `playwright-report` et `test-results`, ne font pas partie des sources à committer.

## 9. Préparer le commit et la Pull Request

Examinez votre état local, puis préparez uniquement les fichiers de la contribution. Si `git add -A` est utilisé, vérifiez attentivement le diff indexé :

```bash
git status
git add -A
git diff --cached --check
git diff --cached
```

Avec Gitleaks installé, vérifiez aussi les modifications indexées, sans créer de commit :

```bash
gitleaks git --pre-commit --staged --redact
```

Créez un commit dont le message décrit le changement, par exemple en anglais :

```bash
git commit -m "fix: describe the corrected behavior"
git push -u origin feature/nom-de-la-contribution
```

Adaptez le nom de branche au préfixe réellement choisi. La description de Pull Request doit indiquer le besoin ou l'issue concernée, le périmètre, les changements visibles, les commandes de validation réellement exécutées, les résultats et les limites restantes. Précisez les migrations, nouvelles variables, conséquences de déploiement et mises à jour documentaires lorsqu'elles existent.

Pour une interface, ajoutez si utile des captures permettant de comparer le résultat. Évitez les données de comptes réels et les informations sensibles dans ces captures.

## 10. Intégrer les retours et synchroniser la branche

Si `dev` a évolué, intégrez ses changements sur votre branche de travail après avoir enregistré votre travail local :

```bash
git fetch origin
git switch feature/nom-de-la-contribution
git merge origin/dev
```

Dans un fork, remplacez les deux références au dépôt original par `git fetch upstream` et `git merge upstream/dev`. Résolvez les conflits en conservant les changements fonctionnels attendus, puis relancez les tests concernés. Ne choisissez pas systématiquement un côté du conflit sans comprendre la différence.

Répondez aux retours de revue et poussez les corrections sur la même branche. Un nouveau commit peut exiger une nouvelle approbation selon les protections activées. La fusion est effectuée par une personne autorisée lorsque les discussions sont résolues et les contrôles requis sont réussis.

Le passage ultérieur de `dev` à `main` relève de la livraison décrite dans le [guide CI/CD](03-deploiement-ci-cd.md). Un contributeur externe n'a pas besoin des clés du VPS ni des secrets de production pour proposer du code.

## 11. Vérification finale d'une contribution

Avant de demander la fusion, assurez-vous que le périmètre est convenu, que la modification est compréhensible, que les tests et la documentation correspondent au comportement réalisé, et qu'aucun secret ou artefact n'est inclus. Signalez explicitement ce qui n'a pas été testé au lieu de l'annoncer comme validé.

Les contrôles locaux limitent les allers-retours, mais la CI reste nécessaire pour vérifier un environnement vierge, les services de tests, les images et les permissions disponibles sur GitHub.

## 12. Références du dépôt

- [README général](../../README.md) et [organisation du code](../ARCHITECTURE.md).
- [Scripts npm](../../package.json) et [scripts de maintenance](../../scripts/README.md).
- [Workflow effectif](../../.github/workflows/ci-cd.yml) et [politique de protection documentée](../../.github/BRANCH_PROTECTION.md).
- [Guide des ressources de présentation](../../landing-page/README.md).
- [Configuration de couverture](../../vitest.config.ts), [Playwright](../../playwright.config.ts) et [Gitleaks](../../.gitleaks.toml).

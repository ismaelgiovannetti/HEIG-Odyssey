# HEIG Odyssey - Proto-personas

## Objectif du document

Ces proto-personas représentent les principaux profils envisagés pour HEIG Odyssey. Ils reposent sur les hypothèses de l'équipe et non sur des entretiens utilisateurs. Ils servent à rattacher chaque user story à un public identifiable et devront être confrontés à des tests utilisateurs dès qu'une première version jouable sera disponible.

Kim Possible est le proto-persona principal : le jeu doit lui permettre de découvrir progressivement la tactique sans perdre le plaisir de l'aventure. Son Goku et Katniss Everdeen représentent deux profils joueurs secondaires. Patrick Jane est un acteur technique interne, utile pour exprimer les besoins de maintenance et de livraison, mais il n'est pas un utilisateur final du jeu.

## Proto-persona principal - Kim Possible, joueuse débutante

- **Âge :** 19 ans
- **Profil :** étudiante, joue occasionnellement à des jeux d'aventure et connaît peu les règles tactiques de Pokémon.
- **Contexte :** Kim Possible est attirée par l'univers, la collection et la progression, mais les notions de types, de changements de créature et de composition d'équipe lui paraissent complexes. Elle joue principalement sur un ordinateur portable et utilise parfois uniquement le clavier.
- **Besoins :**
  - comprendre rapidement comment commencer ;
  - recevoir une première créature sans devoir maîtriser le gacha ;
  - savoir quels modes sont disponibles et quoi faire ensuite ;
  - découvrir progressivement la tactique dans une campagne accessible ;
  - conserver sa progression entre deux sessions.
- **Attentes :**
  - onboarding court et compréhensible ;
  - interface claire, utilisable au clavier et sur un écran de taille courante ;
  - messages d'erreur et d'état explicites ;
  - difficulté de campagne cohérente avec sa progression ;
  - aucune obligation de paiement réel.
- **Frustrations à éviter :** être bloquée avant son premier combat, perdre une récompense ou ne pas comprendre pourquoi une action est impossible.
- **Objectif principal :** vivre une aventure Pokémon et apprendre les bases tactiques sans devoir connaître au préalable les règles compétitives.

## Proto-persona secondaire - Son Goku, joueur tactique

- **Âge :** 23 ans
- **Profil :** étudiant et joueur régulier de Pokémon Showdown, apprécie la composition d'équipe et l'optimisation.
- **Contexte :** Son Goku maîtrise déjà les interactions de types et attend des combats capables de sanctionner les mauvais choix. Il souhaite toutefois retrouver une progression et une identité d'adversaire absentes d'un simulateur compétitif pur.
- **Besoins :**
  - disposer de règles Gen 4 cohérentes et prévisibles ;
  - préparer son équipe avant un combat ;
  - affronter plusieurs comportements d'IA ;
  - tester une équipe sans être limité par son niveau actuel ;
  - comprendre l'effet de la difficulté sur les décisions adverses et les récompenses.
- **Attentes :**
  - combats simples avec attaque et changement de créature ;
  - entraînement adapté au niveau moyen de son équipe ;
  - IA facile aléatoire, IA normale heuristique et IA difficile plus anticipative ;
  - adversaires de campagne configurés avec une difficulté fixe ;
  - résolution serveur empêchant les actions illégales.
- **Frustrations à éviter :** IA artificiellement avantagée par des niveaux excessifs, règles mélangées entre générations ou temps d'attente trop long pour l'IA difficile.
- **Objectif principal :** améliorer et tester ses décisions tactiques dans une progression solo structurée.

## Proto-persona secondaire - Katniss Everdeen, collectionneuse régulière

- **Âge :** 21 ans
- **Profil :** joueuse régulière qui apprécie la collection, les objectifs courts et la progression visible.
- **Contexte :** Katniss Everdeen revient plusieurs fois par semaine pour faire progresser ses créatures, terminer des quêtes et obtenir de nouveaux membres d'équipe. Elle veut pouvoir avancer sans achat réel et sans perdre ses gains.
- **Besoins :**
  - voir l'expérience, la monnaie et les déblocages obtenus ;
  - accomplir des objectifs quotidiens et hebdomadaires ;
  - utiliser la monnaie gagnée pour recruter de nouvelles créatures ;
  - comparer les portails et leurs probabilités ;
  - organiser facilement sa collection et son équipe active.
- **Attentes :**
  - gacha exclusivement fondé sur la monnaie virtuelle ;
  - probabilités configurées et comportement cohérent ;
  - quêtes communes à tous les joueurs, mais progression individuelle ;
  - récompenses attribuées une seule fois ;
  - sauvegarde fiable après chaque action importante.
- **Frustrations à éviter :** monnaie retirée sans résultat, récompense dupliquée ou perdue, progression de quête incohérente et mécanisme pay-to-win.
- **Objectif principal :** développer sa collection et son équipe grâce à des sessions régulières et équitables.

## Acteur technique interne - Patrick Jane, développeur et intégrateur de contenu

- **Âge :** 24 ans
- **Profil :** membre de l'équipe qui développe, teste, configure et déploie HEIG Odyssey.
- **Contexte :** Patrick Jane doit ajouter du contenu de campagne, faire évoluer le modèle de données et livrer rapidement le prototype avec trois autres personnes. Il intervient sur un dépôt partagé et doit pouvoir reproduire localement les problèmes observés sur le VPS.
- **Besoins :**
  - lancer l'application et ses dépendances avec une procédure courte ;
  - ajouter un dresseur, un Boss ou un portail sans modifier le moteur de combat ;
  - détecter automatiquement une configuration invalide ;
  - disposer de migrations, de tests et de logs exploitables ;
  - déployer et restaurer une version identifiable.
- **Attentes :**
  - TypeScript strict et contrats de données clairs ;
  - PostgreSQL comme source de vérité ;
  - Redis utilisé uniquement pour les besoins temporaires ou événementiels ;
  - sprites importés et disponibles localement ;
  - environnement Docker Compose reproductible ;
  - pipeline GitHub Actions bloquant une promotion invalide ;
  - image Docker versionnée par le SHA Git et rollback testable.
- **Frustrations à éviter :** dépendance runtime à PokéAPI, secrets présents dans le dépôt, migrations incompatibles ou comportement différent entre les postes et le VPS.
- **Objectif principal :** faire évoluer et livrer le MVP de manière fiable sans créer une architecture disproportionnée.

## Synthèse des besoins

| Profil | Rôle | Valeur recherchée | Fonctions principalement concernées |
|---|---|---|---|
| Kim Possible | Proto-persona principal | Découverte et aventure accessible | Compte, onboarding, accueil, campagne et accessibilité. |
| Son Goku | Proto-persona secondaire | Profondeur tactique et entraînement | Équipe, combat Gen 4, IA et entraînement adaptatif. |
| Katniss Everdeen | Proto-persona secondaire | Collection et progression régulière | Récompenses, gacha, quêtes et sauvegarde. |
| Patrick Jane | Acteur technique interne | Maintenabilité et livraison fiable | Configurations, sprites, PostgreSQL, Redis, tests et CI/CD. |

## Règle d'utilisation

Une user story joueur doit être rattachée à au moins un proto-persona. Les stories techniques peuvent être rattachées à Patrick Jane lorsqu'elles satisfont directement une exigence non fonctionnelle ou permettent de livrer une story joueur. Les hypothèses de ces profils seront révisées si les tests utilisateurs révèlent des besoins différents.
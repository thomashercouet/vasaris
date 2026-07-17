# VASARIS — Prototype web jetable — Design

**Date :** 2026-07-17
**Statut :** validé en brainstorming
**Sous-projet :** 1 sur N (prototype de gameplay). L'éditeur, le générateur, la campagne, les défis quotidiens et la version Godot sont des sous-projets ultérieurs, hors périmètre ici.

## Objectif

Valider le game feel de VASARIS (puzzle d'échange de disques, cf. Game Design Brief v1.0) avec un prototype web jetable, avant la réécriture propre dans Godot 4. Le prototype doit répondre à trois questions :

1. La mécanique « toucher une frontière pour échanger » est-elle agréable à la souris **et** au doigt ?
2. La règle « trou = mur » produit-elle des puzzles intéressants (l'ordre de résolution compte) sans être frustrante ?
3. Le rythme d'animation 100–200 ms donne-t-il la sensation « élégante et silencieuse » visée ?

## Livrable

Un unique fichier `vasaris.html`, autonome (HTML + CSS + JS vanilla, rendu Canvas), sans build ni dépendance. S'ouvre par double-clic dans un navigateur desktop ou mobile.

## Règles du jeu

- Le plateau est une grille fixe de cellules `{ caseColor, discColor, active }`.
- Une cellule **active** a une couleur de fond (case) et un disque coloré. Le disque n'est pas forcément de la couleur de sa case.
- Une cellule **inactive** est un **trou noir** : ni case ni disque, et c'est un **mur** — aucune frontière adjacente à un trou n'est sélectionnable. Un niveau peut contenir des trous dès le départ (obstacles de construction).
- **Action unique** : le joueur sélectionne la frontière entre deux cellules actives orthogonalement adjacentes ; les deux disques permutent. Aucun autre déplacement n'existe.
- **Validation** : après chaque échange, seules les deux cellules concernées sont vérifiées. Si `discColor === caseColor`, la cellule se résout : animation courte, puis `active = false`, définitivement. Les deux cellules peuvent se résoudre sur le même échange.
- Le plateau ne bouge jamais : rien ne tombe, rien ne glisse, les trous restent visibles.
- **Victoire** : plus aucune cellule active. Passage au niveau suivant.
- **Pas de condition d'échec** : pas de timer, pas de score, pas de vie. Un niveau peut devenir insoluble (trous-murs) ; le restart instantané est la réponse, sans détection automatique de blocage.
- Contrainte de design des niveaux (pas une règle moteur) : aucun disque n'est déjà sur sa bonne couleur au départ.

## Architecture

Trois blocs strictement séparés dans le fichier :

### 1. Logique de jeu (pure)

Objet `Game` sans aucune référence au DOM/Canvas — transposable tel quel en GDScript ensuite.

- État : tableau 2D de cellules + numéro de niveau.
- API : `load(levelDef)`, `swap(border)`, résolution retournant les cellules disparues, `isWon()`, `reset()`, `validBorders()`.
- Une frontière est identifiée par `{ x, y, dir }` (dir = `H` ou `V`, la frontière entre (x,y) et sa voisine droite/basse).

### 2. Rendu Canvas

- Fond noir. Cases = carrés colorés, disques = cercles avec liseré sombre (contraste garanti même si disque et case ont des couleurs proches), trous = noir.
- Boucle `requestAnimationFrame` ; le rendu dérive entièrement de l'état + des animations en cours.
- Animations : échange = glissement croisé des deux disques, 120 ms avec easing ; résolution = flash blanc léger + fondu vers noir, 150 ms. Aucun autre effet.
- Grille centrée, taille de case calculée depuis le viewport (responsive, portrait et paysage).

### 3. Entrées

- Pointer Events (souris + tactile unifiés).
- **Assistance de sélection** : au pointeur, on calcule la frontière valide la plus proche ; retenue si distance < ~40 % de la taille d'une case. Au survol (souris), la frontière candidate est surlignée d'un trait blanc fin.
- Un clic/tap déclenche l'échange immédiatement (pas de sélection en deux temps).
- Pendant une animation, les entrées sont ignorées (pas de file d'attente).
- Clavier : `R` = restart. Pas de manette dans ce prototype (viendra avec Godot).

## Niveaux

10 niveaux faits main, en dur dans le fichier, en notation compacte : une chaîne par ligne, deux caractères par cellule (couleur de case puis couleur de disque, ex. `BR` = case bleue, disque rouge ; `..` = trou initial).

- **1–3** : 2×2 et 2×3, 2–3 couleurs — apprentissage de la mécanique.
- **4–7** : 3×3 et 4×3, 3 couleurs — l'ordre de résolution commence à compter.
- **8–10** : 4×4 et 5×4, 3–4 couleurs, avec des trous initiaux.

Chaque niveau est vérifié résolvable à la main avant inclusion (pas de solveur dans ce périmètre).

**Palette** (sur fond noir) : Bleu `#3B6FF2`, Vert `#2ECC40`, Rose `#F26FD8`, Rouge `#E33333`, réserve : Jaune `#F2C230`, Cyan `#2EC4CC`. Lettres de notation : `B`, `G`, `P`, `R`, `Y`, `C`.

## HUD

- Numéro de niveau en haut.
- Bouton ⟲ restart toujours visible (+ touche `R`).
- Flèches ←/→ (boutons et clavier) pour naviguer librement entre les niveaux déjà atteints.
- Victoire du niveau 10 : écran « fin du prototype ».
- Pas de sauvegarde, pas de son.

## Tests

La logique étant pure, un harnais de tests minimal vit en bas du fichier et s'exécute quand l'URL contient `?test` (résultats en console + bandeau) :

- échange de deux disques ;
- résolution simple (une cellule) et double (les deux cellules du même échange) ;
- frontière adjacente à un trou refusée ;
- détection de victoire ;
- reset restaurant l'état initial du niveau.

## Hors périmètre (sous-projets suivants)

Éditeur de niveaux, générateur avec garantie de solvabilité et mesure de difficulté, campagne complète, défis quotidiens, indices, audio, manette, sauvegarde, version Godot multi-plateforme.

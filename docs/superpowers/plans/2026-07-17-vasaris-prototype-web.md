# VASARIS Web Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un prototype web jetable de VASARIS dans un unique fichier `vasaris.html` : 10 niveaux, échange de disques par sélection de frontière, trous-murs, animations 120/150 ms.

**Architecture:** Trois blocs `<script>` dans un seul fichier HTML : `game-core` (logique pure, sans DOM), `game-tests` (tests de la logique pure), `main` (rendu Canvas + entrées + HUD). Un runner Node dev-only (`run-tests.mjs`) extrait les deux premiers blocs et exécute les tests en CLI ; les mêmes tests tournent dans le navigateur via `?test`.

**Tech Stack:** HTML + CSS + JavaScript vanilla (aucune dépendance), Canvas 2D, Pointer Events. Node.js uniquement pour lancer les tests en CLI.

**Spec:** `docs/superpowers/specs/2026-07-17-vasaris-prototype-web-design.md`

## Global Constraints

- Livrable = un seul fichier `vasaris.html`, ouvrable par double-clic (`file://`), zéro dépendance, zéro build.
- `run-tests.mjs` est un outil de dev, pas une dépendance du livrable.
- Fond noir `#000`. Palette exacte : B=`#3B6FF2`, G=`#2ECC40`, P=`#F26FD8`, R=`#E33333`, Y=`#F2C230`, C=`#2EC4CC`.
- Animation d'échange : 120 ms. Animation de résolution : 150 ms. Aucun autre effet.
- Entrées ignorées pendant une animation (pas de file d'attente).
- Trou = mur : aucune frontière adjacente à une cellule inactive n'est sélectionnable.
- Tolérance de sélection d'une frontière : distance ≤ 0.4 × taille de case.
- Pas de son, pas de sauvegarde, pas de manette, pas de solveur.
- Textes UI en français, majuscules (`NIVEAU 3/10`, `FIN DU PROTOTYPE`, `REJOUER`).
- Une frontière est identifiée par `{x, y, dir}` : `dir:'H'` = frontière entre (x,y) et (x+1,y) ; `dir:'V'` = entre (x,y) et (x,y+1).

## File Structure

- `vasaris.html` — le jeu entier :
  - `<script id="game-core">` : `COLORS`, `parseLevel`, `createGame`, `boardGeometry`, `borderMidpoint`, `nearestBorder`, `LEVELS`. Aucune référence au DOM. C'est le bloc qui sera transposé en GDScript.
  - `<script id="game-tests">` : `runTests(log)` retournant le nombre d'échecs.
  - `<script id="main">` : canvas, rendu, animations, entrées, HUD. Navigateur uniquement.
- `run-tests.mjs` — runner Node : extrait `game-core` + `game-tests` du HTML, exécute `runTests`, code de sortie ≠ 0 si échec.
- `docs/` — spec et ce plan (déjà commités).

---

### Task 1: Squelette du fichier, runner Node, parseLevel

**Files:**
- Create: `vasaris.html`
- Create: `run-tests.mjs`

**Interfaces:**
- Produces: `COLORS` (objet `{B,G,P,R,Y,C}` → hex), `parseLevel(rows: string[]) -> Cell[][]` où `Cell = {caseColor: string|null, discColor: string|null, active: boolean}`. Deux caractères par cellule (`"BG"` = case B, disque G ; `".."` = trou initial, `{caseColor:null, discColor:null, active:false}`).
- Produces: convention des blocs `<script id="game-core">` et `<script id="game-tests">` que `run-tests.mjs` extrait par regex.

- [ ] **Step 1: Vérifier que Node est disponible**

Run: `node --version`
Expected: une version (v18+). Si Node est absent, s'arrêter et le signaler (les tests navigateur `?test` restent possibles mais le plan suppose Node).

- [ ] **Step 2: Créer le squelette `vasaris.html` avec un test qui échoue**

Créer `vasaris.html` :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<title>VASARIS — prototype</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden;
    font-family: "Consolas", "Courier New", monospace; color: #ccc;
    -webkit-user-select: none; user-select: none; touch-action: manipulation; }
</style>
</head>
<body>
<script id="game-core">
'use strict';
const COLORS = { B: '#3B6FF2', G: '#2ECC40', P: '#F26FD8', R: '#E33333', Y: '#F2C230', C: '#2EC4CC' };
</script>
<script id="game-tests">
'use strict';
function runTests(log) {
  let failures = 0;
  const T = (name, fn) => {
    try { fn(); log('PASS  ' + name); }
    catch (e) { failures++; log('FAIL  ' + name + ' — ' + e.message); }
  };
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

  T('parseLevel : dimensions, couleurs, trous', () => {
    const grid = parseLevel(['BG..', 'PRGB']);
    assert(grid.length === 2 && grid[0].length === 2, 'grille 2x2');
    assert(grid[0][0].caseColor === 'B' && grid[0][0].discColor === 'G' && grid[0][0].active === true, 'cellule (0,0)');
    assert(grid[0][1].active === false && grid[0][1].caseColor === null && grid[0][1].discColor === null, 'trou en (1,0)');
    assert(grid[1][0].caseColor === 'P' && grid[1][0].discColor === 'R', 'cellule (0,1)');
    assert(grid[1][1].caseColor === 'G' && grid[1][1].discColor === 'B', 'cellule (1,1)');
  });

  return failures;
}
</script>
<script id="main">
'use strict';
// Rendu, entrées et HUD : tâches 5 à 8.
</script>
</body>
</html>
```

- [ ] **Step 3: Créer `run-tests.mjs`**

```js
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('./vasaris.html', import.meta.url), 'utf8');

function extract(id) {
  const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`));
  if (!m) throw new Error(`bloc <script id="${id}"> introuvable`);
  return m[1];
}

const ctx = vm.createContext({ console });
vm.runInContext(extract('game-core'), ctx, { filename: 'game-core.js' });
vm.runInContext(extract('game-tests'), ctx, { filename: 'game-tests.js' });
const failures = vm.runInContext('runTests(msg => console.log(msg))', ctx);
console.log(failures ? `${failures} ÉCHEC(S)` : 'TOUS LES TESTS PASSENT');
process.exit(failures ? 1 : 0);
```

- [ ] **Step 4: Lancer les tests, vérifier l'échec**

Run: `node run-tests.mjs`
Expected: `FAIL  parseLevel : ...` avec `parseLevel is not defined`, exit code 1.

- [ ] **Step 5: Implémenter `parseLevel`**

Ajouter dans `game-core`, après `COLORS` :

```js
function parseLevel(rows) {
  return rows.map(row => {
    const cells = [];
    for (let i = 0; i < row.length; i += 2) {
      const pair = row.slice(i, i + 2);
      if (pair === '..') cells.push({ caseColor: null, discColor: null, active: false });
      else cells.push({ caseColor: pair[0], discColor: pair[1], active: true });
    }
    return cells;
  });
}
```

- [ ] **Step 6: Lancer les tests, vérifier le succès**

Run: `node run-tests.mjs`
Expected: `PASS  parseLevel : dimensions, couleurs, trous`, `TOUS LES TESTS PASSENT`, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add vasaris.html run-tests.mjs
git commit -m "feat: squelette vasaris.html, runner de tests Node, parseLevel"
```

---

### Task 2: Logique de jeu — createGame, swap, résolution, victoire, reset

**Files:**
- Modify: `vasaris.html` (blocs `game-core` et `game-tests`)

**Interfaces:**
- Consumes: `parseLevel` (Task 1).
- Produces: `createGame(rows: string[]) -> Game` avec :
  - `game.grid: Cell[][]`, `game.width: number`, `game.height: number`
  - `game.cell(x, y) -> Cell | undefined`
  - `game.neighbor(border) -> {x, y}` (la cellule de l'autre côté de la frontière)
  - `game.isValidBorder(border) -> boolean` (les deux cellules existent et sont actives)
  - `game.validBorders() -> border[]`
  - `game.swap(border) -> {resolved: {x,y}[]} | null` (null si frontière invalide ; les cellules résolues passent `active=false` mais **conservent** `caseColor`/`discColor` pour l'animation)
  - `game.isWon() -> boolean`
  - `game.reset() -> void`

- [ ] **Step 1: Écrire les tests de la logique (qui échouent)**

Ajouter dans `runTests`, avant `return failures;` :

```js
  T('swap : échange sans résolution', () => {
    const g = createGame(['BPGR']);
    const res = g.swap({ x: 0, y: 0, dir: 'H' });
    assert(res !== null && res.resolved.length === 0, 'aucune résolution');
    assert(g.cell(0, 0).discColor === 'R' && g.cell(1, 0).discColor === 'P', 'disques échangés');
  });

  T('swap : résolution simple', () => {
    const g = createGame(['BPGB']);
    const res = g.swap({ x: 0, y: 0, dir: 'H' });
    assert(res.resolved.length === 1 && res.resolved[0].x === 0 && res.resolved[0].y === 0, '(0,0) résolue');
    assert(g.cell(0, 0).active === false && g.cell(1, 0).active === true, 'active mis à jour');
    assert(g.cell(0, 0).caseColor === 'B', 'les couleurs restent pour l\'animation');
    assert(g.isWon() === false, 'pas encore gagné');
  });

  T('swap : résolution double et victoire', () => {
    const g = createGame(['BGGB']);
    const res = g.swap({ x: 0, y: 0, dir: 'H' });
    assert(res.resolved.length === 2, 'deux cellules résolues');
    assert(g.isWon() === true, 'plateau vide');
  });

  T('swap : frontière verticale', () => {
    const g = createGame(['BG', 'GB']);
    const res = g.swap({ x: 0, y: 0, dir: 'V' });
    assert(res.resolved.length === 2, 'colonne résolue');
  });

  T('swap : frontière adjacente à un trou refusée', () => {
    const g = createGame(['BG..GB']);
    assert(g.swap({ x: 0, y: 0, dir: 'H' }) === null, 'frontière vers le trou refusée');
    assert(g.cell(0, 0).discColor === 'G', 'état inchangé');
  });

  T('swap : frontière hors limites refusée', () => {
    const g = createGame(['BGGB']);
    assert(g.swap({ x: 1, y: 0, dir: 'H' }) === null, 'pas de voisin à droite');
    assert(g.swap({ x: 0, y: 0, dir: 'V' }) === null, 'pas de voisin en bas');
  });

  T('swap : frontière vers une cellule déjà résolue refusée', () => {
    const g = createGame(['BPGBPG']);
    g.swap({ x: 0, y: 0, dir: 'H' }); // (0,0) reçoit B et se résout
    assert(g.swap({ x: 0, y: 0, dir: 'H' }) === null, '(0,0) est un trou maintenant');
  });

  T('validBorders : liste les frontières entre cellules actives', () => {
    const g = createGame(['BG..GB']);
    const list = g.validBorders();
    assert(list.length === 0, 'aucune frontière valide autour du trou central');
    const g2 = createGame(['BPGR', 'PBRG']);
    assert(g2.validBorders().length === 4, '2 H + 2 V sur une grille 2x2');
  });

  T('reset : restaure l\'état initial', () => {
    const g = createGame(['BGGB']);
    g.swap({ x: 0, y: 0, dir: 'H' });
    assert(g.isWon() === true, 'gagné avant reset');
    g.reset();
    assert(g.isWon() === false && g.cell(0, 0).discColor === 'G' && g.cell(0, 0).active === true, 'état initial restauré');
  });
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `node run-tests.mjs`
Expected: `FAIL` sur chaque nouveau test avec `createGame is not defined`, exit code 1.

- [ ] **Step 3: Implémenter `createGame`**

Ajouter dans `game-core`, après `parseLevel` :

```js
function createGame(rows) {
  return {
    rows,
    grid: parseLevel(rows),
    get width() { return this.grid[0].length; },
    get height() { return this.grid.length; },
    cell(x, y) { return (this.grid[y] || [])[x]; },
    neighbor(border) {
      return border.dir === 'H' ? { x: border.x + 1, y: border.y } : { x: border.x, y: border.y + 1 };
    },
    isValidBorder(border) {
      const a = this.cell(border.x, border.y);
      const n = this.neighbor(border);
      const b = this.cell(n.x, n.y);
      return !!(a && b && a.active && b.active);
    },
    validBorders() {
      const list = [];
      for (let y = 0; y < this.height; y++)
        for (let x = 0; x < this.width; x++)
          for (const dir of ['H', 'V']) {
            const b = { x, y, dir };
            if (this.isValidBorder(b)) list.push(b);
          }
      return list;
    },
    swap(border) {
      if (!this.isValidBorder(border)) return null;
      const n = this.neighbor(border);
      const a = this.cell(border.x, border.y);
      const b = this.cell(n.x, n.y);
      [a.discColor, b.discColor] = [b.discColor, a.discColor];
      const resolved = [];
      if (a.discColor === a.caseColor) { a.active = false; resolved.push({ x: border.x, y: border.y }); }
      if (b.discColor === b.caseColor) { b.active = false; resolved.push({ x: n.x, y: n.y }); }
      return { resolved };
    },
    isWon() { return this.grid.every(row => row.every(c => !c.active)); },
    reset() { this.grid = parseLevel(this.rows); },
  };
}
```

- [ ] **Step 4: Lancer les tests, vérifier le succès**

Run: `node run-tests.mjs`
Expected: tous PASS, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add vasaris.html
git commit -m "feat: logique de jeu pure (swap, résolution, victoire, reset)"
```

---

### Task 3: Géométrie du plateau et sélection de frontière

**Files:**
- Modify: `vasaris.html` (blocs `game-core` et `game-tests`)

**Interfaces:**
- Consumes: `createGame` (Task 2).
- Produces:
  - `boardGeometry(cols, rowCount, viewW, viewH) -> {size, ox, oy}` (taille de case en px et origine du plateau, centré, marge 6 % du petit côté)
  - `borderMidpoint(border, geo) -> {mx, my}` (milieu du segment de frontière en px)
  - `nearestBorder(px, py, game, geo) -> border | null` (frontière valide la plus proche si distance ≤ `0.4 * geo.size`, sinon null)

- [ ] **Step 1: Écrire les tests (qui échouent)**

Ajouter dans `runTests`, avant `return failures;` :

```js
  T('boardGeometry : plateau centré et contenu dans la vue', () => {
    const g = boardGeometry(4, 3, 800, 600);
    assert(g.size > 0, 'taille positive');
    assert(Math.abs(g.ox - (800 - g.size * 4) / 2) < 1e-6, 'centré en x');
    assert(Math.abs(g.oy - (600 - g.size * 3) / 2) < 1e-6, 'centré en y');
    assert(g.size * 4 <= 800 && g.size * 3 <= 600, 'contenu dans la vue');
  });

  T('borderMidpoint : milieux H et V', () => {
    const geo = { size: 100, ox: 0, oy: 0 };
    const h = borderMidpoint({ x: 0, y: 0, dir: 'H' }, geo);
    assert(h.mx === 100 && h.my === 50, 'frontière H entre (0,0) et (1,0)');
    const v = borderMidpoint({ x: 1, y: 0, dir: 'V' }, geo);
    assert(v.mx === 150 && v.my === 100, 'frontière V entre (1,0) et (1,1)');
  });

  T('nearestBorder : frontière la plus proche dans la tolérance', () => {
    const g = createGame(['BPGR', 'PBRG']);
    const geo = { size: 100, ox: 0, oy: 0 };
    const b = nearestBorder(98, 47, g, geo);
    assert(b !== null && b.x === 0 && b.y === 0 && b.dir === 'H', 'frontière H (0,0)');
  });

  T('nearestBorder : null au-delà de la tolérance', () => {
    const g = createGame(['BPGR', 'PBRG']);
    const geo = { size: 100, ox: 0, oy: 0 };
    assert(nearestBorder(500, 500, g, geo) === null, 'trop loin');
  });

  T('nearestBorder : les frontières vers un trou sont exclues', () => {
    const g = createGame(['BP..', 'PBRG']);
    const geo = { size: 100, ox: 0, oy: 0 };
    assert(nearestBorder(100, 50, g, geo) === null, 'la frontière vers le trou n\'existe pas');
  });
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `node run-tests.mjs`
Expected: `FAIL` avec `boardGeometry is not defined`, exit code 1.

- [ ] **Step 3: Implémenter les trois fonctions**

Ajouter dans `game-core`, après `createGame` :

```js
function boardGeometry(cols, rowCount, viewW, viewH) {
  const margin = Math.min(viewW, viewH) * 0.06;
  const size = Math.min((viewW - 2 * margin) / cols, (viewH - 2 * margin) / rowCount);
  return { size, ox: (viewW - size * cols) / 2, oy: (viewH - size * rowCount) / 2 };
}

function borderMidpoint(border, geo) {
  return border.dir === 'H'
    ? { mx: geo.ox + (border.x + 1) * geo.size, my: geo.oy + (border.y + 0.5) * geo.size }
    : { mx: geo.ox + (border.x + 0.5) * geo.size, my: geo.oy + (border.y + 1) * geo.size };
}

function nearestBorder(px, py, game, geo) {
  let best = null, bestD = Infinity;
  for (const b of game.validBorders()) {
    const { mx, my } = borderMidpoint(b, geo);
    const d = Math.hypot(px - mx, py - my);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best && bestD <= 0.4 * geo.size ? best : null;
}
```

- [ ] **Step 4: Lancer les tests, vérifier le succès**

Run: `node run-tests.mjs`
Expected: tous PASS, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add vasaris.html
git commit -m "feat: géométrie du plateau et sélection de frontière avec tolérance"
```

---

### Task 4: Les 10 niveaux et leurs solutions de référence

**Files:**
- Modify: `vasaris.html` (blocs `game-core` et `game-tests`)

**Interfaces:**
- Consumes: `createGame`, `parseLevel`, `COLORS`.
- Produces: `LEVELS: {rows: string[], solution: {x,y,dir}[]}[]` — 10 niveaux. La `solution` est une suite de coups vérifiée qui vide le plateau ; elle sert uniquement de test de résolvabilité (jamais montrée au joueur).

- [ ] **Step 1: Écrire les tests des niveaux (qui échouent)**

Ajouter dans `runTests`, avant `return failures;` :

```js
  T('niveaux : 10 niveaux, format valide, pas de disque pré-résolu', () => {
    assert(LEVELS.length === 10, '10 niveaux');
    const letters = Object.keys(COLORS);
    LEVELS.forEach((lvl, i) => {
      const w = lvl.rows[0].length;
      lvl.rows.forEach(r => assert(r.length === w && r.length % 2 === 0, `niveau ${i + 1} : lignes régulières`));
      parseLevel(lvl.rows).forEach(row => row.forEach(c => {
        if (!c.active) return;
        assert(letters.includes(c.caseColor) && letters.includes(c.discColor), `niveau ${i + 1} : couleurs connues`);
        assert(c.caseColor !== c.discColor, `niveau ${i + 1} : pas de disque pré-résolu`);
      }));
    });
  });

  T('niveaux : chaque solution de référence vide le plateau', () => {
    LEVELS.forEach((lvl, i) => {
      const g = createGame(lvl.rows);
      lvl.solution.forEach((b, j) =>
        assert(g.swap(b) !== null, `niveau ${i + 1} : coup ${j + 1} (${b.x},${b.y},${b.dir}) invalide`));
      assert(g.isWon(), `niveau ${i + 1} : plateau non vide après la solution`);
    });
  });
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `node run-tests.mjs`
Expected: `FAIL` avec `LEVELS is not defined`, exit code 1.

- [ ] **Step 3: Ajouter les niveaux**

Ajouter à la fin de `game-core` (données conçues et vérifiées à la main ; le test de replay les re-vérifie mécaniquement) :

```js
const LEVELS = [
  // 1 — 2x2, 2 couleurs : deux paires, apprendre l'échange.
  { rows: ['BGGB', 'GBBG'],
    solution: [{ x: 0, y: 0, dir: 'H' }, { x: 0, y: 1, dir: 'H' }] },
  // 2 — 3x2, 2 couleurs : échanges verticaux.
  { rows: ['BGGBBG', 'GBBGGB'],
    solution: [{ x: 0, y: 0, dir: 'V' }, { x: 1, y: 0, dir: 'V' }, { x: 2, y: 0, dir: 'V' }] },
  // 3 — 3x1, 3 couleurs : première chaîne, l'ordre compte (l'autre ordre bloque).
  { rows: ['BGGPPB'],
    solution: [{ x: 1, y: 0, dir: 'H' }, { x: 0, y: 0, dir: 'H' }] },
  // 4 — 3x3, 3 couleurs : chaîne en ligne 0 + paires verticales.
  { rows: ['BGGPPB', 'GPBGPB', 'PGGBBP'],
    solution: [{ x: 1, y: 0, dir: 'H' }, { x: 0, y: 0, dir: 'H' }, { x: 0, y: 1, dir: 'V' },
               { x: 1, y: 1, dir: 'V' }, { x: 2, y: 1, dir: 'V' }] },
  // 5 — 3x3, 3 couleurs : chaîne de 4 en L + chaîne verticale + paire.
  { rows: ['BGGBBG', 'GPBGGP', 'PBGBPG'],
    solution: [{ x: 1, y: 2, dir: 'H' }, { x: 2, y: 1, dir: 'V' }, { x: 2, y: 0, dir: 'V' },
               { x: 1, y: 0, dir: 'V' }, { x: 0, y: 1, dir: 'V' }, { x: 0, y: 0, dir: 'V' }] },
  // 6 — 4x3, 3 couleurs : paire, chaînes de 3, coins.
  { rows: ['BGGPPBBG', 'GPBGPBGB', 'PGGBBGGP'],
    solution: [{ x: 3, y: 0, dir: 'V' }, { x: 1, y: 0, dir: 'H' }, { x: 0, y: 0, dir: 'H' },
               { x: 0, y: 1, dir: 'V' }, { x: 1, y: 1, dir: 'V' }, { x: 2, y: 2, dir: 'H' },
               { x: 2, y: 1, dir: 'V' }] },
  // 7 — 4x3, 3 couleurs : chaînes cachées en serpentin.
  { rows: ['BGGPPBBG', 'GPBGBGGP', 'PBPBGPPB'],
    solution: [{ x: 1, y: 0, dir: 'H' }, { x: 0, y: 0, dir: 'H' }, { x: 1, y: 2, dir: 'H' },
               { x: 2, y: 1, dir: 'V' }, { x: 0, y: 1, dir: 'V' }, { x: 0, y: 1, dir: 'H' },
               { x: 3, y: 1, dir: 'V' }, { x: 3, y: 0, dir: 'V' }] },
  // 8 — 4x4, 4 couleurs, 2 trous initiaux : chaînes de 4 et 5 contournant les murs.
  { rows: ['BGGPPRRB', 'GR..PBBG', 'RBBP..GR', 'RGPRBPRB'],
    solution: [{ x: 2, y: 0, dir: 'H' }, { x: 1, y: 0, dir: 'H' }, { x: 0, y: 0, dir: 'H' },
               { x: 0, y: 3, dir: 'H' }, { x: 1, y: 2, dir: 'V' }, { x: 0, y: 2, dir: 'H' },
               { x: 0, y: 1, dir: 'V' }, { x: 2, y: 3, dir: 'H' }, { x: 3, y: 2, dir: 'V' },
               { x: 3, y: 1, dir: 'V' }, { x: 2, y: 1, dir: 'H' }] },
  // 9 — 5x4, 4 couleurs, 2 trous formant un mur central.
  { rows: ['BGGRRBBRRG', 'PGGP..GPGP', 'RBGB..PBPR', 'BRBPPGBGRB'],
    solution: [{ x: 1, y: 0, dir: 'H' }, { x: 0, y: 0, dir: 'H' }, { x: 0, y: 1, dir: 'H' },
               { x: 0, y: 2, dir: 'V' }, { x: 1, y: 3, dir: 'H' }, { x: 1, y: 2, dir: 'V' },
               { x: 4, y: 2, dir: 'V' }, { x: 4, y: 1, dir: 'V' }, { x: 4, y: 0, dir: 'V' },
               { x: 3, y: 0, dir: 'H' }, { x: 3, y: 2, dir: 'V' }, { x: 3, y: 1, dir: 'V' }] },
  // 10 — 5x4, 4 couleurs : chaîne de 7 + chaîne de 5 + paires, trous en quinconce.
  { rows: ['BGGPPRRBBG', 'GR..BPPBGP', 'RPGRRG..PB', 'PBBRRGPGGP'],
    solution: [{ x: 4, y: 1, dir: 'V' }, { x: 4, y: 0, dir: 'V' }, { x: 2, y: 0, dir: 'H' },
               { x: 1, y: 0, dir: 'H' }, { x: 0, y: 0, dir: 'H' }, { x: 1, y: 3, dir: 'H' },
               { x: 0, y: 3, dir: 'H' }, { x: 0, y: 2, dir: 'V' }, { x: 0, y: 1, dir: 'V' },
               { x: 2, y: 1, dir: 'H' }, { x: 1, y: 2, dir: 'H' }, { x: 3, y: 3, dir: 'H' }] },
];
```

- [ ] **Step 4: Lancer les tests, vérifier le succès**

Run: `node run-tests.mjs`
Expected: tous PASS (y compris le replay des 10 solutions), exit code 0.

- [ ] **Step 5: Commit**

```bash
git add vasaris.html
git commit -m "feat: 10 niveaux faits main avec solutions de référence testées"
```

---

### Task 5: Rendu Canvas statique et HUD

**Files:**
- Modify: `vasaris.html` (HTML/CSS + bloc `main`)

**Interfaces:**
- Consumes: `createGame`, `boardGeometry`, `borderMidpoint`, `COLORS`, `LEVELS`.
- Produces (dans `main`, utilisés par les tâches 6-7) : variables `game`, `current`, `maxReached`, `hover`, `anim` ; fonctions `loadLevel(i)`, `geo()`, `updateHud()`, `render(now)`, `shade(hex, f)`, `cellCenter(p, g)`, `onWin()`.

- [ ] **Step 1: Ajouter le HTML/CSS du HUD et de l'overlay**

Remplacer le contenu de `<style>` par :

```css
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden;
    font-family: "Consolas", "Courier New", monospace; color: #ccc;
    -webkit-user-select: none; user-select: none; touch-action: manipulation; }
  canvas { display: block; }
  #hud { position: fixed; top: 0; left: 0; right: 0; display: flex;
    justify-content: center; align-items: center; gap: 18px; padding: 12px;
    font-size: 16px; letter-spacing: 2px; }
  #hud button { background: none; border: 1px solid #444; color: #ccc;
    font: inherit; padding: 4px 14px; cursor: pointer; }
  #hud button:disabled { opacity: 0.3; cursor: default; }
  #overlay { position: fixed; inset: 0; display: none; flex-direction: column;
    justify-content: center; align-items: center; gap: 24px;
    background: rgba(0,0,0,0.85); font-size: 22px; letter-spacing: 4px; }
  #overlay button { background: none; border: 1px solid #444; color: #ccc;
    font: inherit; padding: 8px 24px; cursor: pointer; }
  #banner { position: fixed; bottom: 0; left: 0; right: 0; padding: 8px;
    font-size: 13px; white-space: pre; display: none; background: #111;
    max-height: 40%; overflow: auto; }
```

Et juste après `<body>` :

```html
<canvas id="board"></canvas>
<div id="hud">
  <button id="prev">◀</button>
  <span id="level-label">NIVEAU 1/10</span>
  <button id="restart">⟲</button>
  <button id="next">▶</button>
</div>
<div id="overlay">
  <div>FIN DU PROTOTYPE</div>
  <button id="replay">REJOUER</button>
</div>
<div id="banner"></div>
```

- [ ] **Step 2: Écrire le bloc `main` (rendu statique, HUD, navigation)**

Remplacer le contenu du bloc `<script id="main">` par :

```js
'use strict';
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const levelLabel = document.getElementById('level-label');
const overlay = document.getElementById('overlay');

const SWAP_MS = 120, RESOLVE_MS = 150;

let game = null;
let current = 0;
let maxReached = 0;
let hover = null;   // frontière survolée ou null
let anim = null;    // {phase:'swap'|'resolve', start, moves, resolved} — tâche 7

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

function loadLevel(i) {
  current = i;
  maxReached = Math.max(maxReached, i);
  game = createGame(LEVELS[i].rows);
  hover = null;
  anim = null;
  updateHud();
}

function geo() {
  return boardGeometry(game.width, game.height, canvas.width, canvas.height);
}

function cellCenter(p, g) {
  return { x: g.ox + (p.x + 0.5) * g.size, y: g.oy + (p.y + 0.5) * g.size };
}

function cellRect(x, y, g) {
  const gap = g.size * 0.06;
  return { x: g.ox + x * g.size + gap / 2, y: g.oy + y * g.size + gap / 2, w: g.size - gap, h: g.size - gap };
}

function drawDisc(cx, cy, size, color) {
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.30, 0, Math.PI * 2);
  ctx.fillStyle = COLORS[color];
  ctx.fill();
  ctx.lineWidth = Math.max(2, size * 0.03);
  ctx.strokeStyle = '#000';
  ctx.stroke();
}

function render(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const g = geo();
  for (let y = 0; y < game.height; y++) {
    for (let x = 0; x < game.width; x++) {
      const r = cellRect(x, y, g);
      ctx.fillStyle = '#101010'; // emplacement : les trous restent visibles
      ctx.fillRect(r.x, r.y, r.w, r.h);
      const c = game.cell(x, y);
      if (!c.active) continue;
      ctx.fillStyle = shade(COLORS[c.caseColor], 0.45); // case = teinte assombrie
      ctx.fillRect(r.x, r.y, r.w, r.h);
      drawDisc(r.x + r.w / 2, r.y + r.h / 2, g.size, c.discColor); // disque = teinte vive
    }
  }
  if (hover && !anim) {
    const { mx, my } = borderMidpoint(hover, g);
    const inset = g.size * 0.18;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (hover.dir === 'H') { ctx.moveTo(mx, my - g.size / 2 + inset); ctx.lineTo(mx, my + g.size / 2 - inset); }
    else { ctx.moveTo(mx - g.size / 2 + inset, my); ctx.lineTo(mx + g.size / 2 - inset, my); }
    ctx.stroke();
  }
}

function updateHud() {
  levelLabel.textContent = `NIVEAU ${current + 1}/${LEVELS.length}`;
  document.getElementById('prev').disabled = current === 0;
  document.getElementById('next').disabled = current >= maxReached;
}

function onWin() {
  if (current + 1 < LEVELS.length) loadLevel(current + 1);
  else overlay.style.display = 'flex';
}

document.getElementById('restart').addEventListener('click', () => loadLevel(current));
document.getElementById('prev').addEventListener('click', () => { if (current > 0) loadLevel(current - 1); });
document.getElementById('next').addEventListener('click', () => { if (current < maxReached) loadLevel(current + 1); });
document.getElementById('replay').addEventListener('click', () => {
  overlay.style.display = 'none';
  maxReached = 0;
  loadLevel(0);
});
window.addEventListener('keydown', ev => {
  if (ev.key === 'r' || ev.key === 'R') loadLevel(current);
  if (ev.key === 'ArrowLeft' && current > 0) loadLevel(current - 1);
  if (ev.key === 'ArrowRight' && current < maxReached) loadLevel(current + 1);
});

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
}
window.addEventListener('resize', resize);

function tick(now) {
  render(now);
  requestAnimationFrame(tick);
}

resize();
loadLevel(0);
requestAnimationFrame(tick);
```

- [ ] **Step 3: Vérifier que les tests logiques passent toujours**

Run: `node run-tests.mjs`
Expected: tous PASS, exit code 0.

- [ ] **Step 4: Vérification manuelle dans le navigateur**

Run: `start vasaris.html` (ou ouvrir le fichier dans Chrome/Edge)
Expected :
- fond noir, plateau 2×2 du niveau 1 centré : cases en teintes sombres, disques vifs avec liseré noir ;
- `NIVEAU 1/10` en haut, `◀` et `▶` grisés, `⟲` actif ;
- redimensionner la fenêtre recentre et redimensionne le plateau ;
- `⟲` et la touche `R` ne cassent rien (rechargent le niveau).

- [ ] **Step 5: Commit**

```bash
git add vasaris.html
git commit -m "feat: rendu Canvas statique, HUD et navigation entre niveaux"
```

---

### Task 6: Entrées pointeur et échange (sans animation)

**Files:**
- Modify: `vasaris.html` (bloc `main`)

**Interfaces:**
- Consumes: `nearestBorder`, `game.swap`, `game.isWon`, `onWin`, `hover`, `geo()`.
- Produces: `pointerPos(ev) -> {px, py}` (coordonnées en pixels canvas, DPR compris) ; gestion `pointermove`/`pointerdown` ; `startSwap(border)` (version instantanée, remplacée par la version animée en tâche 7).

- [ ] **Step 1: Ajouter la gestion du pointeur**

Ajouter dans le bloc `main`, avant `function resize()` :

```js
function pointerPos(ev) {
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  return { px: (ev.clientX - rect.left) * scale, py: (ev.clientY - rect.top) * scale };
}

canvas.addEventListener('pointermove', ev => {
  const { px, py } = pointerPos(ev);
  hover = anim ? null : nearestBorder(px, py, game, geo());
});

canvas.addEventListener('pointerdown', ev => {
  if (anim) return;
  const { px, py } = pointerPos(ev);
  const border = nearestBorder(px, py, game, geo());
  if (border) startSwap(border);
});

function startSwap(border) {
  const result = game.swap(border);
  if (!result) return;
  hover = null;
  if (game.isWon()) onWin();
}
```

- [ ] **Step 2: Vérifier que les tests logiques passent toujours**

Run: `node run-tests.mjs`
Expected: tous PASS, exit code 0.

- [ ] **Step 3: Vérification manuelle — partie complète au clic**

Run: `start vasaris.html`
Expected :
- survoler une frontière entre deux cases actives affiche un trait blanc ; au-delà de la tolérance ou vers un trou, rien ;
- cliquer échange les deux disques instantanément ; une case dont le disque correspond disparaît (emplacement `#101010` restant visible) ;
- finir le niveau 1 (2 clics) charge le niveau 2 et `▶`/`◀` s'activent selon la progression ;
- au niveau 3 (`BGGPPB`), jouer la frontière de gauche d'abord mène à un blocage : plus aucune frontière sélectionnable, `⟲` permet de recommencer ;
- finir les 10 niveaux (solutions dans `LEVELS`) affiche `FIN DU PROTOTYPE` et `REJOUER` repart au niveau 1.

- [ ] **Step 4: Commit**

```bash
git add vasaris.html
git commit -m "feat: entrées souris/tactile, échange et enchaînement des niveaux"
```

---

### Task 7: Animations d'échange et de résolution

**Files:**
- Modify: `vasaris.html` (bloc `main`)

**Interfaces:**
- Consumes: tout le bloc `main` existant.
- Produces: `anim` renseigné (`{phase:'swap'|'resolve', start, moves:[{from,to,color}], resolved:[{x,y}]}`), `easeInOut(t)`, `render` animé, `tick` faisant avancer la machine à états. Entrées ignorées pendant `anim !== null` (déjà en place en tâche 6).

- [ ] **Step 1: Remplacer `startSwap` par la version animée**

```js
function startSwap(border) {
  const n = game.neighbor(border);
  const a = { x: border.x, y: border.y };
  const da = game.cell(a.x, a.y).discColor;
  const db = game.cell(n.x, n.y).discColor;
  const result = game.swap(border);
  if (!result) return;
  hover = null;
  anim = {
    phase: 'swap',
    start: performance.now(),
    moves: [{ from: a, to: n, color: da }, { from: n, to: a, color: db }],
    resolved: result.resolved,
  };
}
```

- [ ] **Step 2: Remplacer `tick` par la machine à états**

```js
function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t); }

function tick(now) {
  if (anim) {
    const dur = anim.phase === 'swap' ? SWAP_MS : RESOLVE_MS;
    if (now - anim.start >= dur) {
      if (anim.phase === 'swap' && anim.resolved.length > 0) {
        anim = { phase: 'resolve', start: now, moves: [], resolved: anim.resolved };
      } else {
        anim = null;
        if (game.isWon()) onWin();
      }
    }
  }
  render(now);
  requestAnimationFrame(tick);
}
```

- [ ] **Step 3: Remplacer `render` par la version animée**

```js
function render(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const g = geo();
  const isPending = (x, y) => anim !== null && anim.resolved.some(p => p.x === x && p.y === y);
  const inSwapMove = (x, y) => anim !== null && anim.phase === 'swap' &&
    anim.moves.some(m => (m.to.x === x && m.to.y === y));

  for (let y = 0; y < game.height; y++) {
    for (let x = 0; x < game.width; x++) {
      const r = cellRect(x, y, g);
      ctx.fillStyle = '#101010'; // emplacement : les trous restent visibles
      ctx.fillRect(r.x, r.y, r.w, r.h);
      const c = game.cell(x, y);

      if (anim && anim.phase === 'resolve' && isPending(x, y)) {
        // flash blanc léger + fondu vers le noir
        const t = Math.min(1, (now - anim.start) / RESOLVE_MS);
        ctx.fillStyle = shade(COLORS[c.caseColor], 0.45 * (1 - t));
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = `rgba(255,255,255,${(0.7 * (1 - t)).toFixed(3)})`;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        continue;
      }

      // pendant la phase swap, une cellule logiquement résolue reste dessinée
      if (!c.active && !(anim && anim.phase === 'swap' && isPending(x, y))) continue;

      ctx.fillStyle = shade(COLORS[c.caseColor], 0.45);
      ctx.fillRect(r.x, r.y, r.w, r.h);
      if (!inSwapMove(x, y)) drawDisc(r.x + r.w / 2, r.y + r.h / 2, g.size, c.discColor);
    }
  }

  if (anim && anim.phase === 'swap') {
    const e = easeInOut(Math.min(1, (now - anim.start) / SWAP_MS));
    for (const m of anim.moves) {
      const from = cellCenter(m.from, g);
      const to = cellCenter(m.to, g);
      drawDisc(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e, g.size, m.color);
    }
  }

  if (hover && !anim) {
    const { mx, my } = borderMidpoint(hover, g);
    const inset = g.size * 0.18;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (hover.dir === 'H') { ctx.moveTo(mx, my - g.size / 2 + inset); ctx.lineTo(mx, my + g.size / 2 - inset); }
    else { ctx.moveTo(mx - g.size / 2 + inset, my); ctx.lineTo(mx + g.size / 2 - inset, my); }
    ctx.stroke();
  }
}
```

- [ ] **Step 4: Vérifier que les tests logiques passent toujours**

Run: `node run-tests.mjs`
Expected: tous PASS, exit code 0.

- [ ] **Step 5: Vérification manuelle des animations**

Run: `start vasaris.html`
Expected :
- au clic, les deux disques glissent en se croisant (~120 ms, easing) ;
- si une case se résout : flash blanc léger puis fondu au noir (~150 ms), le disque a disparu ;
- double résolution : les deux cases flashent en même temps ;
- cliquer frénétiquement pendant une animation ne déclenche rien (entrées ignorées) ;
- le rythme reste vif : un enchaînement de coups est fluide, jamais d'attente.

- [ ] **Step 6: Commit**

```bash
git add vasaris.html
git commit -m "feat: animations d'échange (120ms) et de résolution (150ms)"
```

---

### Task 8: Harnais de tests navigateur (?test) et passe finale

**Files:**
- Modify: `vasaris.html` (bloc `main`)

**Interfaces:**
- Consumes: `runTests` (bloc `game-tests`), `#banner`.
- Produces: exécution des tests dans le navigateur quand l'URL contient `?test`, résultats affichés dans le bandeau et en console.

- [ ] **Step 1: Brancher le harnais navigateur**

Ajouter à la fin du bloc `main` :

```js
if (location.search.includes('test')) {
  const banner = document.getElementById('banner');
  banner.style.display = 'block';
  const lines = [];
  const failures = runTests(msg => { lines.push(msg); console.log(msg); });
  lines.push(failures ? `${failures} ÉCHEC(S)` : 'TOUS LES TESTS PASSENT');
  banner.textContent = lines.join('\n');
}
```

- [ ] **Step 2: Vérifier les deux harnais**

Run: `node run-tests.mjs`
Expected: tous PASS, exit code 0.

Puis ouvrir `vasaris.html?test` dans le navigateur.
Expected: bandeau en bas listant les mêmes PASS et `TOUS LES TESTS PASSENT`, le jeu reste jouable derrière.

- [ ] **Step 3: Passe finale — parcours complet**

Dans le navigateur :
- jouer les niveaux 1 à 3 à la souris ;
- vérifier `R`, `⟲`, `◀`/`▶` (navigation limitée aux niveaux atteints) ;
- si possible, ouvrir le fichier sur un smartphone (ou l'émulation tactile des DevTools) et vérifier que la tolérance de sélection rend les frontières atteignables au doigt ;
- finir le niveau 10 → `FIN DU PROTOTYPE` → `REJOUER`.

Expected: aucun blocage, aucune erreur console.

- [ ] **Step 4: Commit final**

```bash
git add vasaris.html
git commit -m "feat: harnais de tests navigateur (?test)"
```

---

## Self-Review (fait à la rédaction)

- **Couverture de la spec :** règles du jeu → Task 2 ; trou = mur → Tasks 2-3 ; assistance de sélection 0.4× → Task 3 ; 10 niveaux vérifiés → Task 4 (replay mécanique des solutions) ; rendu minimaliste/palette/responsive → Task 5 ; souris+tactile unifiés → Task 6 ; animations 120/150 ms + verrouillage → Task 7 ; HUD/navigation/écran de fin → Tasks 5-6 ; harnais `?test` → Task 8. Hors périmètre conforme à la spec (pas de son, sauvegarde, manette, solveur).
- **Types cohérents :** `border {x,y,dir}`, `Cell {caseColor, discColor, active}`, `swap -> {resolved:[{x,y}]} | null`, `geo {size, ox, oy}` utilisés uniformément dans toutes les tâches.
- **Niveaux :** chaque `solution` a été déroulée à la main pendant la rédaction ; le test « chaque solution de référence vide le plateau » re-vérifie mécaniquement à chaque exécution.

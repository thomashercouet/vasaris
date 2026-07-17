// Générateur de niveaux VASARIS — méthode « groupes disjoints » :
// la grille est partitionnée en chemins (paires et chaînes) ; chaque chaîne reçoit
// des couleurs de cases toutes distinctes et des disques décalés d'un cran, ce qui
// garantit une solution par échanges depuis le bout du chemin. Chaque niveau généré
// est ensuite rejoué avec la vraie logique du jeu avant d'être injecté dans index.html.
// Usage : node tools/gen-levels.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const HTML_PATH = new URL('../index.html', import.meta.url);
const LETTERS = ['B', 'G', 'P', 'R', 'Y', 'C'];

// PRNG déterministe : mêmes niveaux à chaque exécution
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function borderBetween(a, b, w) {
  const ax = a % w, ay = (a / w) | 0, bx = b % w, by = (b / w) | 0;
  if (ay === by) return { x: Math.min(ax, bx), y: ay, dir: 'H' };
  return { x: ax, y: Math.min(ay, by), dir: 'V' };
}

function tryPartition(rng, w, h, holes, maxChain) {
  const unassigned = new Set();
  for (let i = 0; i < w * h; i++) if (!holes.has(i)) unassigned.add(i);
  const groups = [];
  const freeNeighbors = i => {
    const x = i % w, y = (i / w) | 0, res = [];
    if (x > 0) res.push(i - 1);
    if (x < w - 1) res.push(i + 1);
    if (y > 0) res.push(i - w);
    if (y < h - 1) res.push(i + w);
    return res.filter(n => unassigned.has(n));
  };
  while (unassigned.size) {
    const arr = [...unassigned];
    const start = arr[Math.floor(rng() * arr.length)];
    const target = 2 + Math.floor(rng() * (maxChain - 1)); // longueur 2..maxChain
    const path = [start];
    unassigned.delete(start);
    while (path.length < target) {
      const ns = freeNeighbors(path[path.length - 1]);
      if (!ns.length) break;
      const nxt = ns[Math.floor(rng() * ns.length)];
      path.push(nxt);
      unassigned.delete(nxt);
    }
    if (path.length < 2) return null; // cellule orpheline : on retente tout
    groups.push(path);
  }
  return groups;
}

function genLevel(rng, { w, h, nColors, nHoles, maxChain }) {
  const colors = LETTERS.slice(0, nColors);
  for (let attempt = 0; attempt < 2000; attempt++) {
    const holes = new Set();
    while (holes.size < nHoles) holes.add(Math.floor(rng() * w * h));
    const groups = tryPartition(rng, w, h, holes, maxChain);
    if (!groups) continue;
    const cells = new Array(w * h).fill(null);
    const solution = [];
    for (const path of shuffle(rng, groups)) {
      const k = path.length;
      const cs = shuffle(rng, colors).slice(0, k); // cases toutes distinctes dans la chaîne
      for (let i = 0; i < k; i++) {
        cells[path[i]] = { caseColor: cs[i], discColor: cs[(i + 1) % k] };
      }
      for (let i = k - 2; i >= 0; i--) solution.push(borderBetween(path[i], path[i + 1], w));
    }
    const rows = [];
    for (let y = 0; y < h; y++) {
      let s = '';
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        s += holes.has(i) ? '..' : cells[i].caseColor + cells[i].discColor;
      }
      rows.push(s);
    }
    return { rows, solution };
  }
  throw new Error(`génération impossible pour ${w}x${h}, ${nHoles} trous`);
}

// ---- Configurations des niveaux 21 à 50 : grilles verticales, difficulté croissante ----
const CONFIGS = [];
for (let i = 0; i < 5; i++) CONFIGS.push({ w: 4, h: 6, nColors: 5, nHoles: i < 2 ? 0 : 2, maxChain: 4 });
for (let i = 0; i < 5; i++) CONFIGS.push({ w: 4, h: 7, nColors: 5, nHoles: 2 + (i % 2), maxChain: 5 });
for (let i = 0; i < 5; i++) CONFIGS.push({ w: 5, h: 7, nColors: 6, nHoles: 2 + i % 3, maxChain: 5 });
for (let i = 0; i < 5; i++) CONFIGS.push({ w: 5, h: 8, nColors: 6, nHoles: 3 + i % 3, maxChain: 6 });
for (let i = 0; i < 5; i++) CONFIGS.push({ w: 5, h: 9, nColors: 6, nHoles: 4 + i % 3, maxChain: 6 });
for (let i = 0; i < 5; i++) CONFIGS.push({ w: 6, h: 9, nColors: 6, nHoles: 5 + i % 3, maxChain: 6 });

// ---- Génération + vérification avec la vraie logique du jeu ----
const html = readFileSync(HTML_PATH, 'utf8');
const core = html.match(/<script id="game-core">([\s\S]*?)<\/script>/)[1];
const ctx = vm.createContext({});
vm.runInContext(core, ctx);

const rng = mulberry32(20260717);
const generated = [];
CONFIGS.forEach((cfg, idx) => {
  const num = 21 + idx;
  const lvl = genLevel(rng, cfg);
  // rejoue la solution avec la logique réelle
  const check = vm.runInContext(
    `(function (rows, solution) {
       const g = createGame(rows);
       for (const b of solution) if (g.swap(b) === null) return 'coup invalide';
       return g.isWon() ? 'OK' : 'plateau non vide';
     })`, ctx)(lvl.rows, lvl.solution);
  if (check !== 'OK') throw new Error(`niveau ${num} : ${check}`);
  generated.push({ num, cfg, lvl });
  console.log(`niveau ${num} : ${cfg.w}x${cfg.h}, ${cfg.nColors} couleurs, ${cfg.nHoles} trous, solution ${lvl.solution.length} coups — OK`);
});

// ---- Injection dans index.html, juste avant la fermeture de LEVELS ----
const entries = generated.map(({ num, cfg, lvl }) => {
  const rows = lvl.rows.map(r => `'${r}'`).join(', ');
  const sol = lvl.solution.map(b => `{ x: ${b.x}, y: ${b.y}, dir: '${b.dir}' }`).join(', ');
  return `  // ${num} — ${cfg.w}x${cfg.h} vertical, ${cfg.nColors} couleurs, ${cfg.nHoles} trous (généré, solution ${lvl.solution.length} coups)\n` +
         `  { rows: [${rows}],\n    solution: [${sol}] },`;
}).join('\n');

const marker = /(\r?\n\];\r?\n<\/script>\r?\n<script id="game-tests">)/;
if (!marker.test(html)) throw new Error('marqueur de fin de LEVELS introuvable');
writeFileSync(HTML_PATH, html.replace(marker, `\n${entries}$1`));
console.log(`\n${generated.length} niveaux injectés dans index.html`);

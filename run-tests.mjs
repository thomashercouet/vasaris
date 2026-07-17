import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

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

// Regressionstest: spielt einen festen Ablauf mit festem Zufall durch (keine echte Spielschleife, nur __ns.tick).
//   Eine Datei:  node tools/regress.js index.html [bildordner]        → Zustände + Fehler ausgeben
//   Vergleich:   node tools/regress.js alt/index.html index.html       → meldet Zustands- und Pixel-Unterschiede
// Playwright: NODE_PATH="$(npm root -g)" voranstellen, falls nicht lokal installiert.
const { chromium } = require('playwright');
const crypto = require('crypto'), fs = require('fs'), path = require('path');
async function run(file, dir) {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 900, height: 500 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.addInitScript(() => {
    let s = 12345; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    window.requestAnimationFrame = () => 0;
  });
  await p.goto('file://' + path.resolve(file) + '#test');
  const shots = [], out = [];
  const snap = async n => { const buf = await p.screenshot(); shots.push([n, crypto.createHash('md5').update(buf).digest('hex')]); if (dir) fs.writeFileSync(path.join(dir, n + '.png'), buf); };
  const dump = () => p.evaluate(() => { const n = window.__ns, S = n.S, K = n.K, r = v => Math.round(v * 1000) / 1000;
    return JSON.stringify({ st: n.state, S: S && [r(S.x), r(S.y), S.hp, !!S.hidden], K: K && [r(K.x), r(K.y), K.mode, K.act && K.act.kind, r(K.aware)], t: n.tasks.map(t => r(t.prog)), p: n.pallets.map(p => p.state) }); });
  const stepIt = async (name, fn) => { await p.evaluate(fn); await snap(name); out.push(name + ' ' + await dump()); };
  await stepIt('title', () => window.__ns.tick(1.5));
  await stepIt('play', () => { const n = window.__ns; n.startGame(); n.keys.r = 1; n.tick(2); n.keys.r = 0; n.keys.u = 1; n.tick(1.5); n.keys.u = 0; n.tick(.5); });
  await stepIt('work', () => { const n = window.__ns, t = n.tasks[0]; n.tp(t.ax, t.ay); n.tick(.2); n.down(); n.up(); n.tick(4); for (let i = 0; i < 6; i++) { n.down(); n.up(); n.tick(.7); } });
  await stepIt('chase', () => { const n = window.__ns, S = n.S; n.ktp(S.x + 3, S.y); n.tick(12); });
  await stepIt('endgame', () => { const n = window.__ns; n.finish(); n.tick(3); });
  await stepIt('caught', () => { const n = window.__ns; n.caught(); n.tick(8); });
  await stepIt('tutorial', () => { const n = window.__ns; document.querySelector('#tutBtn').click(); n.tick(1); n.keys.r = 1; n.tick(1.2); n.keys.r = 0; n.tick(1); });
  await b.close();
  return { out, shots, errs };
}
(async () => {
  const [fa, fb] = process.argv.slice(2);
  if (!fa) { console.log('Aufruf: node tools/regress.js <index.html> [<index.html zum Vergleich> | <bildordner>]'); process.exit(2); }
  const compare = fb && fb.endsWith('.html');
  const a = await run(fa, compare ? null : fb);
  console.log(a.out.join('\n')); console.log('Fehler:', a.errs.length ? a.errs : 'keine');
  if (!compare) process.exit(a.errs.length ? 1 : 0);
  const b = await run(fb, null); let same = true;
  a.out.forEach((s, i) => { if (s !== b.out[i]) { same = false; console.log('ZUSTAND ANDERS\n  A', s, '\n  B', b.out[i]); } });
  a.shots.forEach((s, i) => { if (s[1] !== b.shots[i][1]) { same = false; console.log('PIXEL ANDERS:', s[0]); } });
  console.log('Fehler B:', b.errs.length ? b.errs : 'keine');
  console.log(same ? 'IDENTISCH' : 'UNTERSCHIEDE'); process.exit(same && !b.errs.length ? 0 : 1);
})();

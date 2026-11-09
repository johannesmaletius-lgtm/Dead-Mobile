// Bot-Simulation: 3 Bots allein gegen die Killer-KI, mehrere Partien je Karte, fester Zufall je Partie.
//   NODE_PATH="$(npm root -g)" node tools/botsim.js [--maps schule-team,ferienlager,krankenhaus] [--n 30] [--seed 1] [--strict] [--log]
// Die Werte streuen stark (±10 Punkte Fluchtquote bei 30 Partien): zum Abstimmen mehrere --seed vergleichen.
// Ziel: Fluchtquote 30–60 %, Dauer 4–9 min, Duo-Aufgabe meist erledigt, kein Hängenbleiben.
// Exit-Code 1 bei Browser-Fehlern, Partien ohne Ende oder festhängenden Bots; mit --strict auch, wenn die Zielwerte verfehlt werden.
const { chromium } = require('playwright');
const path = require('path');
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) { const k = args[i].slice(2); opt[k] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true; }
const MAPS = (opt.maps || 'schule-team,ferienlager,krankenhaus').split(','), NGAMES = +(opt.n || 30), SEED = +(opt.seed || 1);
// --cfg noise=2,stun=.4  überschreibt Stellschrauben aus Bots.cfg (zum Abstimmen)
const CFG = {}; if (typeof opt.cfg === 'string') for (const kv of opt.cfg.split(',')) { const [k, v] = kv.split('='); CFG[k] = v.includes(':') ? v.split(':').map(Number) : +v; }
const FILE = path.resolve(opt.file || path.join(__dirname, '..', 'index.html'));

async function runMap(browser, map) {
  const p = await browser.newPage({ viewport: { width: 900, height: 500 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.addInitScript(() => {
    let s = 1; const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    Math.random = rnd; window.__seed = v => { s = v; };
    window.requestAnimationFrame = () => 0;
    window.AudioContext = window.webkitAudioContext = undefined;
  });
  await p.goto('file://' + FILE + '#test');
  const games = [];
  for (let g = 0; g < NGAMES; g++) {
    const r = await p.evaluate(([map, seed, cfg]) => {
      const n = window.__ns; window.__seed(seed);
      n.Bots.on = true; n.Bots.override = cfg;
      n.startTeam(map, [{ kind: 'bot' }, { kind: 'bot' }, { kind: 'bot' }]);
      const t0 = n.T, log = [], pos = n.SV.map(v => ({ x: v.x, y: v.y, t: 0 }));
      let tt = 0, last = '', hits = 0, hp = n.SV.map(v => v.hp), stuck = 0, hooks = 0, hk = n.SV.map(v => v.hookN), chaseT = 0;
      while (n.state === 'play' && tt < 1200) {
        n.tick(.25); tt += .25;
        if (n.K.mode === 'chase') chaseT += .25;
        n.SV.forEach((v, i) => {
          if (v.hp < hp[i]) hits++; hp[i] = v.hp;
          if (v.hookN > hk[i]) hooks++; hk[i] = v.hookN;
          // Hängt ein Bot fest? (frei, will laufen, kommt 8 s lang nicht vom Fleck)
          const b = v.bot, q = pos[i], moving = b && b.want && !v.out && !v.hung && !v.carried && !v.hidden && v.hp > 0;
          if (!moving || Math.hypot(v.x - q.x, v.y - q.y) > .4) { q.x = v.x; q.y = v.y; q.t = 0; }
          else if ((q.t += .25) >= 8) { stuck++; q.t = 0; log.push(`FEST ${Math.round(tt)}s Bot ${i} (${v.x.toFixed(1)},${v.y.toFixed(1)}) ${b.mode}/${b.job && b.job.kind}`); }
        });
        const k = n.SV.map(v => v.out ? (v.out === 'dead' ? '†' : 'E') : v.hung ? 'H' : v.carried ? 'C' : v.hp).join('') + ' ' + n.taskPoints() + 'P';
        if (k !== last) { log.push(Math.round(tt) + 's ' + k); last = k; }
      }
      const duo = n.tasks.find(t => t.type === 'duo');
      return { ended: n.state === 'end', dur: n.T - t0, esc: n.SV.filter(v => v.out === 'escaped').length, pts: n.taskPoints(), need: n.need, duo: !!(duo && duo.done),
        hits, hooks, stuck, chaseT, nudges: n.SV.reduce((s, v) => s + (v.bot ? v.bot.stuckN : 0), 0), log: log.join(' · ') };
    }, [map, SEED * 1000 + g * 7919 + map.length, CFG]);
    games.push(r);
    const mm = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
    console.log(`  ${map} #${g + 1}: ${r.esc}/3 entkommen, ${mm(r.dur)} min, ${r.pts}/${r.need} P, Duo ${r.duo ? 'ja' : 'nein'}, ${r.hits} Treffer, ${r.hooks} Haken, Jagd ${Math.round(r.chaseT)}s${r.stuck ? ', FEST ' + r.stuck : ''}${r.ended ? '' : '  !! KEIN ENDE'}`);
    if (opt.log || r.stuck || !r.ended) console.log('     ' + r.log);
  }
  await p.close();
  return { map, games, errs };
}

(async () => {
  const browser = await chromium.launch();
  const res = await Promise.all(MAPS.map(m => runMap(browser, m)));
  await browser.close();
  let bad = false, off = false;
  console.log('\nKarte           Flucht   Dauer (min)       Duo     Tore offen  Fest');
  for (const { map, games, errs } of res) {
    const n = games.length, esc = games.reduce((s, g) => s + g.esc, 0) / (3 * n), ds = games.map(g => g.dur / 60).sort((a, b) => a - b);
    const avg = ds.reduce((s, d) => s + d, 0) / n, duo = games.filter(g => g.duo).length, open = games.filter(g => g.pts >= g.need).length, stuck = games.reduce((s, g) => s + g.stuck, 0);
    const okE = esc >= .3 && esc <= .6, okD = avg >= 4 && avg <= 9, okU = duo >= n / 2;
    console.log(`${map.padEnd(15)} ${(Math.round(esc * 100) + ' %').padEnd(6)}${okE ? '  ' : ' !'} ⌀ ${avg.toFixed(1)} (${ds[0].toFixed(1)}–${ds[n - 1].toFixed(1)})${okD ? '  ' : ' !'}  ${duo}/${n}${okU ? '  ' : ' !'}  ${open}/${n}        ${stuck}`);
    if (errs.length) { bad = true; console.log('  Browser-Fehler:', [...new Set(errs)].slice(0, 5)); }
    if (stuck || games.some(g => !g.ended)) bad = true;
    if (!okE || !okD || !okU) off = true;
  }
  console.log(bad ? 'FEHLER (Browser-Fehler, kein Ende oder festhängende Bots)' : off ? 'Zielwerte verfehlt (! markiert)' : 'OK: alle Zielwerte erreicht');
  process.exit(bad || (off && opt.strict) ? 1 : 0);
})();

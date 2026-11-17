// Gespielter Killer testen: Szenarien per Test-API (PASS/FAIL) und ein Autopilot, der den Killer wie ein Mensch über
// die Eingabe steuert (Joystick, Angriff, Aktion, Instinkt) und ganze Partien gegen die Bots spielt.
//   node tools/killertest.js [bildordner]                       Szenarien auf schule-team
//   node tools/killertest.js --sim 10 [--maps a,b] [--seed 1] [--cfg vault=.55]   Autopilot: Statistik je Karte (Opfer, Dauer, Hänger)
// Playwright: NODE_PATH="$(npm root -g)" voranstellen. Fester Zufall, kein Ton, keine rAF-Schleife.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), opt = {}; let dir = null;
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) { const k = args[i].slice(2); opt[k] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true; } else dir = args[i]; }
if (dir) fs.mkdirSync(dir, { recursive: true });
const FILE = path.resolve(opt.file || path.join(__dirname, '..', 'index.html'));

// --cfg vault=.55,win=.5  überschreibt Stellschrauben der Bots (Bots.cfg) für die Autopilot-Partien
const BCFG = {}; if (typeof opt.cfg === 'string') for (const kv of opt.cfg.split(',')) { const [k, v] = kv.split('='); BCFG[k] = v.includes(':') ? v.split(':').map(Number) : +v; }
/* Läuft im Browser: Hilfen und Autopilot */
function inPage() {
  const n = window.__ns;
  const setJoy = (dx, dy) => { const l = Math.hypot(dx, dy) || 1; joy.id = 99; joy.bx = 0; joy.by = 0; joy.x = dx / l * JOY_R; joy.y = dy / l * JOY_R; };
  const stop = () => { joy.id = null; };
  window.__k = {
    // Neues Killer-Spiel; bots = false: die Überlebenden stehen still (Szenarien steuern sie selbst)
    fresh(map = 'schule-team', bots = false) {
      n.Bots.on = bots;
      n.startTeam(map, [{ kind: 'bot' }, { kind: 'bot' }, { kind: 'bot' }], undefined, { killer: 'local' });
      n.tick(.05); return n;
    },
    until(cond, max, st = .05) { let t = 0; while (!cond() && t < max) { n.tick(st); t += st; } return Math.round(t * 100) / 100; },
    setJoy, stop,
    /* ---------- Autopilot: nutzt nur, was ein Mensch auch sieht (Sicht im Raum, Lärm, Instinkt, Pfeile) ---------- */
    pilot: {
      path: null, pi: 0, rp: 0, goalKey: '', last: null, inv: null, wander: null, px: 0, py: 0, stillT: 0, nudge: null, kicked: new Map(),
      reset() { Object.assign(this, { path: null, pi: 0, rp: 0, goalKey: '', last: null, inv: null, wander: null, stillT: 0, nudge: null, trailT: 0 }); this.kicked.clear(); stop(); },
      nav(x, y) {
        if (this.nudge && T < this.nudge.t) { setJoy(this.nudge.x - K.x, this.nudge.y - K.y); return; }
        if (lineWalk(K.x, K.y, x, y, K.r)) { this.path = null; setJoy(x - K.x, y - K.y); return; }
        const key = (x | 0) + ',' + (y | 0);
        if (!this.path || this.goalKey !== key || T > this.rp) { this.path = findPath(K.x | 0, K.y | 0, x | 0, y | 0); this.pi = 0; this.goalKey = key; this.rp = T + .6; }
        const P = this.path; if (!P || this.pi >= P.length) { setJoy(x - K.x, y - K.y); return; }
        const c = P[this.pi], nx = c % W, ny = (c / W) | 0, sp = specialAt(nx, ny);
        if (sp) {
          const cx = nx + .5, cy = ny + .5, ax = sp.o.ax, s = Math.sign((K.x - cx) * ax.x + (K.y - cy) * ax.y) || 1;
          const apx = cx + ax.x * s * .9, apy = cy + ax.y * s * .9, a = kActions().alt;
          if (a && a.o === sp.o && Math.hypot(K.x - apx, K.y - apy) < .3) { stop(); kDo('alt'); this.path = null; return; }
          setJoy(apx - K.x, apy - K.y); return;
        }
        let j = this.pi; const lim = Math.min(P.length - 1, this.pi + 6);
        for (let k = this.pi + 1; k <= lim; k++) { const m = P[k]; if (specialAt(m % W, (m / W) | 0)) break; if (lineWalk(K.x, K.y, (m % W) + .5, ((m / W) | 0) + .5, K.r)) j = k; else break; }
        const gx = (P[j] % W) + .5, gy = ((P[j] / W) | 0) + .5;
        setJoy(gx - K.x, gy - K.y);
        if (Math.hypot(gx - K.x, gy - K.y) < .3) this.pi = j + 1;
      },
      step() {
        if (state !== 'play') { stop(); return; }
        if (K.act) { stop(); if (K.act.kind === 'lunge' && this.tg) setJoy(this.tg.x - K.x, this.tg.y - K.y); return; }
        // kommt er nicht vom Fleck: kurz zur Seite
        if (Math.hypot(K.x - this.px, K.y - this.py) > .05) { this.px = K.x; this.py = K.y; this.stillT = T; }
        else if (joy.id !== null && T - this.stillT > 1.2) { this.stillT = T; this.path = null; for (let i = 0; i < 8; i++) { const a = Math.random() * TAU, x = K.x + Math.cos(a) * 1.2, y = K.y + Math.sin(a) * 1.2; if (!circleHit(x, y, K.r) && lineWalk(K.x, K.y, x, y, K.r)) { this.nudge = { x, y, t: T + .5 }; break; } } this.stuck = (this.stuck || 0) + 1; }
        const acts = kActions(), d2 = o => Math.hypot(o.x - K.x, o.y - K.y);
        if (K.carry) {
          if (acts.main && acts.main.kind === 'hook') { stop(); kDo('main'); return; }
          // der Haken mit dem kürzesten Weg (heller Pfeil im HUD), sonst der nächste freie
          const h = K.hookGoal && !hookBusy(K.hookGoal) ? K.hookGoal : hooks.filter(h => !hookBusy(h)).sort((a, b) => d2(a.front) - d2(b.front))[0]; if (h) this.nav(h.front.x, h.front.y); return;
        }
        const dn = SV.filter(isDowned).sort((a, b) => d2(a) - d2(b))[0];
        this.tg = null;
        for (const sv of SV) if (isFree(sv) && survShown(sv, K.mask) && (!this.tg || d2(sv) < d2(this.tg))) this.tg = sv;
        const tg = this.tg;
        // jemand direkt vor ihm: zuschlagen (auch wenn er gerade jemanden aufheben will)
        if (tg && d2(tg) < 2.2 && lineWalk(K.x, K.y, tg.x, tg.y, .22)) { setJoy(tg.x - K.x, tg.y - K.y); K.dir = Math.atan2(tg.y - K.y, tg.x - K.x); kDo('main'); return; }
        if (dn) { if (acts.alt && acts.alt.kind === 'pick') { stop(); kDo('alt'); return; } this.nav(dn.x, dn.y); return; }
        if (tg) { this.last = { x: tg.x, y: tg.y, t: T }; this.nav(tg.x, tg.y); return; }
        if (this.last && T - this.last.t < 5) { if (d2(this.last) < .8) this.last = null; else { this.nav(this.last.x, this.last.y); return; } }
        // frischen Kratzspuren folgen (sie leuchten für den Killer): immer zur neuesten in Sichtweite, die er noch nicht abgelaufen hat
        { let mk = null; for (let i = marks.length - 1; i >= 0; i--) { const m = marks[i]; if (m.t <= (this.trailT || 0) || T - m.t > CFG.markLife) break; if (d2(m) < 10) { mk = m; break; } }
          if (mk) { if (d2(mk) < .7) this.trailT = mk.t; else { this.nav(mk.x, mk.y); return; } } }
        const hn = K.heard.filter(h => T - h.t < 3).pop(); if (hn) this.inv = { x: hn.x, y: hn.y, t: T };
        if (K.instCd <= 0 && kInstinct() && K.inst.length) { const r = K.inst.slice().sort((a, b) => d2(a) - d2(b))[0]; this.inv = { x: r.x, y: r.y, t: T }; }
        if (this.inv && T - this.inv.t < 10) { if (d2(this.inv) < 1) this.inv = null; else { this.nav(this.inv.x, this.inv.y); return; } }
        if (acts.alt && acts.alt.kind === 'kick') { stop(); this.kicked.set(acts.alt.o, T); kDo('alt'); return; }
        // angefangene Aufgaben abklappern, sonst umherstreifen
        // (wie die Pfeile am Bildschirmrand: Aufgaben mit Fortschritt; die mit dem meisten zuerst, nahe bevorzugt)
        const tk = tasks.filter(t => !t.done && t.prog > .03 && !(T - (this.kicked.get(t) || -99) < 20)).sort((a, b) => (b.prog * 30 - d2({ x: b.ax, y: b.ay })) - (a.prog * 30 - d2({ x: a.ax, y: a.ay })))[0];
        if (tk) { if (Math.hypot(tk.ax - K.x, tk.ay - K.y) < .4) this.kicked.set(tk, T); else { this.nav(tk.ax, tk.ay); return; } }
        if (!this.wander || d2(this.wander) < 1 || T > this.wander.t) { const rs = allRooms(), i = roomFloor[rs[(Math.random() * rs.length) | 0]]; const c = i[(Math.random() * i.length) | 0]; this.wander = { x: c % W + .5, y: ((c / W) | 0) + .5, t: T + 14 }; }
        this.nav(this.wander.x, this.wander.y);
      },
    },
    /* Ganze Partie mit Autopilot (ohne Zeichnen) */
    game(map, seed, max = 1200, cfg) {
      window.__seed(seed); n.Bots.override = cfg || null; Object.assign(CFG, window.__kcfg || {});
      this.fresh(map, true); this.pilot.reset(); this.pilot.stuck = 0;
      const t0 = T; let fr = 0, last = '', log = [];
      while (state === 'play' && T - t0 < max) {
        if (fr++ % 3 === 0) this.pilot.step();
        step(1 / 60);
        if (fr % 60 === 0) { const k = SV.map(v => v.out ? (v.out === 'dead' ? '†' : 'E') : v.hung ? 'H' : v.carried ? 'C' : v.hp).join('') + ' ' + taskPoints() + 'P'; if (k !== last) { log.push(Math.round(T - t0) + 's ' + k); last = k; } }
      }
      stop();
      return { ended: state === 'end', dur: T - t0, kills: SV.filter(v => v.out === 'dead').length, esc: SV.filter(v => v.out === 'escaped').length, pts: taskPoints(), need: NEED,
        hits: K.hits, hooks: K.hooksN, stuns: stats.stuns, stuck: this.pilot.stuck, word: document.querySelector('#endWord').textContent, log: log.join(' · ') };
    },
  };
}

(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 900, height: 500 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.addInitScript(() => {
    let s = 4242; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    window.__seed = v => { s = v; };
    window.requestAnimationFrame = () => 0;
    window.AudioContext = window.webkitAudioContext = undefined;
  });
  await p.goto('file://' + FILE + '#test');
  await p.evaluate(inPage);
  // --kcfg kpRoam=4,instCd=24  überschreibt Stellschrauben aus CFG (zum Abstimmen)
  if (typeof opt.kcfg === 'string') await p.evaluate(s => { window.__kcfg = {}; for (const kv of s.split(',')) { const [k, v] = kv.split('='); window.__kcfg[k] = +v; } Object.assign(CFG, window.__kcfg); }, opt.kcfg);

  /* ---------- Autopilot-Statistik ---------- */
  if (opt.sim) {
    const maps = (opt.maps || 'schule-team,ferienlager,krankenhaus').split(','), N = +opt.sim || 10, seed = +(opt.seed || 1);
    let bad = false; const rows = [];
    for (const map of maps) {
      const gs = [];
      for (let g = 0; g < N; g++) {
        const r = await p.evaluate(([map, sd, cfg]) => window.__k.game(map, sd, 1200, cfg), [map, seed * 1000 + g * 7919 + map.length, BCFG]);
        gs.push(r);
        console.log(`  ${map} #${g + 1}: ${r.kills} Opfer, ${r.esc} entkommen, ${Math.floor(r.dur / 60)}:${String(Math.round(r.dur % 60)).padStart(2, '0')} min, ${r.pts}/${r.need} P, ${r.hits} Treffer, ${r.hooks} Haken, ${r.stuns}× betäubt${r.stuck > 6 ? ', Hänger ' + r.stuck : ''}${r.ended ? '' : '  !! KEIN ENDE'}`);
        if (opt.log || !r.ended) console.log('     ' + r.log);
        if (!r.ended) bad = true;
      }
      const avg = f => gs.reduce((s, g) => s + f(g), 0) / gs.length;
      rows.push(`${map.padEnd(15)} ⌀ ${avg(g => g.kills).toFixed(2)} Opfer   ⌀ ${(avg(g => g.dur) / 60).toFixed(1)} min   ${gs.filter(g => g.kills >= 3).length}/${N} alle erwischt   ${gs.filter(g => g.kills === 0).length}/${N} keinen   Tore offen ${gs.filter(g => g.pts >= g.need).length}/${N}`);
    }
    console.log('\nAutopilot-Killer gegen 3 Bots\n' + rows.join('\n'));
    if (errs.length) { bad = true; console.log('Browser-Fehler:', [...new Set(errs)].slice(0, 5)); }
    await b.close(); process.exit(bad ? 1 : 0);
  }

  /* ---------- Szenarien ---------- */
  const shot = async name => { if (dir) { await p.waitForTimeout(80); await p.screenshot({ path: path.join(dir, name + '.png') }); } };
  const results = [];
  const scen = async (name, fn) => {
    let r;
    try { r = await p.evaluate(fn); } catch (e) { r = { ok: false, info: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    results.push([name, r.ok]); console.log((r.ok ? 'PASS ' : 'FAIL ') + name + (r.info ? '  – ' + r.info : '')); return r;
  };
  await scen('Start über den Titel: Rolle Killer, drei Bots, kein eigener Überlebender', () => {
    const n = window.__ns; n.tick(.5); document.querySelector('#killBtn').click(); n.tick(.5);
    return { ok: n.role === 'killer' && n.mode === 'team' && n.state === 'play' && n.SV.length === 3 && n.SV.every(v => v.kind === 'bot' && v.bot) && !n.SV.includes(n.S) && n.K.human === 'local',
      info: `${n.map}, ${n.SV.map(v => v.name).join(', ')}` };
  });
  await shot('k01-start');
  await scen('Laufen: Tempo 4,4, langsam mit Umschalt, Wände halten', () => {
    const k = window.__k, n = k.fresh(); n.ktp(29.5, 12.5); const x0 = K.x;
    n.keys.r = 1; n.tick(1); const v = K.x - x0; n.keys.shift = 1; const x1 = K.x; n.tick(1); const vs = K.x - x1; n.keys.r = 0; n.keys.shift = 0;
    n.keys.u = 1; n.tick(4); n.keys.u = 0; const wall = !circleHit(K.x, K.y, K.r - .02);
    return { ok: Math.abs(v - 4.4) < .15 && Math.abs(vs - 4.4 * .55) < .15 && wall, info: `${v.toFixed(2)} / ${vs.toFixed(2)} Kacheln/s, in der Wand: ${!wall}` };
  });
  await scen('Jagd: beginnt bei Sichtkontakt, endet 5,5 s danach', () => {
    const k = window.__k, n = k.fresh(), A = SV[0];
    A.x = 30.5; A.y = 12.5; n.ktp(36.5, 12.5); K.dir = Math.PI; n.tick(.05);
    const t1 = k.until(() => K.mode === 'chase', 5), tg = K.target === A;
    n.ktp(40.5, 30.5); K.dir = 0; const t2 = k.until(() => K.mode !== 'chase', 9);
    return { ok: tg && t1 > .2 && t1 < 3 && Math.abs(t2 - 5.5) < .4, info: `Jagd nach ${t1} s, verloren nach ${t2} s` };
  });
  await scen('Angriff: Treffer → verletzt (Klinge abwischen), zweiter Treffer → am Boden', () => {
    const k = window.__k, n = k.fresh(), A = SV[0];
    A.x = 33.5; A.y = 12.5; n.ktp(35.3, 12.5); K.dir = Math.PI; n.tick(.05);
    n.down(); const lunge = K.act && K.act.kind; k.until(() => A.hp < 2, 1); const a1 = K.act && K.act.kind, hp1 = A.hp;
    k.until(() => !K.act, 4); n.ktp(A.x + 1.6, A.y); K.dir = Math.PI; n.tick(.05); n.down(); k.until(() => A.hp < 1, 1);
    return { ok: lunge === 'lunge' && hp1 === 1 && a1 === 'wipe' && A.hp === 0 && isDowned(A) && K.hits === 2 && K.downs === 1, info: `${lunge} → hp ${hp1} (${a1}) → hp ${A.hp}, Treffer ${K.hits}` };
  });
  await scen('Daneben: Erholung 1,15 s, Zielhilfe lenkt zum Überlebenden', () => {
    const k = window.__k, n = k.fresh(), A = SV[0];
    n.ktp(35.5, 12.5); K.dir = 0; n.tick(.05); n.down(); k.until(() => K.act && K.act.kind === 'recover', 2); const rec = K.act && K.act.kind === 'recover';
    const t = k.until(() => !K.act, 3);
    A.x = 33.2; A.y = 13.4; n.ktp(35.5, 12.5); K.dir = Math.PI; n.tick(.05); n.down(); k.until(() => A.hp < 2 || !K.act || K.act.kind !== 'lunge', 1);
    return { ok: rec && Math.abs(t - 1.15) < .1 && A.hp === 1, info: `Erholung ${t} s, schräg stehender Überlebender getroffen: ${A.hp === 1}` };
  });
  await scen('Aufheben (Aktion) → Tragen 3,6 → Haken (Hauptknopf)', () => {
    const k = window.__k, n = k.fresh(), A = SV[0], h = hooks[0];
    A.x = h.front.x + 3; A.y = h.front.y; A.hp = 1; n.ktp(A.x + .8, A.y); n.downSurv(A); K.act = null; n.tick(.05);
    const alt = kActions().alt; kDo('alt'); const pick = K.act && K.act.kind; k.until(() => A.carried, 2);
    const main0 = kActions().main; const x0 = K.x; n.keys.l = 1; n.tick(.5); const v = (x0 - K.x) / .5;
    k.until(() => { const m = kActions().main; return m && m.kind === 'hook'; }, 4); n.keys.l = 0;
    n.down(); k.until(() => !!A.hung, 2);
    return { ok: alt && alt.kind === 'pick' && pick === 'pick' && main0.off && Math.abs(v - 3.6) < .2 && A.hung === h && K.hooksN === 1 && K.mode !== 'carry', info: `Aktion ${alt && alt.kind}, Tragen ${v.toFixed(2)}/s, am Haken: ${!!A.hung}` };
  });
  await shot('k02-haken');
  await scen('Aktionen: Palette zerbrechen, Fenster, Spind (mit Überlebendem), Aufgabe treten', () => {
    const k = window.__k, n = k.fresh(), A = SV[0], out = [];
    const pal = pallets[0]; pal.state = 1; n.ktp(pal.cx + pal.ax.x * .95, pal.cy + pal.ax.y * .95); n.tick(.05);
    let a = kActions().alt; kDo('alt'); const tb = k.until(() => pal.state === 2, 4); out.push(`Palette ${a && a.kind} ${tb}s`);
    const ok1 = a && a.kind === 'break' && Math.abs(tb - 2.3) < .15 && K.breaks === 1;
    const w = windows[0]; k.until(() => !K.act, 2); n.ktp(w.cx + w.ax.x * .9, w.cy + w.ax.y * .9); n.tick(.05);
    a = kActions().alt; const side = Math.sign((K.x - w.cx) * w.ax.x + (K.y - w.cy) * w.ax.y); kDo('alt'); const tv = k.until(() => !K.act, 3);
    const side2 = Math.sign((K.x - w.cx) * w.ax.x + (K.y - w.cy) * w.ax.y); out.push(`Fenster ${a && a.kind} ${tv}s`);
    const ok2 = a && a.kind === 'kvault' && side2 === -side && Math.abs(tv - 1.55) < .15;
    const L = lockers[0]; A.x = L.front.x; A.y = L.front.y; n.hide(L, A); n.tick(1); n.ktp(L.front.x, L.front.y); n.tick(.05);
    a = kActions().alt; kDo('alt'); k.until(() => A.carried, 2); out.push(`Spind ${a && a.kind} → getragen ${A.carried}`);
    const ok3 = a && a.kind === 'search' && A.carried && K.found === 1;
    n.dropCarried('wiggle'); K.act = null; const t = tasks[0]; t.prog = .5; n.ktp(t.ax, t.ay); K.mode = 'patrol'; n.tick(.05);
    a = kActions().alt; kDo('alt'); k.until(() => !K.act, 2); out.push(`Treten ${a && a.kind} → ${t.prog.toFixed(2)}`);
    const ok4 = a && a.kind === 'kick' && Math.abs(t.prog - .35) < .01;
    return { ok: ok1 && ok2 && ok3 && ok4, info: out.join(', ') };
  });
  await scen('Palette auf den Kopf: betäubt, lässt Getragenen fallen; Zappeln befreit', () => {
    const k = window.__k, n = k.fresh(), [A, B] = SV, pal = pallets[1];
    n.ktp(pal.cx - pal.ax.x * .2, pal.cy - pal.ax.y * .2); A.hp = 1; n.pickUp(A);
    B.x = pal.cx + pal.ax.x * .8; B.y = pal.cy + pal.ax.y * .8; n.dropPallet(pal, B);
    const stun = K.act && K.act.kind === 'stun', free = !A.carried && A.hp === 1; n.keys.r = 1; const x0 = K.x; n.tick(1); n.keys.r = 0; const still = Math.abs(K.x - x0) < .01;
    k.until(() => !K.act, 3); n.pickUp(A); for (let i = 0; i < 70 && A.carried; i++) { n.wiggle(A); n.tick(.05); }
    return { ok: stun && free && still && !A.carried && K.act && K.act.kind === 'stun' && stats.stuns === 1, info: `betäubt ${stun}, fallen gelassen ${free}, bewegungslos ${still}, losgerissen ${!A.carried}` };
  });
  await scen('Instinkt: zeigt Überlebende im Umkreis (nicht im Spind), Abklingzeit', () => {
    const k = window.__k, n = k.fresh(), [A, B, C] = SV, L = lockers[0];
    n.ktp(L.front.x + 3, L.front.y); A.x = L.front.x + 6; A.y = L.front.y; B.x = 40.5; B.y = 35.5; C.x = L.front.x; C.y = L.front.y; n.hide(L, C); n.tick(1);
    const far = Math.hypot(C.x - K.x, C.y - K.y) < 15;
    const ok1 = kInstinct(), who = K.inst.map(r => r.sv.name), again = kInstinct(), cd = K.instCd;
    return { ok: ok1 && who.length === 1 && who[0] === A.name && !again && Math.abs(cd - 28) < .1, info: `gezeigt: ${who.join(',')} (Spind in Reichweite: ${far}), zweimal: ${again}, Abklingzeit ${cd.toFixed(0)} s` };
  });
  await shot('k03-instinkt');
  await scen('Lauern am Haken bremst die Haken-Zeit', () => {
    const k = window.__k, n = k.fresh(), A = SV[0], h = hooks[0];
    n.hookSurv(A, h); n.ktp(h.front.x + 2, h.front.y); n.tick(6); const near = A.hookProg, camped = A.camped;
    n.ktp(h.front.x + 12 > 44 ? h.front.x - 12 : h.front.x + 12, h.front.y); n.tick(6); const farP = A.hookProg - near;
    return { ok: camped && Math.abs(near - 6 / 60 * .45) < .01 && Math.abs(farP - .1) < .01, info: `nah ${near.toFixed(3)} in 6 s, fern ${farP.toFixed(3)} in 6 s` };
  });
  await scen('Lärm: Skill-Check daneben erscheint als Hinweis', () => {
    const k = window.__k, n = k.fresh(), A = SV[0], t = tasks[0];
    A.x = t.ax; A.y = t.ay; n.startWorkFor(A, t); n.ktp(40.5, 30.5); n.tick(.1); taskFail(A, t);
    const h = K.heard[K.heard.length - 1];
    return { ok: !!h && h.loud && Math.hypot(h.x - t.cx, h.y - t.cy) < .1 && K.mode === 'patrol', info: h ? `gehört bei ${h.x},${h.y}, Modus ${K.mode}` : 'nichts gehört' };
  });
  await shot('k04-laerm');
  await scen('Ende: alle geopfert → Endbildschirm „Massacre", Nochmal startet wieder als Killer', () => {
    const k = window.__k, n = k.fresh();
    for (const v of SV) n.killSurv(v, 'hook'); n.tick(4);
    const word = document.querySelector('#endWord').textContent, st = n.state, rows = document.querySelectorAll('#teamRes .tr').length;
    document.querySelector('#again').click(); n.tick(.2);
    return { ok: st === 'end' && word === 'Massacre' && rows === 3 && n.state === 'play' && n.role === 'killer', info: `${st}, „${word}", danach ${n.state}/${n.role}` };
  });
  await scen('Ende: alle entkommen → „Outplayed"', () => {
    const k = window.__k, n = k.fresh();
    n.finish(); n.tick(3); for (const v of SV) n.escapeSurv(v, gates[0]); n.tick(4);
    return { ok: n.state === 'end' && document.querySelector('#endWord').textContent === 'Outplayed', info: document.querySelector('#endWord').textContent };
  });
  await shot('k05-ende');
  await scen('Danach Solo: Rolle wieder Überlebender, KI-Killer', () => {
    const n = window.__ns; n.startGame(); n.tick(1);
    return { ok: n.role === 'surv' && !n.K.human && n.S === n.SV[0] && n.state === 'play', info: `${n.role}, K.human=${n.K.human}` };
  });
  const r = await scen('Autopilot: ganze Partie gegen Bots läuft bis zum Ende', () => {
    const g = window.__k.game('schule-team', 77);
    return { ok: g.ended && g.stuck < 12, info: `${g.kills} Opfer, ${g.esc} entkommen, ${Math.round(g.dur)} s, ${g.hits} Treffer, ${g.hooks} Haken, „${g.word}", Hänger ${g.stuck}` };
  });
  await shot('k06-autopilot-ende');
  console.log('Fehler im Browser:', errs.length ? [...new Set(errs)] : 'keine');
  const fails = results.filter(r => !r[1]).length;
  console.log('ERGEBNIS: ' + (fails ? fails + ' FAIL von ' + results.length : 'alle ' + results.length + ' PASS'));
  await b.close(); process.exit(fails || errs.length ? 1 : 0);
})();

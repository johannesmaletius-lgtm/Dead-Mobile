// Team-Regeln testen: spielt Szenarien auf 'schule-team' per Test-API (window.__ns) durch, meldet PASS/FAIL je Szenario.
//   node tools/teamtest.js [bildordner]                 alle Szenarien auf schule-team
//   node tools/teamtest.js [bildordner] --map <id>      kartenunabhängige Prüfung (alle Haken, Paletten, Tore, Duo, Dauerlauf)
// Playwright: NODE_PATH="$(npm root -g)" voranstellen.
// Fester Zufall, kein Ton, keine rAF-Schleife (wie tools/regress.js). Die anderen Survivors haben noch keine Bots:
// der Test steuert sie direkt über die Schnittstellen aus js/rules.js (sv.ctl = (sv, dt) => healStep(…) usw.).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), mi = args.indexOf('--map');
const MAP = mi >= 0 ? args[mi + 1] : 'schule-team';
const dir = args.find((a, i) => !a.startsWith('--') && (mi < 0 || i !== mi + 1)) || null;
if (dir) fs.mkdirSync(dir, { recursive: true });

(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 900, height: 500 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.addInitScript(() => {
    let s = 4242; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    window.requestAnimationFrame = () => 0;
    window.AudioContext = window.webkitAudioContext = undefined;
  });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '#test');
  // Hilfen im Browser
  await p.evaluate(MAP => {
    const n = window.__ns;
    window.__t = {
      // Neues Team-Spiel; Killer wartet (ctl), bis ein Szenario ihn freilässt
      fresh(idle = true) {
        n.Bots.on = false;   // Szenarien steuern die anderen Survivors selbst
        n.startTeam(MAP); n.tick(.05);
        if (idle) this.idleK(); return n;
      },
      idleK(x = 42.5, y = 34.5) { n.K.ctl = () => { n.K.moving = false; }; n.ktp(x, y); },
      freeK() { n.K.ctl = null; },
      // tickt in Schritten, bis cond() gilt (oder max Sekunden); liefert die vergangene Zeit
      until(cond, max, st = .05) { let t = 0; while (!cond() && t < max) { n.tick(st); t += st; } return Math.round(t * 100) / 100; },
      // Skill-Checks des eigenen QTE treffen (Bild für Bild)
      auto(sec, miss = false) {
        for (let i = 0; i < Math.round(sec * 60); i++) {
          const q = n.Q;
          if (!miss && q && q.check && q.lock <= 0) { const rel = q.check.a - q.check.zs; if (rel > q.check.gw * .5 && rel < q.check.zw * .6) { n.down(); n.up(); } }
          n.tick(1 / 60);
        }
      },
      room(x, y) { return n.roomAt(x, y); },
      d(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); },
    };
  }, MAP);
  const shot = async name => { if (dir) await p.screenshot({ path: path.join(dir, name + '.png') }); };
  const results = [];
  const scen = async (name, fn) => {
    let r;
    try { r = await p.evaluate(fn); } catch (e) { r = { ok: false, info: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    results.push([name, r.ok, r.info]);
    console.log((r.ok ? 'PASS ' : 'FAIL ') + name + (r.info ? '  – ' + r.info : ''));
    return r;
  };

  // ===== Kartenunabhängiger Teil (--map <id>): Regeln an allen Haken, Paletten, Toren der Karte =====
  if (MAP !== 'schule-team') {
    await scen(`[${MAP}] Treffer → Boden → Aufheben → Tragen → Haken`, () => {
      const t = window.__t, n = t.fresh(true), S = n.S;
      n.ktp(S.x, S.y); t.freeK(); S.hp = 1; n.hitSurvivor(S);
      const tPick = t.until(() => S.carried, 8);
      if (!S.carried) return { ok: false, info: 'nicht aufgehoben, K.mode=' + n.K.mode };
      const k0 = { x: n.K.x, y: n.K.y }; n.tick(1); const v = t.d(n.K, k0);
      const tHook = t.until(() => !!S.hung, 60);
      return { ok: !!S.hung && v > 2 && v <= 3.65, info: `aufgehoben nach ${tPick}s, ${v.toFixed(2)} Kacheln/s, am Haken nach ${tHook}s` };
    });
    await shot(`m1-${MAP}-haken`);
    await scen(`[${MAP}] alle Haken: erreichbar und rettbar`, () => {
      const t = window.__t, n = t.fresh(), [, A, B] = n.SV, bad = [];
      n.hooks.forEach((h, i) => {
        const path = n.findPath(n.K.x | 0, n.K.y | 0, h.front.x | 0, h.front.y | 0);
        n.hookSurv(A, h); A.hookN = 0;
        B.x = h.front.x; B.y = h.front.y + .1; B.ctl = (sv, dt) => n.unhookStep(sv, A, dt);
        n.tick(1.3); B.ctl = null;
        if (!path || A.hung || A.hp !== 1 || circleHit(A.x, A.y, A.r - .02)) bad.push(i);
        A.hp = 2;
      });
      return { ok: !bad.length, info: `${n.hooks.length} Haken, Probleme: ${bad.join(',') || 'keine'}` };
    });
    await scen(`[${MAP}] alle Paletten: Stun beim Tragen lässt fallen`, () => {
      const t = window.__t, n = t.fresh(), S = n.S, A = n.SV[1], bad = [];
      n.pallets.forEach((pal, i) => {
        pal.state = 0; n.K.ctl = null; n.K.act = null;
        n.ktp(pal.cx - pal.ax.x * .25, pal.cy - pal.ax.y * .25); A.hp = 2; n.pickUp(A);
        S.x = pal.cx + pal.ax.x * .8; S.y = pal.cy + pal.ax.y * .8; S.act = null;
        n.dropPallet(pal, S);
        const ok = !A.carried && A.hp === 1 && n.K.act && n.K.act.kind === 'stun' && !circleHit(A.x, A.y, A.r - .02) && Math.hypot(A.x - n.K.x, A.y - n.K.y) < 1.2;
        if (!ok) bad.push(i + (A.carried ? ':getragen' : ':Lage'));
        n.K.act = null; n.K.mode = 'patrol'; S.act = null; pal.state = 0;
      });
      t.idleK();
      return { ok: !bad.length, info: `${n.pallets.length} Paletten, Probleme: ${bad.join(',') || 'keine'}` };
    });
    await shot(`m2-${MAP}-palette`);
    await scen(`[${MAP}] Duo-Aufgabe zu zweit`, () => {
      const t = window.__t, n = t.fresh(), S = n.S, A = n.SV[1], duo = n.tasks.find(x => x.type === 'duo');
      if (!duo) return { ok: false, info: 'keine Duo-Aufgabe' };
      const s0 = duo.stations[0], s1 = duo.stations[1];
      S.x = s0.ax; S.y = s0.ay; n.tick(.05); const a = n.act;
      n.down(); n.up(); n.tick(2); const alone = duo.prog;
      A.x = s1.ax; A.y = s1.ay; n.startWorkFor(A, duo, 1); A.ctl = (sv, dt) => n.workStep(sv, duo, dt, 1);
      t.auto(4); const p = duo.prog;
      return { ok: a && a.kind === 'task' && a.st === 0 && alone === 0 && p > .15, info: `allein ${alone}, zu zweit nach 4 s ${p.toFixed(2)}` };
    });
    await shot(`m3-${MAP}-duo`);
    await scen(`[${MAP}] alle Tore: hindurchlaufen = entkommen`, () => {
      const t = window.__t, n = t.fresh(), bad = [];
      n.finish(); n.tick(3);
      n.gates.forEach((g, i) => {
        const sv = n.SV[1 + (i % 2)]; sv.out = null; sv.leave = null; sv.hp = 2;
        const dir = g.north ? -1 : 1; sv.x = (g.x0 + g.x1 + 1) / 2; sv.y = g.y + .5 - dir * 1.6;
        sv.ctl = (s, dt) => survMove(s, { x: 0, y: dir, mag: 1, walk: false }, dt);
        t.until(() => sv.out === 'escaped', 3); sv.ctl = null;
        if (sv.out !== 'escaped') bad.push(i);
      });
      return { ok: !bad.length, info: `${n.gates.length} Tore, Probleme: ${bad.join(',') || 'keine'}` };
    });
    await scen(`[${MAP}] Dauerlauf: freie Killer-KI gegen 3 stehende Survivors bis zum Ende`, () => {
      const t = window.__t, n = t.fresh(false), log = []; let last = '', tt = 0;
      while (n.state === 'play' && tt < 900) {
        n.tick(.5); tt += .5;
        const k = n.SV.map(v => v.out ? (v.out === 'dead' ? '†' : 'E') : v.hung ? 'H' : v.carried ? 'C' : v.hp).join('') + ' ' + n.K.mode;
        if (k !== last) { log.push(Math.round(tt) + 's ' + k); last = k; }
      }
      return { ok: n.state === 'end' && n.SV.every(v => v.out === 'dead'), info: log.join(' · ') };
    });
    await shot(`m4-${MAP}-ende`);
  }
  if (MAP === 'schule-team') {
  // 1) Treffer → Boden → Aufheben → Tragen → Haken (echte Killer-KI)
  await scen('Treffer → Boden → Aufheben → Tragen → Haken', () => {
    const t = window.__t, n = t.fresh(true), S = n.S, [, A, B] = n.SV;
    A.x = 2.5; A.y = 3.5; B.x = 4.5; B.y = 3.5;                       // weit weg (Hof)
    S.x = 34.5; S.y = 12.5; S.hp = 1; S.dir = Math.PI;
    n.ktp(37.5, 12.5); n.K.dir = Math.PI; t.freeK();
    const tDown = t.until(() => S.hp === 0, 12);
    if (S.hp !== 0) return { ok: false, info: 'nicht am Boden nach ' + tDown + ' s, K.mode=' + n.K.mode };
    const fetch = n.K.mode;
    // Kriechen: S kriecht nach links
    n.keys.l = 1; const x0 = S.x; n.tick(1); n.keys.l = 0; const crawl = Math.abs(S.x - x0);
    const tPick = t.until(() => S.carried, 10);
    if (!S.carried || n.K.carry !== S) return { ok: false, info: 'nicht aufgehoben' };
    const k0 = { x: n.K.x, y: n.K.y }; n.tick(1); const v = t.d(n.K, k0);
    const same = S.x === n.K.x && S.y === n.K.y;
    window.__shotState = { carried: true };
    return { ok: fetch === 'fetch' && crawl > .7 && crawl < 1.0 && same && v > 2.4 && v <= 3.65,
      info: `Boden nach ${tDown}s (K ${fetch}), kriecht ${crawl.toFixed(2)}/s, aufgehoben nach ${tPick}s, trägt ${v.toFixed(2)} Kacheln/s` };
  });
  await shot('01-getragen');
  await scen('… weiter zum freien Haken, kein Camping', () => {
    const t = window.__t, n = window.__ns, S = n.S;
    const tHook = t.until(() => !!S.hung, 30);
    if (!S.hung) return { ok: false, info: 'nicht aufgehängt, K.mode=' + n.K.mode };
    const h = S.hung, campRoom = n.K.campRoom, hookRoom = t.room(h.front.x, h.front.y);
    const ok1 = S.hookN === 1 && S.hookProg < .05 && n.K.mode === 'patrol' && campRoom === hookRoom;
    // Andere Survivors in Spinde, damit er sie nicht findet
    const [, A, B] = n.SV; A.ctl = B.ctl = null;
    const inRoom = []; for (let i = 0; i < 12; i++) { n.tick(1); inRoom.push(t.room(n.K.x, n.K.y) === campRoom ? 1 : 0); }
    const left = inRoom.slice(5).every(v => !v);
    return { ok: ok1 && left, info: `am Haken nach ${tHook}s, Haken-Raum ${hookRoom}, Killer im Haken-Raum (s 1–12): ${inRoom.join('')}` };
  });
  await scen('Haken-Fortschritt, Kampfphase ab 0,5, Tod bei 1 (2 × 30 s)', () => {
    const t = window.__t, n = window.__ns, S = n.S;
    t.idleK(); const h = S.hung;
    // Kamera am Haken: S hängt, die Sicht folgt S
    const p0 = S.hookProg; n.tick(10); const rate = (S.hookProg - p0) / 10;
    t.until(() => S.hookProg >= .55, 30);
    window.__hookShot = { hp: S.hookProg };
    return { ok: Math.abs(rate - 1 / 60) < .002 && S.hookProg >= .5 && !!S.hung && !S.out, info: `Rate ${rate.toFixed(4)}/s (Soll ${(1 / 60).toFixed(4)}), jetzt ${S.hookProg.toFixed(2)}` };
  });
  await shot('02-haken-kampfphase');
  await scen('… Haken bei 1 → geopfert (Klauen), Zuschauen', () => {
    const t = window.__t, n = window.__ns, S = n.S;
    t.until(() => !!S.out, 30);
    const dead = S.out === 'dead', d = n.deaths.find(x => x.sv === S);
    n.tick(1.3);
    const stay = n.viewer() === S && document.querySelector('#specBar').hidden;   // erst Abschied (Klauen)
    return { ok: dead && !!d && d.how === 'hook' && stay, info: `out=${S.out}, Sicht bleibt erst beim eigenen Survivor: ${stay}` };
  });
  await shot('03-eigener-tod-klauen');
  await scen('… danach Zuschauen mit Banner', () => {
    const n = window.__ns, S = n.S;
    n.tick(1.8);   // Abschied 2,6 s (plus Zeitlupe beim eigenen Tod)
    const V = n.viewer();
    return { ok: V !== S && !V.out && !document.querySelector('#specBar').hidden && /Geopfert/.test(document.querySelector('#specText').textContent),
      info: `schaut zu: ${V.name}` };
  });
  await shot('03b-zuschauen-geopfert');

  // 2) Retten durch Teamkollegen (Bot-Schnittstelle) und durch den eigenen Spieler (halten)
  await scen('Retten: Teamkollege hält 1,2 s am Haken', () => {
    const t = window.__t, n = t.fresh(), S = n.S, A = n.SV[1], h = n.hooks[0];
    n.hookSurv(S, h);
    A.x = h.front.x + .3; A.y = h.front.y + .2;
    A.ctl = (sv, dt) => n.unhookStep(sv, S, dt);
    n.tick(.6); const mid = S.unhookProg;
    A.ctl = null; n.tick(.3); const reset = S.unhookProg;              // Abbruch → zurück auf 0
    A.ctl = (sv, dt) => n.unhookStep(sv, S, dt);
    n.tick(1.1); const still = !!S.hung;
    n.tick(.2);
    return { ok: mid > .4 && mid < .6 && reset === 0 && still && !S.hung && S.hp === 1 && S.burst > 0 && S.hookN === 1,
      info: `nach 0,6 s ${mid.toFixed(2)}, Abbruch → ${reset}, frei: ${!S.hung}, hp ${S.hp}, Sprint ${S.burst.toFixed(2)} s` };
  });
  await scen('Retten: eigener Spieler hält die Aktionstaste', () => {
    const t = window.__t, n = t.fresh(), S = n.S, A = n.SV[1], h = n.hooks[1];
    n.hookSurv(A, h); n.tick(2);
    S.x = h.front.x; S.y = h.front.y + .3; n.tick(.05);
    const kind = n.act && n.act.kind;
    n.down(); n.tick(.7); const mid = A.unhookProg;
    window.__rescueMid = mid;
    return { ok: kind === 'rescue' && mid > .5 && !!A.hung && !!S.unhook, info: `Aktion ${kind}, nach 0,7 s ${mid.toFixed(2)}` };
  });
  await shot('04-retten-halten');
  await scen('… loslassen bricht ab, erneut halten befreit', () => {
    const n = window.__ns, S = n.S, A = n.SV[1];
    n.up(); n.tick(.2); const reset = A.unhookProg, stopped = !S.unhook;
    n.down(); n.tick(1.3); n.up();
    return { ok: reset === 0 && stopped && !A.hung && A.hp === 1 && n.S.unhook === null, info: `Abbruch → ${reset}, frei: ${!A.hung}` };
  });

  // 3) Heilen
  await scen('Heilen: verletzt → gesund 12 s, Fortschritt bleibt, zwei Heiler addieren sich', () => {
    const t = window.__t, n = t.fresh(), S = n.S, [, A, B] = n.SV;
    S.x = 10.5; S.y = 11.5; S.hp = 1; A.x = 11.3; A.y = 11.5; B.x = 9.7; B.y = 11.5;
    A.ctl = (sv, dt) => n.healStep(sv, S, dt, 1);
    n.tick(6); const half = S.healProg;
    A.ctl = null; n.tick(2); const kept = S.healProg;
    A.ctl = (sv, dt) => n.healStep(sv, S, dt, 1); B.ctl = (sv, dt) => n.healStep(sv, S, dt, 1);
    n.tick(2.9); const before = S.hp; n.tick(.2);
    const self = n.canHeal(S, S);
    return { ok: Math.abs(half - .5) < .02 && kept === half && before === 1 && S.hp === 2 && S.healProg === 0 && !self,
      info: `6 s → ${half.toFixed(3)}, Pause → ${kept.toFixed(3)}, zu zweit fertig nach ~3 s: hp ${S.hp}, Selbstheilung: ${self}` };
  });
  await scen('Heilen: eigener Spieler richtet Liegenden auf (QTE, 10 s)', () => {
    const t = window.__t, n = t.fresh(), S = n.S, A = n.SV[1];
    A.x = 10.5; A.y = 11.5; A.hp = 1; n.downSurv(A); n.K.act = null;
    S.x = 11.4; S.y = 11.5; n.tick(.05);
    const kind = n.act && n.act.kind;
    n.down(); n.up(); const qt = n.Q && n.Q.type;
    t.auto(5); const mid = A.healProg;
    window.__healShot = true;
    return { ok: kind === 'heal' && qt === 'heal' && mid > .4 && mid < .56 && A.hp === 0, info: `Aktion ${kind}, QTE ${qt}, nach 5 s ${mid.toFixed(2)}` };
  });
  await shot('05-heilen-qte');
  await scen('… Skill-Check daneben = −10 % und Lärm, dann fertig', () => {
    const t = window.__t, n = window.__ns, S = n.S, A = n.SV[1];
    // einen Check verpassen
    const nz0 = n.K.lastSeen; let miss = false, p0 = 0;
    for (let i = 0; i < 60 * 8 && !miss; i++) { const q = n.Q; if (q && q.check && q.check.a > 6.2) { p0 = A.healProg; n.tick(2 / 60); miss = true; } else n.tick(1 / 60); }
    const drop = p0 - A.healProg, flash = n.Q && n.Q.flash > 0;
    t.auto(8);
    // Nach dem Aufrichten heilt er weiter bis „gesund" (solange beide stehen bleiben)
    return { ok: miss && drop > .07 && drop < .11 && flash && A.hp === 1 && n.S.heal === A && n.Q && n.Q.type === 'heal',
      info: `daneben: −${drop.toFixed(3)}, danach hp ${A.hp}, heilt weiter: ${n.S.heal === A}` };
  });

  // 4) Zappeln
  await scen('Zappeln: Leiste füllt sich nur durch Drücken, voll → frei, Killer 2 s betäubt', () => {
    const t = window.__t, n = t.fresh(), S = n.S;
    S.x = 10.5; S.y = 11.5; n.ktp(10.5, 11.5); t.freeK();
    n.pickUp(S);
    n.K.act = { kind: 'look', t: 0, dur: 60, base: 0 };                 // bleibt stehen (sonst wäre der Haken zu nah)
    n.tick(.05); const kind = n.act && n.act.kind;
    for (let i = 0; i < 20; i++) { n.down(); n.up(); n.tick(.18); }
    const w1 = S.wiggle; n.tick(3); const w2 = S.wiggle;                 // sinkt nicht
    let presses = 20, tt = 20 * .18;
    while (S.carried && presses < 200) { n.down(); n.up(); n.tick(.18); presses++; tt += .18; }
    const ka = n.K.act;
    return { ok: kind === 'wiggle' && w1 > .25 && w2 === w1 && !S.carried && S.hp === 1 && S.burst > 0 && ka && ka.kind === 'stun' && ka.dur === 2 && !n.K.carry,
      info: `${presses} Drücke (≈ ${tt.toFixed(1)} s bei 5,5/s), Leiste nach Pause ${w1.toFixed(2)} → ${w2.toFixed(2)}, Killer: ${ka && ka.kind} ${ka && ka.dur} s` };
  });
  await scen('… Zappeln beim Aufhängen wirkt nicht mehr', () => {
    const t = window.__t, n = t.fresh(), S = n.S, h = n.hooks[0];
    n.ktp(h.front.x, h.front.y); t.freeK(); n.pickUp(S); S.wiggle = .99;
    n.K.act = { kind: 'hook', t: 0, dur: .9, sv: S, h };
    n.wiggle(S); n.wiggle(S);
    n.tick(1);
    return { ok: S.hung === h && S.hookN === 1, info: `hung=${!!S.hung}` };
  });
  await scen('Getragen: Zappel-Leiste (Bild)', () => {
    const t = window.__t, n = t.fresh(), S = n.S;
    S.x = 33.5; S.y = 12.5; n.ktp(33.5, 12.5); t.freeK(); n.pickUp(S);
    n.tick(1); for (let i = 0; i < 25; i++) { n.down(); n.up(); n.tick(.17); }
    return { ok: S.carried && S.wiggle > .3, info: `Leiste ${S.wiggle.toFixed(2)}` };
  });
  await shot('06-getragen-zappeln');

  // 5) Paletten-Stun beim Tragen
  await scen('Paletten-Stun beim Tragen: Killer lässt fallen und ist betäubt', () => {
    const t = window.__t, n = t.fresh(), S = n.S, A = n.SV[1], pal = n.pallets[0];
    n.ktp(pal.cx - pal.ax.x * .25, pal.cy - pal.ax.y * .25); t.freeK();
    n.pickUp(A);
    S.x = pal.cx + pal.ax.x * .8; S.y = pal.cy + pal.ax.y * .8;
    n.K.hunt.sv = A; n.K.hunt.t = 25; n.K.hunt.last = T;
    n.dropPallet(pal, S);
    const ka = n.K.act, freed = !A.carried && A.hp === 1 && !n.K.carry, dk = Math.hypot(A.x - n.K.x, A.y - n.K.y);
    n.tick(.5);
    window.__palletShot = true;
    return { ok: freed && ka && ka.kind === 'stun' && pal.state === 1 && dk < 1.2 && A.burst > 0, info: `frei: ${freed}, Killer ${ka && ka.kind}, Abstand ${dk.toFixed(2)}` };
  });
  await shot('07-palette-fallen-lassen');

  // 6) Dritter Haken
  await scen('3. Haken = sofort tot (2. startet bei ≥ 0,5)', () => {
    const t = window.__t, n = t.fresh(), S = n.S, A = n.SV[1], h = n.hooks[2];
    n.hookSurv(A, h); n.tick(3); const p1 = A.hookProg;
    A.x = h.front.x; A.y = h.front.y; A.ctl = null; n.unhookSurv(A, S);
    n.ktp(A.x, A.y); t.freeK(); n.pickUp(A); n.hookSurv(A, h); const p2 = A.hookProg;
    n.unhookSurv(A, S); n.pickUp(A); n.hookSurv(A, h);
    const dead = A.out === 'dead';
    S.x = h.front.x + 1.6; S.y = h.front.y + 1.2; t.idleK(); n.tick(1.1);
    return { ok: p1 > 0 && p1 < .1 && p2 >= .5 && A.hookN === 3 && dead, info: `1. Haken ${p1.toFixed(3)}, 2. Haken startet bei ${p2.toFixed(2)}, 3. Haken: ${A.out}` };
  });
  await shot('08-klauen-dritter-haken');

  // 7) Spind
  await scen('Spind öffnen mit Survivor darin → sofort getragen', () => {
    const t = window.__t, n = t.fresh(), S = n.S, L = n.lockers[2];
    S.x = L.front.x; S.y = L.front.y; n.hide(L, S); n.tick(.6);
    const hid = S.hidden === L;
    n.ktp(L.front.x, L.front.y + .1); t.freeK(); n.K.act = { kind: 'locker', t: 0, dur: .9, L };
    n.tick(.5);
    return { ok: hid && S.carried && n.K.carry === S && !S.hidden && S.hp === 0, info: `versteckt ${hid}, getragen ${S.carried}` };
  });

  // 8) Duo-Aufgabe
  await scen('Duo: allein kein Fortschritt („Warte auf Partner …")', () => {
    const t = window.__t, n = t.fresh(), S = n.S, duo = n.tasks.find(x => x.type === 'duo');
    const st = duo.stations[0]; S.x = st.ax; S.y = st.ay; n.tick(.05);
    const a = n.act, kind = a && a.kind, sta = a && a.st;
    n.down(); n.up(); n.tick(5);
    return { ok: kind === 'task' && a.o === duo && sta === 0 && S.work === duo && S.station === 0 && n.Q.type === 'duo' && duo.prog === 0,
      info: `Aktion ${kind} Station ${sta}, Fortschritt nach 5 s: ${duo.prog}` };
  });
  await shot('09-duo-warten');
  await scen('… zu zweit 20 s, Skill-Checks je Person, zählt 2 Punkte', () => {
    const t = window.__t, n = window.__ns, S = n.S, A = n.SV[1], duo = n.tasks.find(x => x.type === 'duo');
    const st = duo.stations[1];
    const taken = n.startWorkFor(A, duo, 0);                           // besetzt
    A.x = st.ax; A.y = st.ay;
    const ok2 = n.startWorkFor(A, duo, 1);
    A.ctl = (sv, dt) => n.workStep(sv, duo, dt, 1);
    t.auto(5); const p5 = duo.prog;
    window.__duoShot = true;
    return { ok: !taken && ok2 && p5 > .22 && p5 < .28, info: `Station 0 doppelt: ${taken}, A an Station 1: ${ok2}, nach 5 s ${p5.toFixed(3)}` };
  });
  await shot('10-duo-zu-zweit');
  await scen('… fertig nach 20 s', () => {
    const t = window.__t, n = window.__ns, duo = n.tasks.find(x => x.type === 'duo');
    t.auto(15.3);
    return { ok: duo.done && n.taskPoints() === 2 && !n.S.work && !n.SV[1].work && n.Q === null, info: `fertig ${duo.done}, Punkte ${n.taskPoints()}/${n.need}` };
  });
  await scen('… Bot verpasst Checks: −10 % und Lärm', () => {
    const t = window.__t, n = t.fresh(), [, A] = n.SV, g = n.tasks[0];
    A.x = g.ax; A.y = g.ay; n.startWorkFor(A, g); A.ctl = (sv, dt) => n.workStep(sv, g, dt, 0);
    const orig = window.noise; let loud = 0; window.noise = (x, y, R, l) => { if (l) loud++; return orig(x, y, R, l); };
    n.tick(4.6); window.noise = orig;
    const exp = 4.6 / 14;
    return { ok: g.prog < exp - .05 && loud > 0, info: `Fortschritt ${g.prog.toFixed(3)} statt ${exp.toFixed(3)}, laute Geräusche: ${loud}` };
  });

  // 9) 40-s-Regel
  await scen('40-s-Regel: Abbruch, Hinweis, Suche beim nächsten anderen Survivor', () => {
    const t = window.__t, n = t.fresh(), S = n.S, [, A, B] = n.SV;
    S.x = 34.5; S.y = 12.5; A.x = 10.5; A.y = 11.5; B.x = 3.5; B.y = 3.5;
    n.ktp(38.5, 12.5); n.K.dir = Math.PI; t.freeK();
    n.startChase(S);
    // Treffer setzen zurück, Paletten-Stuns nicht
    n.K.hunt.sv = S; n.K.hunt.t = 30; n.K.hunt.last = T; n.tick(.05);
    const pal = n.pallets[0]; const sx = S.x, sy = S.y, kx = n.K.x, ky = n.K.y;
    n.K.x = pal.cx - pal.ax.x * .25; n.K.y = pal.cy - pal.ax.y * .25; S.x = pal.cx + pal.ax.x * .8; S.y = pal.cy + pal.ax.y * .8;
    const h0 = n.K.hunt.t; n.dropPallet(pal, S); const hStun = n.K.hunt.t;
    n.K.act = null; n.K.x = kx; n.K.y = ky; S.x = sx; S.y = sy; pal.state = 0;
    n.hitSurvivor(S); const hHit = n.K.hunt.t; S.hp = 2; n.K.act = null; S.burst = 0;
    // jetzt kurz vor 40 s
    n.K.mode = 'chase'; n.K.target = S; n.K.hunt.sv = S; n.K.hunt.t = 39.8; n.K.hunt.last = T; n.K.seenT = 0;
    n.tick(.3);
    const ig = n.K.ignore, inv = n.K.inv;
    n.tick(.4); // Hinweis einblenden (für das Bild)
    const dA = inv ? Math.hypot(inv.x - A.x, inv.y - A.y) : 99;
    return { ok: hStun === h0 && hHit === 0 && ig && ig.sv === S && n.K.mode === 'investigate' && inv.kind === 'hunt' && dA <= 7.2,
      info: `Stun: ${h0}→${hStun}, Treffer → ${hHit}, ignoriert ${ig && ig.sv.name}, sucht ${dA.toFixed(1)} Kacheln neben ${A.name}, Hinweis „${toastMsg}"` };
  });
  await shot('11-vierzig-sekunden');
  await scen('… Ziel wird 20 s ignoriert (×0,2), außer näher als 2 Kacheln', () => {
    const t = window.__t, n = window.__ns, S = n.S;
    // Killer steht, S 5 Kacheln vor ihm, sichtbar
    const K = n.K; K.x = 30.5; K.y = 12.5; K.dir = 0; K.mode = 'patrol'; K.aware = 0; K.goal = { x: 30.5, y: 12.5 }; K.act = null;
    S.x = 35.5; S.y = 12.5; S.moving = false;
    const sees = n.killerSees(S);
    n.tick(.5); const aIgn = K.aware;
    K.aware = 0; S.x = 32.2; n.tick(.3); const aNear = K.aware;
    // nach Ablauf normal
    const T0 = K.ignore.until; K.ignore.until = 0; K.aware = 0; S.x = 35.5; K.mode = 'patrol'; K.goal = { x: 30.5, y: 12.5 }; n.tick(.5); const aNorm = K.aware;
    return { ok: sees && aIgn > 0 && aIgn < aNorm * .3 && aNear > aIgn * 2, info: `Aufmerksamkeit in 0,5 s: ignoriert ${aIgn.toFixed(3)}, normal ${aNorm.toFixed(3)}, nah (0,3 s) ${aNear.toFixed(3)}` };
  });
  await scen('… Hinweis nur für den eigenen Gejagten', () => {
    const t = window.__t, n = t.fresh(), S = n.S, A = n.SV[1];
    t.freeK(); toastMsg = null; n.startChase(A); n.giveUpChase(A);
    const other = toastMsg;
    n.startChase(S); n.giveUpChase(S);
    return { ok: other === null && toastMsg === 'Er hat genug von dir – er sucht die anderen!', info: `fremder Gejagter: ${other}, eigener: „${toastMsg}"` };
  });

  // 10) Team-Ende und Zuschauen
  await scen('Entkommen durchs offene Tor, Zuschauen mit Banner', () => {
    const t = window.__t, n = t.fresh(), S = n.S, g = n.gates[1];
    n.finish(); n.tick(3);
    S.x = g.x0 + 1; S.y = g.y - 1.6; n.keys.d = 1; t.until(() => !!S.out, 3); n.keys.d = 0;
    const esc = S.out === 'escaped'; n.tick(.5);
    window.__leaveY = S.y;
    return { ok: esc && n.viewer() === S && S.leave && S.leave.t > .3, info: `${S.out}, läuft hinaus (${S.leave && S.leave.t.toFixed(2)} s)` };
  });
  await shot('12a-lauf-durchs-tor');
  await scen('… danach Zuschauen mit Banner', () => {
    const t = window.__t, n = window.__ns, S = n.S;
    n.tick(1.4);
    const esc = S.out === 'escaped';
    const V = n.viewer(), bar = !document.querySelector('#specBar').hidden, txt = document.querySelector('#specText').textContent;
    const nextBtn = !document.querySelector('#specNext').hidden;
    return { ok: esc && V !== S && !V.out && bar && /entkommen/.test(txt) && nextBtn, info: `${S.out}, schaut ${V.name} zu, Banner „${txt}"` };
  });
  await shot('12-entkommen-zuschauen');
  await scen('… Wechseln, dann: niemand frei → die übrigen sterben → Endbildschirm', () => {
    const t = window.__t, n = window.__ns, S = n.S, [, A, B] = n.SV;
    const v1 = n.viewer(); document.querySelector('#specNext').click(); const v2 = n.viewer();
    n.hookSurv(A, n.hooks[0]); const aliveAfterHook = !A.out;
    B.hp = 1; n.downSurv(B);
    const both = A.out === 'dead' && B.out === 'dead';
    n.tick(3.2);
    const end = n.state === 'end', rows = [...document.querySelectorAll('#teamRes .tr')].map(r => r.querySelector('b').textContent + ':' + r.querySelector('i').textContent);
    return { ok: v1 !== v2 && aliveAfterHook && both && end && rows.length === 3 && /Entkommen/.test(rows[0]) && /Geopfert/.test(rows[1]) && /Geopfert/.test(rows[2]) && !document.querySelector('#teamRes').hidden,
      info: `Wechsel ${v1.name} → ${v2.name}; Ende: ${rows.join(', ')}` };
  });
  await shot('13-endbildschirm');
  await scen('Geopfert → „Ergebnis" beendet das Offline-Spiel', () => {
    const t = window.__t, n = t.fresh(), S = n.S;
    n.killSurv(S, 'bleed'); n.tick(3.2);
    const txt = document.querySelector('#specText').textContent;
    document.querySelector('#specEnd').click();
    const rows = [...document.querySelectorAll('#teamRes .tr i')].map(i => i.textContent);
    return { ok: /Geopfert/.test(txt) && n.state === 'end' && rows[0] === 'Geopfert' && rows[1] === 'Noch drin', info: `Banner „${txt}", Ergebnis: ${rows.join(', ')}` };
  });
  await scen('Nochmal startet wieder eine Team-Runde', () => {
    const n = window.__ns;
    document.querySelector('#again').click(); n.tick(.1);
    return { ok: n.state === 'play' && n.mode === 'team' && n.SV.length === 3 && n.SV.every(v => !v.out), info: `${n.state} ${n.mode}` };
  });

  // Team-HUD mit allen Zuständen
  await scen('Team-HUD (Bild): verletzt, am Haken (Kampfphase), am Boden mit Heilen', () => {
    const t = window.__t, n = t.fresh(), S = n.S, [, A, B] = n.SV, h = n.hooks[1];
    S.hp = 1; n.hookSurv(A, h); A.hookProg = .62;
    B.x = S.x + .9; B.y = S.y; B.hp = 1; n.downSurv(B); n.K.act = null; t.idleK();
    S.x = B.x + 1; n.tick(.05); n.down(); n.up(); t.auto(2.5);
    return { ok: !!A.hung && B.hp === 0 && B.healProg > 0, info: `A hängt ${A.hookProg.toFixed(2)}, B wird geheilt ${B.healProg.toFixed(2)}` };
  });
  await shot('14-team-hud');
  await scen('Kriechen am Boden (Bild)', () => {
    const t = window.__t, n = t.fresh(), S = n.S;
    S.x = 33.5; S.y = 12.5; S.hp = 1; n.downSurv(S); n.K.act = null;
    n.keys.l = 1; n.tick(.8); n.keys.l = 0;
    return { ok: S.hp === 0 && S.moving !== undefined, info: '' };
  });
  await shot('15-am-boden');

  // Dauerlauf mit freier Killer-KI: stehende Survivors werden gefunden, aufgehängt, das Spiel endet
  await scen('Dauerlauf: freie Killer-KI gegen 3 stehende Survivors bis zum Ende', () => {
    const t = window.__t, n = t.fresh(false), log = []; let last = '', tt = 0;
    while (n.state === 'play' && tt < 600) {
      n.tick(.5); tt += .5;
      const k = n.SV.map(v => v.out ? (v.out === 'dead' ? '†' : 'E') : v.hung ? 'H' : v.carried ? 'C' : v.hp).join('') + ' ' + n.K.mode;
      if (k !== last) { log.push(Math.round(tt) + 's ' + k); last = k; }
    }
    return { ok: n.state === 'end' && n.SV.every(v => v.out === 'dead'), info: log.join(' · ') };
  });

  // Porträts über die Schnittstelle des Skins-Agenten: skinPortrait(skin, size) liefert eine Data-URL
  await p.evaluate(() => {
    window.skinPortrait = (skin, size) => {
      const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
      x.fillStyle = { cop: '#22325f', medic: '#cf2a30', janitor: '#6b7a30' }[skin] || '#444'; x.beginPath(); x.arc(size / 2, size / 2, size / 2, 0, 7); x.fill();
      x.fillStyle = '#e9b793'; x.beginPath(); x.arc(size / 2, size * .45, size * .22, 0, 7); x.fill();
      return c.toDataURL('image/png');
    };
    for (const k in pimgs) delete pimgs[k];
    const n = window.__t.fresh(); n.SV[1].skin = 'medic'; n.SV[2].skin = 'janitor'; n.tick(.05);
  });
  await p.waitForTimeout(150);
  await scen('Porträts aus skinPortrait (Data-URL) im HUD und am Ende', () => {
    const n = window.__ns; n.tick(.05);
    const ok1 = Object.values(pimgs).every(im => im && im.complete && im.naturalWidth > 0);
    n.killSurv(n.S, 'bleed'); n.tick(3.2); document.querySelector('#specEnd').click();
    const imgs = document.querySelectorAll('#teamRes img').length;
    return { ok: ok1 && imgs === 3, info: `HUD-Bilder geladen: ${ok1}, Bilder am Ende: ${imgs}` };
  });
  await shot('16-portraits-ende');
  await p.evaluate(() => { delete window.skinPortrait; for (const k in pimgs) delete pimgs[k]; });

  }

  // Solo bleibt solo
  await scen('Solo: zweiter Treffer = Haken-Sequenz wie bisher', () => {
    const n = window.__ns; n.startGame(); n.tick(.1);
    n.S.hp = 1; n.hitSurvivor(n.S);
    return { ok: n.state === 'caught' && n.mode === 'solo', info: n.state };
  });
  // Auf jeder Karte: Wirft jemand eine Palette, während ein Teamkollege in der Lücke steht, wird der nicht eingeklemmt
  await scen(`[${MAP}] alle Paletten: Teamkollege in der Lücke wird herausgeschoben`, () => {
    const t = window.__t, n = t.fresh(), S = n.S, A = n.SV[1], bad = [];
    n.pallets.forEach((pal, i) => {
      pal.state = 0; S.act = null; A.act = null; A.hp = 2;
      S.x = pal.cx + pal.ax.x * .8; S.y = pal.cy + pal.ax.y * .8;
      A.x = pal.cx - pal.ax.x * .1; A.y = pal.cy - pal.ax.y * .1;
      n.dropPallet(pal, S); n.tick(.3);
      if (pal.state !== 1 || circleHit(A.x, A.y, A.r - .02) || circleHit(S.x, S.y, S.r - .02)) bad.push(i);
      pal.state = 0;
    });
    return { ok: !bad.length, info: `${n.pallets.length} Paletten, Probleme: ${bad.join(',') || 'keine'}` };
  });

  await b.close();
  const bad = results.filter(r => !r[1]);
  console.log('Fehler im Browser:', errs.length ? errs : 'keine');
  console.log(bad.length || errs.length ? `ERGEBNIS: ${bad.length} von ${results.length} FAIL` : `ERGEBNIS: alle ${results.length} PASS`);
  process.exit(bad.length || errs.length ? 1 : 0);
})();

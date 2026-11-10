'use strict';
/* Dead Mobile – Killer als Spieler (nur Team-Modus, KP = 'local' | 'remote').
   K.human = 'local': dieser Spieler steuert den Killer (Joystick/Tasten + Aktionsknopf), viewer() ist dann K.
   K.human = 'remote': ein Mitspieler steuert ihn; der Host übernimmt dessen Position und Aktionen (Sync.hostKiller).
   Die Zustandswechsel bleiben dieselben Funktionen wie bei der KI (hitSurvivor, pickUp, hookSurv … in js/rules.js).

   Aktionsknopf (killerAction → killerDo): Angriff (Ausfallschritt), solange ein Überlebender in Reichweite ist, sonst das
   Naheliegende: Liegenden aufheben, am Haken aufhängen, liegende Palette zerbrechen, durchs Fenster steigen,
   Spind öffnen, angefangene Aufgabe treten. Ohne alles: Angriff ins Leere.
   Jagd (für Musik, Zoom und Bots): hkAware setzt K.mode = 'chase' und K.target, sobald er jemanden vor sich sieht.
   Die 35-s-Regel und das Camping-Verbot der KI gelten für Menschen nicht; dafür läuft die Haken-Zeit nur halb so
   schnell, solange er in der Nähe des Hakens steht (teamStep in js/rules.js). */
let kActN = 0;
function kAct(o, ai = -1) { K.act = Object.assign(o, { t: 0, n: ++kActN, ai }); return K.act; }

/* Wen jagt er gerade? Der Nächste im Blickfeld (das laufende Ziel zählt 2 Kacheln näher); 3,5 s ohne Sicht = Jagd vorbei */
function hkAware(dt) {
  if (K.carry) { K.mode = 'carry'; K.target = null; K.focus = null; K.aware = 0; return; }
  let b = null, bd = 1e9;
  for (const v of SV) if (killerSees(v)) { const d = hyp(v.x - K.x, v.y - K.y) - (v === K.target ? 2 : 0); if (d < bd) { bd = d; b = v; } }
  K.focus = b;
  if (b && bd < 9) {
    if (K.mode !== 'chase') K.chaseT = 0;
    K.mode = 'chase'; K.target = b; K.seenT = T; K.lastSeen = { x: b.x, y: b.y }; K.lastContact = T; K.chaseT += dt;
  } else if (K.mode === 'chase') {
    if (T - K.seenT > 3.5 || !K.target || !isFree(K.target)) { K.mode = 'patrol'; K.target = null; }
  } else K.mode = 'patrol';
  K.aware = K.mode === 'chase' ? 1 : 0;
}
/* Getragener hängt am Killer; ohne freien Haken stirbt er sofort (wie bei der KI) */
function hkCarry(dt) {
  const sv = K.carry; if (!sv) return;
  K.carryT += dt; sv.x = K.x; sv.y = K.y; sv.mask = K.mask;
  if (!(K.act && K.act.kind === 'hook') && !hooks.some(h => !hookBusy(h))) killSurv(sv, 'mori');
}
function humanKiller(dt) {
  if (K.human === 'remote') { Sync.hostKiller(dt); return; }
  hkAware(dt);
  if (K.act) hkAct(dt); else hkMove(dt);
  hkCarry(dt);
  if (K.moving) { K.stepT -= dt; if (K.stepT <= 0) { K.stepT = K.mode === 'chase' ? .28 : .42; if (state === 'play') SFX.kstep(); } }
}
function hkMove(dt) {
  const inp = netPaused ? { mag: 0 } : readInput();
  if (inp.mag < .15) { K.moving = false; return; }
  everMoved = true;
  const spd = (K.carry ? CFG.carryV : CFG.hkSpeed) * (inp.walk || inp.mag < .62 ? .55 : 1);
  K.dir = turn(K.dir, Math.atan2(inp.y, inp.x), 16 * dt);
  const ox = K.x, oy = K.y;
  moveEnt(K, inp.x * spd * dt, inp.y * spd * dt);
  const md = hyp(K.x - ox, K.y - oy);
  K.moving = md > .0005; K.walk += md * 4.6;
}
/* Laufende Aktion. Ausfallschritt und Erholung lenkt der Spieler selbst, alles andere läuft wie bei der KI (runAct). */
function hkAct(dt) {
  const a = K.act;
  if (a.kind === 'lunge') {
    a.t += dt;
    const inp = netPaused ? { mag: 0 } : readInput();
    if (inp.mag > .3) K.dir = turn(K.dir, Math.atan2(inp.y, inp.x), CFG.lungeTurn * 2.4 * dt);
    const lv = a.t < CFG.lungeWind ? CFG.kChase * 1.05 : CFG.lungeV;
    moveEnt(K, Math.cos(K.dir) * lv * dt, Math.sin(K.dir) * lv * dt);
    K.moving = true; K.walk += dt * 12;
    if (lungeHit()) return;
    if (a.t >= a.dur) { SFX.whiff(); kAct({ kind: 'recover', dur: CFG.recover }); }
  } else if (a.kind === 'recover') {
    a.t += dt;
    const inp = netPaused ? { mag: 0 } : readInput();
    if (inp.mag > .15) { K.dir = turn(K.dir, Math.atan2(inp.y, inp.x), 6 * dt); moveEnt(K, inp.x * 1.3 * dt, inp.y * 1.3 * dt); K.moving = true; K.walk += dt * 5; } else K.moving = false;
    if (a.t >= a.dur) K.act = null;
  } else runAct(dt);
}
/* Trifft der Ausfallschritt jemanden? (auch für den Host, der den Killer eines Mitspielers nachführt) */
function lungeHit(pad = 0) {
  if (state !== 'play') return false;
  for (const v of SV) if (!v.hidden && !v.ghost && !v.out && !v.carried && !v.hung && v.hp > 0 && hyp(v.x - K.x, v.y - K.y) < CFG.hitR + pad && losClear(K.x, K.y, v.x, v.y)) { hitSurvivor(v); return true; }
  return false;
}

/* ================= Aktionsknopf ================= */
function killerAction() {
  if (K.act || state !== 'play') return null;
  if (K.carry) {
    let b = null, bd = 1.15;
    for (const h of hooks) { if (hookBusy(h)) continue; const d = hyp(K.x - h.front.x, K.y - h.front.y); if (d < bd) { bd = d; b = h; } }
    return b ? { kind: 'khook', o: b } : { kind: 'kcarry' };
  }
  // Angriff hat Vorrang, wenn jemand in Reichweite ist
  for (const v of SV) if (isFree(v) && !v.hidden && (v.mask & K.mask) && hyp(v.x - K.x, v.y - K.y) < CFG.hkReach) return { kind: 'attack', o: v };
  let best = null, bs = 1e9;
  const take = (kind, o, sc) => { if (sc < bs) { bs = sc; best = { kind, o }; } };
  for (const v of SV) if (isDowned(v)) { const d = hyp(v.x - K.x, v.y - K.y); if (d < 1.25) take('kpick', v, d - 1); }
  for (const p of pallets) {
    if (p.state !== 1) continue;
    const dx = K.x - p.cx, dy = K.y - p.cy; if (dx * dx + dy * dy > 4) continue;
    const al = dx * p.ax.x + dy * p.ax.y, lat = Math.abs(dx * p.ax.y - dy * p.ax.x);
    if (lat < .6 && Math.abs(al) > .3 && Math.abs(al) < 1.5) take('kbreak', p, Math.abs(al) - .6);
  }
  for (const w of windows) {
    const dx = K.x - w.cx, dy = K.y - w.cy; if (dx * dx + dy * dy > 4) continue;
    const al = dx * w.ax.x + dy * w.ax.y, lat = Math.abs(dx * w.ax.y - dy * w.ax.x);
    if (lat < .5 && Math.abs(al) > .35 && Math.abs(al) < 1.4) take('kvault', w, Math.abs(al) - .3);
  }
  for (const L of lockers) { const d = hyp(K.x - L.front.x, K.y - L.front.y); if (d < .8) take('klocker', L, d + .1); }
  for (const t of tasks) { if (t.done || t.prog <= .05 || isWorked(t)) continue; for (const s of t.stations || [t]) { const d = hyp(K.x - s.cx, K.y - s.cy); if (d < 1.4) take('kkick', t, d); } }
  return best || { kind: 'attack' };
}
function killerDo(a) {
  if (K.act || !a) return;
  const face = (x, y) => { K.dir = Math.atan2(y - K.y, x - K.x); K.moving = false; };
  switch (a.kind) {
    case 'attack': kAct({ kind: 'lunge', dur: CFG.lungeT }); SFX.whoosh(); break;
    case 'kpick': face(a.o.x, a.o.y); kAct({ kind: 'pick', dur: CFG.pickT, sv: a.o }, a.o.id); break;
    case 'khook': { const h = a.o; K.x = h.front.x; K.y = h.front.y; face(h.cx, h.cy); kAct({ kind: 'hook', dur: CFG.hookT, sv: K.carry, h }, hooks.indexOf(h)); break; }
    case 'kbreak': { const p = a.o; face(p.cx, p.cy); kAct({ kind: 'break', dur: CFG.kBreak, p }, pallets.indexOf(p)); break; }
    case 'kvault': {
      const w = a.o, s = Math.sign((K.x - w.cx) * w.ax.x + (K.y - w.cy) * w.ax.y) || 1;
      K.dir = Math.atan2(-w.ax.y * s, -w.ax.x * s);
      kAct({ kind: 'vault', dur: CFG.kVault, fx: K.x, fy: K.y, tx: w.cx - w.ax.x * s * .88, ty: w.cy - w.ax.y * s * .88 }, windows.indexOf(w)); break;
    }
    case 'klocker': face(a.o.cx, a.o.cy); kAct({ kind: 'locker', dur: .9, L: a.o }, lockers.indexOf(a.o)); break;
    case 'kkick': face(a.o.cx, a.o.cy); kAct({ kind: 'kick', dur: 1.1, task: a.o }, tasks.indexOf(a.o)); break;
  }
}

'use strict';
/* Dead Mobile – Team-Regeln (Phase 2): am Boden, Tragen, Haken, Retten, Heilen, Zappeln, Duo-Aufgabe,
   Killer-KI für mehrere Ziele (aufheben, tragen, aufhängen, kein Camping, 40-s-Regel), Team-Ende, Zuschauen.
   Alles hier wirkt nur mit MODE === 'team' (Solo und Tutorial bleiben unverändert).

   Zustandswechsel laufen nur über diese Funktionen (das Netz ruft sie später auf dem Host auf und verschickt sie):
     downSurv(sv) · pickUp(sv) · dropCarried(grund) · hookSurv(sv, h) · unhookSurv(sv, retter) · healDone(sv)
     escapeSurv(sv, tor) · killSurv(sv, wie) · teamCheckEnd()
   Effekte (Ton, Partikel, Shake, Flash) laufen getrennt über fx(art, sv, extra) → FX[art].
   Bildschirm-Effekte (Flash, Slow-Mo, starkes Shake) nur, wenn der eigene Survivor S betroffen ist.

   Schnittstelle für Bots (Phase 3) – aus sv.ctl(sv, dt) aufrufen, gilt für jeden Survivor, braucht keine QTE-Anzeige:
     startWorkFor(sv, t, station) / stopWorkFor(sv)   Aufgabe beginnen/abbrechen (Duo: station 0|1, -1/undefined = nächste freie)
     workStep(sv, t, dt, skill)    weiterarbeiten inkl. zufälliger Skill-Check-Fehler; Duo läuft nur zu zweit
     duoStation(t, sv)             freie Duo-Station, die sv am nächsten ist (-1 = keine)
     canHeal(a, b) / healStep(heiler, ziel, dt, skill)    heilen (mehrere Heiler addieren sich, Fortschritt bleibt)
     canUnhook(a, b) / unhookStep(retter, ziel, dt)       vom Haken retten (CFG.unhookT gedrückt halten)
     wiggle(sv, menge)             Zappeln, solange getragen (Standard: ein Tastendruck = 1/CFG.wiggleN)
     survSpeed(sv, rennen)         Tempo für goTo (am Boden: Kriechen). survMove kriecht am Boden von selbst.
     isFree(sv), isDowned(sv), hookBusy(h), workSpot(sv)
   skill = Trefferquote der Skill-Checks (0–1); daneben = −10 % Fortschritt und lauter Lärm.
   sv.ctl wird auch für Liegende, Getragene und Hängende aufgerufen (Kriechen, wiggle); Getragene/Hängende
   behalten aber die Position des Killers bzw. Hakens.

   Felder am Survivor: hp 2/1/0, carried, hung (Haken), out ('dead'|'escaped'), hookN (wie oft am Haken),
     hookProg (0–1, ab 0,5 Kampfphase), unhookProg, healProg, wiggle (0–1), heal (wen er heilt), unhook (wen er
     rettet), healedT/unhookT (zuletzt geheilt/gerettet), outT, leave (Lauf durchs Tor), spec (wem S zuschaut).
   Felder am Killer: carry, hookGoal, carryT, campUntil/campRoom (kein Camping), hunt {sv, t, last} (40-s-Regel),
     ignore {sv, until}. Zusätzliche K.mode: 'fetch' (geht zum Liegenden), 'carry' (trägt zum Haken). */

let deaths = [], teamEndAt = 0, teamRoster = null, endLock = false;
function teamReset() { deaths = []; teamEndAt = 0; endLock = false; specShown = ''; }

/* ================= Abfragen ================= */
const isFree = sv => inPlay(sv) && sv.hp > 0 && !sv.carried && !sv.hung;
const isDowned = sv => inPlay(sv) && sv.hp <= 0 && !sv.carried && !sv.hung;
const hookBusy = h => SV.some(v => v.hung === h);
const kIgnores = sv => !!(K.ignore && K.ignore.sv === sv && T < K.ignore.until);
const roomAt = (x, y) => room[I(clamp(x | 0, 0, W - 1), clamp(y | 0, 0, H - 1))];
const campBlock = (x, y) => T < K.campUntil && K.campRoom > 0 && roomAt(x, y) === K.campRoom;
const survSpeed = (sv, run) => sv.hp <= 0 ? CFG.crawl : sv.burst > 0 ? CFG.sBurst : run ? CFG.sRun : CFG.sWalk;
const workSpot = sv => sv.work && sv.work.stations ? sv.work.stations[sv.station] : sv.work;
const duoBoth = t => SV.some(v => v.work === t && v.station === 0) && SV.some(v => v.work === t && v.station === 1);
const canHeal = (a, b) => a !== b && isFree(a) && !a.hidden && !a.act && inPlay(b) && b.hp < 2 && !b.carried && !b.hung && !b.hidden
  && hyp(a.x - b.x, a.y - b.y) < CFG.healR;
const canUnhook = (a, b) => a !== b && isFree(a) && !a.hidden && !a.act && !!b.hung && !b.out
  && hyp(a.x - b.hung.front.x, a.y - b.hung.front.y) < CFG.unhookR;
/* Aufmerksamkeit des Killers: ignoriertes Ziel (40-s-Regel) und Haken-Raum kurz nach dem Aufhängen ×0,2 */
function awareMul(sv, d) {
  let m = 1;
  if (kIgnores(sv) && d >= CFG.ignoreNear) m *= .2;
  if (T < K.campUntil && K.campRoom && (sv.mask & (1 << K.campRoom))) m *= .2;
  return m;
}

/* ================= Effekte (nur Darstellung/Ton – übers Netz verschickbar) ================= */
function blood(x, y, z, n, sp = 2.5) { for (let i = 0; i < n; i++) parts.push({ x, y, z, vx: rand(-sp, sp), vy: rand(-1.5, 1.5), vz: rand(.5, 3), g: 9, life: rand(.5, 1), max: 1, col: '150,10,18', sz: .06, splat: 1 }); }
function puff(x, y, z, n, col, up = 1) { for (let i = 0; i < n; i++) parts.push({ x: x + rand(-.3, .3), y: y + rand(-.15, .15), z: z + rand(0, .6), vx: rand(-.5, .5), vy: rand(-.3, .3), vz: rand(.4, 1.6) * up, g: -.4, life: rand(.6, 1.2), max: 1.2, col, sz: rand(.06, .12), fade: 1 }); }
const FX = {
  down(sv) { SFX.hit(); SFX.gasp(); blood(sv.x, sv.y, .6, 28); if (sv === S) { flash = .85; flashCol = '195,18,31'; shake(.6); slowT = .2; } else shake(.15); },
  pick(sv) { SFX.gasp(); SFX.kick(); if (sv === S) shake(.35); },
  hook(sv, h) { SFX.clang(); SFX.scream(); blood(h.cx + .3, h.cy + .1, 1.3, 26, 2); if (sv === S) { shake(.8); flash = .8; flashCol = '195,18,31'; } else shake(.2); },
  stage(sv, h) { SFX.scream(); blood(h.cx + .3, h.cy + .1, 1.2, 12, 1.5); if (sv === S) { shake(.4); flash = .45; flashCol = '195,18,31'; } },
  unhook(sv, h) { SFX.clang(); SFX.gasp(); blood(h.cx + .3, h.cy + .1, 1.1, 12, 1.5); if (sv === S) shake(.35); },
  heal(sv) { SFX.great(); SFX.chirp(); for (let i = 0; i < 18; i++) parts.push({ x: sv.x + rand(-.3, .3), y: sv.y + rand(-.1, .1), z: rand(.2, 1.2), vx: rand(-.3, .3), vy: rand(-.2, .2), vz: rand(.6, 1.6), g: -.2, life: rand(.6, 1.1), max: 1.1, col: '125,255,160', sz: .05, fade: 1 }); },
  free(sv, why) { SFX.gasp(); if (why === 'wiggle') SFX.stun(); if (sv === S) shake(.45); },
  death(sv, d) { SFX.scream(); SFX.hit(); blood(d.x, d.y, d.how === 'hook' ? 1.3 : .4, 34, 2.5); if (sv === S) { flash = 1; flashCol = '195,18,31'; shake(.7); slowT = .3; } else shake(.25); },
  vanish(sv, d) { puff(d.how === 'hook' ? d.h.cx + .3 : d.x, d.how === 'hook' ? d.h.cy + .3 : d.y, d.how === 'hook' ? .8 : .1, 26, '20,14,16'); },
  escape(sv) { if (sv === S) SFX.win(); else SFX.chirp(); },
  fail(sv, o) {
    if (o.kind === 'heal') { SFX.gasp(); SFX.bang(); } else SFX.spark();
    for (let i = 0; i < 24; i++) parts.push({ x: o.x, y: o.y, z: .5, vx: rand(-3, 3), vy: rand(-2, 2), vz: rand(1, 4), g: 9, life: rand(.3, .8), max: .8, col: o.kind === 'heal' ? '150,10,18' : '255,200,90', sz: .05 });
    if (sv === S) { shake(.4); S.flinch = .45; flash = .35; flashCol = '255,120,40'; eyeT = T; }
  },
};
function fx(kind, sv, o) { const f = FX[kind]; if (f) f(sv, o); }

/* ================= Zustandswechsel ================= */
function clearInteract(sv) { if (sv.work) stopWorkFor(sv); if (sv.heal) stopHeal(sv); sv.unhook = null; }
function leaveLocker(sv) { if (sv.hidden) { sv.x = sv.hidden.front.x; sv.y = sv.hidden.front.y; sv.hidden.known = false; sv.hidden = null; } }
/* Zweiter Treffer: am Boden. Der Killer wischt die Klinge ab und holt ihn dann (Vorrang). */
function downSurv(sv) {
  if (!inPlay(sv) || sv.hp <= 0 || sv.carried || sv.hung) return;
  clearInteract(sv); leaveLocker(sv);
  if (sv.act && sv.act.kind !== 'vault') { sv.act = null; sv.z = 0; resolve(sv); }
  sv.hp = 0; sv.healProg = 0; sv.burst = 0; sv.running = false; sv.flinch = .4;
  K.act = { kind: 'wipe', t: 0, dur: CFG.wipe }; K.mode = 'fetch'; K.target = null; K.path = null; K.goal = null;
  K.aware = 0; K.blood = 0; K.chaseT = 0; K.hunt.t = 0; K.seenT = T; K.lastSeen = { x: sv.x, y: sv.y };
  fx('down', sv);
  teamCheckEnd();
}
/* Der Killer nimmt sv auf die Schulter (nach 1 s Aufheben oder sofort aus dem Spind) */
function pickUp(sv) {
  if (!inPlay(sv) || sv.carried || sv.hung) return;
  clearInteract(sv); leaveLocker(sv);
  sv.act = null; sv.z = 0; sv.hp = 0; sv.carried = true; sv.wiggle = 0; sv.healProg = 0; sv.burst = 0; sv.moving = sv.running = false;
  K.carry = sv; K.mode = 'carry'; K.carryT = 0; K.target = null; K.aware = 0; K.path = null; K.goal = null;
  K.hookGoal = nearestFreeHook();
  sv.x = K.x; sv.y = K.y; sv.mask = K.mask;
  fx('pick', sv);
}
/* Getragener kommt frei: 'wiggle' (Leiste voll → Killer 2 s betäubt) oder 'pallet' (Paletten-Stun, Betäubung setzt dropPallet) */
function dropCarried(why) {
  const sv = K.carry; if (!sv) return;
  K.carry = null; K.hookGoal = null;
  sv.carried = false; sv.hp = 1; sv.healProg = 0; sv.wiggle = 0; sv.burst = CFG.wiggleBurst; sv.flinch = .3;
  placeBeside(sv);
  if (why === 'wiggle') K.act = { kind: 'stun', t: 0, dur: CFG.wiggleStun };
  // Nach der Betäubung jagt er den Entkommenen weiter
  K.mode = 'chase'; K.target = sv; K.aware = 1; K.seenT = T; K.lastSeen = { x: sv.x, y: sv.y }; K.trailT = T; K.chaseT = 0; K.path = null; K.goal = null;
  fx('free', sv, why);
  if (sv === S) toast(why === 'wiggle' ? 'Losgerissen – lauf!' : 'Er hat dich fallen lassen – lauf!');
}
function placeBeside(sv) {
  for (const off of [Math.PI / 2, -Math.PI / 2, Math.PI, 0]) {
    const a = K.dir + off, x = K.x + Math.cos(a) * .7, y = K.y + Math.sin(a) * .7;
    if (!circleHit(x, y, sv.r) && losClear(K.x, K.y, x, y)) { sv.x = x; sv.y = y; sv.dir = a; sv.mask = mask[I(x | 0, y | 0)] || sv.mask; return; }
  }
  sv.x = K.x; sv.y = K.y; resolve(sv);
}
/* Aufhängen: 1. Mal ab 0, 2. Mal ab mindestens 0,5 (Kampfphase), 3. Mal sofort tot */
function hookSurv(sv, h) {
  if (K.carry === sv) { K.carry = null; K.hookGoal = null; }
  sv.carried = false; sv.hookN++; sv.hung = h; sv.unhookProg = 0; sv.wiggle = 0; sv.moving = sv.running = false;
  sv.x = h.front.x; sv.y = h.front.y; sv.mask = mask[I(sv.x | 0, sv.y | 0)] || sv.mask;
  // Kein Camping: mindestens CFG.antiCamp s in anderen Räumen suchen
  K.campUntil = T + CFG.antiCamp; K.campRoom = roomAt(h.front.x, h.front.y); K.mode = 'patrol'; K.goal = null; K.path = null; K.aware = 0; K.target = null;
  fx('hook', sv, h);
  if (sv.hookN >= 3) { killSurv(sv, 'hook'); return; }
  sv.hookProg = sv.hookN === 1 ? 0 : Math.max(.5, sv.hookProg);
  if (sv === S) toast(sv.hookN === 1 ? 'Am Haken! Deine Freunde können dich retten.' : 'Wieder am Haken – beim nächsten Mal ist es vorbei!');
  teamCheckEnd();
}
function unhookSurv(sv, by) {
  if (!sv.hung || sv.out) return;
  const h = sv.hung;
  sv.hung = null; sv.hp = 1; sv.healProg = 0; sv.unhookProg = 0; sv.burst = CFG.unhookBurst;
  sv.x = h.front.x; sv.y = h.front.y + .05; resolve(sv); sv.dir = Math.atan2(sv.y - h.cy, sv.x - h.cx);
  if (by) { by.unhook = null; if (by === S) stats.rescues++; }
  fx('unhook', sv, h);
  if (sv === S) toast('Gerettet – lauf!');
}
function healDone(sv) {
  sv.hp = Math.min(2, sv.hp + 1); sv.healProg = 0;
  fx('heal', sv);
  if (sv === S) toast(sv.hp >= 2 ? 'Wieder gesund!' : 'Du stehst wieder – lauf!');
}
/* Geopfert: wie = 'hook' (am Haken), 'bleed' (am Boden, niemand mehr frei), 'mori' (kein freier Haken) */
function killSurv(sv, how) {
  if (sv.out) return;
  clearInteract(sv);
  if (K.carry === sv) { K.carry = null; K.hookGoal = null; if (K.mode === 'carry') K.mode = 'patrol'; }
  sv.carried = false; sv.out = 'dead'; sv.outT = T; sv.hp = 0; sv.moving = sv.running = false; sv.leave = null; sv.unhookProg = 0;
  const h = sv.hung || { cx: sv.x - .3, cy: sv.y - .95 }, d = { sv, h, how, t0: T, x: sv.x, y: sv.y, dir: sv.dir };
  deaths.push(d);
  fx('death', sv, d);
  teamCheckEnd();
}
function escapeSurv(sv, g) {
  if (sv.out) return;
  clearInteract(sv);
  sv.out = 'escaped'; sv.outT = T; sv.act = null; sv.z = 0; sv.leave = { g, t: 0 };
  fx('escape', sv);
  teamCheckEnd();
}
/* Niemand mehr frei und der Killer trägt niemanden → die übrigen sterben. Niemand mehr im Spiel → Ende. */
function teamCheckEnd() {
  if (state !== 'play' || MODE !== 'team' || endLock) return;
  endLock = true;
  if (SV.some(inPlay) && !SV.some(isFree) && !K.carry) for (const v of SV) if (inPlay(v)) killSurv(v, v.hung ? 'hook' : 'bleed');
  endLock = false;
  if (!SV.some(inPlay) && !teamEndAt) teamEndAt = T + 2.8;
}

/* ================= Handlungen (für jeden Survivor) ================= */
function stopHeal(sv) { sv.heal = null; if (sv === S && Q && Q.type === 'heal') Q = null; }
function startHeal(sv, target) {
  if (!canHeal(sv, target)) return false;
  clearInteract(sv);
  sv.heal = target; sv.healAt = T; sv.dir = Math.atan2(target.y - sv.y, target.x - sv.x);
  if (sv === S) { Q = newCheckQTE('heal', target); SFX.chirp(); }
  return true;
}
/* Heilen: dt Sekunden an target arbeiten. skill = Trefferquote der Bots (null = eigener Spieler, Checks übers QTE). */
function healStep(healer, target, dt, skill = CFG.botSkill) {
  if (!canHeal(healer, target)) { if (healer.heal === target) stopHeal(healer); return false; }
  healer.heal = target; healer.healAt = T; target.healedT = T;
  healer.moving = healer.running = false; healer.dir = Math.atan2(target.y - healer.y, target.x - healer.x);
  target.healProg = Math.min(1, target.healProg + dt / (target.hp >= 1 ? CFG.healInj : CFG.healDown));
  if (healer !== S && skill != null) botCheck(healer, dt, skill, () => healFail(healer, target));
  if (target.healProg >= 1) { if (healer === S) { stats.heals++; qteSeen.add('heal'); } healDone(target); }
  return true;
}
function healFail(sv, target) {
  target.healProg = Math.max(0, target.healProg - .1);
  noise(sv.x, sv.y, 99, true);
  if (sv === S) { stats.fails++; if (Q) { Q.lock = .7; Q.flash = .6; } }
  fx('fail', sv, { x: (sv.x + target.x) / 2, y: (sv.y + target.y) / 2, kind: 'heal' });
}
function startUnhook(sv, target) { if (!canUnhook(sv, target)) return false; clearInteract(sv); sv.unhook = target; sv.unhookAt = T; return true; }
/* Retten: dt Sekunden am Haken halten; nach CFG.unhookT ist target frei (verletzt, kurzer Sprint) */
function unhookStep(sv, target, dt) {
  if (!canUnhook(sv, target)) { if (sv.unhook === target) sv.unhook = null; return false; }
  sv.unhook = target; sv.unhookAt = T; target.unhookT = T;
  sv.moving = sv.running = false; sv.dir = Math.atan2(target.hung.cy - sv.y, target.hung.cx + .3 - sv.x);
  target.unhookProg = Math.min(1, target.unhookProg + dt / CFG.unhookT);
  if (target.unhookProg >= 1) unhookSurv(target, sv);
  return true;
}
/* Zappeln: jeder Druck füllt die Leiste, sie sinkt nicht von selbst. Beim Aufhängen geht es nicht mehr. */
function wiggle(sv, amount = 1 / CFG.wiggleN) {
  if (!sv.carried || K.carry !== sv || (K.act && K.act.kind === 'hook')) return false;
  sv.wiggle = Math.min(1, sv.wiggle + amount); sv.wigT = T;
  if (sv.wiggle >= 1) dropCarried('wiggle');
  return true;
}
function duoStation(t, sv) {
  let b = -1, bd = 1e9;
  for (let k = 0; k < 2; k++) {
    if (SV.some(v => v !== sv && v.work === t && v.station === k)) continue;
    const s = t.stations[k], d = hyp(sv.x - s.ax, sv.y - s.ay); if (d < bd) { bd = d; b = k; }
  }
  return b;
}
function startWorkFor(sv, t, station) {
  if (!t || t.done || !isFree(sv) || sv.hidden) return false;
  if (t.type === 'duo') {
    if (station == null || station < 0) station = duoStation(t, sv);
    if (station < 0 || SV.some(v => v !== sv && v.work === t && v.station === station)) return false;
    sv.station = station;
  } else if (SV.some(v => v !== sv && v.work === t)) return false;
  if (sv.heal) stopHeal(sv); sv.unhook = null;
  if (sv === S) startWork(t); else { sv.work = t; sv.chkT = rand(2, 4.5); }
  const p = workSpot(sv); sv.dir = Math.atan2(p.cy - sv.y, p.cx - sv.x);
  return true;
}
function stopWorkFor(sv) { if (sv === S) stopWork(); else sv.work = null; }
/* Bots: an Aufgabe t weiterarbeiten (vorher startWorkFor). Normale Aufgaben brauchen CFG.genTime s, Duo läuft zentral
   (teamStep) nur bei zwei Besetzern. Liefert den Fortschritt. Für den eigenen Spieler übernimmt das QTE. */
function workStep(sv, t, dt, skill = CFG.botSkill) {
  if (sv.work !== t || t.done) return t.done ? 1 : t.prog;
  const duo = t.type === 'duo', p = workSpot(sv);
  sv.moving = sv.running = false; sv.dir = Math.atan2(p.cy - sv.y, p.cx - sv.x);
  if (!duo) t.prog = Math.min(1, t.prog + dt / CFG.genTime);
  if (sv !== S && (!duo || duoBoth(t))) botCheck(sv, dt, skill, () => taskFail(sv, t));
  if (!duo && t.prog >= 1) complete(t, sv);
  return t.prog;
}
function taskFail(sv, t) {
  t.prog = Math.max(0, t.prog - .1);
  const p = sv.work === t ? workSpot(sv) : t;
  noise(p.cx, p.cy, 99, true);
  if (sv === S) { stats.fails++; if (Q) { Q.lock = .7; Q.flash = .6; } }
  fx('fail', sv, { x: p.cx, y: p.cy, kind: t.type });
}
/* Zufällige Skill-Checks der Bots: alle 2,2–4,5 s einer, daneben mit Wahrscheinlichkeit 1 − skill */
function botCheck(sv, dt, skill, onFail) {
  if (sv.chkT == null) sv.chkT = rand(2, 4.5);
  sv.chkT -= dt;
  if (sv.chkT <= 0) { sv.chkT = rand(2.2, 4.5); if (Math.random() > skill) onFail(); }
}

/* ================= Eigener Survivor (Eingabe) ================= */
/* Sonderzustände im Team. Liefert true, wenn updateSurv nichts mehr tun soll. */
function teamSurv(sv, dt) {
  if (sv.out) { sv.moving = sv.running = false; return true; }
  if (sv.carried || sv.hung) { survTick(sv, dt); sv.moving = sv.running = false; return true; }
  if (sv.hp <= 0) {
    survTick(sv, dt);
    sv.breathT -= dt; if (sv.breathT <= 0) { sv.breathT = rand(1.8, 3.2); SFX.breath(); }
    if (sv.act) { survAct(sv, dt); return true; }
    const inp = readInput();
    if (inp.mag < .15) sv.moving = sv.running = false; else { everMoved = true; survMove(sv, inp, dt); }
    return true;
  }
  if (sv.unhook) { if (actHeld && unhookStep(sv, sv.unhook, dt)) { survTick(sv, dt); return true; } sv.unhook = null; }
  if (sv.heal) { if (readInput().mag <= .4 && healStep(sv, sv.heal, dt, null)) { survTick(sv, dt); return true; } stopHeal(sv); }
  return false;
}
/* Aktionsknopf im Team: undefined = normale Aktionen prüfen */
function teamActionPre() {
  if (S.out || S.hung || (S.hp <= 0 && !S.carried)) return null;
  if (S.carried) return K.carry === S ? { kind: 'wiggle' } : null;
  if (S.unhook) return { kind: 'unhooking', o: S.unhook };
  if (S.heal) return { kind: 'healing', o: S.heal };
  return undefined;
}
function teamActions(take) {
  for (const t of tasks) if (t.type === 'duo' && !t.done) for (let k = 0; k < 2; k++) {
    if (SV.some(v => v.work === t && v.station === k)) continue;
    const s = t.stations[k], d = hyp(S.x - s.cx, S.y - s.cy);
    if (d < 1.35) take('task', t, d - .2, k);
  }
  for (const v of SV) {
    if (canUnhook(S, v)) take('rescue', v, hyp(S.x - v.hung.front.x, S.y - v.hung.front.y) - .8);
    else if (canHeal(S, v)) take('heal', v, hyp(S.x - v.x, S.y - v.y) - .1);
  }
}

/* ================= Killer: aufheben, tragen, aufhängen ================= */
function nearestDowned() { let b = null, bd = 1e9; for (const v of SV) if (isDowned(v)) { const d = hyp(v.x - K.x, v.y - K.y); if (d < bd) { bd = d; b = v; } } return b; }
function nearestFreeHook() {
  let b = null, bl = 1e9;
  for (const h of hooks) { if (hookBusy(h)) continue; const p = findPath(K.x | 0, K.y | 0, h.front.x | 0, h.front.y | 0); const l = p ? p.length : 1e6 + hyp(h.cx - K.x, h.cy - K.y); if (l < bl) { bl = l; b = h; } }
  return b;
}
/* Team-Teil der Killer-KI. Liefert true, wenn updateKiller nichts mehr tun soll. */
function killerTeam(dt) {
  if (K.carry) {
    const sv = K.carry; K.carryT += dt;
    if (K.act) runAct(dt); else carryStep(dt);
    if (K.carry === sv) { sv.x = K.x; sv.y = K.y; sv.mask = K.mask; }
    return true;
  }
  if (K.act && (K.act.kind === 'pick' || K.act.kind === 'hook')) { runAct(dt); return true; }
  const dn = nearestDowned();
  if (!dn) { if (K.mode === 'fetch' || K.mode === 'carry') { K.mode = 'patrol'; K.goal = null; K.path = null; } return false; }
  K.mode = 'fetch';
  if (K.act) { runAct(dt); return true; }
  // Steht jemand direkt vor ihm (z. B. ein Heiler), schlägt er erst zu
  for (const v of SV) if (isFree(v) && !v.hidden && killerSees(v) && hyp(v.x - K.x, v.y - K.y) < CFG.lungeAt && lineWalk(K.x, K.y, v.x, v.y, .22)) {
    K.target = v; K.act = { kind: 'lunge', t: 0, dur: CFG.lungeT }; SFX.whoosh(); return true;
  }
  if (hyp(dn.x - K.x, dn.y - K.y) < .8) { K.dir = Math.atan2(dn.y - K.y, dn.x - K.x); K.moving = false; K.act = { kind: 'pick', t: 0, dur: CFG.pickT, sv: dn }; return true; }
  goTo(K, dn.x, dn.y, CFG.kChase, dt);
  return true;
}
function carryStep(dt) {
  let h = K.hookGoal;
  if (!h || hookBusy(h)) h = K.hookGoal = nearestFreeHook();
  if (!h) { killSurv(K.carry, 'mori'); K.mode = 'patrol'; return; }
  const arrived = goTo(K, h.front.x, h.front.y, CFG.carryV, dt);
  if ((arrived && hyp(h.front.x - K.x, h.front.y - K.y) < .5) || K.carryT > 45) {
    K.x = h.front.x; K.y = h.front.y; K.moving = false; K.dir = Math.atan2(h.cy - K.y, h.cx - K.x);
    K.act = { kind: 'hook', t: 0, dur: CFG.hookT, sv: K.carry, h };
  }
}
/* 40-s-Regel (Paletten-Stuns zählen weiter, Treffer setzen zurück) und Ende der Jagd, wenn das Ziel nicht mehr frei ist.
   Liefert true, wenn er gerade abgebrochen hat. */
function huntTick(dt) {
  if (K.mode !== 'chase') return false;
  const tg = K.target;
  if (!tg || !isFree(tg)) { K.mode = 'patrol'; K.goal = null; K.path = null; K.aware = 0; K.target = null; return false; }
  const h = K.hunt;
  if (h.sv !== tg || T - h.last > 15) { h.sv = tg; h.t = 0; }
  h.t += dt; h.last = T;
  if (h.t > CFG.loopDrop) { giveUpChase(tg); return true; }
  return false;
}
function giveUpChase(sv) {
  K.ignore = { sv, until: T + CFG.ignoreT };
  K.hunt.sv = null; K.hunt.t = 0;
  K.aware = 0; K.blood = 0; K.breakP = null; K.target = null; pallets.forEach(p => p.loopT = 0);
  if (K.act && ['look', 'kick', 'locker', 'recover'].includes(K.act.kind)) K.act = null;
  let o = null, od = 1e9;
  for (const v of SV) if (v !== sv && isFree(v)) { const d = hyp(v.x - K.x, v.y - K.y); if (d < od) { od = d; o = v; } }
  if (o) { const p = pointNear(o, 5); investigate(p.x, p.y, 'hunt'); }
  else { K.mode = 'patrol'; K.goal = null; K.path = null; }
  if (sv === S) toast('Er hat genug von dir – er sucht die anderen!');
}
/* Zufälliger begehbarer Punkt bis ±R Kacheln um o, möglichst in seinem Raum (ungenaue Suche) */
function pointNear(o, R) {
  const r = roomAt(o.x, o.y);
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(o.x + rand(-R, R)), y = Math.floor(o.y + rand(-R, R));
    if (kc(x, y) === 1 && !circleHit(x + .5, y + .5, K.r) && (i > 20 || !r || room[I(x, y)] === r)) return { x: x + .5, y: y + .5 };
  }
  return { x: o.x, y: o.y };
}

/* ================= Welt-Update (nach dem Killer) ================= */
function teamStep(dt) {
  for (const sv of SV) {
    if (sv.hung && !sv.out) {
      const was = sv.hookProg;
      sv.hookProg = Math.min(1, sv.hookProg + dt / (2 * CFG.hookStage));
      if (was < .5 && sv.hookProg >= .5) fx('stage', sv, sv.hung);
      if (T - sv.unhookT > .12) sv.unhookProg = 0;          // niemand rettet gerade
      if (sv.hookProg >= 1) killSurv(sv, 'hook');
    }
    if (sv !== S) { if (sv.heal && T - sv.healAt > .15) sv.heal = null; if (sv.unhook && T - sv.unhookAt > .15) sv.unhook = null; }
    if (sv.leave) {
      const L = sv.leave, dir = L.g.north ? -1 : 1; L.t += dt;
      if (L.t < 2) { sv.dir = dir * Math.PI / 2; sv.moving = sv.running = true; sv.walk += dt * 20; sv.y += dir * 2.6 * dt; }
    }
  }
  // Duo-Aufgabe: läuft nur, wenn beide Stationen besetzt sind
  for (const t of tasks) if (t.type === 'duo' && !t.done && duoBoth(t)) {
    t.prog = Math.min(1, t.prog + dt / CFG.duoTime);
    if (t.prog >= 1) complete(t, SV.find(v => v.work === t) || S);
  }
  // Tote verschwinden nach den Klauen
  for (const d of deaths) if (!d.gone && T - d.t0 > 2.4) { d.gone = true; if (d.sv.hung === d.h) d.sv.hung = null; fx('vanish', d.sv, d); }
  teamCheckEnd();
  if (teamEndAt && T >= teamEndAt) { teamEndAt = 0; showTeamEnd(); return; }
  specUI();
}

/* ================= Zuschauen und Ende ================= */
let specShown = '';
function specUI() {
  const on = state === 'play' && S && !!S.out && T - S.outT >= specDelay() && SV.some(inPlay);
  const V = viewer(), others = SV.filter(v => v !== S && inPlay(v)).length;
  const key = on ? S.out + '|' + V.name + '|' + others : '';
  if (key === specShown) return;
  specShown = key;
  $('#specBar').hidden = !on;
  if (!on) return;
  $('#specText').textContent = S.out === 'escaped' ? 'Du bist entkommen – du schaust zu' : 'Geopfert – du schaust zu';
  $('#specWho').textContent = V !== S ? V.name : '';
  $('#specNext').hidden = others < 2;
}
function specNext() {
  const a = SV.filter(v => v !== S && inPlay(v)); if (!a.length) return;
  S.spec = a[(a.indexOf(viewer()) + 1) % a.length]; specShown = '';
}
/* „Ergebnis"-Knopf beim Zuschauen: offline sofort zum Endbildschirm. Das Netz (Phase 3) kann teamGiveUp überschreiben. */
function teamGiveUp() { if (MODE !== 'team' || state !== 'play') return; showTeamEnd(); }
const RES_TXT = { escaped: 'Entkommen', dead: 'Geopfert' };
const SLOT_COL = ['#5b86d8', '#d8584f', '#a3b04a'];
/* Ersatz-Porträt ohne skinPortrait: Nummer („Überlebender 2") oder Anfangsbuchstabe */
const initial = sv => { const nm = sv.name || '?'; return /\d$/.test(nm) ? nm.slice(-1) : nm[0].toUpperCase(); };
/* Porträt als Bild-URL (skinPortrait aus js/figures.js, falls vorhanden) */
function portraitURL(skin, size) {
  if (typeof skinPortrait !== 'function') return null;
  try { const p = skinPortrait(skin, size); return typeof p === 'string' ? p : p && p.toDataURL ? p.toDataURL() : null; } catch (e) { return null; }
}
function showTeamEnd() {
  if (state === 'end') return;
  teamEndAt = 0; stats.end = T;
  const won = S.out === 'escaped';
  if (won) { save.wins++; persist(); }
  const esc = SV.filter(v => v.out === 'escaped').length;
  showEnd(won, Math.min(stats.heals, 3) * 3 + Math.min(stats.rescues, 2) * 5 + esc * 3);
  $('#sgrid').insertAdjacentHTML('beforeend', `<div>Heals<b>${stats.heals}</b></div><div>Rescues<b>${stats.rescues}</b></div>`);
  $('#teamRes').innerHTML = SV.map((sv, i) => {
    const res = sv.out || 'alive', url = portraitURL(sv.skin, 104);
    const pic = url ? `<img src="${url}" alt="">` : `<span style="background:${SLOT_COL[i % 3]}">${initial(sv)}</span>`;
    return `<div class="tr ${res}${sv === S ? ' me' : ''}"><div class="tp">${pic}</div><b>${sv.name}</b><i>${RES_TXT[res] || 'Noch drin'}</i></div>`;
  }).join('');
  $('#teamRes').hidden = false; $('#specBar').hidden = true; specShown = '';
}
/* Nochmal: Team-Runde mit derselben Aufstellung, sonst Solo */
function againPressed() { if (MODE === 'team') startTeam(MAPID, teamRoster); else startGame(); }
$('#specEnd').addEventListener('click', () => teamGiveUp());
$('#specNext').addEventListener('click', specNext);

/* Test-API (wird in js/main.js an window.__ns angehängt) */
const TEAM_API = {
  downSurv, pickUp, dropCarried, hookSurv, unhookSurv, healDone, killSurv, escapeSurv, teamCheckEnd, teamGiveUp, viewer,
  startWorkFor, stopWorkFor, workStep, healStep, unhookStep, wiggle, canHeal, canUnhook, duoStation, isFree, isDowned,
  hitSurvivor, dropPallet, hide, startChase, giveUpChase, nearestFreeHook, specNext, roomAt, computeAction,
  get deaths() { return deaths; }, get teamEndAt() { return teamEndAt; }, get actHeld() { return actHeld; },
};

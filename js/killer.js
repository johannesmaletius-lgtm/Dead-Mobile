'use strict';
/* Dead Mobile – Killer-KI: Sicht, Pfade, Patrouille, Suche, Verfolgung, Aktionen, Lärm */
/* ================= Killer-KI ================= */
function killerSees(sv = S) {
  if (state !== 'play' || !sv || sv.hidden || sv.ghost || sv.out || sv.carried || sv.hung || sv.hp <= 0) return false;
  if (!(K.mask & sv.mask)) return false;
  const dx = sv.x - K.x, dy = sv.y - K.y, d = hyp(dx, dy);
  if (d > CFG.viewR) return false;
  if (d > 1.7 && Math.abs(angDiff(Math.atan2(dy, dx), K.dir)) > CFG.viewA) return false;
  return losClear(K.x, K.y - .1, sv.x, sv.y - .1);
}
function killerVisible() {
  if (state === 'title' || state === 'caught' || state === 'end') return true;
  const v = viewer();
  if (!v || v.ghost) return false;
  return (K.mask & v.mask) !== 0;
}
/* Wen sucht er auf Patrouille? Den nächsten Überlebenden, der noch frei herumläuft (Team: nicht den Ignorierten) */
function huntTarget() {
  let b = S, bd = 1e9;
  for (const sv of SV) if (inPlay(sv) && !sv.carried && !sv.hung && (MODE !== 'team' || (sv.hp > 0 && !kIgnores(sv)))) { const d = hyp(sv.x - K.x, sv.y - K.y); if (d < bd) { bd = d; b = sv; } }
  return b;
}
function kSpeed() {
  if (K.mode === 'chase' && TUT && TUT.kChase) return TUT.kChase;
  if (K.mode === 'chase') return CFG.kChase * (1 + .035 * K.blood);
  let s = K.mode === 'patrol' ? CFG.kPatrol : CFG.kInvest;
  if (endgame) s = CFG.kInvest * 1.08;
  return s;
}
/* Bewegung zu einem Punkt – für den Killer und für Bots (e = Figur) */
function moveAgent(e, tx, ty, spd, dt) {
  const dx = tx - e.x, dy = ty - e.y, d = hyp(dx, dy);
  if (d < 1e-4) { e.moving = false; return; }
  e.dir = turn(e.dir, Math.atan2(dy, dx), 10 * dt);
  const st = Math.min(d, spd * dt), ox = e.x, oy = e.y;
  moveEnt(e, dx / d * st, dy / d * st);
  const md = hyp(e.x - ox, e.y - oy);
  if (e === K) { K.moving = md > .0005; K.walk += md * 4.6; } else survMoved(e, md, dt);
  if (md < st * .35) { e.stuck = (e.stuck || 0) + dt; if (e.stuck > .5) { e.stuck = 0; e.path = null; e.repathT = 0; e.stuckHit = T; } }
  else e.stuck = Math.max(0, (e.stuck || 0) - dt);
}
const moveK = (tx, ty, spd, dt) => moveAgent(K, tx, ty, spd, dt);
function specialAt(x, y) {
  const c = ch(x, y);
  if (c === 'W') return { kind: 'w', o: windowAt[I(x, y)] };
  if (c === 'P') { const p = palletAt[I(x, y)]; if (p.state === 1) return { kind: 'p', o: p }; }
  return null;
}
/* Zum Ziel laufen (direkt oder per A*). Killer springt durch Fenster / zerbricht Paletten,
   Survivors (Bots) springen über Fenster und liegende Paletten. Liefert true bei Ankunft. */
function goTo(e, tx, ty, spd, dt) {
  if (hyp(tx - e.x, ty - e.y) < .22) { e.moving = false; return true; }
  if (lineWalk(e.x, e.y, tx, ty, e.r)) { e.path = null; moveAgent(e, tx, ty, spd, dt); return hyp(tx - e.x, ty - e.y) < .22; }
  const gi = I(clamp(tx | 0, 0, W - 1), clamp(ty | 0, 0, H - 1));
  if (!e.path || e.pathGoal !== gi || T > e.repathT) {
    const isK = e === K;
    e.path = isK ? findPath(e.x | 0, e.y | 0, tx | 0, ty | 0) : findPath(e.x | 0, e.y | 0, tx | 0, ty | 0, .6, 1.2, true); e.pi = 0; e.pathGoal = gi;
    e.repathT = T + (isK ? (K.mode === 'chase' ? .35 : 2.5) : (e.repathEvery || .8));
    if (!e.path) { e.repathT = T + .5; return true; }
  }
  return followPath(e, tx, ty, spd, dt);
}
function followPath(e, tx, ty, spd, dt) {
  const P = e.path;
  if (e.pi >= P.length) { moveAgent(e, tx, ty, spd, dt); return hyp(tx - e.x, ty - e.y) < .25 || T - (e.stuckHit || -9) < .05; }
  const n = P[e.pi], nx = n % W, ny = (n / W) | 0, sp = specialAt(nx, ny);
  if (sp) {
    const cx = nx + .5, cy = ny + .5, ax = sp.o.ax;
    const s = Math.sign((e.x - cx) * ax.x + (e.y - cy) * ax.y) || 1;
    const apx = cx + ax.x * s * .88, apy = cy + ax.y * s * .88;
    if (hyp(e.x - apx, e.y - apy) < .15) {
      e.dir = Math.atan2(-ax.y * s, -ax.x * s);
      if (e !== K) vaultOver(sp.o, sp.kind === 'w', e);
      else if (sp.kind === 'w') K.act = { kind: 'vault', t: 0, dur: CFG.kVault, fx: K.x, fy: K.y, tx: cx - ax.x * s * .88, ty: cy - ax.y * s * .88 };
      else K.act = { kind: 'break', t: 0, dur: CFG.kBreak, p: sp.o };
      e.pi++;
    } else moveAgent(e, apx, apy, spd, dt);
    return false;
  }
  let j = e.pi;
  const lim = Math.min(P.length - 1, e.pi + 6);
  for (let k = e.pi + 1; k <= lim; k++) { const m = P[k]; if (specialAt(m % W, (m / W) | 0)) break; if (lineWalk(e.x, e.y, (m % W) + .5, ((m / W) | 0) + .5, e.r)) j = k; else break; }
  if (j === P.length - 1 && lineWalk(e.x, e.y, tx, ty, e.r)) { moveAgent(e, tx, ty, spd, dt); if (hyp(tx - e.x, ty - e.y) < .25) { e.pi = P.length; return true; } return false; }
  const gx = (P[j] % W) + .5, gy = ((P[j] / W) | 0) + .5;
  moveAgent(e, gx, gy, spd, dt);
  if (hyp(gx - e.x, gy - e.y) < .3) e.pi = j + 1;
  return false;
}
function newestMark(p, R, after, owner) {
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i];
    if (m.t <= after || T - m.t > CFG.markLife) break;
    if (owner != null && m.o != null && m.o !== owner) continue;
    if (hyp(m.x - p.x, m.y - p.y) < R && losClear(p.x, p.y, m.x, m.y)) return m;
  }
  return null;
}
function investigate(x, y, kind) {
  K.mode = 'investigate'; K.inv = { x, y, kind, t: T }; K.goal = null; K.path = null; K.repathT = 0;
  if (K.act && K.act.kind === 'look') K.act = null;
}
function startSearch(x, y, lockerChance) {
  K.mode = 'search'; K.search = { x, y, until: T + 7, lockerChance }; K.goal = null; K.path = null;
  if (!K.act) K.act = { kind: 'look', t: 0, dur: 1, base: K.dir };
}
function startChase(sv) {
  if (MODE === 'team' && K.carry) return;
  sv = sv || K.focus || S;
  K.target = sv; K.mode = 'chase'; K.aware = 1; K.chaseT = 0; K.blood = 0; K.seenT = T; K.lastSeen = { x: sv.x, y: sv.y }; K.trailT = T;
  K.path = null; K.goal = null;
  if (K.act && ['look', 'kick', 'locker'].includes(K.act.kind)) K.act = null;
  SFX.sting(); chaseFlash = 1;
}
function loseChase() { if (K.mode === 'chase') stats.chasesWon++; K.aware = 0; K.blood = 0; K.breakP = null; pallets.forEach(p => p.loopT = 0); startSearch(K.lastSeen.x, K.lastSeen.y, .45); }
function nearestLocker(p, R) { let b = null, bd = R; for (const L of lockers) { const d = hyp(L.cx - p.x, L.cy - p.y); if (d < bd) { bd = d; b = L; } } return b; }
function randomPointNear(x, y, R) {
  for (let i = 0; i < 16; i++) { const tx = Math.floor(x + rand(-R, R)), ty = Math.floor(y + rand(-R, R)); if (kc(tx, ty) === 1 && !circleHit(tx + .5, ty + .5, K.r)) return { x: tx + .5, y: ty + .5 }; }
  return { x, y };
}
function pickPatrol() {
  let r = 0;
  const kr = room[I(K.x | 0, K.y | 0)] || firstBit(K.mask);
  if (state === 'play') {
    const quiet = T - K.lastContact;
    const pHunt = quiet > 45 ? .6 : quiet > 20 ? .35 : .12;
    if (Math.random() < pHunt) r = firstBit(huntTarget().mask);
    if (MODE === 'team' && T < K.campUntil && r === K.campRoom) r = 0; // kein Camping am Haken
  }
  if (!r) {
    const ws = []; let tot = 0;
    for (let i = 1; i <= NR; i++) { let w = i === kr || !roomFloor[i] || !roomFloor[i].length || (MODE === 'team' && T < K.campUntil && i === K.campRoom) ? 0 : 1; if (w) for (const t of tasks) if (t.room === i && !t.done) w += .6 + t.prog * 4; ws.push(w); tot += w; }
    let v = Math.random() * tot; for (let i = 1; i <= NR; i++) { v -= ws[i - 1]; if (v <= 0) { r = i; break; } }
    if (!r) r = MAPDEF.patrolFallback || firstBit(K.mask) || 1;
  }
  const tk = tasks.filter(t => t.room === r && !t.done && t.prog > .05);
  if (tk.length && Math.random() < .75) { const t = pick(tk); K.goal = { x: t.ax, y: t.ay, task: t }; }
  else { const i = pick(roomFloor[r]); K.goal = { x: i % W + .5, y: ((i / W) | 0) + .5 }; }
}
function updateKiller(dt) {
  const m = mask[I(K.x | 0, K.y | 0)]; if (m) K.mask = m;
  if (K.net) { K.net(dt); return; }   // Online-Client: der Killer kommt vom Host (js/sync.js)
  if (K.ctl) { if (K.act) runAct(dt); else K.ctl(dt); return; }
  if (K.moving) { K.stepT -= dt; if (K.stepT <= 0) { K.stepT = K.mode === 'chase' ? .28 : .42; if (state === 'play' && killerVisible()) SFX.kstep(); } }
  // Team: Liegende aufheben (Vorrang), tragen, aufhängen
  if (MODE === 'team' && killerTeam(dt)) return;
  // Wen sieht er? Fokus = der Nächste (das laufende Jagdziel zählt 3 Kacheln näher)
  const seenL = SV.length === 1 ? (killerSees(S) ? [S] : []) : SV.filter(sv => killerSees(sv));
  let foc = null, fd = 1e9;
  for (const sv of seenL) { const d = hyp(sv.x - K.x, sv.y - K.y) - (sv === K.target && K.mode === 'chase' ? 3 : 0) + (MODE === 'team' && kIgnores(sv) ? 6 : 0); if (d < fd) { fd = d; foc = sv; } }
  const sees = !!foc;
  K.focus = foc;
  if (sees) K.lastContact = T;
  if (K.mode !== 'chase') {
    if (sees) {
      const d = hyp(foc.x - K.x, foc.y - K.y);
      let rate = lerp(3.4, 1.05, clamp((d - 1.5) / 8, 0, 1));
      rate *= foc.running ? 1.7 : foc.moving ? 1 : .7;
      if (K.mode !== 'patrol') rate *= 1.35;
      if (endgame) rate *= 1.4;
      if (MODE === 'team') rate *= awareMul(foc, d);
      K.aware += rate * dt;
      if (K.aware >= 1 && !(K.act && ['stun', 'vault', 'break'].includes(K.act.kind))) startChase(foc);
    } else K.aware = Math.max(0, K.aware - dt * .5);
  }
  const tg = K.target || S;
  if (K.mode === 'chase') for (const p of pallets) {
    if (p.state === 2) { p.loopT = 0; continue; }
    if (hyp(K.x - p.cx, K.y - p.cy) < 6.5 && hyp(tg.x - p.cx, tg.y - p.cy) < 6.5) p.loopT = (p.loopT || 0) + dt;
    else p.loopT = Math.max(0, (p.loopT || 0) - dt * .2);
  }
  if (MODE === 'team' && huntTick(dt)) return;
  if (K.act) {
    if (K.act.kind === 'look' && K.aware > .3) K.act = null;
    else { runAct(dt); return; }
  }
  if (K.mode === 'chase') { chase(dt, seenL.includes(K.target || S)); return; }
  if (sees && K.aware > .3) {
    K.dir = turn(K.dir, Math.atan2(foc.y - K.y, foc.x - K.x), dt * 5);
    goTo(K, foc.x, foc.y, CFG.kPatrol * .55, dt); return;
  }
  K.scanT -= dt;
  if (K.scanT <= 0) {
    K.scanT = .25;
    let mk = newestMark(K, 6.5, Math.max(K.trailT, T - CFG.markLife));
    if (mk && MODE === 'team' && (campBlock(mk.x, mk.y) || (K.ignore && T < K.ignore.until && mk.o === K.ignore.sv.id) || (K.mode === 'investigate' && K.inv.kind === 'hunt' && T - K.inv.t < 4))) mk = null;
    if (mk && !(K.mode === 'investigate' && K.inv.kind === 'noise' && T - K.inv.t < 3)) { K.trailT = mk.t; investigate(mk.x, mk.y, 'trail'); }
  }
  if (K.mode === 'patrol') {
    if (!K.goal) pickPatrol();
    if (goTo(K, K.goal.x, K.goal.y, kSpeed(), dt)) {
      const g = K.goal; K.goal = null;
      if (g.task && !g.task.done && g.task.prog > .05 && !isWorked(g.task)) { K.dir = Math.atan2(g.task.cy - K.y, g.task.cx - K.x); K.act = { kind: 'kick', t: 0, dur: 1.1, task: g.task }; return; }
      const L = nearestLocker(K, 2.2);
      if (L && Math.random() < .12) { K.dir = Math.atan2(L.cy - K.y, L.cx - K.x); K.act = { kind: 'locker', t: 0, dur: .9, L }; return; }
      K.act = { kind: 'look', t: 0, dur: rand(.8, 1.8), base: K.dir };
    }
  } else if (K.mode === 'investigate') {
    if (goTo(K, K.inv.x, K.inv.y, kSpeed(), dt)) {
      if (K.inv.kind === 'trail') { const mk = newestMark(K, 6, K.trailT); if (mk) { K.trailT = mk.t; K.inv = { x: mk.x, y: mk.y, kind: 'trail', t: T }; return; } }
      startSearch(K.inv.x, K.inv.y, K.inv.kind === 'noise' ? .4 : .2);
    }
  } else if (K.mode === 'search') {
    if (T > K.search.until) { K.mode = 'patrol'; K.goal = null; return; }
    if (!K.goal) {
      const L = nearestLocker(K.search, 4);
      if (L && Math.random() < K.search.lockerChance) { K.search.lockerChance = 0; K.goal = { x: L.front.x, y: L.front.y, locker: L }; }
      else K.goal = randomPointNear(K.search.x, K.search.y, 4.5);
    }
    if (goTo(K, K.goal.x, K.goal.y, kSpeed() * .9, dt)) {
      const g = K.goal; K.goal = null;
      if (g.locker) { K.dir = Math.atan2(g.locker.cy - K.y, g.locker.cx - K.x); K.act = { kind: 'locker', t: 0, dur: .9, L: g.locker }; return; }
      K.act = { kind: 'look', t: 0, dur: rand(.6, 1.2), base: K.dir };
    }
  }
}
function chase(dt, sees) {
  const tg = K.target || S;
  K.chaseT += dt;
  if (TUT && TUT.omni) { K.seenT = T; K.lastSeen = { x: tg.x, y: tg.y }; if (tg.hidden) tg.hidden.known = true; }
  if (sees) { K.lastSeen = { x: tg.x, y: tg.y }; K.seenT = T; K.trailT = Math.max(K.trailT, T - .3); K.blood = Math.min(3, Math.floor(K.chaseT / 12)); }
  const since = T - K.seenT;
  const Lk = tg.hidden && tg.hidden.known ? tg.hidden : null;
  if (since > CFG.loseAfter && !Lk) { loseChase(); return; }
  let tx, ty;
  if (Lk) {
    tx = Lk.front.x; ty = Lk.front.y;
    if (hyp(K.x - tx, K.y - ty) < .35) { K.dir = Math.atan2(Lk.cy - K.y, Lk.cx - K.x); K.act = { kind: 'locker', t: 0, dur: .8, L: Lk }; return; }
  } else if (sees || (since < CFG.track && !tg.hidden)) { tx = tg.x; ty = tg.y; }
  else {
    const mk = newestMark(K, 7, K.trailT, tg.id);
    if (mk) { tx = mk.x; ty = mk.y; if (hyp(K.x - mk.x, K.y - mk.y) < .6) K.trailT = mk.t; }
    else { tx = K.lastSeen.x; ty = K.lastSeen.y; if (hyp(K.x - tx, K.y - ty) < .6) { loseChase(); return; } }
  }
  const d = hyp(tg.x - K.x, tg.y - K.y);
  if (!(TUT && TUT.noLunge) && sees && !tg.hidden && d < CFG.lungeAt && lineWalk(K.x, K.y, tg.x, tg.y, .22)) { K.act = { kind: 'lunge', t: 0, dur: CFG.lungeT }; SFX.whoosh(); return; }
  // Jagt er länger als 20 s um dieselbe Palette, zerbricht er sie einfach
  let loopP = K.breakP && K.breakP.state !== 2 ? K.breakP : null;
  if (!loopP) for (const p of pallets) if (p.state !== 2 && p.loopT > CFG.palletLoop) { loopP = p; break; }
  if (loopP && hyp(tg.x - loopP.cx, tg.y - loopP.cy) > 8) { loopP = null; K.breakP = null; }
  if (loopP && !Lk) {
    K.breakP = loopP;
    const ax = loopP.ax, s = Math.sign((K.x - loopP.cx) * ax.x + (K.y - loopP.cy) * ax.y) || 1;
    const apx = loopP.cx + ax.x * s * .88, apy = loopP.cy + ax.y * s * .88;
    if (hyp(K.x - apx, K.y - apy) < .22) { K.dir = Math.atan2(-ax.y * s, -ax.x * s); K.act = { kind: 'break', t: 0, dur: CFG.kBreak, p: loopP }; loopP.loopT = 0; K.breakP = null; return; }
    goTo(K, apx, apy, kSpeed(), dt); return;
  }
  goTo(K, tx, ty, kSpeed(), dt);
}
function runAct(dt) {
  const a = K.act; a.t += dt; const p = Math.min(1, a.t / a.dur);
  switch (a.kind) {
    case 'look': K.dir = a.base + Math.sin(p * TAU) * .95; K.moving = false; break;
    case 'kick':
      K.moving = false;
      if (!a.hit && p > .6) { a.hit = true; a.task.prog = Math.max(0, a.task.prog - .15); SFX.kick(); for (let i = 0; i < 12; i++) parts.push({ x: a.task.cx, y: a.task.cy, z: .4, vx: rand(-2, 2), vy: rand(-1, 1), vz: rand(1, 3), g: 9, life: .5, max: .5, col: '255,90,60', sz: .05 }); }
      break;
    case 'locker':
      K.moving = false;
      if (!a.opened && p > .45) { a.opened = true; a.L.anim = 1; SFX.locker(); const hv = SV.find(v => v.hidden === a.L); if (hv && state === 'play') { if (TUT) hitSurvivor(hv); else if (MODE === 'team') pickUp(hv); else caught(hv); return; } }
      break;
    case 'vault': K.x = lerp(a.fx, a.tx, p); K.y = lerp(a.fy, a.ty, p); K.z = Math.sin(p * Math.PI) * .45; K.moving = true; K.walk += dt * 5; break;
    case 'break':
      K.moving = false;
      if (!a.done && p >= 1) { a.done = true; a.p.state = 2; SFX.crack(); shake(.2); for (let i = 0; i < 18; i++) parts.push({ x: a.p.cx, y: a.p.cy, z: .2, vx: rand(-2, 2), vy: rand(-1.5, 1.5), vz: rand(1, 3), g: 8, life: rand(.4, .9), max: .9, col: '120,90,55', sz: .06 }); }
      break;
    case 'stun': case 'wipe': K.moving = false; break;
    case 'pick': K.moving = false; if (!a.done && a.t >= a.dur) { a.done = true; if (isDowned(a.sv)) pickUp(a.sv); } break;
    case 'hook': K.moving = false; if (!a.done && a.t >= a.dur) { a.done = true; if (K.carry === a.sv) hookSurv(a.sv, a.h); } break;
    case 'lunge': {
      const tg = K.target || S, want = Math.atan2(tg.y - K.y, tg.x - K.x);
      K.dir = turn(K.dir, want, CFG.lungeTurn * dt);
      const lv = a.t < CFG.lungeWind ? CFG.kChase * 1.05 : CFG.lungeV;
      moveEnt(K, Math.cos(K.dir) * lv * dt, Math.sin(K.dir) * lv * dt);
      K.moving = true; K.walk += dt * 12;
      // Getroffen wird, wer im Weg steht – meist das Ziel
      if (state === 'play') for (const v of SV) if (!v.hidden && !v.ghost && !v.out && !v.carried && !v.hung && v.hp > 0 && hyp(v.x - K.x, v.y - K.y) < CFG.hitR && losClear(K.x, K.y, v.x, v.y)) { hitSurvivor(v); return; }
      if (a.t >= a.dur) { SFX.whiff(); K.act = { kind: 'recover', t: 0, dur: CFG.recover }; }
      return;
    }
    case 'recover': if (state === 'play') { const tg = K.target || S; moveK(tg.x, tg.y, 1.3, dt); } break;
  }
  if (a.t >= a.dur && K.act === a) { K.z = 0; K.act = null; }
}
function noise(x, y, R, loud) {
  noises.push({ x, y, t: T, loud });
  if (state !== 'play') return;
  if (MODE === 'team' && (K.carry || K.mode === 'fetch' || campBlock(x, y))) return; // trägt/holt gerade, kein Camping
  if (K.mode === 'chase') { K.lastSeen = { x, y }; if (R >= 8) K.seenT = Math.max(K.seenT, T - CFG.track + .8); return; }
  if (hyp(K.x - x, K.y - y) <= R) { investigate(x, y, 'noise'); if (loud) K.aware = Math.max(K.aware, .15); }
}

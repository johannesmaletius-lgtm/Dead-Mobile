'use strict';
/* Dead Mobile – Killer-KI: Sicht, Pfade, Patrouille, Suche, Verfolgung, Aktionen, Lärm */
/* ================= Killer-KI ================= */
function killerSees() {
  if (state !== 'play' || !S || S.hidden || S.ghost) return false;
  if (!(K.mask & S.mask)) return false;
  const dx = S.x - K.x, dy = S.y - K.y, d = hyp(dx, dy);
  if (d > CFG.viewR) return false;
  if (d > 1.7 && Math.abs(angDiff(Math.atan2(dy, dx), K.dir)) > CFG.viewA) return false;
  return losClear(K.x, K.y - .1, S.x, S.y - .1);
}
function killerVisible() {
  if (state === 'title' || state === 'caught' || state === 'end') return true;
  if (!S || S.ghost) return false;
  return (K.mask & S.mask) !== 0;
}
function kSpeed() {
  if (K.mode === 'chase' && TUT && TUT.kChase) return TUT.kChase;
  if (K.mode === 'chase') return CFG.kChase * (1 + .035 * K.blood);
  let s = K.mode === 'patrol' ? CFG.kPatrol : CFG.kInvest;
  if (endgame) s = CFG.kInvest * 1.08;
  return s;
}
function moveK(tx, ty, spd, dt) {
  const dx = tx - K.x, dy = ty - K.y, d = hyp(dx, dy);
  if (d < 1e-4) { K.moving = false; return; }
  K.dir = turn(K.dir, Math.atan2(dy, dx), 10 * dt);
  const st = Math.min(d, spd * dt), ox = K.x, oy = K.y;
  moveEnt(K, dx / d * st, dy / d * st);
  const md = hyp(K.x - ox, K.y - oy);
  K.moving = md > .0005; K.walk += md * 4.6;
  if (md < st * .35) { K.stuck += dt; if (K.stuck > .5) { K.stuck = 0; K.path = null; K.repathT = 0; K.stuckHit = T; } }
  else K.stuck = Math.max(0, K.stuck - dt);
}
function specialAt(x, y) {
  const c = ch(x, y);
  if (c === 'W') return { kind: 'w', o: windowAt[I(x, y)] };
  if (c === 'P') { const p = palletAt[I(x, y)]; if (p.state === 1) return { kind: 'p', o: p }; }
  return null;
}
function goTo(tx, ty, spd, dt) {
  if (hyp(tx - K.x, ty - K.y) < .22) { K.moving = false; return true; }
  if (lineWalk(K.x, K.y, tx, ty, K.r)) { K.path = null; moveK(tx, ty, spd, dt); return hyp(tx - K.x, ty - K.y) < .22; }
  const gi = I(clamp(tx | 0, 0, W - 1), clamp(ty | 0, 0, H - 1));
  if (!K.path || K.pathGoal !== gi || T > K.repathT) {
    K.path = findPath(K.x | 0, K.y | 0, tx | 0, ty | 0); K.pi = 0; K.pathGoal = gi;
    K.repathT = T + (K.mode === 'chase' ? .35 : 2.5);
    if (!K.path) { K.repathT = T + .5; return true; }
  }
  return followPath(tx, ty, spd, dt);
}
function followPath(tx, ty, spd, dt) {
  const P = K.path;
  if (K.pi >= P.length) { moveK(tx, ty, spd, dt); return hyp(tx - K.x, ty - K.y) < .25 || T - (K.stuckHit || -9) < .05; }
  const n = P[K.pi], nx = n % W, ny = (n / W) | 0, sp = specialAt(nx, ny);
  if (sp) {
    const cx = nx + .5, cy = ny + .5, ax = sp.o.ax;
    const s = Math.sign((K.x - cx) * ax.x + (K.y - cy) * ax.y) || 1;
    const apx = cx + ax.x * s * .88, apy = cy + ax.y * s * .88;
    if (hyp(K.x - apx, K.y - apy) < .15) {
      K.dir = Math.atan2(-ax.y * s, -ax.x * s);
      if (sp.kind === 'w') K.act = { kind: 'vault', t: 0, dur: CFG.kVault, fx: K.x, fy: K.y, tx: cx - ax.x * s * .88, ty: cy - ax.y * s * .88 };
      else K.act = { kind: 'break', t: 0, dur: CFG.kBreak, p: sp.o };
      K.pi++;
    } else moveK(apx, apy, spd, dt);
    return false;
  }
  let j = K.pi;
  const lim = Math.min(P.length - 1, K.pi + 6);
  for (let k = K.pi + 1; k <= lim; k++) { const m = P[k]; if (specialAt(m % W, (m / W) | 0)) break; if (lineWalk(K.x, K.y, (m % W) + .5, ((m / W) | 0) + .5, K.r)) j = k; else break; }
  if (j === P.length - 1 && lineWalk(K.x, K.y, tx, ty, K.r)) { moveK(tx, ty, spd, dt); if (hyp(tx - K.x, ty - K.y) < .25) { K.pi = P.length; return true; } return false; }
  const gx = (P[j] % W) + .5, gy = ((P[j] / W) | 0) + .5;
  moveK(gx, gy, spd, dt);
  if (hyp(gx - K.x, gy - K.y) < .3) K.pi = j + 1;
  return false;
}
function newestMark(p, R, after) {
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i];
    if (m.t <= after || T - m.t > CFG.markLife) break;
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
function startChase() {
  K.mode = 'chase'; K.aware = 1; K.chaseT = 0; K.blood = 0; K.seenT = T; K.lastSeen = { x: S.x, y: S.y }; K.trailT = T;
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
    if (Math.random() < pHunt) r = firstBit(S.mask);
  }
  if (!r) {
    const ws = []; let tot = 0;
    for (let i = 1; i <= 9; i++) { let w = i === kr ? 0 : 1; if (w) for (const t of tasks) if (t.room === i && !t.done) w += .6 + t.prog * 4; ws.push(w); tot += w; }
    let v = Math.random() * tot; for (let i = 1; i <= 9; i++) { v -= ws[i - 1]; if (v <= 0) { r = i; break; } }
    if (!r) r = 3;
  }
  const tk = tasks.filter(t => t.room === r && !t.done && t.prog > .05);
  if (tk.length && Math.random() < .75) { const t = pick(tk); K.goal = { x: t.ax, y: t.ay, task: t }; }
  else { const i = pick(roomFloor[r]); K.goal = { x: i % W + .5, y: ((i / W) | 0) + .5 }; }
}
function updateKiller(dt) {
  const m = mask[I(K.x | 0, K.y | 0)]; if (m) K.mask = m;
  if (K.ctl) { if (K.act) runAct(dt); else K.ctl(dt); return; }
  if (K.moving) { K.stepT -= dt; if (K.stepT <= 0) { K.stepT = K.mode === 'chase' ? .28 : .42; if (state === 'play' && killerVisible()) SFX.kstep(); } }
  const sees = killerSees();
  if (sees) K.lastContact = T;
  if (K.mode !== 'chase') {
    if (sees) {
      const d = hyp(S.x - K.x, S.y - K.y);
      let rate = lerp(3.4, 1.05, clamp((d - 1.5) / 8, 0, 1));
      rate *= S.running ? 1.7 : S.moving ? 1 : .7;
      if (K.mode !== 'patrol') rate *= 1.35;
      if (endgame) rate *= 1.4;
      K.aware += rate * dt;
      if (K.aware >= 1 && !(K.act && ['stun', 'vault', 'break'].includes(K.act.kind))) startChase();
    } else K.aware = Math.max(0, K.aware - dt * .5);
  }
  if (K.mode === 'chase') for (const p of pallets) {
    if (p.state === 2) { p.loopT = 0; continue; }
    if (hyp(K.x - p.cx, K.y - p.cy) < 6.5 && hyp(S.x - p.cx, S.y - p.cy) < 6.5) p.loopT = (p.loopT || 0) + dt;
    else p.loopT = Math.max(0, (p.loopT || 0) - dt * .2);
  }
  if (K.act) {
    if (K.act.kind === 'look' && K.aware > .3) K.act = null;
    else { runAct(dt); return; }
  }
  if (K.mode === 'chase') { chase(dt, sees); return; }
  if (sees && K.aware > .3) {
    K.dir = turn(K.dir, Math.atan2(S.y - K.y, S.x - K.x), dt * 5);
    goTo(S.x, S.y, CFG.kPatrol * .55, dt); return;
  }
  K.scanT -= dt;
  if (K.scanT <= 0) {
    K.scanT = .25;
    const mk = newestMark(K, 6.5, Math.max(K.trailT, T - CFG.markLife));
    if (mk && !(K.mode === 'investigate' && K.inv.kind === 'noise' && T - K.inv.t < 3)) { K.trailT = mk.t; investigate(mk.x, mk.y, 'trail'); }
  }
  if (K.mode === 'patrol') {
    if (!K.goal) pickPatrol();
    if (goTo(K.goal.x, K.goal.y, kSpeed(), dt)) {
      const g = K.goal; K.goal = null;
      if (g.task && !g.task.done && g.task.prog > .05 && S.work !== g.task) { K.dir = Math.atan2(g.task.cy - K.y, g.task.cx - K.x); K.act = { kind: 'kick', t: 0, dur: 1.1, task: g.task }; return; }
      const L = nearestLocker(K, 2.2);
      if (L && Math.random() < .12) { K.dir = Math.atan2(L.cy - K.y, L.cx - K.x); K.act = { kind: 'locker', t: 0, dur: .9, L }; return; }
      K.act = { kind: 'look', t: 0, dur: rand(.8, 1.8), base: K.dir };
    }
  } else if (K.mode === 'investigate') {
    if (goTo(K.inv.x, K.inv.y, kSpeed(), dt)) {
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
    if (goTo(K.goal.x, K.goal.y, kSpeed() * .9, dt)) {
      const g = K.goal; K.goal = null;
      if (g.locker) { K.dir = Math.atan2(g.locker.cy - K.y, g.locker.cx - K.x); K.act = { kind: 'locker', t: 0, dur: .9, L: g.locker }; return; }
      K.act = { kind: 'look', t: 0, dur: rand(.6, 1.2), base: K.dir };
    }
  }
}
function chase(dt, sees) {
  K.chaseT += dt;
  if (TUT && TUT.omni) { K.seenT = T; K.lastSeen = { x: S.x, y: S.y }; if (S.hidden) S.hidden.known = true; }
  if (sees) { K.lastSeen = { x: S.x, y: S.y }; K.seenT = T; K.trailT = Math.max(K.trailT, T - .3); K.blood = Math.min(3, Math.floor(K.chaseT / 12)); }
  const since = T - K.seenT;
  const Lk = S.hidden && S.hidden.known ? S.hidden : null;
  if (since > CFG.loseAfter && !Lk) { loseChase(); return; }
  let tx, ty;
  if (Lk) {
    tx = Lk.front.x; ty = Lk.front.y;
    if (hyp(K.x - tx, K.y - ty) < .35) { K.dir = Math.atan2(Lk.cy - K.y, Lk.cx - K.x); K.act = { kind: 'locker', t: 0, dur: .8, L: Lk }; return; }
  } else if (sees || (since < CFG.track && !S.hidden)) { tx = S.x; ty = S.y; }
  else {
    const mk = newestMark(K, 7, K.trailT);
    if (mk) { tx = mk.x; ty = mk.y; if (hyp(K.x - mk.x, K.y - mk.y) < .6) K.trailT = mk.t; }
    else { tx = K.lastSeen.x; ty = K.lastSeen.y; if (hyp(K.x - tx, K.y - ty) < .6) { loseChase(); return; } }
  }
  const d = hyp(S.x - K.x, S.y - K.y);
  if (!(TUT && TUT.noLunge) && sees && !S.hidden && d < CFG.lungeAt && lineWalk(K.x, K.y, S.x, S.y, .22)) { K.act = { kind: 'lunge', t: 0, dur: CFG.lungeT }; SFX.whoosh(); return; }
  // Jagt er länger als 20 s um dieselbe Palette, zerbricht er sie einfach
  let loopP = K.breakP && K.breakP.state !== 2 ? K.breakP : null;
  if (!loopP) for (const p of pallets) if (p.state !== 2 && p.loopT > CFG.palletLoop) { loopP = p; break; }
  if (loopP && hyp(S.x - loopP.cx, S.y - loopP.cy) > 8) { loopP = null; K.breakP = null; }
  if (loopP && !Lk) {
    K.breakP = loopP;
    const ax = loopP.ax, s = Math.sign((K.x - loopP.cx) * ax.x + (K.y - loopP.cy) * ax.y) || 1;
    const apx = loopP.cx + ax.x * s * .88, apy = loopP.cy + ax.y * s * .88;
    if (hyp(K.x - apx, K.y - apy) < .22) { K.dir = Math.atan2(-ax.y * s, -ax.x * s); K.act = { kind: 'break', t: 0, dur: CFG.kBreak, p: loopP }; loopP.loopT = 0; K.breakP = null; return; }
    goTo(apx, apy, kSpeed(), dt); return;
  }
  goTo(tx, ty, kSpeed(), dt);
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
      if (!a.opened && p > .45) { a.opened = true; a.L.anim = 1; SFX.locker(); if (S.hidden === a.L && state === 'play') { if (TUT) hitSurvivor(); else caught(); return; } }
      break;
    case 'vault': K.x = lerp(a.fx, a.tx, p); K.y = lerp(a.fy, a.ty, p); K.z = Math.sin(p * Math.PI) * .45; K.moving = true; K.walk += dt * 5; break;
    case 'break':
      K.moving = false;
      if (!a.done && p >= 1) { a.done = true; a.p.state = 2; SFX.crack(); shake(.2); for (let i = 0; i < 18; i++) parts.push({ x: a.p.cx, y: a.p.cy, z: .2, vx: rand(-2, 2), vy: rand(-1.5, 1.5), vz: rand(1, 3), g: 8, life: rand(.4, .9), max: .9, col: '120,90,55', sz: .06 }); }
      break;
    case 'stun': case 'wipe': K.moving = false; break;
    case 'lunge': {
      const want = Math.atan2(S.y - K.y, S.x - K.x);
      K.dir = turn(K.dir, want, CFG.lungeTurn * dt);
      const lv = a.t < CFG.lungeWind ? CFG.kChase * 1.05 : CFG.lungeV;
      moveEnt(K, Math.cos(K.dir) * lv * dt, Math.sin(K.dir) * lv * dt);
      K.moving = true; K.walk += dt * 12;
      if (state === 'play' && !S.hidden && hyp(S.x - K.x, S.y - K.y) < CFG.hitR && losClear(K.x, K.y, S.x, S.y)) { hitSurvivor(); return; }
      if (a.t >= a.dur) { SFX.whiff(); K.act = { kind: 'recover', t: 0, dur: CFG.recover }; }
      return;
    }
    case 'recover': if (state === 'play') moveK(S.x, S.y, 1.3, dt); break;
  }
  if (a.t >= a.dur && K.act === a) { K.z = 0; K.act = null; }
}
function noise(x, y, R, loud) {
  noises.push({ x, y, t: T, loud });
  if (state !== 'play') return;
  if (K.mode === 'chase') { K.lastSeen = { x, y }; if (R >= 8) K.seenT = Math.max(K.seenT, T - CFG.track + .8); return; }
  if (hyp(K.x - x, K.y - y) <= R) { investigate(x, y, 'noise'); if (loud) K.aware = Math.max(K.aware, .15); }
}

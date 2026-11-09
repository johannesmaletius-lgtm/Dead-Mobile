'use strict';
/* Dead Mobile – Aufgaben und Quick-Time-Events (Aggregat, Sicherung, Funk, Ventil) */
/* ================= Aufgaben / Quick-Time-Events ================= */
function startWork(t) { if (t.done) return; S.work = t; Q = newQTE(t); S.dir = Math.atan2(t.cy - S.y, t.cx - S.x); SFX.chirp(); }
function stopWork() { S.work = null; Q = null; }
function newQTE(t) {
  const q = { task: t, type: t.type, t: 0, lock: 0, flash: 0, ok: 0, great: 0 };
  if (t.type === 'gen') { q.next = TUT ? .9 : rand(1.2, 2.6); q.check = null; q.warn = 0; }
  if (t.type === 'fuse') { q.hits = Math.round(t.prog * 3); q.pos = 0; q.v = 1; fuseZone(q); }
  if (t.type === 'radio') { q.round = t.prog >= .5 ? 1 : 0; radioSeq(q); }
  if (t.type === 'valve') { q.p = .45; q.hold = false; q.bc = .5; }
  return q;
}
function fuseZone(q) { const k = Math.min(2, q.hits); q.zw = [.24, .18, .13][k]; q.zc = rand(.15 + q.zw / 2, .85 - q.zw / 2); q.spd = [1.15, 1.5, 1.9][k]; }
function radioSeq(q) { const n = q.round ? 4 : 3; q.seq = []; for (let i = 0; i < n; i++) { let d; do d = (Math.random() * 4) | 0; while (i && d === q.seq[i - 1]); q.seq.push(d); } q.phase = 'show'; q.st = -.45; q.inp = 0; q.shown = -1; }
function updateQTE(dt) {
  const q = Q, t = q.task;
  q.t += dt; q.lock -= dt; q.flash -= dt; q.ok -= dt; q.great -= dt;
  if (q.type === 'gen') {
    t.prog = Math.min(1, t.prog + dt / (TUT ? 7 : CFG.genTime));
    if (q.check) { q.check.a += q.check.v * dt; if (q.check.a > TAU) { q.check = null; fail(t, .1); q.next = rand(2.2, 4.2); } }
    else if (q.warn > 0) { q.warn -= dt; if (q.warn <= 0) q.check = { a: 0, v: TAU / (TUT ? 1.6 : 1.15), zs: rand(1.9, 4.9), zw: .9, gw: .22 }; }
    else { q.next -= dt; if (q.next <= 0 && t.prog < .96) { q.warn = .55; SFX.ding(); } }
  } else if (q.type === 'fuse') {
    if (q.lock <= 0) { q.pos += q.v * q.spd * dt; if (q.pos > 1) { q.pos = 1; q.v = -1; } if (q.pos < 0) { q.pos = 0; q.v = 1; } }
    t.prog = Math.max(t.prog * 0 + q.hits / 3, 0);
  } else if (q.type === 'radio') {
    if (q.phase === 'show') {
      q.st += dt; const k = Math.floor(q.st / .62);
      if (q.st >= 0 && k !== q.shown && k < q.seq.length) { q.shown = k; SFX.beep(q.seq[k]); }
      if (q.st > q.seq.length * .62) { q.phase = 'input'; q.inp = 0; }
    }
    t.prog = (q.round + (q.phase === 'input' ? q.inp / q.seq.length : 0)) / 2;
  } else if (q.type === 'valve') {
    q.bc = .5 + Math.sin(q.t * .9) * .2;
    if (q.lock <= 0) {
      if (q.hold) q.p -= dt * .62; else q.p += dt * (.34 + .12 * Math.sin(q.t * 4.1));
      q.p = Math.max(0, q.p);
      if (q.p >= 1) { q.p = .5; fail(t, .2); }
      else if (Math.abs(q.p - q.bc) < .13) t.prog = Math.min(1, t.prog + dt / CFG.valveTime);
    }
    if (Math.random() < dt * 8) parts.push({ x: t.cx + rand(-.2, .2), y: t.cy, z: .6, vx: rand(-.3, .3), vy: rand(-.2, .1), vz: rand(.6, 1.2), g: -.5, life: .8, max: .8, col: '200,205,210', sz: .09, fade: 1 });
  }
  if (t.prog >= 1) complete(t);
}
function qteDown() {
  const q = Q; if (!q || q.lock > 0) return;
  if (q.type === 'gen') {
    if (!q.check) return;
    const c = q.check, rel = c.a - c.zs;
    if (rel >= 0 && rel <= c.gw) { q.task.prog = Math.min(1, q.task.prog + .04); SFX.great(); stats.checks++; q.ok = .4; q.great = .6; }
    else if (rel >= 0 && rel <= c.zw) { SFX.good(); stats.checks++; q.ok = .3; }
    else fail(q.task, .1);
    q.check = null; q.next = TUT ? rand(1, 1.8) : rand(2, 4.5);
  } else if (q.type === 'fuse') {
    if (Math.abs(q.pos - q.zc) <= q.zw / 2) { q.hits++; stats.checks++; SFX.good(); q.ok = .35; if (q.hits >= 3) q.task.prog = 1; else fuseZone(q); }
    else { q.hits = Math.max(0, q.hits - 1); fail(q.task, 0); fuseZone(q); }
  } else if (q.type === 'valve') q.hold = true;
}
function qteUp() { if (Q && Q.type === 'valve') Q.hold = false; }
function qteArrow(d) {
  const q = Q; if (!q || q.type !== 'radio' || q.phase !== 'input' || q.lock > 0) return;
  q.press = { d, t: .2 };
  if (q.seq[q.inp] === d) {
    q.inp++; SFX.beep(d);
    if (q.inp >= q.seq.length) { q.round++; stats.checks++; if (q.round >= 2) q.task.prog = 1; else { q.ok = .5; SFX.chirp(); radioSeq(q); q.st = -.8; } }
  } else { fail(q.task, 0); radioSeq(q); q.st = -1; }
}
function fail(t, pen) {
  t.prog = Math.max(0, t.prog - pen);
  if (Q) { Q.lock = .7; Q.flash = .6; }
  ({ gen: SFX.bang, fuse: SFX.spark, radio: SFX.staticB, valve: SFX.steam })[t.type]();
  const col = t.type === 'valve' ? '215,220,225' : t.type === 'radio' ? '160,190,255' : '255,200,90';
  for (let i = 0; i < 26; i++) parts.push({ x: t.cx, y: t.cy, z: .5, vx: rand(-3, 3), vy: rand(-2, 2), vz: rand(1, 4), g: t.type === 'valve' ? -.5 : 9, life: rand(.3, .8), max: .8, col, sz: t.type === 'valve' ? .12 : .05, fade: t.type === 'valve' ? 1 : 0 });
  shake(.4); S.flinch = .45; flash = .35; flashCol = '255,120,40';
  eyeT = T; stats.fails++;
  noise(t.cx, t.cy, 99, true);
}
function complete(t) {
  qteSeen.add(t.type);
  t.done = true; t.prog = 1; S.work = null; Q = null;
  SFX.done();
  for (let i = 0; i < 20; i++) parts.push({ x: t.cx, y: t.cy, z: .6, vx: rand(-1.2, 1.2), vy: rand(-1, 1), vz: rand(1, 3), g: 3, life: rand(.5, 1), max: 1, col: '255,225,140', sz: .05 });
  if (t.type === 'gen') noise(t.cx, t.cy, 16, false);
  if (tasks.every(k => k.done)) { endgame = true; gatesPowered = true; SFX.siren(); noise(S.x, S.y, 99, true); }
}

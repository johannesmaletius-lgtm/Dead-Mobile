'use strict';
/* Dead Mobile – Überlebender: Eingabe, Bewegung, Aktionen (Palette, Fenster, Spind) */
/* ================= Überlebender ================= */
const joy = { id: null, bx: 0, by: 0, x: 0, y: 0 };
const JOY_R = 54;
const keys = { u: 0, d: 0, l: 0, r: 0, shift: 0 };
function readInput() {
  if (joy.id !== null) {
    const dx = joy.x - joy.bx, dy = joy.y - joy.by, l = hyp(dx, dy);
    if (l > 5) return { x: dx / l, y: dy / l, mag: Math.min(1, l / JOY_R), walk: false };
    return { x: 0, y: 0, mag: 0, walk: false };
  }
  const kx = keys.r - keys.l, ky = keys.d - keys.u;
  if (kx || ky) { const l = hyp(kx, ky); return { x: kx / l, y: ky / l, mag: 1, walk: !!keys.shift }; }
  return { x: 0, y: 0, mag: 0, walk: false };
}
function updateSurv(dt) {
  const m = mask[I(S.x | 0, S.y | 0)]; if (m) S.mask = m;
  S.flinch = Math.max(0, S.flinch - dt); S.burst = Math.max(0, S.burst - dt);
  if (S.hp < 2 && !S.hidden) { S.breathT -= dt; if (S.breathT <= 0) { S.breathT = rand(2.5, 4.5); SFX.breath(); } }
  if (S.act) { survAct(dt); return; }
  if (S.hidden) { S.moving = S.running = false; return; }
  const inp = readInput();
  if (S.work) {
    const radioKeys = Q && Q.type === 'radio' && joy.id === null;
    if (!radioKeys && inp.mag > 0.4) stopWork();
    else { S.moving = S.running = false; S.dir = Math.atan2(S.work.cy - S.y, S.work.cx - S.x); return; }
  }
  if (inp.mag < 0.15) { S.moving = S.running = false; return; }
  everMoved = true;
  S.running = (inp.mag > 0.62 && !inp.walk) || S.burst > 0;
  const spd = S.burst > 0 ? CFG.sBurst : S.running ? CFG.sRun : CFG.sWalk;
  S.dir = Math.atan2(inp.y, inp.x);
  const ox = S.x, oy = S.y;
  moveEnt(S, Math.cos(S.dir) * spd * dt, Math.sin(S.dir) * spd * dt);
  const md = hyp(S.x - ox, S.y - oy);
  S.moving = md > 0.001; S.walk += md * 5.2;
  if (S.hp < 2 && S.moving) { S.dropT -= dt; if (S.dropT <= 0) { S.dropT = rand(.35, .7); if (splats.length > 150) splats.shift(); splats.push({ x: S.x + rand(-.15, .15), y: S.y + rand(-.1, .1), r: rand(.03, .07) }); } }
  if (S.running && S.moving) {
    S.markAcc += md;
    if (S.markAcc > CFG.markStep) { S.markAcc = 0; marks.push({ x: S.x + rand(-.18, .18), y: S.y + rand(-.12, .12), t: T, a: S.dir + rand(-.8, .8), l: rand(.3, .55) }); if (marks.length > 240) marks.splice(0, 40); }
    S.stepT -= dt; if (S.stepT <= 0) { S.stepT = .3; SFX.step(); }
  }
  const gt = gateAt[I(S.x | 0, S.y | 0)];
  if (gt && gt.open >= 1) win(gt);
}
function survAct(dt) {
  const a = S.act; a.t += dt; const p = Math.min(1, a.t / a.dur);
  if (a.kind === 'vault') { S.x = lerp(a.fx, a.tx, p); S.y = lerp(a.fy, a.ty, p); S.z = Math.sin(p * Math.PI) * a.h; S.moving = true; S.walk += dt * 9; }
  else if (a.kind === 'enter') { S.x = lerp(a.fx, a.L.cx, p); S.y = lerp(a.fy, a.L.cy + .2, p); a.L.anim = 1; S.moving = true; }
  else if (a.kind === 'exit') { S.x = lerp(a.L.cx, a.tx, p); S.y = lerp(a.L.cy + .2, a.ty, p); a.L.anim = 1; S.moving = true; }
  else S.moving = false;
  if (a.t >= a.dur) {
    S.act = null; S.z = 0;
    if (a.kind === 'enter') { S.hidden = a.L; S.x = a.L.cx; S.y = a.L.cy; }
    if (a.kind === 'vault' || a.kind === 'exit') resolve(S);
  }
}
function computeAction() {
  if (state !== 'play' || S.act) return null;
  if (S.hidden) return { kind: 'unhide' };
  if (S.work) return { kind: 'work' };
  let best = null, bs = 1e9;
  const take = (kind, o, sc) => { if (sc < bs) { bs = sc; best = { kind, o }; } };
  const chase = K.mode === 'chase';
  for (const p of pallets) {
    if (p.state === 2) continue;
    const dx = S.x - p.cx, dy = S.y - p.cy; if (dx * dx + dy * dy > 4) continue;
    const al = dx * p.ax.x + dy * p.ax.y, lat = Math.abs(dx * p.ax.y - dy * p.ax.x);
    if (lat > .55) continue;
    if (p.state === 0 && Math.abs(al) < 1.35) take('drop', p, Math.abs(al) - (chase ? 3 : 0.3));
    if (p.state === 1 && Math.abs(al) > .3 && Math.abs(al) < 1.45) take('vaultP', p, Math.abs(al) - 1.2);
  }
  for (const w of windows) {
    if (T < w.blockedUntil) continue;
    const dx = S.x - w.cx, dy = S.y - w.cy; if (dx * dx + dy * dy > 4) continue;
    const al = dx * w.ax.x + dy * w.ax.y, lat = Math.abs(dx * w.ax.y - dy * w.ax.x);
    if (lat < .5 && Math.abs(al) > .35 && Math.abs(al) < 1.4) take('vault', w, Math.abs(al) - (chase ? 1.6 : 1.0));
  }
  for (const t of tasks) { if (t.done) continue; const d = hyp(S.x - t.cx, S.y - t.cy); if (d < 1.35) take('task', t, d - .2); }
  for (const L of lockers) { const d = hyp(S.x - L.front.x, S.y - L.front.y); if (d < .7) take('hide', L, d + .25); }
  return best;
}
function doAction() {
  const a = actNow; if (!a) return;
  if (a.kind === 'task') startWork(a.o);
  else if (a.kind === 'drop') dropPallet(a.o);
  else if (a.kind === 'vault') vaultOver(a.o, true);
  else if (a.kind === 'vaultP') vaultOver(a.o, false);
  else if (a.kind === 'hide') hide(a.o);
  else if (a.kind === 'unhide') unhide();
}
function dropPallet(p) {
  const al = (S.x - p.cx) * p.ax.x + (S.y - p.cy) * p.ax.y;
  const kl = (K.x - p.cx) * p.ax.x + (K.y - p.cy) * p.ax.y;
  const s = Math.abs(al) > .15 ? Math.sign(al) : (kl ? -Math.sign(kl) : 1);
  p.state = 1; stats.pallets++;
  if (Math.abs(al) < .85) { S.x += p.ax.x * (s * .85 - al); S.y += p.ax.y * (s * .85 - al); }
  const klat = Math.abs((K.x - p.cx) * p.ax.y - (K.y - p.cy) * p.ax.x);
  const kBusy = K.act && K.act.kind === 'vault';
  if (!kBusy && Math.abs(kl) < .5 + K.r && klat < .5 + K.r * .5) {
    const side = Math.abs(kl) > .05 ? Math.sign(kl) : -s;
    K.x += p.ax.x * (side * (.5 + K.r + .03) - kl); K.y += p.ax.y * (side * (.5 + K.r + .03) - kl);
    K.act = { kind: 'stun', t: 0, dur: CFG.stun }; stats.stuns++; K.blood = 0; K.chaseT = 0; K.path = null; SFX.stun(); shake(.5);
    if (TUT) toast('Volltreffer – er ist betäubt!');
  }
  S.act = { kind: 'drop', t: 0, dur: .28 };
  if (TUT) TUT.flag.drop = true;
  noise(p.cx, p.cy, 16, false); SFX.pallet(); shake(.25);
  for (let i = 0; i < 14; i++) parts.push({ x: p.cx + rand(-.6, .6), y: p.cy + rand(-.3, .3), z: .1, vx: rand(-1, 1), vy: rand(-.5, .5), vz: rand(.5, 2), g: 6, life: rand(.4, .8), max: .8, col: '140,120,95', sz: .05 });
}
function vaultOver(o, isWin) {
  const al = (S.x - o.cx) * o.ax.x + (S.y - o.cy) * o.ax.y, s = Math.sign(al) || 1;
  const fast = S.running; stats.vaults++;
  const dur = isWin ? (fast ? CFG.sVaultFast : CFG.sVaultSlow) : CFG.sVaultPal;
  S.act = { kind: 'vault', t: 0, dur, fx: S.x, fy: S.y, tx: o.cx - o.ax.x * s * .88, ty: o.cy - o.ax.y * s * .88, h: isWin ? .5 : .32 };
  S.dir = Math.atan2(-o.ax.y * s, -o.ax.x * s);
  if (isWin) {
    if (TUT) TUT.flag.vault = true;
    o.vaults = o.vaults.filter(t => T - t < 40); o.vaults.push(T);
    if (o.vaults.length >= 3 && K.mode === 'chase') { o.blockedUntil = T + 15; o.vaults = []; }
  }
  if (fast) noise(o.cx, o.cy, isWin ? 13 : 8, false);
  SFX.vault(fast);
}
function hide(L) {
  S.act = { kind: 'enter', t: 0, dur: .45, fx: S.x, fy: S.y, L };
  const seen = killerSees() || (K.aware > .35 && (K.mask & S.mask));
  L.known = seen || (K.mode === 'chase' && T - K.seenT < CFG.track + .3);
  if (seen && K.mode !== 'chase') startChase();
  if (S.running) noise(L.cx, L.cy, 7, false);
  SFX.locker();
}
function unhide() {
  const L = S.hidden; S.hidden = null; L.known = false;
  S.act = { kind: 'exit', t: 0, dur: .38, L, tx: L.front.x, ty: L.front.y };
  S.dir = Math.atan2(L.front.y - L.cy, L.front.x - L.cx);
  SFX.locker();
}

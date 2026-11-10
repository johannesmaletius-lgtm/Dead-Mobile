'use strict';
/* Dead Mobile – Überlebender: Eingabe, Bewegung, Aktionen (Palette, Fenster, Spind) */
/* ================= Überlebender ================= */
const joy = { id: null, bx: 0, by: 0, x: 0, y: 0 };
const JOY_R = 54;
const keys = { u: 0, d: 0, l: 0, r: 0, shift: 0 };
let actHeld = false; // Aktionsknopf/-taste gerade gedrückt (Retten = halten)
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
  if (MODE === 'team' && S.kind !== 'local') { updateOther(S, dt); return; }   // nur Zuschauer/Simulation: S ist ein Bot
  if (MODE === 'team' && teamSurv(S, dt)) return;
  survTick(S, dt);
  if (S.hp < 2 && !S.hidden) { S.breathT -= dt; if (S.breathT <= 0) { S.breathT = rand(2.5, 4.5); SFX.breath(); } }
  if (S.act) { survAct(S, dt); return; }
  if (S.hidden) { S.moving = S.running = false; return; }
  const inp = readInput();
  if (S.work) {
    const radioKeys = Q && Q.type === 'radio' && joy.id === null;
    if (!radioKeys && inp.mag > 0.4) stopWork();
    else { const ws = S.work.stations ? S.work.stations[S.station] : S.work; S.moving = S.running = false; S.dir = Math.atan2(ws.cy - S.y, ws.cx - S.x); return; }
  }
  if (inp.mag < 0.15) { S.moving = S.running = false; return; }
  everMoved = true;
  survMove(S, inp, dt);
}
/* Grundpflege jedes Survivors pro Schritt */
function survTick(sv, dt) {
  const m = mask[I(sv.x | 0, sv.y | 0)]; if (m) sv.mask = m;
  sv.flinch = Math.max(0, sv.flinch - dt); sv.burst = Math.max(0, sv.burst - dt);
}
/* Laufen nach Eingabe-Vektor {x, y, mag, walk} (eigene Figur, auch für Bots nutzbar). Am Boden (hp 0): kriechen. */
function survMove(sv, inp, dt) {
  sv.running = sv.hp > 0 && ((inp.mag > 0.62 && !inp.walk) || sv.burst > 0);
  const spd = sv.hp <= 0 ? CFG.crawl : sv.burst > 0 ? CFG.sBurst : sv.running ? CFG.sRun : CFG.sWalk;
  sv.dir = Math.atan2(inp.y, inp.x);
  const ox = sv.x, oy = sv.y;
  moveEnt(sv, Math.cos(sv.dir) * spd * dt, Math.sin(sv.dir) * spd * dt);
  survMoved(sv, hyp(sv.x - ox, sv.y - oy), dt);
}
/* Nach jeder Bewegung: Animation, Blutstropfen, Kratzspuren, Schritte, Tor */
function survMoved(sv, md, dt) {
  sv.moving = md > 0.001; sv.walk += md * 5.2;
  if (sv.hp < 2 && sv.moving) { sv.dropT -= dt; if (sv.dropT <= 0) { sv.dropT = rand(.35, .7); if (splats.length > 150) splats.shift(); splats.push({ x: sv.x + rand(-.15, .15), y: sv.y + rand(-.1, .1), r: rand(.03, .07) }); } }
  if (sv.running && sv.moving) {
    sv.markAcc += md;
    if (sv.markAcc > CFG.markStep) { sv.markAcc = 0; marks.push({ x: sv.x + rand(-.18, .18), y: sv.y + rand(-.12, .12), t: T, a: sv.dir + rand(-.8, .8), l: rand(.3, .55), o: sv.id }); if (marks.length > 240) marks.splice(0, 40); }
    sv.stepT -= dt; if (sv.stepT <= 0) { sv.stepT = .3; if (sv === S) SFX.step(); }
  }
  const gt = gateAt[I(sv.x | 0, sv.y | 0)];
  if (gt && gt.open >= 1) { if (MODE === 'team') escapeSurv(sv, gt); else win(gt); }
}
/* Andere Überlebende (Bots, Mitspieler): sv.ctl(sv, dt) steuert (Bot-KI bzw. Netz).
   ctl läuft auch am Boden, getragen und am Haken (Kriechen, wiggle) – Getragene/Hängende behalten ihre Position. */
function updateOther(sv, dt) {
  if (sv.out || sv.ghost) return;
  survTick(sv, dt);
  if (sv.act) { survAct(sv, dt); return; }
  if (sv.ctl) sv.ctl(sv, dt); else sv.moving = sv.running = false;
  if (sv.hung) { sv.x = sv.hung.front.x; sv.y = sv.hung.front.y; sv.moving = sv.running = false; }
  else if (sv.carried) { sv.x = K.x; sv.y = K.y; sv.moving = sv.running = false; }
}
function survAct(sv, dt) {
  const a = sv.act; a.t += dt; const p = Math.min(1, a.t / a.dur);
  if (a.kind === 'vault') { sv.x = lerp(a.fx, a.tx, p); sv.y = lerp(a.fy, a.ty, p); sv.z = Math.sin(p * Math.PI) * a.h; sv.moving = true; sv.walk += dt * 9; }
  else if (a.kind === 'enter') { sv.x = lerp(a.fx, a.L.cx, p); sv.y = lerp(a.fy, a.L.cy + .2, p); a.L.anim = 1; sv.moving = true; }
  else if (a.kind === 'exit') { sv.x = lerp(a.L.cx, a.tx, p); sv.y = lerp(a.L.cy + .2, a.ty, p); a.L.anim = 1; sv.moving = true; }
  else sv.moving = false;
  if (a.t >= a.dur) {
    sv.act = null; sv.z = 0;
    if (a.kind === 'enter') { sv.hidden = a.L; sv.x = a.L.cx; sv.y = a.L.cy; }
    if (a.kind === 'vault' || a.kind === 'exit') resolve(sv);
  }
}
function computeAction() {
  if (state === 'play' && KP === 'local') return killerAction();   // Killer-Spieler (js/hkiller.js)
  if (state !== 'play' || S.act) return null;
  if (MODE === 'team') { const a = teamActionPre(); if (a !== undefined) return a; }
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
  // Normale Aufgaben (besetzte sind tabu); die Duo-Stationen prüft teamActions
  for (const t of tasks) { if (t.done || t.type === 'duo' || isWorked(t)) continue; const d = hyp(S.x - t.cx, S.y - t.cy); if (d < 1.35) take('task', t, d - .2); }
  // Team: Duo-Station (st = 0|1), Heilen, Retten
  if (MODE === 'team') teamActions((kind, o, sc, st) => { if (sc < bs) { bs = sc; best = { kind, o, st }; } });
  for (const L of lockers) { const d = hyp(S.x - L.front.x, S.y - L.front.y); if (d < .7) take('hide', L, d + .25); }
  return best;
}
function doAction() {
  const a = actNow; if (!a) return;
  if (KP === 'local') { killerDo(a); return; }
  if (a.kind === 'task') { if (a.o.type === 'duo') startWorkFor(S, a.o, a.st); else startWork(a.o); }
  else if (a.kind === 'wiggle') wiggle(S);
  else if (a.kind === 'heal') startHeal(S, a.o);
  else if (a.kind === 'rescue') startUnhook(S, a.o);
  else if (a.kind === 'drop') dropPallet(a.o);
  else if (a.kind === 'vault') vaultOver(a.o, true);
  else if (a.kind === 'vaultP') vaultOver(a.o, false);
  else if (a.kind === 'hide') hide(a.o);
  else if (a.kind === 'unhide') unhide();
}
function dropPallet(p, sv = S) {
  const al = (sv.x - p.cx) * p.ax.x + (sv.y - p.cy) * p.ax.y;
  const kl = (K.x - p.cx) * p.ax.x + (K.y - p.cy) * p.ax.y;
  const s = Math.abs(al) > .15 ? Math.sign(al) : (kl ? -Math.sign(kl) : 1);
  p.state = 1; stats.pallets++;
  if (Math.abs(al) < .85) { sv.x += p.ax.x * (s * .85 - al); sv.y += p.ax.y * (s * .85 - al); }
  // Team: Steht ein anderer Überlebender gerade in der Lücke, schiebt ihn die Palette auf seine Seite (sonst klemmt er fest)
  if (MODE === 'team') for (const v of SV) {
    if (v === sv || !inPlay(v) || v.carried || v.hung || v.hidden) continue;
    const va = (v.x - p.cx) * p.ax.x + (v.y - p.cy) * p.ax.y, vl = Math.abs((v.x - p.cx) * p.ax.y - (v.y - p.cy) * p.ax.x);
    if (Math.abs(va) < .5 + v.r && vl < .5 + v.r) { const vs = Math.abs(va) > .05 ? Math.sign(va) : s; if (v.act && v.act.kind === 'vault') { v.act = null; v.z = 0; } v.x += p.ax.x * (vs * .85 - va); v.y += p.ax.y * (vs * .85 - va); }
  }
  const klat = Math.abs((K.x - p.cx) * p.ax.y - (K.y - p.cy) * p.ax.x);
  const kBusy = K.act && K.act.kind === 'vault';
  if (!kBusy && Math.abs(kl) < .5 + K.r && klat < .5 + K.r * .5) {
    const side = Math.abs(kl) > .05 ? Math.sign(kl) : -s;
    K.x += p.ax.x * (side * (.5 + K.r + .03) - kl); K.y += p.ax.y * (side * (.5 + K.r + .03) - kl);
    K.act = { kind: 'stun', t: 0, dur: CFG.stun }; stats.stuns++; K.blood = 0; K.chaseT = 0; K.path = null; K.mem.stuns++; K.loop.alt = null; hear(p.cx, p.cy, () => { SFX.stun(); shake(sv === S ? .5 : .3); });
    if (MODE === 'team' && K.carry) dropCarried('pallet'); // Paletten-Stun beim Tragen: er lässt fallen
    if (TUT) toast('Volltreffer – er ist betäubt!');
  }
  sv.act = { kind: 'drop', t: 0, dur: .28 };
  if (TUT) TUT.flag.drop = true;
  noise(p.cx, p.cy, 16, false); hear(p.cx, p.cy, SFX.pallet); if (sv === S) shake(.25);
  for (let i = 0; i < 14; i++) parts.push({ x: p.cx + rand(-.6, .6), y: p.cy + rand(-.3, .3), z: .1, vx: rand(-1, 1), vy: rand(-.5, .5), vz: rand(.5, 2), g: 6, life: rand(.4, .8), max: .8, col: '140,120,95', sz: .05 });
}
function vaultOver(o, isWin, sv = S) {
  const al = (sv.x - o.cx) * o.ax.x + (sv.y - o.cy) * o.ax.y, s = Math.sign(al) || 1;
  const fast = sv.running; stats.vaults++;
  const dur = isWin ? (fast ? CFG.sVaultFast : CFG.sVaultSlow) : CFG.sVaultPal;
  sv.act = { kind: 'vault', t: 0, dur, fx: sv.x, fy: sv.y, tx: o.cx - o.ax.x * s * .88, ty: o.cy - o.ax.y * s * .88, h: isWin ? .5 : .32 };
  sv.dir = Math.atan2(-o.ax.y * s, -o.ax.x * s);
  if (isWin) {
    if (TUT) TUT.flag.vault = true;
    o.vaults = o.vaults.filter(t => T - t < 40); o.vaults.push(T);
    if (o.vaults.length >= 3 && K.mode === 'chase') { o.blockedUntil = T + 15; o.vaults = []; }
    // Team: der Killer merkt sich, wer immer wieder durchs selbe Fenster springt (smartChase in js/killer.js)
    if (MODE === 'team') { const lw = sv.lastWin; if (lw && lw.w === o && T - lw.t < 20) { lw.n++; lw.t = T; } else sv.lastWin = { w: o, n: 1, t: T, set: new Set([I(o.x, o.y)]) }; }
  }
  if (fast) noise(o.cx, o.cy, isWin ? 13 : 8, false);
  hear(o.cx, o.cy, () => SFX.vault(fast));
}
function hide(L, sv = S) {
  sv.act = { kind: 'enter', t: 0, dur: .45, fx: sv.x, fy: sv.y, L };
  const seen = killerSees(sv) || (K.aware > .35 && (K.mask & sv.mask));
  L.known = seen || (K.mode === 'chase' && T - K.seenT < CFG.track + .3);
  if (seen && K.mode !== 'chase') startChase(sv);
  if (MODE === 'team' && ((K.mode === 'chase' && K.target === sv) || hyp(K.x - L.cx, K.y - L.cy) < 12)) L.uses++;   // er lernt beliebte Verstecke
  if (sv.running) noise(L.cx, L.cy, 7, false);
  hear(L.cx, L.cy, SFX.locker);
}
function unhide(sv = S) {
  const L = sv.hidden; sv.hidden = null; L.known = false;
  sv.act = { kind: 'exit', t: 0, dur: .38, L, tx: L.front.x, ty: L.front.y };
  sv.dir = Math.atan2(L.front.y - L.cy, L.front.x - L.cx);
  hear(L.cx, L.cy, SFX.locker);
}

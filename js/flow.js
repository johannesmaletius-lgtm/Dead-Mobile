'use strict';
/* Dead Mobile – Treffer, Erwischt, Haken-Sequenz, Sieg, Endbildschirm, Welt-Update, Kamera */
/* ================= Treffer / Erwischt / Haken ================= */
function hitSurvivor(sv = S) {
  if (state !== 'play') return;
  if (sv.hp <= 1 && !TUT) { if (MODE === 'team') downSurv(sv); else caught(sv); return; }
  const wasHurt = sv.hp <= 1;
  if (MODE === 'team') { clearInteract(sv); K.hunt.t = 0; K.loop.t = 0; K.kstats.hits++; }
  if (sv.hidden) { sv.x = sv.hidden.front.x; sv.y = sv.hidden.front.y; sv.hidden.known = false; sv.hidden = null; }
  if (sv.work) { if (sv === S) stopWork(); else sv.work = null; }
  if (sv.act && sv.act.kind !== 'vault') { sv.act = null; sv.z = 0; resolve(sv); }
  sv.hp = 1; sv.burst = CFG.burstT; sv.flinch = .3;
  K.act = { kind: 'wipe', t: 0, dur: CFG.wipe }; K.seenT = T; K.lastSeen = { x: sv.x, y: sv.y }; K.blood = 0; K.chaseT = 0;
  hear(sv.x, sv.y, () => { SFX.hit(); SFX.gasp(); });
  if (sv === S) { flash = .75; flashCol = '195,18,31'; shake(.55); slowT = .12; } else shake(.2);
  for (let i = 0; i < 22; i++) parts.push({ x: sv.x, y: sv.y, z: .7, vx: rand(-2.5, 2.5), vy: rand(-1.5, 1.5), vz: rand(.5, 3), g: 9, life: rand(.5, 1), max: 1, col: '150,10,18', sz: .06, splat: 1 });
  if (TUT) { TUT.flag.hit = true; if (wasHurt) toast('Autsch! Im echten Spiel wärst du jetzt am Haken.'); }
}
function caught(sv = S) {
  if (state !== 'play') return;
  if (TUT) { hitSurvivor(); return; }
  state = 'caught'; Q = null; S.work = null; S.act = null; S.z = 0;
  if (S.hidden) { S.x = S.hidden.front.x; S.y = S.hidden.front.y; S.hidden = null; }
  K.act = null; K.path = null; K.z = 0;
  let best = hooks[0], bl = 1e9;
  for (const h of hooks) { const p = findPath(K.x | 0, K.y | 0, h.front.x | 0, h.front.y | 0); const l = p ? p.length : 1e9; if (l < bl) { bl = l; best = h; } }
  seq = { phase: 'hit', t: 0, hook: best };
  stats.end = T;
  SFX.hit(); flash = 1; flashCol = '195,18,31'; shake(.7); slowT = .45;
  for (let i = 0; i < 30; i++) parts.push({ x: S.x, y: S.y, z: .7, vx: rand(-2.5, 2.5), vy: rand(-1.5, 1.5), vz: rand(.5, 3), g: 9, life: rand(.5, 1), max: 1, col: '150,10,18', sz: .06, splat: 1 });
  $('#pauseBtn').hidden = true;
}
function updateSeq(dt) {
  const q = seq; q.t += dt; const h = q.hook;
  if (q.phase === 'hit') { if (q.t > .95) { q.phase = 'carry'; q.t = 0; S.carried = true; K.path = null; } }
  else if (q.phase === 'carry') {
    let arrived = false;
    if (K.act) runAct(dt); else arrived = goTo(K, h.front.x, h.front.y, 4.8, dt);
    S.x = K.x; S.y = K.y;
    if (arrived || q.t > 5.5) { K.x = h.front.x; K.y = h.front.y; K.act = null; K.z = 0; K.moving = false; K.dir = Math.atan2(h.cy - K.y, h.cx - K.x); q.phase = 'lift'; q.t = 0; }
  } else if (q.phase === 'lift') {
    if (q.t > .55) {
      q.phase = 'hung'; q.t = 0; S.carried = false; S.hung = h;
      { const fx = h.front.x | 0, fy = h.front.y | 0, side = kc(fx - 1, fy) === 1 ? -1 : 1; K.x = h.front.x + side * .95; K.y = h.front.y + .1; K.dir = Math.PI / 2; } SFX.clang(); SFX.scream(); shake(.8); flash = .8; flashCol = '195,18,31';
      for (let i = 0; i < 26; i++) parts.push({ x: h.cx + .3, y: h.cy + .1, z: 1.3, vx: rand(-2, 2), vy: rand(-1, 1.5), vz: rand(-1, 2), g: 9, life: rand(.6, 1.2), max: 1.2, col: '150,10,18', sz: .06, splat: 1 });
    }
  } else if (q.phase === 'hung') {
    if (q.t > .6) K.dir = turn(K.dir, Math.PI / 2, dt * 4);
    if (q.t > 3.4) { q.phase = 'fade'; q.t = 0; }
  } else if (q.phase === 'fade') {
    if (q.t > 1.3 && !q.shown) { q.shown = true; showEnd(false); }
  }
}
function win(g) {
  state = 'won'; stats.end = T; seq = { t: 0, g }; Q = null; S.work = null;
  SFX.win();
  const t = stats.end - stats.t0;
  save.wins++; if (!save.best || t < save.best) save.best = t; persist();
  $('#pauseBtn').hidden = true;
}
function showEnd(won, extra = 0) {
  state = 'end';
  const w = $('#endWord'); w.textContent = won ? 'Escaped' : 'Sacrificed'; w.className = 'logo ' + (won ? 'win' : 'lose');
  endWon = won;
  const dur = Math.max(1, stats.end - stats.t0), tries = stats.checks + stats.fails;
  // Bewertung: Flucht, Skill-Checks, gewonnene Chases, Betäubungen, wenig Chase-Zeit
  const score = Math.round(Math.min(100, (won ? 35 : 0) + (tries ? 20 * stats.checks / tries : 0) + Math.min(stats.chasesWon, 4) * 5
    + Math.min(stats.stuns, 3) * 5 + 10 * Math.max(0, 1 - stats.chase / dur * 2) + extra));
  const g = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  $('#grade').textContent = g; $('#grade').className = score >= 60 ? '' : 'lo'; $('#score').textContent = score + ' / 100';
  const rows = [['Chase Time', fmt(stats.chase)], ['Escapes', save.wins], ['Pallets Thrown', stats.pallets], ['Windows Vaulted', stats.vaults],
    ['Killer Stuns', stats.stuns], ['Chases Won', stats.chasesWon], ['Skill Checks', stats.checks + '/' + tries]];
  $('#sgrid').innerHTML = rows.map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join('');
  const ic = { gen: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>', fuse: '<path d="M7 3h10v18H7zM10 16l4-8" stroke="currentColor"/>', radio: '<path d="M8 8h9v14H8zM14 8V2h1.5v6z"/>', duo: '<path d="M2 7h7v13H2zM15 7h7v13h-7zM9 13h6v2H9z"/>', valve: '<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z"/><path d="M11 3h2v18h-2zM3 11h18v2H3z"/>' };
  $('#endStats').innerHTML = tasks.map(t => `<svg viewBox="0 0 24 24" class="${t.done ? 'ic-on' : 'ic-off'}">${ic[t.type]}</svg>`).join('') + `<span class="time">${fmt(stats.end - stats.t0)}</span>`;
  const eb = $('#endBest');
  if (save.best) { eb.hidden = false; eb.innerHTML = gateSvg + fmt(save.best); } else eb.hidden = true;
  $('#end').hidden = false; $('#pauseBtn').hidden = true;
  setTimeout(() => { try { $('#again').focus({ preventScroll: true }); } catch (e) {} }, 50);
}
const gateSvg = '<svg viewBox="0 0 24 24"><path d="M3 21V5h2v16zM19 21V5h2v16zM3 4h18v2H3zM8 7h1.5v14H8zM11.3 7h1.5v14h-1.5zM14.6 7h1.5v14h-1.5z"/></svg>';
/* Team-Modus: am Boden, Tragen, Haken, Entkommen, Team-Ende → js/rules.js */
const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ================= Welt-Update ================= */
function shake(v) { cam.sh = Math.max(cam.sh, REDUCED ? v * .25 : v); }
function step(dt) {
  if (slowT > 0) { slowT -= dt; dt *= .3; }
  T += dt;
  if (state === 'play' && K && K.mode === 'chase' && (MODE !== 'team' || K.target === S)) stats.chase += dt;
  if (MODE === 'team' && state === 'play') chaseCue();
  if (state === 'play') {
    updateSurv(dt);
    if (SV.length > 1) for (const sv of SV) if (sv !== S) updateOther(sv, dt);
    if (Q && state === 'play') updateQTE(dt);
    if (state === 'play') updateKiller(dt);
    if (state === 'play' && MODE === 'team') teamStep(dt);
    if (state === 'play' && TUT) tutUpdate(dt);
    actNow = state === 'play' ? computeAction() : null;
  } else if (state === 'caught') updateSeq(dt);
  else if (state === 'won') {
    seq.t += dt; const g = seq.g;
    S.dir = g.north ? -Math.PI / 2 : Math.PI / 2; S.moving = true; S.running = true; S.walk += dt * 20;
    S.y += (g.north ? -1 : 1) * 2.6 * dt;
    if (K.act) runAct(dt); else if (hyp(K.x - S.x, K.y - S.y) > 2) goTo(K, S.x, S.y + (g.north ? 1.5 : -1.5), CFG.kChase, dt);
    if (seq.t > 1.8 && !seq.shown) { seq.shown = true; showEnd(true); }
  } else if (state === 'title' || state === 'end') {
    if (K.act) runAct(dt);
    else { if (!K.goal) { const i = pick(roomFloor[pick(MAPDEF.demoRooms || allRooms())]); K.goal = { x: i % W + .5, y: ((i / W) | 0) + .5 }; } if (goTo(K, K.goal.x, K.goal.y, CFG.kPatrol, dt)) { K.goal = null; K.act = { kind: 'look', t: 0, dur: rand(1, 2), base: K.dir }; } }
    const m = mask[I(K.x | 0, K.y | 0)]; if (m) K.mask = m;
  }
  // Welt
  for (const g of gates) if (gatesPowered) g.open = Math.min(1, g.open + dt / 2.2);
  for (const L of lockers) if (L.anim > 0 && !SV.some(v => v.act && v.act.L === L) && !(K.act && K.act.L === L)) L.anim = Math.max(0, L.anim - dt * 2.5);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.vz -= p.g * dt; p.z += p.vz * dt;
    if (p.z < 0) { p.z = 0; if (p.splat && splats.length < 90) { splats.push({ x: p.x, y: p.y, r: rand(.04, .1) }); p.splat = 0; } p.vz *= -.25; p.vx *= .5; p.vy *= .5; }
    if (p.life <= 0) parts.splice(i, 1);
  }
  if (noises.length && T - noises[0].t > 1.2) noises.shift();
  flash = Math.max(0, flash - dt * 1.6); chaseFlash = Math.max(0, chaseFlash - dt * 1.4);
  if (state === 'end' && endWon) {
  }
  if (MODE === 'team' && Sync.active) Sync.tick(dt);   // Online: Zustand verschicken (js/sync.js)
  cam.sh = Math.max(0, cam.sh - dt * 2.2);
  updateCamera(dt);
  updateHeart(dt);
}
function updateCamera(dt) {
  let tx, ty, tz = 1;
  if (state === 'title' || state === 'end') { tx = K.x; ty = K.y - .5; tz = 1.05; }
  else if (state === 'caught') {
    const q = seq, h = q.hook;
    if (q.phase === 'hit' || q.phase === 'carry') { tx = K.x; ty = K.y - .5; tz = 1.15; }
    else { tx = h.cx + .2; ty = h.cy + .1; tz = 2.1; }
  } else {
    const V = viewer();
    tx = V.x; ty = V.y - .4;
    if (V.work || (V === S && S.heal)) { const portrait = VH > VW; ty += portrait ? 2.2 : 1.6; }
    if (MODE !== 'team') { if (K.mode === 'chase' && state === 'play') tz = .9; }
    else if (state === 'play' && chasedView() && !V.out) tz = KP === 'local' ? 1.06 : CFG.chaseZoom;   // Team: wer gejagt wird, sieht näher ran
    if (MODE === 'team' && state === 'play') { if (V.hung) { ty -= 1.6; tz = 1.25; } else if (V.hp <= 0 && !V.out) tz = 1.12; }
  }
  const k = 1 - Math.exp(-dt * (state === 'caught' ? 3 : 6));
  cam.x = lerp(cam.x, tx, k); cam.y = lerp(cam.y, ty, k); cam.z = lerp(cam.z, tz, 1 - Math.exp(-dt * 2.5));
  const z = TP * cam.z, hw = VW / 2 / z, hh = VH / 2 / z;
  if (state === 'title' || state === 'end') {
    cam.x = hw * 2 > W ? W / 2 : clamp(cam.x, hw - .5, W - hw + .5);
    cam.y = hh * 2 > H ? H / 2 : clamp(cam.y, hh - 1, H - hh + .5);
  }
}
/* Team: Stich und roter Blitz nur für den, der ab jetzt gejagt wird (nicht für das ganze Team) */
let cuePrev = false;
function chaseCue() {
  const now = chasedView();
  if (now && !cuePrev) { SFX.sting(); chaseFlash = 1; }
  cuePrev = now;
}
function updateHeart(dt) {
  const V = viewer();
  if (state === 'play' && V && !V.ghost && V !== K) {
    const d = hyp(V.x - K.x, V.y - K.y);
    terror = clamp(1 - (d - 2) / 12, 0, 1);
    if (terror > 0 && T >= hbNext) { SFX.heart(.25 + .75 * terror); hbPulse = 1; hbNext = T + lerp(1.15, .42, terror); }
  } else terror = Math.max(0, terror - dt);
  hbPulse = Math.max(0, hbPulse - dt * 2.6);
}

'use strict';
/* Dead Mobile – Licht, Leuchten, Klauen, Bild zusammensetzen (render) */
/* ---- Licht ---- */
function lg(c, x, y, r, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
function flick(L) { if (!L.fl) return 1; const n = Math.sin(T * 13 + L.x) * Math.sin(T * 7.3 + L.y * 2); return n > 1 - L.fl * 1.4 ? .25 : 1; }
/* Lichtkegel mit Schatten: Strahlen bis zum ersten hohen Hindernis (Wand, Regal, Spind …); Fenster lassen Licht durch.
   Liefert ein Path2D in Weltkoordinaten (Spitze bei x, y). */
function rayHit(x, y, dx, dy, R) {
  let tx = Math.floor(x), ty = Math.floor(y), t = 0;
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, ddx = dx ? Math.abs(1 / dx) : 1e9, ddy = dy ? Math.abs(1 / dy) : 1e9;
  let mx = (dx > 0 ? tx + 1 - x : x - tx) * ddx, my = (dy > 0 ? ty + 1 - y : y - ty) * ddy;
  while (t < R) {
    if (mx < my) { t = mx; mx += ddx; tx += sx; } else { t = my; my += ddy; ty += sy; }
    const c = ch(tx, ty);
    if (TALL.has(c) && !(c === 'E' && gateAt[I(tx, ty)] && gateAt[I(tx, ty)].open >= 1)) return Math.min(R, t + .55);   // ein Stück in die Wand: ihre Front wird hell
  }
  return R;
}
function conePath(x, y, dir, half, R, n = 56) {
  const p = new Path2D(); p.moveTo(x, y);
  for (let i = 0; i <= n; i++) {
    const a = dir - half + 2 * half * i / n, dx = Math.cos(a), dy = Math.sin(a), t = rayHit(x, y, dx, dy, R);
    p.lineTo(x + dx * t, y + dy * t);
  }
  p.closePath(); return p;
}
/* Farbiges Licht in Viertelauflösung (weiche Kanten), wird additiv aufs Bild gelegt */
const gcv = document.createElement('canvas'), gx = gcv.getContext('2d');
let lightTf = null;
/* Wer leuchtet wie: Überlebende haben eine Taschenlampe, der Killer-Spieler einen breiten, rötlichen Blick */
let beam = null;
function viewBeam(V) {
  beam = null;
  if (state !== 'play' || !V || V.hidden) return;
  const kp = ROLE === 'killer';
  if (!kp && MODE === 'team' && !(V.hp > 0 && !V.carried && !V.hung && !V.out)) return;   // nur aufrecht
  const R = kp ? 9.5 : 8, half = kp ? .78 : .52;
  beam = { x: V.x, y: V.y - .12, R, kp, path: conePath(V.x, V.y - .12, V.dir, half, R) };
}
/* Gewitter (Karten mit weather 'rain'): Blitze nach festem Zeitplan (kein Math.random – das Spiel bleibt reproduzierbar) */
let boltK = -1;
function lightning() {
  if (WEATHER !== 'rain' || REDUCED) return 0;
  const k = Math.floor(T / 29), at = k * 29 + 5 + hash(k, 71) * 18, d = T - at;
  if (d < 0 || d > .9) return 0;
  if (boltK !== k && d > .25) { boltK = k; if (state !== 'paused') SFX.thunder(.35 + hash(k, 5) * .5); }
  return d < .09 ? 1 : d < .16 ? .15 : d < .26 ? .8 : Math.max(0, .5 * (1 - (d - .26) / .6));
}
function visibleMask() {
  if (state === 'title' || state === 'end') return K.mask;
  if (state === 'caught') { const q = seq; return (q.phase === 'hit' || q.phase === 'carry') ? K.mask : (mask[I(q.hook.front.x | 0, q.hook.front.y | 0)] || K.mask); }
  return viewer().mask;
}
function drawLight(z, ox, oy, visM) {
  const s = z * LS;
  lx.globalCompositeOperation = 'source-over'; lx.setTransform(1, 0, 0, 1, 0, 0);
  // Nachtblau statt Schwarz: unbeleuchtete Flächen wirken wie im Mondschein
  lx.fillStyle = 'rgb(4,7,18)'; lx.fillRect(0, 0, lc.width, lc.height);
  lx.globalCompositeOperation = 'destination-out';
  lx.fillStyle = 'rgba(0,0,0,.13)'; lx.fillRect(0, 0, lc.width, lc.height);
  lx.setTransform(s, 0, 0, s, ox * LS, oy * LS); lightTf = { s, ox, oy, z };
  // Grundhelligkeit: im Spiel etwas dunkler (das Licht macht den Unterschied), Blitze erhellen kurz alles im Freien
  const bolt = lightning(), dim = state === 'title' || state === 'end' ? .85 : ROLE === 'killer' ? .95 : .8;
  for (let r = 1; r <= NR; r++) if ((visM & (1 << r)) && roomPath[r]) { const o = ROOMS[r].out; lx.fillStyle = `rgba(0,0,0,${Math.min(.95, ROOMS[r].amb * (o ? Math.max(dim, .9) : dim) + (o ? bolt * .4 : bolt * .08))})`; lx.fill(roomPath[r]); }
  if (bolt > 0 && OUTMASK & ~visM) { lx.fillStyle = `rgba(0,0,0,${bolt * .3})`; lx.fill(maskPath(OUTMASK & ~visM)); }
  lx.save(); lx.clip(maskPath(visM));
  const V = viewer();
  viewBeam(V);
  if (state === 'play' && !V.hidden) {
    lg(lx, V.x, V.y - .5, 3.8, .82);
    if (beam) {
      const g = lx.createRadialGradient(beam.x, beam.y, .3, beam.x, beam.y, beam.R);
      g.addColorStop(0, `rgba(0,0,0,${beam.kp ? .6 : .92})`); g.addColorStop(.55, `rgba(0,0,0,${beam.kp ? .4 : .7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      lx.fillStyle = g; lx.fill(beam.path);
    }
  }
  // Teamkollegen tragen auch ein kleines Licht
  for (const sv of SV) if (sv !== V && state === 'play' && survShown(sv, visM)) lg(lx, sv.x, sv.y - .5, 2.4, .6);
  if (MODE === 'team' && state === 'play') for (const sv of SV) if (sv.hung && (visM & (1 << roomAt(sv.hung.front.x, sv.hung.front.y)))) lg(lx, sv.hung.cx + .3, sv.hung.cy - .3, 2.2, .55);
  if (state !== 'play' && K) lg(lx, K.x, K.y - .5, 3, .6);
  for (const L of LAMPS) if (visM & (1 << L.room)) lg(lx, L.x, L.y, L.r, L.moon ? Math.min(.9, L.a * (1 + bolt * 1.4)) : L.a * flick(L));
  for (const t of tasks) if (t.done && (visM & (1 << t.room))) lg(lx, t.cx, t.cy - .4, 3.6, .8);
  if (state === 'caught' && seq.phase !== 'hit' && seq.phase !== 'carry') lg(lx, seq.hook.cx, seq.hook.cy, 3, .7);
  if (MODE === 'team') for (const d of deaths) if (T - d.t0 < 3) lg(lx, d.h.cx + .3, d.h.cy + .4, 3, .7 * clamp((3 - (T - d.t0)) / .6, 0, 1));
  lx.restore();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(lc, 0, 0, lc.width, lc.height, 0, 0, lc.width / LS, lc.height / LS);
}
function glow(x, y, r, col) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
function stains() {
  const out = [], S = viewer();
  if (state !== 'play' || killerVisible() || hyp(K.x - S.x, K.y - S.y) > 16) return out;
  for (const o of openings) {
    const d = hyp(K.x - o.cx, K.y - o.cy); if (d > 4.8) continue;
    for (let k = 0; k < 2; k++) {
      const me = o.sides[k], other = o.sides[1 - k];
      if (!(S.mask & (1 << me.r)) || !(K.mask & (1 << other.r))) continue;
      let s = clamp((4.8 - d) / 3.3, 0, 1);
      if (d > 1.6) s *= .45 + .55 * clamp(Math.cos(angDiff(Math.atan2(o.cy - K.y, o.cx - K.x), K.dir)), 0, 1);
      out.push({ x: me.x, y: me.y, s });
    }
  }
  return out;
}
function drawGlows(visM) {
  ctx.globalCompositeOperation = 'lighter';
  const bolt = lightning();
  for (const L of LAMPS) if (visM & (1 << L.room)) glow(L.x, L.y, L.r * (L.moon ? 1 : .9), L.moon ? `rgba(120,160,255,${.07 + bolt * .2})` : L.red ? `rgba(255,40,25,${.18 * flick(L)})` : `rgba(255,190,120,${.11 * flick(L)})`);
  // Lichtkegel: warm (Taschenlampe) bzw. rötlich (Blick des Killers), dazu Staub im Strahl
  if (beam && lightTf) {
    if (gcv.width !== lc.width || gcv.height !== lc.height) { gcv.width = lc.width; gcv.height = lc.height; }
    gx.setTransform(1, 0, 0, 1, 0, 0); gx.clearRect(0, 0, gcv.width, gcv.height);
    gx.setTransform(lightTf.s, 0, 0, lightTf.s, lightTf.ox * LS, lightTf.oy * LS);
    gx.save(); gx.clip(maskPath(visM));
    const g = gx.createRadialGradient(beam.x, beam.y, .2, beam.x, beam.y, beam.R);
    g.addColorStop(0, beam.kp ? 'rgba(255,70,55,.12)' : 'rgba(255,222,165,.24)'); g.addColorStop(.6, beam.kp ? 'rgba(255,50,40,.06)' : 'rgba(255,214,150,.11)'); g.addColorStop(1, 'rgba(255,200,140,0)');
    gx.fillStyle = g; gx.fill(beam.path); gx.restore();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(gcv, 0, 0, gcv.width, gcv.height, 0, 0, gcv.width / LS, gcv.height / LS);
    ctx.setTransform(DPR * lightTf.z, 0, 0, DPR * lightTf.z, DPR * lightTf.ox, DPR * lightTf.oy);
    ctx.save();
    if (!beam.kp && !REDUCED) {
      const V0 = viewer();
      for (let i = 0; i < 14; i++) {
        const a = V0.dir + (hash(i, 3) - .5) * .9, d = .8 + ((hash(i, 5) * 6 + T * (.18 + hash(i, 9) * .2)) % 6), x = beam.x + Math.cos(a) * d, y = beam.y + Math.sin(a) * d - .5 + Math.sin(T * 1.3 + i) * .12;
        if (losClear(beam.x, beam.y, x, y + .5)) { ctx.fillStyle = `rgba(255,235,200,${.3 * (1 - d / 7)})`; ctx.beginPath(); ctx.arc(x, y, .022 + hash(i, 1) * .02, 0, TAU); ctx.fill(); }
      }
    }
    ctx.restore();
  }
  if (WEATHER === 'fog') drawFog(visM);
  for (const t of tasks) if (t.done && (visM & (1 << t.room))) glow(t.cx, t.cy - .5, 2.4, 'rgba(255,220,150,.1)');
  if (killerVisible()) {
    const fx = K.x + Math.cos(K.dir) * 1.1, fy = K.y + Math.sin(K.dir) * 1.1;
    glow(fx, fy, 2.5, 'rgba(255,12,12,.3)'); glow(K.x, K.y - .6, .9, 'rgba(255,20,20,.12)');
  }
  const pulse = .75 + .25 * Math.sin(T * 7);
  for (const s of stains()) { glow(s.x, s.y, 2.7, `rgba(255,8,8,${.5 * s.s * pulse})`); glow(s.x, s.y, 1.1, `rgba(255,50,50,${.45 * s.s * pulse})`); }
  if (car.has && (visM & (1 << car.room))) {
    const rt = tasks.find(t => t.type === 'radio'), on = endgame || (rt && rt.done);
    if (on) { const b = Math.sin(T * 12) > 0; glow(car.x0 + (b ? 1.8 : 2.2), car.y0 - .1, 2.6, 'rgba(80,130,255,.35)'); }
  }
  for (const g of gates) glow((g.x0 + g.x1 + 1) / 2, g.y + .4 - 1.55, 1.3, gatesPowered ? 'rgba(90,255,150,.35)' : 'rgba(255,30,30,.2)');
  for (const n of noises) {
    const a = (T - n.t) / 1.2; if (a > 1) continue;
    ctx.strokeStyle = n.loud ? `rgba(255,40,40,${.8 * (1 - a)})` : `rgba(255,220,200,${.35 * (1 - a)})`; ctx.lineWidth = .08;
    for (let k = 0; k < 2; k++) { const rr_ = (a + k * .25) * (n.loud ? 3.2 : 1.8); if (rr_ > 0) { ctx.beginPath(); ctx.arc(n.x, n.y, rr_, 0, TAU); ctx.stroke(); } }
  }
  if (state === 'caught' && (seq.phase === 'hung' || seq.phase === 'fade')) glow(seq.hook.cx, seq.hook.cy + .5, 3.5, `rgba(255,0,0,${.25 + .1 * Math.sin(T * 5)})`);
  if (MODE === 'team') for (const d of deaths) { const a = T - d.t0; if (a < 3) glow(d.h.cx + .3, d.h.cy + .5, 3.5, `rgba(255,0,0,${(.3 + .1 * Math.sin(T * 5)) * clamp((3 - a) / .6, 0, 1)})`); }
  ctx.globalCompositeOperation = 'source-over';
  if (state === 'play' && TUT) {
    for (const g of TUT.targets) {
      const p = (T * .9) % 1;
      ctx.strokeStyle = `rgba(235,231,220,${.85 * (1 - p)})`; ctx.lineWidth = .06; ctx.beginPath(); ctx.ellipse(g.x, g.y, .35 + p * .6, (.35 + p * .6) * .55, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(235,231,220,.8)'; ctx.lineWidth = .05; ctx.beginPath(); ctx.ellipse(g.x, g.y, .38, .21, 0, 0, TAU); ctx.stroke();
    }
  }
  if (state === 'play') {
    const p = .55 + .45 * Math.sin(T * 3);
    for (const t of tasks) {
      if (t.done) continue;
      const inside = visM & (1 << t.room), a = inside ? .3 : .75 * p;
      for (const b of t.stations ? t.stations.map(s => s.aura) : [t.aura]) {
        ctx.strokeStyle = `rgba(242,193,75,${a * .35})`; ctx.lineWidth = .16; ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = `rgba(255,218,120,${a})`; ctx.lineWidth = .045; ctx.strokeRect(b.x, b.y, b.w, b.h);
        if (t.prog > 0) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(b.x, b.y - .22, b.w, .1); ctx.fillStyle = '#f2c14b'; ctx.fillRect(b.x, b.y - .22, b.w * t.prog, .1); }
      }
    }
    if (gatesPowered) for (const g of gates) {
      ctx.strokeStyle = `rgba(160,255,190,${.7 * p})`; ctx.lineWidth = .06; ctx.strokeRect(g.x0 - .2, g.y - 1.2, g.x1 - g.x0 + 1.4, 1.9);
    }
    if (MODE === 'team') drawTeamWorld(visM);
    if (ROLE === 'killer') drawKillerSense();
  }
}
/* Klauen aus dem Boden: h = Haken (oder {cx, cy} wie ein Haken), t = Zeit (wachsen ab 0,9 s) */
function drawClaws(h = seq.hook, t = seq.phase === 'fade' ? 3 + seq.t : seq.t) {
  const grow = clamp((t - .9) / 1.4, 0, 1);
  if (grow <= 0) return;
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k - 2) * .55, bx = h.cx + .3 + Math.cos(a + Math.PI) * .95 * (k % 2 ? 1 : .8), by = h.cy + .95;
    const L = (1.3 + (k % 3) * .35) * grow, tipx = h.cx + .3 + (bx - h.cx - .3) * .25, tipy = by - L;
    ctx.fillStyle = '#060607';
    ctx.beginPath(); ctx.moveTo(bx - .09, by); ctx.quadraticCurveTo(bx + (tipx - bx) * .2, by - L * .6, tipx, tipy); ctx.quadraticCurveTo(bx + (tipx - bx) * .2 + .1, by - L * .5, bx + .09, by); ctx.closePath(); ctx.fill();
  }
}
function collectEnts() {
  const e = [];
  if (state !== 'title' && state !== 'end') {
    const visM = SV.length > 1 ? visibleMask() : 0, V = viewer();
    for (const sv of SV) if (sv && !sv.ghost && !sv.hidden && !sv.carried && !sv.hung && !sv.out && (sv === V || survShown(sv, visM))) e.push({ y: sv.y, d: () => drawSurv(sv) });
    // Team: wer durchs Tor läuft, und wer am Boden geopfert wurde
    if (MODE === 'team') for (const sv of SV) {
      if (sv.leave && sv.leave.t < 1.6 && (sv.mask & visM)) e.push({ y: sv.y, d: () => { ctx.save(); ctx.globalAlpha = clamp(1 - sv.leave.t / 1.6, 0, 1); drawSurv(sv); ctx.restore(); } });
      const dd = deaths.find(d => d.sv === sv && d.how !== 'hook');
      if (dd && T - dd.t0 < 2.4 && (sv.mask & visM)) e.push({ y: dd.y, d: () => { ctx.save(); ctx.globalAlpha = clamp((2.4 - (T - dd.t0)) / .6, 0, 1); drawDowned(sv, dd.x, dd.y); ctx.restore(); } });
    }
  }
  if (K && killerVisible()) e.push({ y: K.y, d: drawKiller });
  e.sort((a, b) => a.y - b.y);
  return e;
}
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#050807'; ctx.fillRect(0, 0, VW, VH);
  if (!K) return;
  const z = TP * cam.z;
  const shx = cam.sh ? (Math.random() - .5) * cam.sh * .5 : 0, shy = cam.sh ? (Math.random() - .5) * cam.sh * .5 : 0;
  const ox = VW / 2 - (cam.x + shx) * z, oy = VH / 2 - (cam.y + shy) * z;
  ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * ox, DPR * oy);
  const x0 = Math.floor(-ox / z) - 1, x1 = Math.ceil((VW - ox) / z) + 1, y0 = Math.floor(-oy / z) - 1, y1 = Math.ceil((VH - oy) / z) + 2;
  const fx0 = clamp(x0, 0, W), fx1 = clamp(x1, 0, W), fy0 = clamp(y0, 0, H), fy1 = clamp(y1, 0, H);
  if (fx1 > fx0 && fy1 > fy0) ctx.drawImage(floorCv, fx0 * FR, fy0 * FR, (fx1 - fx0) * FR, (fy1 - fy0) * FR, fx0, fy0, fx1 - fx0, fy1 - fy0);
  ctx.fillStyle = 'rgba(90,6,12,.75)'; for (const s of splats) { ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 1.4, s.r, 0, 0, TAU); ctx.fill(); }
  ctx.lineCap = 'round';
  for (const m of marks) {
    const a = 1 - (T - m.t) / CFG.markLife; if (a <= 0) continue;
    const dx = Math.cos(m.a) * m.l / 2, dy = Math.sin(m.a) * m.l / 2;
    ctx.strokeStyle = `rgba(185,20,28,${.55 * a})`; ctx.lineWidth = .05;
    ctx.beginPath(); ctx.moveTo(m.x - dx, m.y - dy); ctx.lineTo(m.x + dx, m.y + dy); ctx.moveTo(m.x - dx + .06, m.y - dy + .05); ctx.lineTo(m.x + dx * .6 + .06, m.y + dy * .6 + .05); ctx.stroke();
  }
  if (WEATHER === 'rain') drawRainGround(x0, y0, x1, y1);
  const ents = collectEnts(); let ei = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) drawTile(x, y);
    while (ei < ents.length && ents[ei].y < y + 1) { ents[ei].d(); ei++; }
  }
  while (ei < ents.length) { ents[ei].d(); ei++; }
  for (const p of parts) { const a = p.fade ? p.life / p.max : Math.min(1, p.life / p.max * 2); ctx.fillStyle = `rgba(${p.col},${a})`; if (p.fade) { ctx.beginPath(); ctx.arc(p.x, p.y - p.z, p.sz * (1.6 - a), 0, TAU); ctx.fill(); } else ctx.fillRect(p.x - p.sz / 2, p.y - p.z - p.sz / 2, p.sz, p.sz); }
  if (state === 'caught' && (seq.phase === 'hung' || seq.phase === 'fade')) drawClaws();
  if (MODE === 'team') for (const d of deaths) {
    // Klauen wachsen sofort, ziehen den Körper weg und verschwinden wieder
    const a = T - d.t0; if (a > 3) continue;
    const g = a < 2.4 ? clamp(a / 1.1, 0, 1) : clamp(1 - (a - 2.4) / .5, 0, 1);
    drawClaws(d.h, .9 + 1.4 * g);
  }
  if (WEATHER === 'rain') drawRain(x0, y0, x1, y1);
  const visM = visibleMask();
  drawLight(z, ox, oy, visM);
  ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * ox, DPR * oy);
  drawGlows(visM);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawOverlays(z, ox, oy);
  if (state === 'play') drawHUD(z, ox, oy);
}

/* ---- Wetter (nur im Freien; Zeitplan aus T und hash, kein Math.random) ---- */
const isOut = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return false; const r = room[I(x | 0, y | 0)]; return !!(r && ROOMS[r].out) && G[y | 0][x | 0] === '.'; };
const outAt = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return true; const r = room[I(x | 0, y | 0)]; return r ? !!ROOMS[r].out : G[y | 0][x | 0] === 'T'; };
/* Regentropfen auf dem Boden (unter den Figuren) */
function drawRainGround(x0, y0, x1, y1) {
  if (REDUCED) return;
  const w = x1 - x0, h = y1 - y0;
  ctx.lineWidth = .025;
  for (let i = 0; i < 46; i++) {
    const ph = T * 1.6 + hash(i, 11) * 7, k = Math.floor(ph), p = ph - k;
    const x = x0 + hash(i, k) * w, y = y0 + hash(k, i + 40) * h;
    if (!isOut(x, y)) continue;
    ctx.strokeStyle = `rgba(190,205,235,${.3 * (1 - p)})`; ctx.beginPath(); ctx.ellipse(x, y, .05 + p * .22, (.05 + p * .22) * .45, 0, 0, TAU); ctx.stroke();
  }
}
/* Regenfäden (über den Figuren, unter dem Licht) */
function drawRain(x0, y0, x1, y1) {
  const w = x1 - x0, h = y1 - y0 + 2;
  ctx.strokeStyle = 'rgba(175,195,235,.26)'; ctx.lineWidth = .022; ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let i = 0; i < 130; i++) {
    const sp = 9 + hash(i, 2) * 5, x = x0 + hash(i, 1) * w, y = y0 - 1 + ((hash(i, 7) * h + (REDUCED ? 0 : T * sp)) % h), fy = y0 - 1 + hash(i, 13) * h;
    if (y > fy || !isOut(x, fy) || !outAt(x, y - .3)) continue;   // fällt bis zu seinem Bodenpunkt (fy), nie durch ein Dach
    ctx.moveTo(x, y - .1); ctx.lineTo(x - .1, y - .65);
  }
  ctx.stroke();
}
/* Nebelschwaden und Glühwürmchen (Karten mit weather 'fog') */
function drawFog(visM) {
  const V = viewer(), cx = cam.x, cy = cam.y;
  ctx.save(); ctx.clip(maskPath(OUTMASK));
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 9; i++) {
    const t = REDUCED ? 0 : T, x = Math.floor(cx / 9) * 9 + (hash(i, 21) - .5) * 30 + Math.sin(t * .05 + i * 2.1) * 3 + ((t * (.12 + hash(i, 4) * .1)) % 9), y = Math.floor(cy / 7) * 7 + (hash(i, 33) - .5) * 20 + Math.cos(t * .04 + i) * 1.5;
    const R = 3.5 + hash(i, 8) * 2.5, g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, 'rgba(170,190,210,.085)'); g.addColorStop(1, 'rgba(170,190,210,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, R, R * .5, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  if (REDUCED) return;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const bx = Math.floor(cx / 16) * 16 + hash(i, 51) * 32 - 8, by = Math.floor(cy / 12) * 12 + hash(i, 67) * 24 - 6;
    const x = bx + Math.sin(T * .5 + i * 1.7) * 1.2, y = by + Math.cos(T * .37 + i * 2.3) * .8, on = Math.max(0, Math.sin(T * 1.4 + i * 2.9));
    if (on < .05 || !isOut(x, y)) continue;
    glow(x, y - .5, .35, `rgba(200,255,120,${.5 * on})`);
    ctx.fillStyle = `rgba(230,255,170,${.9 * on})`; ctx.beginPath(); ctx.arc(x, y - .5, .03, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'lighter';
}
/* ---- Team: Liegende, Hängende, Leisten in der Welt ---- */
/* Am Boden: liegend (Kopf in Kriechrichtung), beim Kriechen Arme nach vorn und strampelnde Beine */
function drawDowned(sv, x = sv.x, y = sv.y) {
  const s = Math.cos(sv.dir) >= 0 ? 1 : -1, crawl = sv.moving && !sv.out;
  ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.beginPath(); ctx.ellipse(x, y + .02, .66, .17, 0, 0, TAU); ctx.fill();
  if (!crawl) { ctx.fillStyle = 'rgba(110,8,14,.55)'; ctx.beginPath(); ctx.ellipse(x - s * .1, y + .08, .42, .12, 0, 0, TAU); ctx.fill(); }
  const breathe = crawl ? 0 : Math.sin(T * 2.6) * .012;
  drawHuman(x - s * .55, y + .14 + breathe, { look: skinOf(sv), face: 2, lie: s * Math.PI / 2, pose: crawl ? 'hang' : null, moving: false, noShadow: true, hurt: true, shake: sv.flinch > 0 ? .03 : 0 });
}
/* Am Haken (statt der Solo-Figur in hookTile): ab 0,5 Kampfphase mit Zucken; tot → die Klauen holen ihn */
function drawHung(sv, px, base) {
  const dead = sv.out === 'dead', a = dead ? T - sv.outT : 0, fade = dead ? clamp(1 - (a - 1.5) / .8, 0, 1) : 1;
  if (fade <= 0) return;
  const fight = !dead && sv.hookProg >= .5, jerk = fight ? (Math.sin(T * 17) > .5 ? .05 : .014) : dead ? .02 * fade : 0;
  ctx.save(); ctx.globalAlpha = fade;
  drawHuman(px + .3, base + .05 - (dead ? Math.max(0, a - 1.1) * .6 : 0), { look: skinOf(sv), face: 0, pose: 'hang', z: .72, moving: false, hurt: true, shake: jerk });
  ctx.restore();
}
function worldBar(cx, y, w, p, col, tick) {
  ctx.fillStyle = 'rgba(0,0,0,.75)'; rr(cx - w / 2 - .04, y - .04, w + .08, .18, .06);
  ctx.fillStyle = col; ctx.fillRect(cx - w / 2, y, w * clamp(p, 0, 1), .1);
  if (tick) { ctx.fillStyle = 'rgba(235,231,220,.9)'; ctx.fillRect(cx - w / 2 + w * tick - .015, y - .05, .03, .2); }
}
function drawTeamWorld(visM) {
  for (const sv of SV) {
    if (sv.out) continue;
    if (sv.hung) {
      const h = sv.hung, fight = sv.hookProg >= .5, x = h.cx + .3;
      ctx.globalCompositeOperation = 'lighter';
      glow(x, h.cy - .2, fight ? 2.4 : 1.8, `rgba(255,20,20,${fight ? .26 + .1 * Math.sin(T * 9) : .16})`);
      ctx.globalCompositeOperation = 'source-over';
      worldBar(x, h.cy - 2.05, 1.1, sv.hookProg, fight ? '#ff2d2d' : '#b3121b', .5);
      if (sv.unhookProg > 0) worldBar(x, h.cy - 1.82, 1.1, sv.unhookProg, '#ebe7dc');
    } else if (sv.carried) {
      if (sv.wiggle > 0) worldBar(K.x, K.y - 2.15, .9, sv.wiggle, '#f2c14b');
    } else {
      const healing = T - sv.healedT < .25;
      if (sv.hp <= 0) {
        // Liegende sieht man auch durch Wände (pulsierender Ring)
        if (!(sv.mask & visM)) { const p = (T * .8) % 1; ctx.strokeStyle = `rgba(255,120,60,${.8 * (1 - p)})`; ctx.lineWidth = .06; ctx.beginPath(); ctx.ellipse(sv.x, sv.y, .4 + p * .5, (.4 + p * .5) * .5, 0, 0, TAU); ctx.stroke(); }
        if (sv.healProg > 0 || healing) worldBar(sv.x, sv.y - .95, .9, sv.healProg, '#7dff9a');
      } else if (healing || (sv.healProg > 0 && SV.some(v => v.heal === sv))) worldBar(sv.x, sv.y - 1.75, .9, sv.healProg, '#7dff9a');
    }
  }
}

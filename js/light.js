'use strict';
/* Dead Mobile – Licht, Leuchten, Klauen, Bild zusammensetzen (render) */
/* ---- Licht ---- */
function lg(c, x, y, r, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
function flick(L) { if (!L.fl) return 1; const n = Math.sin(T * 13 + L.x) * Math.sin(T * 7.3 + L.y * 2); return n > 1 - L.fl * 1.4 ? .25 : 1; }
function visibleMask() {
  if (state === 'title' || state === 'end') return K.mask;
  if (state === 'caught') { const q = seq; return (q.phase === 'hit' || q.phase === 'carry') ? K.mask : (mask[I(q.hook.front.x | 0, q.hook.front.y | 0)] || K.mask); }
  return viewer().mask;
}
function drawLight(z, ox, oy, visM) {
  const s = z * LS;
  lx.globalCompositeOperation = 'source-over'; lx.setTransform(1, 0, 0, 1, 0, 0);
  lx.fillStyle = 'rgb(3,4,10)'; lx.fillRect(0, 0, lc.width, lc.height);
  lx.globalCompositeOperation = 'destination-out';
  lx.fillStyle = 'rgba(0,0,0,.15)'; lx.fillRect(0, 0, lc.width, lc.height);
  lx.setTransform(s, 0, 0, s, ox * LS, oy * LS);
  const dim = state === 'title' || state === 'end' ? .85 : 1;
  for (let r = 1; r <= NR; r++) if ((visM & (1 << r)) && roomPath[r]) { lx.fillStyle = `rgba(0,0,0,${ROOMS[r].amb * dim})`; lx.fill(roomPath[r]); }
  lx.save(); lx.clip(maskPath(visM));
  const V = viewer();
  if (state === 'play' && !V.hidden) {
    lg(lx, V.x, V.y - .5, 3.6, .85);
    // Taschenlampe nur aufrecht (nicht am Boden, getragen oder am Haken)
    if (MODE !== 'team' || (V.hp > 0 && !V.carried && !V.hung && !V.out)) {
      const a = V.dir, R = 7, g = lx.createRadialGradient(V.x, V.y - .4, .3, V.x, V.y - .4, R);
      g.addColorStop(0, 'rgba(0,0,0,.78)'); g.addColorStop(1, 'rgba(0,0,0,0)'); lx.fillStyle = g;
      lx.beginPath(); lx.moveTo(V.x, V.y - .4); lx.arc(V.x, V.y - .4, R, a - .48, a + .48); lx.closePath(); lx.fill();
    }
  }
  // Teamkollegen tragen auch ein kleines Licht
  for (const sv of SV) if (sv !== V && state === 'play' && survShown(sv, visM)) lg(lx, sv.x, sv.y - .5, 2.4, .6);
  if (MODE === 'team' && state === 'play') for (const sv of SV) if (sv.hung && (visM & (1 << roomAt(sv.hung.front.x, sv.hung.front.y)))) lg(lx, sv.hung.cx + .3, sv.hung.cy - .3, 2.2, .55);
  if (state !== 'play' && K) lg(lx, K.x, K.y - .5, 3, .6);
  for (const L of LAMPS) if (visM & (1 << L.room)) lg(lx, L.x, L.y, L.r, L.a * flick(L));
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
  for (const L of LAMPS) if (visM & (1 << L.room)) glow(L.x, L.y, L.r * .9, L.red ? `rgba(255,40,25,${.16 * flick(L)})` : `rgba(255,190,120,${.07 * flick(L)})`);
  for (const t of tasks) if (t.done && (visM & (1 << t.room))) glow(t.cx, t.cy - .5, 2.4, 'rgba(255,220,150,.1)');
  const V = viewer();
  if (state === 'play' && !V.hidden && (MODE !== 'team' || (V.hp > 0 && !V.carried && !V.hung && !V.out))) glow(V.x + Math.cos(V.dir) * 1.6, V.y - .3 + Math.sin(V.dir) * 1.6, 2.4, 'rgba(255,225,170,.06)');
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
  const visM = visibleMask();
  drawLight(z, ox, oy, visM);
  ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * ox, DPR * oy);
  drawGlows(visM);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawOverlays(z, ox, oy);
  if (state === 'play') drawHUD(z, ox, oy);
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

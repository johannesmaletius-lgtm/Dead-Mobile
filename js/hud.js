'use strict';
/* Dead Mobile – Bildschirm-Ebenen, HUD, Knöpfe, QTE-Anzeige */
/* ---- Bildschirm-Ebenen & HUD ---- */
function drawOverlays(z, ox, oy) {
  if (state === 'play' && S.hidden) {
    ctx.fillStyle = 'rgba(2,3,6,.9)';
    const sl = [.4, .49, .58].map(f => VH * f), sh = VH * .045;
    ctx.fillRect(0, 0, VW, sl[0]); ctx.fillRect(0, sl[0] + sh, VW, sl[1] - sl[0] - sh); ctx.fillRect(0, sl[1] + sh, VW, sl[2] - sl[1] - sh); ctx.fillRect(0, sl[2] + sh, VW, VH - sl[2] - sh);
    const g = ctx.createLinearGradient(0, 0, VW, 0); g.addColorStop(0, 'rgba(2,3,6,.95)'); g.addColorStop(.3, 'rgba(2,3,6,0)'); g.addColorStop(.7, 'rgba(2,3,6,0)'); g.addColorStop(1, 'rgba(2,3,6,.95)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }
  const vr = Math.max(VW, VH);
  const tA = state === 'play' ? terror * .22 * (.45 + hbPulse * .8) + (K.mode === 'chase' ? .12 : 0) + chaseFlash * .35 + (S.hp < 2 ? .1 + .05 * Math.sin(T * 3) : 0) : 0;
  if (tA > .005) {
    const g = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * .3, VW / 2, VH / 2, vr * .72);
    g.addColorStop(0, 'rgba(150,0,10,0)'); g.addColorStop(1, `rgba(150,0,10,${Math.min(.85, tA)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }
  const g2 = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * .35, VW / 2, VH / 2, vr * .75);
  g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, VW, VH);
  if (flash > 0) { ctx.fillStyle = `rgba(${flashCol},${flash * .45})`; ctx.fillRect(0, 0, VW, VH); }
  if (state === 'caught' && seq.phase === 'fade') { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, seq.t / 1.2)})`; ctx.fillRect(0, 0, VW, VH); }
  if (state === 'won') { ctx.fillStyle = `rgba(4,6,14,${Math.min(1, seq.t / 1.6)})`; ctx.fillRect(0, 0, VW, VH); }
  if (state === 'end') { ctx.fillStyle = 'rgba(4,5,10,.35)'; ctx.fillRect(0, 0, VW, VH); }
  const ta = T - toastT;
  if (state === 'play' && toastMsg && ta < 2.6) {
    const a = Math.min(1, ta / .15, (2.6 - ta) / .4);
    ctx.save(); ctx.globalAlpha = a; ctx.font = '16px "Special Elite", "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(VW - 32, ctx.measureText(toastMsg).width + 32), y = VH / 2 + 70;
    ctx.fillStyle = 'rgba(6,7,12,.82)'; rrp(ctx, VW / 2 - w / 2, y - 20, w, 40, 20); ctx.fill();
    ctx.strokeStyle = 'rgba(242,193,75,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#ebe7dc'; ctx.fillText(toastMsg, VW / 2, y + 1, VW - 48); ctx.restore();
  }
  const ea = T - eyeT;
  if (state === 'play' && ea < 1.6) {
    const a = ea < .2 ? ea / .2 : 1 - (ea - .2) / 1.4, cx = VW / 2, cy = SAT + 40;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(10,0,2,.6)'; ctx.beginPath(); ctx.ellipse(0, 0, 36, 20, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ff3030'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-28, 0); ctx.quadraticCurveTo(0, -22, 28, 0); ctx.quadraticCurveTo(0, 22, -28, 0); ctx.stroke();
    ctx.fillStyle = '#ff3030'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
function actBtn() { return { x: VW - SAR - 66, y: VH - SAB - 74, r: 40 }; }
function arrowPad() { const c = { x: VW - SAR - 108, y: VH - SAB - 108 }; return [{ d: 0, x: c.x, y: c.y - 58 }, { d: 1, x: c.x + 58, y: c.y }, { d: 2, x: c.x, y: c.y + 58 }, { d: 3, x: c.x - 58, y: c.y }]; }
function qteCenter() { return VH > VW ? { x: VW / 2, y: VH - SAB - 272 } : { x: VW / 2, y: VH - SAB - 100 }; }
function icon(kind, cx, cy, s, col, lw = 2.2) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw / s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (kind) {
    case 'gen': ctx.moveTo(.15, -.95); ctx.lineTo(-.55, .12); ctx.lineTo(-.05, .12); ctx.lineTo(-.2, .95); ctx.lineTo(.55, -.15); ctx.lineTo(.05, -.15); ctx.closePath(); ctx.fill(); break;
    case 'fuse': ctx.rect(-.5, -.85, 1, 1.7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-.1, .45); ctx.lineTo(.25, -.4); ctx.stroke(); ctx.beginPath(); ctx.arc(.25, -.4, .13, 0, TAU); ctx.fill(); break;
    case 'radio': rrp(ctx, -.45, -.4, .9, 1.3, .15); ctx.stroke(); ctx.beginPath(); ctx.moveTo(.22, -.4); ctx.lineTo(.22, -.98); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-.2, 0); ctx.lineTo(.2, 0); ctx.moveTo(-.2, .25); ctx.lineTo(.2, .25); ctx.moveTo(-.2, .5); ctx.lineTo(.2, .5); ctx.stroke(); break;
    case 'valve': ctx.arc(0, 0, .72, 0, TAU); ctx.stroke(); ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + .4; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * .72, Math.sin(a) * .72); } ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, .18, 0, TAU); ctx.fill(); break;
    case 'vault': ctx.moveTo(-.95, .6); ctx.lineTo(.95, .6); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-.7, .25); ctx.quadraticCurveTo(0, -1.2, .7, .15); ctx.stroke(); ctx.beginPath(); ctx.moveTo(.7, .15); ctx.lineTo(.3, .05); ctx.moveTo(.7, .15); ctx.lineTo(.72, -.28); ctx.stroke(); break;
    case 'drop': ctx.save(); ctx.rotate(-.5); ctx.strokeRect(-.2, -.95, .4, 1.4); ctx.beginPath(); ctx.moveTo(-.2, -.5); ctx.lineTo(.2, -.5); ctx.moveTo(-.2, 0); ctx.lineTo(.2, 0); ctx.stroke(); ctx.restore(); ctx.beginPath(); ctx.moveTo(-.9, .8); ctx.lineTo(.9, .8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(.55, -.5); ctx.quadraticCurveTo(.75, 0, .5, .45); ctx.stroke(); break;
    case 'hide': ctx.rect(-.5, -.95, 1, 1.9); ctx.stroke(); ctx.beginPath(); for (let k = 0; k < 3; k++) { ctx.moveTo(-.25, -.6 + k * .22); ctx.lineTo(.25, -.6 + k * .22); } ctx.stroke(); break;
    case 'unhide': ctx.moveTo(-.2, -.95); ctx.lineTo(-.75, -.95); ctx.lineTo(-.75, .95); ctx.lineTo(-.2, .95); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-.3, 0); ctx.lineTo(.85, 0); ctx.moveTo(.45, -.4); ctx.lineTo(.85, 0); ctx.lineTo(.45, .4); ctx.stroke(); break;
    case 'gate': ctx.moveTo(-.85, .95); ctx.lineTo(-.85, -.85); ctx.lineTo(.85, -.85); ctx.lineTo(.85, .95); ctx.moveTo(-.4, -.85); ctx.lineTo(-.4, .95); ctx.moveTo(0, -.85); ctx.lineTo(0, .95); ctx.moveTo(.4, -.85); ctx.lineTo(.4, .95); ctx.stroke(); break;
    case 'duo': ctx.rect(-.95, -.35, .62, 1.15); ctx.rect(.33, -.35, .62, 1.15); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-.33, .25); ctx.lineTo(.33, .25); ctx.stroke(); ctx.beginPath(); ctx.arc(-.64, -.02, .14, 0, TAU); ctx.arc(.64, -.02, .14, 0, TAU); ctx.fill(); break;
    case 'tap': ctx.arc(0, 0, .35, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, .75, 0, TAU); ctx.stroke(); break;
    case 'arrow': ctx.moveTo(0, -.8); ctx.lineTo(.7, .1); ctx.lineTo(.28, .1); ctx.lineTo(.28, .8); ctx.lineTo(-.28, .8); ctx.lineTo(-.28, .1); ctx.lineTo(-.7, .1); ctx.closePath(); ctx.fill(); break;
  }
  ctx.restore();
}
function heart(cx, cy, s, fill, stroke) {
  ctx.beginPath(); ctx.moveTo(cx, cy + s * .9);
  ctx.bezierCurveTo(cx - s * 1.5, cy - s * .15, cx - s * .75, cy - s * 1.15, cx, cy - s * .38);
  ctx.bezierCurveTo(cx + s * .75, cy - s * 1.15, cx + s * 1.5, cy - s * .15, cx, cy + s * .9); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}
function drawHUD(z, ox, oy) {
  // Aufgaben oben links
  const hy = SAT + 24;
  for (let k = 0; k < 2; k++) {
    const full = k < S.hp, cx = SAL + 18 + k * 22, pul = !full ? 0 : (S.hp < 2 ? 1 + .12 * Math.sin(T * 6) : 1);
    heart(cx, hy, 8.5 * (pul || 1), full ? '#c3121f' : 'rgba(6,7,12,.6)', full ? 'rgba(255,200,200,.5)' : 'rgba(235,231,220,.4)');
  }
  let hx = SAL + 22 + 52;
  for (const t of tasks) {
    ctx.fillStyle = t.done ? 'rgba(242,193,75,.95)' : 'rgba(6,7,12,.6)'; ctx.beginPath(); ctx.arc(hx, hy, 14, 0, TAU); ctx.fill();
    if (!t.done && t.prog > 0) { ctx.strokeStyle = '#f2c14b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, hy, 14, -Math.PI / 2, -Math.PI / 2 + TAU * t.prog); ctx.stroke(); }
    else if (!t.done) { ctx.strokeStyle = 'rgba(235,231,220,.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(hx, hy, 14, 0, TAU); ctx.stroke(); }
    icon(t.type, hx, hy, 7.5, t.done ? '#1a1406' : 'rgba(235,231,220,.75)', 2);
    hx += 34;
  }
  hx += 4;
  ctx.fillStyle = gatesPowered ? 'rgba(125,255,160,.9)' : 'rgba(6,7,12,.6)'; ctx.beginPath(); ctx.arc(hx, hy, 14, 0, TAU); ctx.fill();
  icon('gate', hx, hy, 7.5, gatesPowered ? '#06140b' : 'rgba(235,231,220,.35)', 2);
  // Pfeile am Rand
  const edge = (wx, wy, col) => {
    const sx = ox + wx * z, sy = oy + wy * z, m = 34;
    if (sx > -4 && sx < VW + 4 && sy > SAT - 4 && sy < VH + 4) return;
    const cx = VW / 2, cy = VH / 2, a = Math.atan2(sy - cy, sx - cx);
    const px = clamp(sx, m + SAL, VW - m - SAR), py = clamp(sy, m + SAT + 30, VH - m - SAB);
    ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.restore();
  };
  if (!S.hidden) {
    const pa = .55 + .35 * Math.sin(T * 3);
    for (const t of tasks) if (!t.done) edge(t.cx, t.cy - .3, `rgba(242,193,75,${pa})`);
    if (gatesPowered) for (const g of gates) edge((g.x0 + g.x1 + 1) / 2, g.y + .5, 'rgba(125,255,160,.9)');
  }
  if (killerVisible()) edge(K.x, K.y - .5, 'rgba(255,40,40,.95)');
  if (TUT) for (const g of TUT.targets) edge(g.x, g.y, 'rgba(235,231,220,.95)');
  // QTE
  if (Q) drawQTE();
  // Aktions-Knopf / Pfeile
  if (Q && Q.type === 'radio') {
    for (const b of arrowPad()) {
      const pr = Q.press && Q.press.d === b.d && Q.press.t > 0;
      ctx.fillStyle = pr ? 'rgba(242,193,75,.85)' : 'rgba(6,7,12,.55)'; ctx.beginPath(); ctx.arc(b.x, b.y, 27, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(235,231,220,.5)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.d * Math.PI / 2); icon('arrow', 0, 0, 12, Q.phase === 'input' ? '#ebe7dc' : 'rgba(235,231,220,.3)'); ctx.restore();
    }
  } else {
    const b = actBtn(), a = actNow;
    let kind = null;
    if (a) kind = a.kind === 'task' ? a.o.type : a.kind === 'work' ? 'tap' : a.kind === 'vaultP' ? 'vault' : a.kind;
    if (a && a.kind === 'work' && Q.type === 'valve') kind = 'valve';
    const live = !!kind, pulse = live ? .5 + .5 * Math.sin(T * 6) : 0;
    const hot = (Q && Q.type === 'gen' && Q.check) || (a && (a.kind === 'drop' || a.kind === 'vault') && K.mode === 'chase');
    ctx.fillStyle = live ? (hot ? `rgba(195,18,31,${.45 + .25 * pulse})` : 'rgba(235,231,220,.16)') : 'rgba(6,7,12,.35)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = live ? `rgba(235,231,220,${.55 + .3 * pulse})` : 'rgba(235,231,220,.18)'; ctx.lineWidth = 2.5; ctx.stroke();
    if (Q && Q.type === 'valve' && Q.hold) { ctx.strokeStyle = '#f2c14b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5, 0, TAU); ctx.stroke(); }
    if (kind) { ctx.save(); if (kind === 'valve' && Q && Q.hold) { ctx.translate(b.x, b.y); ctx.rotate(T * 4); ctx.translate(-b.x, -b.y); } icon(kind, b.x, b.y, 19, '#ebe7dc', 2.6); ctx.restore(); }
  }
  // Joystick
  if (joy.id !== null) {
    const dx = joy.x - joy.bx, dy = joy.y - joy.by, l = hyp(dx, dy), k = l > JOY_R ? JOY_R / l : 1;
    const run = l / JOY_R > .62;
    ctx.strokeStyle = 'rgba(235,231,220,.22)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.bx, joy.by, JOY_R, 0, TAU); ctx.stroke();
    ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(235,231,220,.14)'; ctx.beginPath(); ctx.arc(joy.bx, joy.by, JOY_R * .62, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = run ? 'rgba(235,231,220,.5)' : 'rgba(140,170,230,.4)'; ctx.beginPath(); ctx.arc(joy.bx + dx * k, joy.by + dy * k, 22, 0, TAU); ctx.fill();
  } else if (isTouch && !everMoved) {
    const px = SAL + 96, py = VH - SAB - 110, p = .5 + .5 * Math.sin(T * 3);
    ctx.strokeStyle = `rgba(235,231,220,${.15 + .2 * p})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, JOY_R, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(235,231,220,${.15 + .2 * p})`; ctx.beginPath(); ctx.arc(px + Math.sin(T * 1.5) * 26, py, 22, 0, TAU); ctx.fill();
  }
}
function drawQTE() {
  const q = Q, c = qteCenter(), t = q.task;
  ctx.save();
  if (q.flash > 0) { ctx.translate(Math.sin(T * 70) * 5 * q.flash, 0); }
  const shade = (w, h) => { ctx.fillStyle = 'rgba(6,7,12,.62)'; rrp(ctx, c.x - w / 2, c.y - h / 2, w, h, 18); ctx.fill(); };
  const bar = () => { const w = 150, y = c.y + 62; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(c.x - w / 2, y, w, 6); ctx.fillStyle = '#f2c14b'; ctx.fillRect(c.x - w / 2, y, w * t.prog, 6); };
  const bad = q.flash > 0;
  if (TUT || !qteSeen.has(q.type)) {
    const hint = { gen: isTouch ? 'Tippen, wenn die Nadel im weißen Feld ist' : 'Leertaste, wenn die Nadel im weißen Feld ist',
      fuse: isTouch ? 'Tippen, wenn der rote Strich im weißen Feld ist – 3×' : 'Leertaste, wenn der rote Strich im weißen Feld ist – 3×',
      radio: isTouch ? 'Pfeile merken, dann nachtippen' : 'Pfeile merken, dann mit den Pfeiltasten nachmachen',
      valve: isTouch ? 'Knopf halten lässt Druck ab – Nadel im grünen Feld halten' : 'Leertaste halten lässt Druck ab – Nadel im grünen Feld halten' }[q.type];
    const ph = { gen: 150, fuse: 120, radio: 110, valve: 130 }[q.type];
    ctx.font = '14px "Special Elite", "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(VW - 24, ctx.measureText(hint).width + 24), y = c.y - ph / 2 - 20;
    ctx.fillStyle = 'rgba(6,7,12,.75)'; rrp(ctx, c.x - w / 2, y - 14, w, 28, 14); ctx.fill();
    ctx.fillStyle = '#f2c14b'; ctx.fillText(hint, c.x, y + 1, VW - 36);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  if (q.type === 'gen') {
    shade(130, 150);
    const R = 44;
    ctx.lineWidth = 6; ctx.strokeStyle = bad ? 'rgba(255,60,40,.7)' : 'rgba(235,231,220,.22)'; ctx.beginPath(); ctx.arc(c.x, c.y - 6, R, 0, TAU); ctx.stroke();
    if (q.warn > 0) { ctx.strokeStyle = `rgba(235,231,220,${q.warn / .55})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y - 6, R + 8 * (1 - q.warn / .55), 0, TAU); ctx.stroke(); }
    if (q.check) {
      const k = q.check, a0 = -Math.PI / 2 + k.zs;
      ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(235,231,220,.9)'; ctx.beginPath(); ctx.arc(c.x, c.y - 6, R, a0, a0 + k.zw); ctx.stroke();
      ctx.strokeStyle = '#f2c14b'; ctx.beginPath(); ctx.arc(c.x, c.y - 6, R, a0, a0 + k.gw); ctx.stroke();
      const na = -Math.PI / 2 + k.a;
      ctx.strokeStyle = '#ff3030'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c.x, c.y - 6); ctx.lineTo(c.x + Math.cos(na) * (R + 8), c.y - 6 + Math.sin(na) * (R + 8)); ctx.stroke();
    }
    icon('gen', c.x, c.y - 6, 13, q.great > 0 ? '#f2c14b' : 'rgba(235,231,220,.8)');
    bar();
  } else if (q.type === 'fuse') {
    shade(270, 120);
    const w = 220, x = c.x - w / 2, y = c.y + 6;
    for (let k = 0; k < 3; k++) { ctx.fillStyle = k < q.hits ? '#7dff9a' : 'rgba(235,231,220,.18)'; rrp(ctx, c.x - 50 + k * 36, c.y - 42, 28, 18, 5); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(x, y - 12, w, 24);
    ctx.fillStyle = 'rgba(235,231,220,.85)'; ctx.fillRect(x + (q.zc - q.zw / 2) * w, y - 12, q.zw * w, 24);
    ctx.fillStyle = bad ? '#ffae40' : '#ff3030'; ctx.fillRect(x + q.pos * w - 3, y - 18, 6, 36);
    bar();
  } else if (q.type === 'radio') {
    const n = q.seq.length, sw = 44, wtot = n * sw + (n - 1) * 8;
    shade(Math.max(170, wtot + 40), 110);
    for (let k = 0; k < n; k++) {
      const x = c.x - wtot / 2 + k * (sw + 8) + sw / 2, y = c.y - 4;
      let col = 'rgba(235,231,220,.12)', show = false;
      if (q.phase === 'show') { const cur = Math.floor(q.st / .62); if (q.st >= 0 && k === cur) { col = 'rgba(160,190,255,.9)'; show = true; } }
      else if (k < q.inp) { col = 'rgba(125,255,160,.8)'; show = true; }
      else if (k === q.inp) col = 'rgba(235,231,220,.3)';
      ctx.fillStyle = col; rrp(ctx, x - sw / 2, y - sw / 2, sw, sw, 9); ctx.fill();
      if (show) { ctx.save(); ctx.translate(x, y); ctx.rotate(q.seq[k] * Math.PI / 2); icon('arrow', 0, 0, 13, '#0b0d14'); ctx.restore(); }
    }
    icon('radio', c.x, c.y - 44, 10, 'rgba(235,231,220,.6)', 2);
    if (q.press) q.press.t -= 1 / 60;
    bar();
  } else if (q.type === 'valve') {
    shade(170, 130);
    const R = 52, cy = c.y + 26;
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(235,231,220,.16)'; ctx.beginPath(); ctx.arc(c.x, cy, R, Math.PI, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(195,18,31,.6)'; ctx.beginPath(); ctx.arc(c.x, cy, R, Math.PI * 1.88, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(125,255,160,.75)'; ctx.beginPath(); ctx.arc(c.x, cy, R, Math.PI + (q.bc - .13) * Math.PI, Math.PI + (q.bc + .13) * Math.PI); ctx.stroke();
    const na = Math.PI + clamp(q.p, 0, 1) * Math.PI, inb = Math.abs(q.p - q.bc) < .13;
    ctx.strokeStyle = inb ? '#ebe7dc' : '#ff3030'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c.x, cy); ctx.lineTo(c.x + Math.cos(na) * (R + 6), cy + Math.sin(na) * (R + 6)); ctx.stroke();
    ctx.fillStyle = '#ebe7dc'; ctx.beginPath(); ctx.arc(c.x, cy, 5, 0, TAU); ctx.fill();
    bar();
  }
  ctx.restore();
}

'use strict';
/* Dead Mobile – Bildschirm-Ebenen, HUD, Knöpfe, QTE-Anzeige */
/* ---- Bildschirm-Ebenen & HUD ---- */
function drawOverlays(z, ox, oy) {
  const V = viewer();
  if (state === 'play' && V.hidden) {
    ctx.fillStyle = 'rgba(2,3,6,.9)';
    const sl = [.4, .49, .58].map(f => VH * f), sh = VH * .045;
    ctx.fillRect(0, 0, VW, sl[0]); ctx.fillRect(0, sl[0] + sh, VW, sl[1] - sl[0] - sh); ctx.fillRect(0, sl[1] + sh, VW, sl[2] - sl[1] - sh); ctx.fillRect(0, sl[2] + sh, VW, VH - sl[2] - sh);
    const g = ctx.createLinearGradient(0, 0, VW, 0); g.addColorStop(0, 'rgba(2,3,6,.95)'); g.addColorStop(.3, 'rgba(2,3,6,0)'); g.addColorStop(.7, 'rgba(2,3,6,0)'); g.addColorStop(1, 'rgba(2,3,6,.95)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }
  const vr = Math.max(VW, VH);
  const tA = state === 'play' ? terror * .22 * (.45 + hbPulse * .8) + (K.mode === 'chase' ? .12 : 0) + chaseFlash * .35 + (V.hp < 2 ? .1 + .05 * Math.sin(T * 3) : 0) + (MODE === 'team' && !V.out && (V.hp <= 0 || V.hung) ? .14 + .08 * Math.sin(T * 4) : 0) : 0;
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
    // Team
    case 'heal': ctx.rect(-.24, -.8, .48, 1.6); ctx.rect(-.8, -.24, 1.6, .48); ctx.fill(); break;
    case 'hook': ctx.moveTo(-.15, -.95); ctx.lineTo(-.15, .25); ctx.arc(.2, .25, .35, Math.PI, Math.PI * .1, true); ctx.stroke(); ctx.beginPath(); ctx.moveTo(.52, .38); ctx.lineTo(.62, .02); ctx.lineTo(.28, .2); ctx.closePath(); ctx.fill(); break;
    case 'rescue': ctx.moveTo(-.45, -.95); ctx.lineTo(-.45, .2); ctx.arc(-.15, .2, .3, Math.PI, Math.PI * .1, true); ctx.stroke(); ctx.beginPath(); ctx.moveTo(.55, .9); ctx.lineTo(.55, -.35); ctx.moveTo(.22, -.05); ctx.lineTo(.55, -.4); ctx.lineTo(.88, -.05); ctx.stroke(); break;
    case 'wiggle': for (const sx of [-1, 1]) { ctx.moveTo(sx * .25, -.8); ctx.lineTo(sx * .75, -.4); ctx.lineTo(sx * .25, 0); ctx.lineTo(sx * .75, .4); ctx.lineTo(sx * .25, .8); } ctx.stroke(); break;
    case 'skull': ctx.arc(0, -.15, .7, Math.PI * .85, Math.PI * .15); ctx.lineTo(.4, .75); ctx.lineTo(-.4, .75); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(6,7,12,.95)'; ctx.beginPath(); ctx.arc(-.27, -.12, .19, 0, TAU); ctx.arc(.27, -.12, .19, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, .12); ctx.lineTo(.1, .32); ctx.lineTo(-.1, .32); ctx.closePath(); ctx.fill(); break;
    case 'down': ctx.arc(.62, -.25, .22, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(.35, -.12); ctx.lineTo(-.7, .05); ctx.moveTo(.1, -.15); ctx.lineTo(.45, .3); ctx.moveTo(-.7, .05); ctx.lineTo(-.95, .4); ctx.moveTo(-.4, .0); ctx.lineTo(-.55, .45); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-.95, .65); ctx.lineTo(.95, .65); ctx.stroke(); break;
    case 'carry': ctx.arc(-.35, -.62, .22, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-.35, -.38); ctx.lineTo(-.35, .3); ctx.lineTo(-.6, .95); ctx.moveTo(-.35, .3); ctx.lineTo(-.1, .95); ctx.moveTo(-.75, -.05); ctx.lineTo(.85, -.32); ctx.stroke(); break;
    case 'heart': ctx.moveTo(0, .8); ctx.bezierCurveTo(-1.2, -.1, -.6, -.95, 0, -.3); ctx.bezierCurveTo(.6, -.95, 1.2, -.1, 0, .8); ctx.fill(); break;
    case 'hurt': ctx.moveTo(0, .8); ctx.bezierCurveTo(-1.2, -.1, -.6, -.95, 0, -.3); ctx.lineTo(-.12, .05); ctx.lineTo(.1, .3); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(.12, -.24); ctx.bezierCurveTo(.6, -.95, 1.2, -.1, .06, .74); ctx.lineTo(.22, .3); ctx.lineTo(-.02, .05); ctx.closePath(); ctx.fill(); break;
    case 'eye': ctx.moveTo(-.9, 0); ctx.quadraticCurveTo(0, -.75, .9, 0); ctx.quadraticCurveTo(0, .75, -.9, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, .26, 0, TAU); ctx.fill(); break;
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
  // Aufgaben oben links (Zuschauer: Herzen des Teamkollegen)
  const hy = SAT + 24, V = viewer();
  for (let k = 0; k < 2; k++) {
    const full = k < V.hp, cx = SAL + 18 + k * 22, pul = !full ? 0 : (V.hp < 2 ? 1 + .12 * Math.sin(T * 6) : 1);
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
  if (MODE === 'team') pointsLabel(hx + 22, hy);
  // Pfeile am Rand (ic: kleines Symbol am Pfeil)
  const edge = (wx, wy, col, ic) => {
    const sx = ox + wx * z, sy = oy + wy * z, m = 34;
    if (sx > -4 && sx < VW + 4 && sy > SAT - 4 && sy < VH + 4) return;
    const cx = VW / 2, cy = VH / 2, a = Math.atan2(sy - cy, sx - cx);
    const px = clamp(sx, m + SAL, VW - m - SAR);
    let py = clamp(sy, m + SAT + 30, VH - m - SAB);
    if (MODE === 'team') { const b = actBtn(); if (hyp(px - b.x, py - b.y) < b.r + 26) py = b.y - b.r - 26; } // nicht auf den Aktionsknopf
    ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.restore();
    if (ic) { const bx = px - Math.cos(a) * 20, by = py - Math.sin(a) * 20; ctx.fillStyle = 'rgba(6,7,12,.75)'; ctx.beginPath(); ctx.arc(bx, by, 11, 0, TAU); ctx.fill(); icon(ic, bx, by, 6.5, col, 1.8); }
  };
  if (!V.hidden) {
    const pa = .55 + .35 * Math.sin(T * 3);
    for (const t of tasks) if (!t.done) edge(t.cx, t.cy - .3, `rgba(242,193,75,${pa})`);
    if (gatesPowered) for (const g of gates) edge((g.x0 + g.x1 + 1) / 2, g.y + .5, 'rgba(125,255,160,.9)');
  }
  if (killerVisible()) edge(K.x, K.y - .5, 'rgba(255,40,40,.95)');
  if (TUT) for (const g of TUT.targets) edge(g.x, g.y, 'rgba(235,231,220,.95)');
  if (MODE === 'team') {
    for (const sv of SV) if (sv !== V && inPlay(sv)) {
      if (sv.hung) edge(sv.hung.cx + .3, sv.hung.cy - .6, `rgba(255,45,45,${.7 + .3 * Math.sin(T * 6)})`, 'hook');
      else if (sv.hp <= 0 && !sv.carried) edge(sv.x, sv.y - .3, 'rgba(255,150,60,.95)', 'down');
    }
    teamHUD(V);
    if (S.out) return; // Zuschauer: kein Aktionsknopf, kein Joystick
  }
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
    if (a && a.kind === 'healing') kind = 'tap'; else if (a && a.kind === 'unhooking') kind = 'rescue';
    const live = !!kind, pulse = live ? .5 + .5 * Math.sin(T * 6) : 0;
    const hot = (Q && Q.check && (Q.type === 'gen' || Q.type === 'heal' || Q.type === 'duo')) || (a && (a.kind === 'drop' || a.kind === 'vault') && K.mode === 'chase') || (a && a.kind === 'wiggle');
    ctx.fillStyle = live ? (hot ? `rgba(195,18,31,${.45 + .25 * pulse})` : 'rgba(235,231,220,.16)') : 'rgba(6,7,12,.35)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = live ? `rgba(235,231,220,${.55 + .3 * pulse})` : 'rgba(235,231,220,.18)'; ctx.lineWidth = 2.5; ctx.stroke();
    if (Q && Q.type === 'valve' && Q.hold) { ctx.strokeStyle = '#f2c14b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5, 0, TAU); ctx.stroke(); }
    if (MODE === 'team') teamButtonRing(b);
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
  const prog = q.type === 'heal' ? q.heal.healProg : t.prog;
  const bar = () => { const w = 150, y = c.y + 62; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(c.x - w / 2, y, w, 6); ctx.fillStyle = q.type === 'heal' ? '#7dff9a' : '#f2c14b'; ctx.fillRect(c.x - w / 2, y, w * prog, 6); };
  const bad = q.flash > 0;
  if ((TUT || !qteSeen.has(q.type)) && !(q.type === 'duo' && !duoBoth(t))) {
    const hint = { gen: isTouch ? 'Tippen, wenn die Nadel im weißen Feld ist' : 'Leertaste, wenn die Nadel im weißen Feld ist',
      fuse: isTouch ? 'Tippen, wenn der rote Strich im weißen Feld ist – 3×' : 'Leertaste, wenn der rote Strich im weißen Feld ist – 3×',
      radio: isTouch ? 'Pfeile merken, dann nachtippen' : 'Pfeile merken, dann mit den Pfeiltasten nachmachen',
      valve: isTouch ? 'Knopf halten lässt Druck ab – Nadel im grünen Feld halten' : 'Leertaste halten lässt Druck ab – Nadel im grünen Feld halten',
      heal: isTouch ? 'Heilen: tippen, wenn die Nadel im weißen Feld ist' : 'Heilen: Leertaste, wenn die Nadel im weißen Feld ist',
      duo: isTouch ? 'Zu zweit: tippen, wenn die Nadel im weißen Feld ist' : 'Zu zweit: Leertaste, wenn die Nadel im weißen Feld ist' }[q.type];
    const ph = { gen: 150, fuse: 120, radio: 110, valve: 130, heal: 150, duo: 150 }[q.type];
    ctx.font = '14px "Special Elite", "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(VW - 24, ctx.measureText(hint).width + 24), y = c.y - ph / 2 - 20;
    ctx.fillStyle = 'rgba(6,7,12,.75)'; rrp(ctx, c.x - w / 2, y - 14, w, 28, 14); ctx.fill();
    ctx.fillStyle = '#f2c14b'; ctx.fillText(hint, c.x, y + 1, VW - 36);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  if (q.type === 'duo' && !duoBoth(t)) {
    // Duo allein: warten
    shade(220, 120);
    icon('duo', c.x, c.y - 26, 15, `rgba(235,231,220,${.55 + .3 * Math.sin(T * 4)})`);
    ctx.font = '15px "Special Elite", "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f2c14b'; ctx.fillText('Warte auf Partner' + ' .'.repeat(1 + (Math.floor(T * 2) % 3)), c.x, c.y + 22);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    bar();
  } else if (q.type === 'gen' || q.type === 'heal' || q.type === 'duo') {
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
    icon(q.type, c.x, c.y - 6, q.type === 'gen' ? 13 : 11, q.great > 0 ? '#f2c14b' : q.type === 'heal' ? 'rgba(125,255,160,.85)' : 'rgba(235,231,220,.8)');
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

/* ---- Team-HUD (nur MODE === 'team') ---- */
const pimgs = {};
function portraitImg(skin) {
  if (skin in pimgs) return pimgs[skin];
  let im = null;
  if (typeof skinPortrait === 'function') {
    try { const p = skinPortrait(skin, 64); if (typeof p === 'string') { im = new Image(); im.src = p; } else if (p && (p.getContext || 'complete' in p)) im = p; } catch (e) { im = null; }
  }
  return (pimgs[skin] = im);
}
const imgReady = im => !!im && (!!im.getContext || (im.complete && im.naturalWidth > 0));
function svStatus(sv) { return sv.out === 'escaped' ? 'esc' : sv.out ? 'dead' : sv.hung ? 'hook' : sv.carried ? 'carry' : sv.hp <= 0 ? 'down' : sv.hp < 2 ? 'hurt' : 'ok'; }
const ST_TXT = { ok: 'gesund', hurt: 'verletzt', down: 'am Boden', carry: 'getragen', hook: 'am Haken', dead: 'geopfert', esc: 'entkommen' };
const ST_COL = { ok: 'rgba(235,231,220,.55)', hurt: '#e0323c', down: '#ff9640', carry: '#ff4b4b', hook: '#ff2d2d', dead: 'rgba(160,160,160,.6)', esc: '#7dff9a' };
const ST_ICON = { ok: 'heart', hurt: 'hurt', down: 'down', carry: 'carry', hook: 'hook', dead: 'skull', esc: 'gate' };
function drawPortrait(sv, i, x, y, r) {
  const st = svStatus(sv), gone = st === 'dead' || st === 'esc', im = portraitImg(sv.skin), col = ST_COL[st];
  const pulse = st === 'down' || st === 'carry' || (st === 'hook' && sv.hookProg >= .5) ? .5 + .5 * Math.sin(T * 7) : 1;
  ctx.fillStyle = 'rgba(6,7,12,.8)'; ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, TAU); ctx.fill();
  ctx.save(); ctx.globalAlpha = gone ? .45 : 1;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  if (imgReady(im)) ctx.drawImage(im, x - r, y - r, r * 2, r * 2);
  else {
    const g = ctx.createRadialGradient(x, y - r * .4, 1, x, y, r); g.addColorStop(0, SLOT_COL[i % 3]); g.addColorStop(1, 'rgba(10,12,20,1)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = '#ebe7dc'; ctx.font = `${Math.round(r * 1.05)}px "Cabin Sketch", "Special Elite", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(initial(sv), x, y + 1);
  }
  if (st === 'dead') { ctx.fillStyle = 'rgba(40,0,4,.55)'; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  ctx.restore();
  // Ring: Haken-Fortschritt bzw. Zustandsfarbe
  ctx.lineWidth = 3;
  if (st === 'hook') {
    ctx.strokeStyle = 'rgba(70,0,6,.9)'; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, TAU); ctx.stroke();
    ctx.strokeStyle = sv.hookProg >= .5 ? `rgba(255,45,45,${.6 + .4 * pulse})` : '#c3121f';
    ctx.beginPath(); ctx.arc(x, y, r + 2, -Math.PI / 2, -Math.PI / 2 + TAU * sv.hookProg); ctx.stroke();
    ctx.fillStyle = '#ebe7dc'; ctx.fillRect(x - 1, y + r - 1, 2, 6); // Hälfte = Kampfphase
  } else {
    ctx.strokeStyle = col; ctx.globalAlpha = st === 'down' || st === 'carry' ? .45 + .55 * pulse : 1;
    ctx.beginPath(); ctx.arc(x, y, r + 2, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  }
  // Abzeichen unten rechts
  const bx = x + r * .78, by = y + r * .78;
  ctx.fillStyle = 'rgba(6,7,12,.92)'; ctx.beginPath(); ctx.arc(bx, by, 8, 0, TAU); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke();
  icon(ST_ICON[st], bx, by, 4.6, st === 'ok' ? '#c3121f' : col, 1.5);
}
function teamHUD(V) {
  const x0 = SAL + 30, rowH = 44; let y = SAT + 70;
  const nm = sv => sv.name.length > 16 ? sv.name.slice(0, 15) + '…' : sv.name;
  ctx.font = '13px "Special Elite", "Courier New", monospace';
  const tw = Math.max(98, ...SV.map(sv => ctx.measureText(nm(sv)).width)), cw = 25 + tw + 30;
  ctx.fillStyle = 'rgba(6,7,12,.42)'; rrp(ctx, SAL + 6, y - 24, cw + 6, rowH * SV.length + 4, 14); ctx.fill();
  SV.forEach((sv, i) => {
    const st = svStatus(sv), gone = st === 'dead' || st === 'esc';
    drawPortrait(sv, i, x0, y, 16);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '13px "Special Elite", "Courier New", monospace';
    ctx.fillStyle = sv === S ? (gone ? 'rgba(242,193,75,.55)' : '#f2c14b') : gone ? 'rgba(235,231,220,.45)' : '#ebe7dc';
    ctx.fillText(nm(sv), x0 + 25, y - 7);
    ctx.font = '11px "Special Elite", "Courier New", monospace'; ctx.fillStyle = ST_COL[st];
    ctx.fillText(ST_TXT[st], x0 + 25, y + 9);
    // Haken-Zähler (zwei Punkte; der dritte Haken ist tödlich), Auge = wem man zuschaut
    if (!gone) for (let k = 0; k < 2; k++) { ctx.fillStyle = k < sv.hookN ? '#c3121f' : 'rgba(235,231,220,.18)'; ctx.beginPath(); ctx.arc(x0 + cw - 18 + k * 9, y + 9, 3, 0, TAU); ctx.fill(); }
    if (S.out && sv === V && sv !== S) icon('eye', x0 + cw - 14, y - 7, 6, '#f2c14b', 1.6);
    y += rowH;
  });
  if (!S.out) selfStatus();
}
function pointsLabel(x, y) {
  const p = taskPoints(), done = p >= NEED;
  ctx.font = '15px "Special Elite", "Courier New", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const txt = 'Punkte ' + Math.min(p, NEED) + '/' + NEED, w = ctx.measureText(txt).width + 18;
  ctx.fillStyle = 'rgba(6,7,12,.6)'; rrp(ctx, x - 8, y - 13, w, 26, 13); ctx.fill();
  ctx.fillStyle = done ? '#7dff9a' : '#f2c14b'; ctx.fillText(txt, x + 1, y + 1);
}
/* Großanzeige für den eigenen Zustand: Zappeln (unten), am Haken (oben), am Boden (unten), wird geheilt (oben) */
function selfStatus() {
  const label = (txt, y, col = '#ebe7dc', size = 16) => { ctx.font = `${size}px "Special Elite", "Courier New", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(txt, VW / 2, y, VW - 40); };
  // Kasten mit Überschrift, Leiste und Unterzeile; die Breite passt sich dem Text an
  const panel = (y, w, p, col, tick, head, headCol, sub, subCol = 'rgba(235,231,220,.75)') => {
    ctx.font = '13px "Special Elite", "Courier New", monospace';
    const bw = Math.min(VW - 24, Math.max(w + 28, sub ? ctx.measureText(sub).width + 32 : 0));
    ctx.fillStyle = 'rgba(6,7,12,.74)'; rrp(ctx, VW / 2 - bw / 2, y - 34, bw, sub ? 74 : 54, 16); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.7)'; rrp(ctx, VW / 2 - w / 2, y, w, 12, 6); ctx.fill();
    ctx.fillStyle = col; rrp(ctx, VW / 2 - w / 2, y, Math.max(12, w * clamp(p, 0, 1)), 12, 6); ctx.fill();
    if (tick) { ctx.fillStyle = 'rgba(235,231,220,.9)'; ctx.fillRect(VW / 2 - w / 2 + w * tick - 1.5, y - 4, 3, 20); }
    label(head, y - 17, headCol, 17);
    if (sub) label(sub, y + 28, subCol, 13);
  };
  const low = VH > VW ? VH - SAB - 300 : VH - SAB - 58, high = SAT + 94;
  if (S.carried) {
    const sh = T - (S.wigT || -9) < .15 ? Math.sin(T * 80) * 3 : 0;
    ctx.save(); ctx.translate(sh, 0);
    panel(low, 240, S.wiggle, '#f2c14b', 0, 'Zappeln!', '#f2c14b', isTouch ? 'Tippe schnell auf den Knopf' : 'Leertaste hämmern');
    ctx.restore();
  } else if (S.hung) {
    const fight = S.hookProg >= .5, saving = S.unhookProg > 0;
    panel(high, 260, S.hookProg, fight ? `rgba(255,45,45,${.75 + .25 * Math.sin(T * 8)})` : '#b3121b', .5,
      fight ? 'Kampfphase – halte durch!' : 'Am Haken', fight ? '#ff6b6b' : '#ebe7dc',
      saving ? 'Du wirst gerettet …' : S.hookN >= 2 ? 'Beim nächsten Haken ist es vorbei' : 'Warte auf Rettung', saving ? '#7dff9a' : undefined);
    if (saving) { ctx.fillStyle = '#ebe7dc'; ctx.fillRect(VW / 2 - 130, high + 15, 260 * S.unhookProg, 3); }
  } else if (S.hp <= 0) {
    const healing = T - S.healedT < .3;
    panel(low, 220, S.healProg, '#7dff9a', 0, healing ? 'Du wirst geheilt …' : 'Am Boden', healing ? '#7dff9a' : '#ff9640', 'Kriech weg – ein Teamkollege kann dich aufrichten');
  } else if (T - S.healedT < .3 && S.healProg > 0) {
    panel(high, 200, S.healProg, '#7dff9a', 0, 'Du wirst geheilt …', '#7dff9a');
  }
}
/* Fortschrittsring am Aktionsknopf (Retten = halten) */
function teamButtonRing(b) {
  const t = S.unhook; if (!t) return;
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#ebe7dc'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * t.unhookProg); ctx.stroke();
}

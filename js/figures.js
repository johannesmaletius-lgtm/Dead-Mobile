'use strict';
/* Dead Mobile – Figuren: Polizist und Killer zeichnen */
/* ---- Figuren ---- */
const LOOK = {
  cop: { skin: '#e9b793', hair: '#8b5a2b', cap: '#1b2850', capBand: '#0f1733', shirt: '#22325f', shirtSh: '#172244', arm: '#e5b08b', armSh: '#c28d6a', hand: '#e9b793', pants: '#1b2446', pantsSh: '#121932', shoe: '#eef0f2', shoeSh: '#b9bec6', vest: '#141519', patch: '#e9e9e6' },
  killer: { hair: '#4a2a19', face: '#ebe6dc', shirt: '#b8a589', shirtSh: '#8f7d63', strap: '#1d1916', blood: '#8f0f17', arm: '#d8c1aa', armSh: '#ad957f', hand: '#a4453f', pants: '#2b2622', pantsSh: '#1d1916', shoe: '#d3c6a8', shoeSh: '#9f9378' },
};
const faceOf = a => { const c = Math.cos(a), s = Math.sin(a); return Math.abs(c) > Math.abs(s) * 1.05 ? (c > 0 ? 1 : 3) : (s > 0 ? 0 : 2); };
function knife() {
  ctx.fillStyle = '#1d1614'; ctx.fillRect(-.022, .27, .044, .1);
  ctx.fillStyle = '#b3121b'; ctx.fillRect(.02, .29, .06, .025);
  ctx.fillStyle = '#d9dde0'; ctx.beginPath(); ctx.moveTo(-.032, .36); ctx.lineTo(.032, .36); ctx.lineTo(.012, .62); ctx.lineTo(-.032, .45); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9e1119'; ctx.beginPath(); ctx.moveTo(-.03, .47); ctx.lineTo(.024, .49); ctx.lineTo(.012, .62); ctx.closePath(); ctx.fill();
}
function limb(x0, y0, ang, c1, c2, hand, withKnife) {
  ctx.save(); ctx.translate(x0, y0); ctx.rotate(ang);
  rr(-.054, -.02, .108, .18, .045, c1); rr(-.046, .13, .092, .15, .04, c2); circ(0, .3, .05, hand);
  if (withKnife) knife();
  ctx.restore();
}
function spikes(hy) {
  ctx.fillStyle = LOOK.killer.hair;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI + (i + .5) * Math.PI / 9 + Math.sin(i * 7.3) * .12;
    const bx = Math.cos(a) * .19, by = hy - .03 + Math.sin(a) * .18, tx = Math.cos(a) * (.34 + (i % 3) * .03), ty = hy - .03 + Math.sin(a) * (.31 + (i % 2) * .04);
    ctx.beginPath(); ctx.moveTo(bx + Math.cos(a + 1.6) * .08, by + Math.sin(a + 1.6) * .08); ctx.lineTo(tx, ty); ctx.lineTo(bx + Math.cos(a - 1.6) * .08, by + Math.sin(a - 1.6) * .08); ctx.fill();
  }
}
function head(L, cop, v) {
  const hy = -1;
  if (cop) {
    if (v === 0) {
      ell(0, hy - .02, .245, .23, L.hair); circ(0, hy + .03, .2, L.skin);
      circ(-.075, hy + .04, .024, '#1c140f'); circ(.075, hy + .04, .024, '#1c140f');
      ctx.strokeStyle = '#8a4a36'; ctx.lineWidth = .02; ctx.beginPath(); ctx.arc(0, hy + .09, .05, .3, Math.PI - .3); ctx.stroke();
      ell(0, hy - .15, .255, .125, L.cap); ctx.fillStyle = L.capBand; ctx.fillRect(-.235, hy - .15, .47, .07);
      ctx.fillStyle = '#0a0b0e'; ctx.beginPath(); ctx.ellipse(0, hy - .075, .215, .07, 0, 0, Math.PI); ctx.fill();
      circ(0, hy - .18, .042, '#cfd6de');
    } else if (v === 2) {
      ell(0, hy, .24, .23, L.hair); ell(0, hy - .14, .255, .13, L.cap); ctx.fillStyle = L.capBand; ctx.fillRect(-.235, hy - .13, .47, .06);
    } else {
      ell(-.02, hy - .01, .235, .23, L.hair); ell(.05, hy + .04, .17, .19, L.skin);
      circ(.13, hy + .03, .022, '#1c140f'); ell(.21, hy + .07, .03, .026, L.skin);
      ell(0, hy - .15, .24, .12, L.cap); ctx.fillStyle = L.capBand; ctx.fillRect(-.22, hy - .14, .44, .06);
      ctx.fillStyle = '#0a0b0e'; ctx.beginPath(); ctx.ellipse(.2, hy - .085, .14, .045, 0, 0, TAU); ctx.fill();
    }
  } else {
    spikes(hy);
    if (v === 0) {
      ell(0, hy - .02, .25, .23, L.hair); circ(0, hy + .035, .2, L.face);
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(.17, hy - .11); ctx.lineTo(.2, hy - .04); ctx.lineTo(-.1, hy + .13); ctx.lineTo(-.16, hy + .07); ctx.closePath(); ctx.fill();
      circ(-.075, hy + .025, .027, '#0d0d0d'); circ(.075, hy + .025, .027, '#0d0d0d');
      ctx.strokeStyle = '#c3121f'; ctx.lineWidth = .036; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-.16, hy + .075); ctx.quadraticCurveTo(0, hy + .2, .16, hy + .075); ctx.stroke();
      ctx.fillStyle = L.hair; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * .09 - .06, hy - .15); ctx.lineTo(i * .09 + .05, hy - .15); ctx.lineTo(i * .08 + .01, hy - .04); ctx.fill(); }
    } else if (v === 2) ell(0, hy, .25, .235, L.hair);
    else {
      ell(-.03, hy - .01, .245, .235, L.hair); ell(.05, hy + .045, .17, .19, L.face);
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(.03, hy - .1); ctx.lineTo(.09, hy - .1); ctx.lineTo(.2, hy + .1); ctx.lineTo(.14, hy + .13); ctx.closePath(); ctx.fill();
      circ(.13, hy + .02, .025, '#0d0d0d');
      ctx.strokeStyle = '#c3121f'; ctx.lineWidth = .034; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(.03, hy + .1); ctx.quadraticCurveTo(.15, hy + .18, .21, hy + .08); ctx.stroke();
    }
  }
}
function frontBody(L, o, sw, back) {
  const cop = o.look === 'cop';
  for (let i = 0; i < 2; i++) {
    const lx = i ? .1 : -.1; let off = (i ? 1 : -1) * sw * .055;
    if (o.pose === 'hang') off = Math.sin(T * 9 + i * 2) * .06;
    rr(lx - .068, -.34 + off * .4, .136, .3, .045, L.pants); ell(lx, -.045 + off, .085, .055, L.shoe);
  }
  rr(-.225, -.77, .45, .5, .11, L.shirt);
  if (cop) {
    rr(-.19, -.73, .38, .42, .07, L.vest);
    ctx.fillStyle = L.patch; ctx.fillRect(-.13, back ? -.64 : -.62, .26, .055);
    if (!back) { ctx.fillStyle = '#2a2d33'; ctx.fillRect(-.16, -.52, .09, .09); ctx.fillRect(.07, -.52, .09, .09); }
    ctx.fillStyle = '#0c0d10'; ctx.fillRect(-.215, -.34, .43, .055);
    if (o.hurt) { ell(.07, -.5, .075, .055, '#8f0f17'); ell(-.1, -.63, .045, .035, '#8f0f17'); ell(.13, -.38, .035, .05, '#7a0c12'); }
    if (!back) { ctx.fillStyle = '#9aa1aa'; ctx.fillRect(-.03, -.335, .06, .045); }
  } else {
    ctx.fillStyle = L.strap;
    if (!back) { ctx.fillRect(-.14, -.76, .055, .44); ctx.fillRect(.085, -.76, .055, .44); }
    else { ctx.save(); ctx.translate(0, -.55); ctx.rotate(.45); ctx.fillRect(-.03, -.24, .055, .48); ctx.rotate(-.9); ctx.fillRect(-.03, -.24, .055, .48); ctx.restore(); }
    ell(-.06, -.55, .07, .05, L.blood); ell(.1, -.42, .05, .07, L.blood); ell(-.12, -.36, .04, .03, L.blood);
    ctx.fillStyle = '#15120f'; ctx.fillRect(-.215, -.33, .43, .04);
  }
  let aL = sw * .45, aR = -sw * .45;
  if (o.pose === 'work') { aL = -.75 + Math.sin(T * 14) * .12; aR = .75 + Math.cos(T * 13) * .12; }
  if (o.pose === 'hang') { aL = Math.PI - .25; aR = .5 + Math.sin(T * 7) * .4; }
  if (o.pose === 'lunge') aR = -2.4;
  if (o.pose === 'swing') aR = .9;
  limb(-.275, -.72, aL, L.shirt, L.arm, L.hand, !cop && back);
  limb(.275, -.72, aR, L.shirt, L.arm, L.hand, !cop && !back);
  head(L, cop, back ? 2 : 0);
}
function sideBody(L, o, sw) {
  const cop = o.look === 'cop';
  const l1 = sw * .11, l2 = -sw * .11;
  rr(-.06 + l2, -.34, .12, .3, .045, L.pantsSh); ell(.03 + l2, -.045, .09, .05, L.shoeSh);
  limb(0, -.72, -sw * .5, L.shirtSh, L.armSh, L.armSh, false);
  rr(-.06 + l1, -.34, .12, .3, .045, L.pants); ell(.03 + l1, -.045, .09, .055, L.shoe);
  rr(-.15, -.77, .3, .5, .1, L.shirt);
  if (cop) { rr(-.13, -.73, .27, .42, .06, L.vest); ctx.fillStyle = L.patch; ctx.fillRect(-.06, -.62, .12, .05); ctx.fillStyle = '#0c0d10'; ctx.fillRect(-.15, -.34, .3, .055); ctx.fillStyle = '#22252b'; ctx.fillRect(-.02, -.37, .09, .13); if (o.hurt) { ell(.03, -.52, .06, .05, '#8f0f17'); ell(-.06, -.64, .03, .03, '#8f0f17'); } }
  else { ctx.fillStyle = L.strap; ctx.fillRect(.02, -.76, .05, .44); ell(.05, -.5, .06, .05, L.blood); ctx.fillStyle = '#15120f'; ctx.fillRect(-.15, -.33, .3, .04); }
  let a = sw * .5;
  if (o.pose === 'work') a = -1.2 + Math.sin(T * 14) * .15;
  if (o.pose === 'lunge') a = -1.9;
  if (o.pose === 'swing') a = -.6;
  if (o.pose === 'hang') a = Math.PI - .3;
  limb(0, -.72, a, L.shirt, L.arm, L.hand, !cop);
  head(L, cop, 1);
}
function drawHuman(x, y, o) {
  const L = LOOK[o.look];
  const f = o.face != null ? o.face : faceOf(o.dir || 0);
  const mv = !!o.moving, sw = mv ? Math.sin(o.walk || 0) : 0;
  const bob = mv ? -Math.abs(Math.cos(o.walk || 0)) * .035 : Math.sin(T * 2.3 + x * 3) * .008;
  ctx.save(); ctx.translate(x, y);
  if (!o.noShadow) ell(0, 0, .27, .1, 'rgba(0,0,0,.42)');
  ctx.translate(0, -(o.z || 0) + bob);
  if (o.lie) { ctx.translate(0, -.12); ctx.rotate(o.lie); }
  if (o.shake) ctx.translate(Math.sin(T * 60) * o.shake, 0);
  if (f === 3) ctx.scale(-1, 1);
  if (f === 1 || f === 3) sideBody(L, o, sw); else frontBody(L, o, sw, f === 2);
  ctx.restore();
}
function drawSurv() {
  let pose = null, lie = 0;
  if (S.work) pose = 'work';
  if (state === 'caught' && seq.phase === 'hit') lie = Math.PI / 2 * Math.min(1, seq.t * 5);
  if (S.burst > 0 && S.moving) {
    const a = S.burst / CFG.burstT, bx = -Math.cos(S.dir), by = -Math.sin(S.dir);
    ctx.strokeStyle = `rgba(235,231,220,${.35 * a})`; ctx.lineWidth = .04; ctx.lineCap = 'round'; ctx.beginPath();
    for (let k = -1; k <= 1; k++) { const ox = -by * k * .2, oy = bx * k * .2 - .6; ctx.moveTo(S.x + ox + bx * .35, S.y + oy + by * .35); ctx.lineTo(S.x + ox + bx * (1 + Math.random() * .4), S.y + oy + by * (1 + Math.random() * .4)); }
    ctx.stroke();
  }
  drawHuman(S.x, S.y, { look: 'cop', dir: S.dir, moving: S.moving, walk: S.walk, z: S.z, pose, lie, hurt: S.hp < 2, shake: S.flinch > 0 ? .03 : 0 });
}
function drawKiller() {
  const a = K.act; let pose = null, face = null;
  if (a) { if (a.kind === 'lunge') pose = 'lunge'; if (a.kind === 'break' || a.kind === 'kick') pose = Math.sin(a.t * 11) > 0 ? 'lunge' : 'swing'; if (a.kind === 'recover') pose = 'swing'; if (a.kind === 'wipe') pose = a.t % .5 < .25 ? 'swing' : null; }
  if (state === 'caught' && seq.phase === 'lift') pose = 'lunge';
  if (state === 'caught' && seq.phase === 'hung' && seq.t > .6) face = 0;
  drawHuman(K.x, K.y, { look: 'killer', dir: K.dir, moving: K.moving, walk: K.walk, z: K.z, pose, face });
  if (S && S.carried) drawHuman(K.x + .42, K.y, { look: 'cop', face: 0, lie: -Math.PI / 2, z: .8, noShadow: true, moving: true, walk: T * 3 });
  if (a && a.kind === 'stun') { for (let i = 0; i < 3; i++) { const an = T * 5 + i * TAU / 3; circ(K.x + Math.cos(an) * .25, K.y - 1.42 + Math.sin(an) * .08, .04, 'rgba(255,240,200,.9)'); } }
  if (a && a.kind === 'lunge' && a.t > a.dur * .5) {
    ctx.strokeStyle = `rgba(255,255,255,${.7 * (1 - a.t / a.dur)})`; ctx.lineWidth = .06;
    ctx.beginPath(); ctx.arc(K.x, K.y - .6, .75, K.dir - .9, K.dir + .6); ctx.stroke();
  }
  if (state === 'play' && K.mode !== 'chase' && K.aware > .05) {
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = .1; ctx.beginPath(); ctx.arc(K.x, K.y - 1.6, .16, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,40,40,${.6 + .4 * K.aware})`; ctx.lineWidth = .08; ctx.beginPath(); ctx.arc(K.x, K.y - 1.6, .16, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, K.aware)); ctx.stroke();
  }
}

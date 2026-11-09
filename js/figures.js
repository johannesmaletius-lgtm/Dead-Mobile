'use strict';
/* Dead Mobile – Figuren: Survivor-Skins (Polizist, Sanitäterin, Hausmeister), Killer, Porträts */
/* ---- Figuren ---- */
const SKINS = ['cop', 'medic', 'janitor'];
const SKIN_NAMES = { cop: 'Polizist', medic: 'Sanitäterin', janitor: 'Hausmeister' };
/* surv: Survivor-Skin. Alle Survivors teilen Körper und Animationen, die Stil-Felder wählen die Teile
   (fehlt ein Feld, entfällt das Teil):
   Kopf:  cap/capBand/visor/badge Schirmmütze · beanie/beanieHi/beanieCuff/beanieRib Strickmütze · fringe Haaransatz oben
          tail/tie Pferdeschwanz · beard/lip Vollbart · hairHi/hairSh Glanz und Kante der Haare
   Körper: vest/patch/pockets/belt/buckle/holster Polizeiweste · stripe/stripeSh Reflexstreifen (Brust, Ärmel, Hose)
          cross Kreuz-Aufnäher · hem Jackensaum · bib/bibSh/pocket/button/pen Latzhose · handSh Hand im Schatten
   blood/blood2: Blutflecken bei hurt */
const LOOK = {
  cop: { surv: true, skin: '#e9b793', hair: '#8b5a2b', eye: '#1c140f', mouth: '#8a4a36', cap: '#1b2850', capBand: '#0f1733', visor: '#0a0b0e', badge: '#cfd6de',
    shirt: '#22325f', shirtSh: '#172244', arm: '#e5b08b', armSh: '#c28d6a', hand: '#e9b793', pants: '#1b2446', pantsSh: '#121932', shoe: '#eef0f2', shoeSh: '#b9bec6',
    vest: '#141519', patch: '#e9e9e6', pockets: '#2a2d33', belt: '#0c0d10', buckle: '#9aa1aa', holster: '#22252b', blood: '#8f0f17', blood2: '#7a0c12' },
  medic: { surv: true, skin: '#f1c6a3', hair: '#86401d', hairHi: '#b4642f', hairSh: '#5a2810', fringe: true, tail: true, tie: '#e0353b', eye: '#1c140f', mouth: '#b5524a',
    shirt: '#cf2a30', shirtSh: '#931d22', arm: '#cf2a30', armSh: '#931d22', hand: '#f1c6a3', handSh: '#c99c7c', pants: '#2a2e38', pantsSh: '#1c1f27', shoe: '#3a3c42', shoeSh: '#26272c',
    stripe: '#e6ebee', stripeSh: '#a3abb0', cross: '#ffffff', hem: '#8a181d', blood: '#4d070b', blood2: '#3d0508' },
  janitor: { surv: true, skin: '#9a6446', hair: '#33221a', eye: '#140e0a', mouth: '#e0a58a', beard: '#402919', lip: '#7a4230',
    beanie: '#ee7a2b', beanieHi: '#ffa25e', beanieCuff: '#d2651f', beanieRib: '#a84d15',
    shirt: '#8d9298', shirtSh: '#63676d', arm: '#946043', armSh: '#714630', hand: '#9a6446', pants: '#6b7a30', pantsSh: '#4b5722', shoe: '#7a4c27', shoeSh: '#523319',
    bib: '#6b7a30', bibSh: '#4b5722', pocket: '#58662a', button: '#d8b64e', pen: '#e9c43c', blood: '#8f0f17', blood2: '#7a0c12' },
  killer: { hair: '#4a2a19', face: '#ebe6dc', shirt: '#b8a589', shirtSh: '#8f7d63', strap: '#1d1916', blood: '#8f0f17', arm: '#d8c1aa', armSh: '#ad957f', hand: '#a4453f', pants: '#2b2622', pantsSh: '#1d1916', shoe: '#d3c6a8', shoeSh: '#9f9378' },
};
const faceOf = a => { const c = Math.cos(a), s = Math.sin(a); return Math.abs(c) > Math.abs(s) * 1.05 ? (c > 0 ? 1 : 3) : (s > 0 ? 0 : 2); };
function knife() {
  ctx.fillStyle = '#1d1614'; ctx.fillRect(-.022, .27, .044, .1);
  ctx.fillStyle = '#b3121b'; ctx.fillRect(.02, .29, .06, .025);
  ctx.fillStyle = '#d9dde0'; ctx.beginPath(); ctx.moveTo(-.032, .36); ctx.lineTo(.032, .36); ctx.lineTo(.012, .62); ctx.lineTo(-.032, .45); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9e1119'; ctx.beginPath(); ctx.moveTo(-.03, .47); ctx.lineTo(.024, .49); ctx.lineTo(.012, .62); ctx.closePath(); ctx.fill();
}
// Arm: Oberarm c1, Unterarm c2, Hand; st = Farbe der Reflexstreifen am Ärmel (optional)
function limb(x0, y0, ang, c1, c2, hand, withKnife, st) {
  ctx.save(); ctx.translate(x0, y0); ctx.rotate(ang);
  rr(-.054, -.02, .108, .18, .045, c1); rr(-.046, .13, .092, .15, .04, c2);
  if (st) { ctx.fillStyle = st; ctx.fillRect(-.054, .085, .108, .045); ctx.fillRect(-.046, .2, .092, .032); }
  circ(0, .3, .05, hand);
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
/* ---- Survivor-Kopfteile ---- */
// Pferdeschwanz von der Wurzel (x0,y0) zur Spitze (x1,y1), Breite w, Biegung bend (± zur Seite)
function tail(L, x0, y0, x1, y1, w, bend) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = -dy / l * w, ny = dx / l * w;
  const mx = x0 + dx * .45 + nx * bend, my = y0 + dy * .45 + ny * bend;
  ctx.beginPath(); ctx.moveTo(x0 + nx * .5, y0 + ny * .5);
  ctx.quadraticCurveTo(mx + nx * .72, my + ny * .72, x1, y1);
  ctx.quadraticCurveTo(mx - nx * .62, my - ny * .62, x0 - nx * .5, y0 - ny * .5); ctx.closePath();
  ctx.fillStyle = L.hair; ctx.fill(); ctx.strokeStyle = L.hairSh; ctx.lineWidth = .016; ctx.stroke();
  ctx.strokeStyle = L.hairHi; ctx.lineWidth = .022; ctx.lineCap = 'round'; ctx.beginPath();
  ctx.moveTo(x0 + nx * .12 + dx * .12, y0 + ny * .12 + dy * .12); ctx.quadraticCurveTo(mx + nx * .25, my + ny * .25, x0 + dx * .82 + nx * .1, y0 + dy * .82 + ny * .1); ctx.stroke();
}
// Haargummi an der Wurzel des Pferdeschwanzes
function hairTie(L, x, y, rx, ry, a) { ctx.fillStyle = L.tie; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, a, 0, TAU); ctx.fill(); }
// Strickmütze mit Umschlag (Kuppel, Umschlag, Rippen); x = Versatz in der Seitenansicht
function beanie(L, hy, x) {
  ctx.fillStyle = L.beanie; ctx.beginPath(); ctx.ellipse(x, hy - .12, .252, .2, 0, Math.PI, TAU); ctx.fill();
  ctx.strokeStyle = L.beanieHi; ctx.lineWidth = .028; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(x, hy - .12, .19, .15, 0, Math.PI * 1.2, Math.PI * 1.45); ctx.stroke();
  rr(x - .262, hy - .165, .524, .11, .05, L.beanieCuff);
  ctx.fillStyle = L.beanieRib; for (let i = -3; i <= 3; i++) ctx.fillRect(x + i * .07 - .009, hy - .15, .018, .08);
}
function survHead(L, v, sw) {
  const hy = -1;
  if (v === 0) {
    if (L.tail) tail(L, .1, hy - .12, .35 + sw * .035, hy + .2, .13, .35);
    ell(0, hy - .02, .245, .23, L.hair); circ(0, hy + .03, .2, L.skin);
    if (L.fringe) {
      // Haare straff nach hinten, Haaransatz mit Seitenscheitel
      ctx.fillStyle = L.hair; ctx.beginPath(); ctx.moveTo(-.2, hy + .03);
      ctx.quadraticCurveTo(-.17, hy - .07, -.05, hy - .085); ctx.quadraticCurveTo(.05, hy - .095, .08, hy - .135);
      ctx.quadraticCurveTo(.16, hy - .07, .2, hy + .03); ctx.arc(0, hy + .03, .207, 0, Math.PI, true); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = L.hairHi; ctx.lineWidth = .024; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(-.02, hy - .02, .17, Math.PI * 1.18, Math.PI * 1.42); ctx.stroke();
    }
    circ(-.075, hy + .04, .024, L.eye); circ(.075, hy + .04, .024, L.eye);
    if (L.beard) {
      ctx.fillStyle = L.beard; ctx.beginPath(); ctx.moveTo(-.205, hy - .02);
      ctx.quadraticCurveTo(-.17, hy + .1, -.07, hy + .085); ctx.quadraticCurveTo(0, hy + .06, .07, hy + .085);
      ctx.quadraticCurveTo(.17, hy + .1, .205, hy - .02); ctx.ellipse(0, hy + .04, .208, .238, 0, -.05, Math.PI + .05); ctx.closePath(); ctx.fill();
      ell(0, hy + .128, .05, .02, L.lip);
    }
    ctx.strokeStyle = L.mouth; ctx.lineWidth = .02; ctx.beginPath(); ctx.arc(0, hy + .09, .05, .3, Math.PI - .3); ctx.stroke();
    if (L.cap) {
      ell(0, hy - .15, .255, .125, L.cap); ctx.fillStyle = L.capBand; ctx.fillRect(-.235, hy - .15, .47, .07);
      ctx.fillStyle = L.visor; ctx.beginPath(); ctx.ellipse(0, hy - .075, .215, .07, 0, 0, Math.PI); ctx.fill();
      circ(0, hy - .18, .042, L.badge);
    }
    if (L.beanie) beanie(L, hy, 0);
  } else if (v === 2) {
    ell(0, hy, .24, .23, L.hair);
    if (L.tail) {
      ctx.strokeStyle = L.hairHi; ctx.lineWidth = .02; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(-.17, hy - .06); ctx.quadraticCurveTo(-.14, hy - .16, -.03, hy - .06); ctx.moveTo(.17, hy - .06); ctx.quadraticCurveTo(.14, hy - .16, .03, hy - .06); ctx.stroke();
      tail(L, 0, hy - .04, sw * .06, hy + .43, .13, .12);
      hairTie(L, 0, hy - .04, .06, .035, 0);
    }
    if (L.cap) { ell(0, hy - .14, .255, .13, L.cap); ctx.fillStyle = L.capBand; ctx.fillRect(-.235, hy - .13, .47, .06); }
    if (L.beanie) beanie(L, hy, 0);
  } else {
    if (L.tail) tail(L, -.16, hy - .08, -.31 - Math.abs(sw) * .05, hy + .32, .13, -.3);
    ell(-.02, hy - .01, .235, .23, L.hair); ell(.05, hy + .04, .17, .19, L.skin);
    circ(.13, hy + .03, .022, L.eye);
    if (L.beard) {
      ctx.fillStyle = L.beard; ctx.beginPath(); ctx.moveTo(-.135, hy - .06); ctx.lineTo(-.03, hy - .06);
      ctx.quadraticCurveTo(-.01, hy + .07, .09, hy + .085); ctx.lineTo(.21, hy + .09);
      ctx.quadraticCurveTo(.25, hy + .2, .15, hy + .27); ctx.quadraticCurveTo(0, hy + .29, -.135, hy + .12); ctx.closePath(); ctx.fill();
      ell(.19, hy + .135, .03, .016, L.lip);
    }
    ell(.21, hy + .07, .03, .026, L.skin);
    if (L.fringe) {
      ctx.fillStyle = L.hair; ctx.beginPath(); ctx.moveTo(-.09, hy + .17);
      ctx.quadraticCurveTo(-.02, hy + .1, -.02, hy - .02); ctx.quadraticCurveTo(.07, hy - .1, .19, hy - .06);
      ctx.quadraticCurveTo(.17, hy - .2, .0, hy - .24); ctx.lineTo(-.24, hy - .06); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = L.hairHi; ctx.lineWidth = .024; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(.13, hy - .13); ctx.quadraticCurveTo(-.02, hy - .17, -.17, hy - .07); ctx.stroke();
    }
    if (L.tail) hairTie(L, -.235, hy - .07, .05, .028, .35);
    if (L.cap) {
      ell(0, hy - .15, .24, .12, L.cap); ctx.fillStyle = L.capBand; ctx.fillRect(-.22, hy - .14, .44, .06);
      ctx.fillStyle = L.visor; ctx.beginPath(); ctx.ellipse(.2, hy - .085, .14, .045, 0, 0, TAU); ctx.fill();
    }
    if (L.beanie) beanie(L, hy, -.01);
  }
}
function head(L, v, sw) {
  const hy = -1;
  if (L.surv) { survHead(L, v, sw); return; }
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
/* ---- Survivor-Kleidung (über dem Grundtorso) ---- */
function survTorsoFront(L, o, back) {
  if (L.vest) rr(-.19, -.73, .38, .42, .07, L.vest);
  if (L.patch) { ctx.fillStyle = L.patch; ctx.fillRect(-.13, back ? -.64 : -.62, .26, .055); }
  if (L.pockets && !back) { ctx.fillStyle = L.pockets; ctx.fillRect(-.16, -.52, .09, .09); ctx.fillRect(.07, -.52, .09, .09); }
  if (L.bib) {
    // Latzhose: Bund rundum, vorn Latz mit Trägern, hinten gekreuzte Träger
    ctx.save(); rrp(ctx, -.225, -.77, .45, .5, .11); ctx.clip();
    ctx.fillStyle = L.bib; ctx.fillRect(-.225, -.44, .45, .2);
    if (!back) { ctx.fillRect(-.15, -.63, .3, .22); ctx.fillRect(-.16, -.78, .06, .17); ctx.fillRect(.1, -.78, .06, .17); }
    else { ctx.translate(0, -.6); ctx.rotate(.62); ctx.fillRect(-.03, -.2, .06, .4); ctx.rotate(-1.24); ctx.fillRect(-.03, -.2, .06, .4); }
    ctx.restore();
    ctx.fillStyle = L.bibSh; ctx.fillRect(-.225, -.445, .45, .018);
    if (!back) {
      rr(-.08, -.57, .16, .11, .02, L.pocket); ctx.fillStyle = L.bibSh; ctx.fillRect(-.08, -.57, .16, .025);
      ctx.fillStyle = L.pen; ctx.fillRect(.035, -.62, .02, .06);
      circ(-.128, -.61, .022, L.button); circ(.128, -.61, .022, L.button);
    } else { circ(-.128, -.43, .02, L.button); circ(.128, -.43, .02, L.button); }
  }
  if (L.stripe) { ctx.fillStyle = L.stripe; ctx.fillRect(-.225, -.635, .45, .05); ctx.fillRect(-.225, -.43, .45, .045); }
  if (L.cross) { ctx.fillStyle = L.cross; ctx.fillRect(-.019, -.565, .038, .12); ctx.fillRect(-.06, -.524, .12, .038); }
  if (L.hem) { ctx.fillStyle = L.hem; ctx.fillRect(-.215, -.335, .43, .05); }
  if (L.belt) { ctx.fillStyle = L.belt; ctx.fillRect(-.215, -.34, .43, .055); }
  if (o.hurt) { ell(.07, -.5, .075, .055, L.blood); ell(-.1, -.63, .045, .035, L.blood); ell(.13, -.38, .035, .05, L.blood2); }
  if (L.buckle && !back) { ctx.fillStyle = L.buckle; ctx.fillRect(-.03, -.335, .06, .045); }
}
function survTorsoSide(L, o) {
  if (L.vest) rr(-.13, -.73, .27, .42, .06, L.vest);
  if (L.patch) { ctx.fillStyle = L.patch; ctx.fillRect(-.06, -.62, .12, .05); }
  if (L.bib) {
    ctx.save(); rrp(ctx, -.15, -.77, .3, .5, .1); ctx.clip();
    ctx.fillStyle = L.bib; ctx.fillRect(-.15, -.44, .3, .2); ctx.fillRect(.03, -.63, .12, .2);
    ctx.beginPath(); ctx.moveTo(.03, -.63); ctx.lineTo(.095, -.63); ctx.lineTo(.03, -.78); ctx.lineTo(-.035, -.78); ctx.fill();
    ctx.fillStyle = L.bibSh; ctx.fillRect(-.15, -.445, .3, .018); ctx.restore();
    circ(.06, -.61, .02, L.button);
  }
  if (L.stripe) { ctx.fillStyle = L.stripe; ctx.fillRect(-.15, -.635, .3, .05); ctx.fillRect(-.15, -.43, .3, .045); }
  if (L.cross) { ctx.fillStyle = L.cross; ctx.fillRect(.085, -.555, .03, .095); ctx.fillRect(.053, -.523, .094, .03); }
  if (L.hem) { ctx.fillStyle = L.hem; ctx.fillRect(-.15, -.335, .3, .05); }
  if (L.belt) { ctx.fillStyle = L.belt; ctx.fillRect(-.15, -.34, .3, .055); }
  if (L.holster) { ctx.fillStyle = L.holster; ctx.fillRect(-.02, -.37, .09, .13); }
  if (o.hurt) { ell(.03, -.52, .06, .05, L.blood); ell(-.06, -.64, .03, .03, L.blood); }
}
// Hosenbein mit optionalem Reflexstreifen am Schienbein
function leg(x, y, w, col, st) {
  rr(x, y, w, .3, .045, col);
  if (st) { ctx.fillStyle = st; ctx.fillRect(x, y + .17, w, .035); }
}
function frontBody(L, o, sw, back) {
  const sv = L.surv;
  for (let i = 0; i < 2; i++) {
    const lx = i ? .1 : -.1; let off = (i ? 1 : -1) * sw * .055;
    if (o.pose === 'hang') off = Math.sin(T * 9 + i * 2) * .06;
    leg(lx - .068, -.34 + off * .4, .136, L.pants, L.stripe); ell(lx, -.045 + off, .085, .055, L.shoe);
  }
  rr(-.225, -.77, .45, .5, .11, L.shirt);
  if (sv) survTorsoFront(L, o, back);
  else {
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
  limb(-.275, -.72, aL, L.shirt, L.arm, L.hand, !sv && back, L.stripe);
  limb(.275, -.72, aR, L.shirt, L.arm, L.hand, !sv && !back, L.stripe);
  head(L, back ? 2 : 0, sw);
}
function sideBody(L, o, sw) {
  const sv = L.surv;
  const l1 = sw * .11, l2 = -sw * .11;
  leg(-.06 + l2, -.34, .12, L.pantsSh, L.stripeSh); ell(.03 + l2, -.045, .09, .05, L.shoeSh);
  limb(0, -.72, -sw * .5, L.shirtSh, L.armSh, L.handSh || L.armSh, false, L.stripeSh);
  leg(-.06 + l1, -.34, .12, L.pants, L.stripe); ell(.03 + l1, -.045, .09, .055, L.shoe);
  rr(-.15, -.77, .3, .5, .1, L.shirt);
  if (sv) survTorsoSide(L, o);
  else { ctx.fillStyle = L.strap; ctx.fillRect(.02, -.76, .05, .44); ell(.05, -.5, .06, .05, L.blood); ctx.fillStyle = '#15120f'; ctx.fillRect(-.15, -.33, .3, .04); }
  let a = sw * .5;
  if (o.pose === 'work') a = -1.2 + Math.sin(T * 14) * .15;
  if (o.pose === 'lunge') a = -1.9;
  if (o.pose === 'swing') a = -.6;
  if (o.pose === 'hang') a = Math.PI - .3;
  limb(0, -.72, a, L.shirt, L.arm, L.hand, !sv, L.stripe);
  head(L, 1, sw);
}
function drawHuman(x, y, o) {
  const L = LOOK[o.look] || LOOK.cop;
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
function drawSurv(sv = S) {
  let pose = null, lie = 0;
  if (sv.work) pose = 'work';
  if (sv === S && state === 'caught' && seq.phase === 'hit') lie = Math.PI / 2 * Math.min(1, seq.t * 5);
  if (sv.burst > 0 && sv.moving) {
    const a = sv.burst / CFG.burstT, bx = -Math.cos(sv.dir), by = -Math.sin(sv.dir);
    ctx.strokeStyle = `rgba(235,231,220,${.35 * a})`; ctx.lineWidth = .04; ctx.lineCap = 'round'; ctx.beginPath();
    for (let k = -1; k <= 1; k++) { const ox = -by * k * .2, oy = bx * k * .2 - .6; ctx.moveTo(sv.x + ox + bx * .35, sv.y + oy + by * .35); ctx.lineTo(sv.x + ox + bx * (1 + Math.random() * .4), sv.y + oy + by * (1 + Math.random() * .4)); }
    ctx.stroke();
  }
  drawHuman(sv.x, sv.y, { look: skinOf(sv), dir: sv.dir, moving: sv.moving, walk: sv.walk, z: sv.z, pose, lie: lie || sv.lie || 0, hurt: sv.hp < 2, shake: sv.flinch > 0 ? .03 : 0 });
}
function drawKiller() {
  const a = K.act; let pose = null, face = null;
  if (a) { if (a.kind === 'lunge') pose = 'lunge'; if (a.kind === 'break' || a.kind === 'kick') pose = Math.sin(a.t * 11) > 0 ? 'lunge' : 'swing'; if (a.kind === 'recover') pose = 'swing'; if (a.kind === 'wipe') pose = a.t % .5 < .25 ? 'swing' : null; }
  if (state === 'caught' && seq.phase === 'lift') pose = 'lunge';
  if (state === 'caught' && seq.phase === 'hung' && seq.t > .6) face = 0;
  drawHuman(K.x, K.y, { look: 'killer', dir: K.dir, moving: K.moving, walk: K.walk, z: K.z, pose, face });
  const cs = SV.find(s => s.carried);
  if (cs) drawHuman(K.x + .42, K.y, { look: skinOf(cs), face: 0, lie: -Math.PI / 2, z: .8, noShadow: true, moving: true, walk: T * 3 });
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
/* ---- Porträt für Menü/HUD: Kopf und Oberkörper von vorn als Data-URL (gecacht) ---- */
const portraits = {};
function skinPortrait(skin, size) {
  const key = skin + '@' + size;
  if (portraits[key]) return portraits[key];
  const c = document.createElement('canvas'); c.width = c.height = size;
  const c0 = ctx, r = size / 2;
  ctx = c.getContext('2d');
  try {
    const g = ctx.createRadialGradient(r, r * .75, 0, r, r, r);
    g.addColorStop(0, '#262b35'); g.addColorStop(1, '#0b0d12');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r, r, r, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(r, r, r * .93, 0, TAU); ctx.clip();
    const s = size / .98; ctx.translate(r, r); ctx.scale(s, s); ctx.translate(0, .95);
    frontBody(LOOK[skin] || LOOK.cop, {}, 0, false);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = Math.max(1, size * .025);
    ctx.beginPath(); ctx.arc(r, r, r * .95, 0, TAU); ctx.stroke();
  } finally { ctx = c0; }
  return (portraits[key] = c.toDataURL('image/png'));
}

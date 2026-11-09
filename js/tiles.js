'use strict';
/* Dead Mobile – Kacheln: Wände, Fenster, Bäume, Möbel, Spinde, Haken, Aufgaben, Paletten, Tore, Auto */
/* ---- Kacheln ---- */
function wallTile(x, y) {
  const v = hash(x, y);
  ctx.fillStyle = v < .33 ? '#34303b' : v < .66 ? '#312d37' : '#37333e'; ctx.fillRect(x, y - WH, 1, 1);
  if (v > .8) { ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x + v * .5, y - WH + .2, .3, .25); }
  const up = ch(x, y - 1);
  if (!WALLISH(up)) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x, y - WH, 1, .035); }
  if (!WALLISH(ch(x - 1, y))) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x, y - WH, .035, 1); }
  if (!WALLISH(ch(x + 1, y))) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x + .965, y - WH, .035, 1); }
  if (!WALLISH(ch(x, y + 1))) wallFront(x, y, floorRoom(x, y + 1));
}
/* Tafel an dieser Wandkachel? (Kartenangabe boards) */
function boardAt(x, y, r) { const bs = MAPDEF.boards; if (bs) for (const b of bs) if (b.y === y && b.r === r && x >= b.x0 && x <= b.x1) return b; return null; }
function wallFront(x, y, r) {
  const fy = y + 1 - WH, out = ROOMS[r] && ROOMS[r].out;
  ctx.fillStyle = out ? '#3a2420' : '#29272f'; ctx.fillRect(x, fy, 1, WH);
  if (out) {
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    for (let k = 1; k < 4; k++) ctx.fillRect(x, fy + k * WH / 4, 1, .018);
    for (let k = 0; k < 4; k++) for (let b = (k % 2) * .25; b < 1; b += .5) ctx.fillRect(x + b, fy + k * WH / 4, .018, WH / 4);
  } else {
    const bd = boardAt(x, y, r), ws = ROOMS[r] && ROOMS[r].wall;
    if (bd) {
      ctx.fillStyle = '#1c3327'; ctx.fillRect(x, fy + .06, 1, WH - .2);
      ctx.fillStyle = '#5d4a33'; if (x === bd.x0) ctx.fillRect(x, fy + .04, .05, WH - .16); if (x === bd.x1) ctx.fillRect(x + .95, fy + .04, .05, WH - .16);
      ctx.fillStyle = '#5d4a33'; ctx.fillRect(x, fy + WH - .15, 1, .04);
      ctx.strokeStyle = 'rgba(235,231,220,.55)'; ctx.lineWidth = .03; ctx.beginPath();
      if (bd.art === 'tally' && (x === bd.x0 + 3 || x === bd.x0 + 4)) { for (let k = 0; k < 4; k++) { ctx.moveTo(x + .18 + k * .15, fy + .12); ctx.lineTo(x + .18 + k * .15, fy + .32); } ctx.moveTo(x + .1, fy + .3); ctx.lineTo(x + .8, fy + .14); }
      else if (bd.art === 'smile' && x === bd.x0 + 3) { ctx.arc(x + .5, fy + .12, .18, .3, Math.PI - .3); }
      else if (hash(x, 3) < .6) { ctx.moveTo(x + .1, fy + .15 + hash(x, 1) * .1); ctx.lineTo(x + .5 + hash(x, 2) * .4, fy + .14 + hash(x, 5) * .12); }
      ctx.stroke();
    } else if (ws === 'poster' && hash(x, y + 7) < .28) {
      ctx.fillStyle = ['#7a2b22', '#2d4f6b', '#6b5a2a'][(x * 7) % 3]; ctx.fillRect(x + .2, fy + .08, .5, .3); ctx.fillStyle = 'rgba(235,231,220,.3)'; ctx.fillRect(x + .27, fy + .14, .3, .04);
    } else if (ws === 'gym') { ctx.fillStyle = '#22324a'; ctx.fillRect(x, fy + WH * .45, 1, WH * .45); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + .98, fy + WH * .45, .02, WH * .45); }
    else if (ws === 'tile') { ctx.fillStyle = 'rgba(200,205,210,.1)'; for (let k = 0; k < 4; k++) ctx.fillRect(x + k * .25, fy + .05, .012, WH - .1); ctx.fillRect(x, fy + WH / 2, 1, .012); }
    else if (ws === 'pipe') { ctx.fillStyle = '#3a3d42'; ctx.fillRect(x, fy + .1, 1, .06); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, fy + .16, 1, .02); }
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x, fy + WH - .06, 1, .06);
  }
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x, fy, 1, .02);
}
function windowTile(x, y) {
  const w = windowAt[I(x, y)], blocked = T < w.blockedUntil;
  ctx.fillStyle = '#322e38'; ctx.fillRect(x, y - WH, 1, 1);
  if (w.ax.y !== 0) {
    ctx.fillStyle = '#6b5641'; ctx.fillRect(x + .08, y - WH + .12, .84, .76);
    ctx.fillStyle = '#0a0e15'; ctx.fillRect(x + .15, y - WH + .19, .7, .62);
    if (!WALLISH(ch(x, y + 1))) {
      const fy = y + 1 - WH; ctx.fillStyle = '#29272f'; ctx.fillRect(x, fy, 1, WH);
      ctx.fillStyle = '#6b5641'; ctx.fillRect(x + .08, fy, .84, WH - .08);
      ctx.fillStyle = '#0e1824'; ctx.fillRect(x + .14, fy + .04, .72, WH - .18);
      ctx.strokeStyle = 'rgba(170,200,235,.25)'; ctx.lineWidth = .025; ctx.beginPath(); ctx.moveTo(x + .2, fy + .3); ctx.lineTo(x + .35, fy + .08); ctx.moveTo(x + .6, fy + .33); ctx.lineTo(x + .78, fy + .12); ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#6b5641'; ctx.fillRect(x + .14, y - WH + .04, .72, .92);
    ctx.fillStyle = '#0a0e15'; ctx.fillRect(x + .24, y - WH + .1, .52, .8);
    ctx.strokeStyle = 'rgba(170,200,235,.22)'; ctx.lineWidth = .025; ctx.beginPath(); ctx.moveTo(x + .3, y - WH + .6); ctx.lineTo(x + .55, y - WH + .2); ctx.stroke();
  }
  if (blocked) {
    const p = .6 + .4 * Math.sin(T * 6);
    ctx.strokeStyle = `rgba(210,20,30,${.85 * p})`; ctx.lineWidth = .09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + .15, y - WH + .1); ctx.lineTo(x + .85, y + .3); ctx.moveTo(x + .85, y - WH + .1); ctx.lineTo(x + .15, y + .3); ctx.stroke();
  }
}
function treeTile(x, y) {
  const v = hash(x, y), v2 = hash(y + 3, x);
  const cx = x + .5 + (v - .5) * .25, cy = y + .3 + (v2 - .5) * .2, R = .66 + v * .14;
  ell(cx + .12, y + .9, R * .8, R * .3, 'rgba(0,0,0,.35)');
  ctx.fillStyle = '#2a1d15'; ctx.fillRect(cx - .06, y + .5, .12, .38);
  circ(cx, cy - .25, R, v < .5 ? '#0d1812' : '#0f1b14');
  circ(cx - .12, cy - .38, R * .72, '#132217');
  circ(cx - .2, cy - .5, R * .4, '#19301f');
}
function deskTile(x, y, k) {
  const mensa = (ROOMS[room[I(x, y)]] || {}).f === 'tiles' || k;
  const s = (dx, dy) => ch(x + dx, y + dy) === ch(x, y);
  const h = k ? .45 : mensa ? .34 : .3;
  const L = x + (s(-1, 0) ? 0 : .07), R = x + 1 - (s(1, 0) ? 0 : .07), U = y + (s(0, -1) ? 0 : .12), D = y + 1 - (s(0, 1) ? 0 : .12);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(L + .06, D - .04, R - L, .1);
  ctx.fillStyle = k ? '#80858c' : mensa ? '#6c6f76' : '#6a4f37'; ctx.fillRect(L, U - h, R - L, D - U);
  if (!s(0, -1)) { ctx.fillStyle = k ? '#9ca1a8' : mensa ? '#7b7e86' : '#7a5c41'; ctx.fillRect(L, U - h, R - L, .04); }
  if (!s(0, 1)) {
    ctx.fillStyle = k ? '#44474d' : mensa ? '#3f4147' : '#3e2d20'; ctx.fillRect(L, D - h, R - L, h);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; if (!s(-1, 0)) ctx.fillRect(L + .04, D - h, .06, h); if (!s(1, 0)) ctx.fillRect(R - .1, D - h, .06, h);
  }
  if (!k && !mensa && hash(x, y) < .35) { ctx.save(); ctx.translate(x + .5, y + .35 - h); ctx.rotate(hash(y, x) - .5); ctx.fillStyle = 'rgba(230,225,210,.85)'; ctx.fillRect(-.13, -.09, .26, .18); ctx.restore(); }
}
function tallTile(x, y) {
  const r = room[I(x, y)], gym = (ROOMS[r] || {}).f === 'gym';
  const s = (dx, dy) => ch(x + dx, y + dy) === 'B';
  const h = gym ? .72 : 1.08;
  const l = s(-1, 0) ? 0 : .05, rt = s(1, 0) ? 0 : .05, tp = s(0, -1) ? 0 : .05;
  ctx.fillStyle = gym ? '#35506f' : '#48433c'; ctx.fillRect(x + l, y + tp - h, 1 - l - rt, 1 - tp);
  if (gym) { ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let k = 1; k < 3; k++) ctx.fillRect(x + l, y + tp - h + k * .33, 1 - l - rt, .03); }
  else { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + l + .08, y + tp - h + .1, 1 - l - rt - .16, .7); ctx.fillStyle = '#6b5033'; if (hash(x, y) < .6) ctx.fillRect(x + .2, y - h + .2, .35, .3); }
  if (!s(0, 1)) {
    ctx.fillStyle = gym ? '#243a55' : '#2c2925'; ctx.fillRect(x + l, y + 1 - h, 1 - l - rt, h);
    if (gym) { ctx.fillStyle = 'rgba(255,255,255,.06)'; for (let k = 0; k < 3; k++) ctx.fillRect(x + l, y + 1 - h + k * .24, 1 - l - rt, .03); }
    else { ctx.fillStyle = '#1b1917'; for (let k = 1; k < 3; k++) ctx.fillRect(x + l, y + 1 - h + k * .36, 1 - l - rt, .04); ctx.fillStyle = ['#6b5033', '#5a4a3a', '#7a5a2e'][(x + y) % 3]; ctx.fillRect(x + .15, y + 1 - h + .1, .3, .24); ctx.fillRect(x + .55, y + 1 - h + .48, .3, .22); }
  }
  if (!s(-1, 0)) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + l, y + tp - h, .03, 1 - tp + h); }
}
function boilerTile(x, y) {
  const s = (dx, dy) => ch(x + dx, y + dy) === 'O', h = 1.25;
  const l = s(-1, 0) ? 0 : .04, rt = s(1, 0) ? 0 : .04, tp = s(0, -1) ? 0 : .06;
  ctx.fillStyle = '#2b2b30'; ctx.fillRect(x + l, y + tp - h, 1 - l - rt, 1 - tp);
  ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(x + .1, y + tp - h + .1, .8, .05);
  if (!s(0, 1)) {
    ctx.fillStyle = '#1c1c21'; ctx.fillRect(x + l, y + 1 - h, 1 - l - rt, h);
    ctx.fillStyle = '#3a3a40'; for (let k = 0; k < 3; k++) circ(x + .2 + k * .3, y + 1 - h + .1, .03);
    const b = boilerAt[I(x, y)], fl = b.fc - 1;
    if (y === b.y1 && (x === fl || x === b.fc)) { ctx.fillStyle = '#120806'; ctx.fillRect(x + (x === fl ? .3 : 0), y + 1 - h + .45, .7, .5); ctx.fillStyle = `rgba(255,${110 + Math.sin(T * 7) * 30 | 0},30,.85)`; ctx.fillRect(x + (x === fl ? .38 : 0), y + 1 - h + .58, .62, .3); }
  }
  if (x === boilerAt[I(x, y)].x0 && y === boilerAt[I(x, y)].y0) { ctx.fillStyle = '#3a3b40'; ctx.fillRect(x + .3, y - h - .8, .28, .9); circ(x + .44, y - h - .8, .14, '#46474d'); }
}
function lockerTile(x, y) {
  const L = lockerAt[I(x, y)], h = 1.25, U = y + .2, D = y + .9;
  const sl = ch(x - 1, y) === 'L', sr = ch(x + 1, y) === 'L';
  const l = x + (sl ? .01 : .06), r = x + 1 - (sr ? .01 : .06);
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(l + .05, D - .02, r - l, .1);
  ctx.fillStyle = '#46586b'; ctx.fillRect(l, U - h, r - l, D - U);
  ctx.fillStyle = '#33424f'; ctx.fillRect(l, D - h, r - l, h);
  const op = L.anim;
  if (op > .02) {
    ctx.fillStyle = '#07090c'; ctx.fillRect(l + .06, D - h + .06, r - l - .12, h - .1);
    ctx.fillStyle = '#3d4d5c'; ctx.fillRect(l - op * .22, D - h + .03, .12 + (1 - op) * (r - l - .2), h - .05);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,.5)'; for (let k = 0; k < 3; k++) ctx.fillRect(l + .2, D - h + .14 + k * .08, r - l - .4, .035);
    ctx.fillStyle = '#9aa3ad'; ctx.fillRect(r - .2, D - h + .6, .05, .16);
  }
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(l, D - h, .025, h); ctx.fillRect(r - .025, D - h, .025, h);
}
function hookTile(x, y) {
  const hk = hookAt[I(x, y)], px = x + .5, base = y + .8;
  ell(px, base, .3, .1, 'rgba(0,0,0,.4)');
  ctx.fillStyle = '#261c17'; ctx.fillRect(px - .07, base - 1.8, .14, 1.8);
  ctx.fillStyle = '#3a2c24'; ctx.fillRect(px - .07, base - 1.8, .05, 1.8);
  ctx.fillStyle = '#261c17'; ctx.fillRect(px - .07, base - 1.8, .44, .1);
  ctx.strokeStyle = '#8d8f94'; ctx.lineWidth = .05; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px + .3, base - 1.7); ctx.lineTo(px + .3, base - 1.38); ctx.arc(px + .22, base - 1.38, .08, 0, Math.PI * .9); ctx.stroke();
  ctx.fillStyle = 'rgba(120,10,15,.7)'; ctx.fillRect(px + .27, base - 1.42, .05, .08);
  for (const sv of SV) if (sv.hung === hk) { if (MODE === 'team') drawHung(sv, px, base); else drawHuman(px + .3, base + .05, { look: skinOf(sv), face: 0, pose: 'hang', z: .72, moving: false }); }
}
function genTile(x, y) {
  const t = taskAt[I(x, y)], h = .5, working = isWorked(t);
  const j = working ? Math.sin(T * 50) * .012 : 0;
  ell(x + .5, y + .85, .45, .14, 'rgba(0,0,0,.4)');
  box(x + .1 + j, y + .22, .8, .66, h, '#7a6331', '#54441f');
  ctx.fillStyle = '#2a2622'; ctx.fillRect(x + .2 + j, y + .28 - h, .5, .42);
  for (let k = 0; k < 3; k++) { const py = working || t.done ? Math.sin(T * 25 + k * 2) * .04 : 0; circ(x + .3 + k * .15 + j, y + .4 - h + py, .055, '#4b4540'); }
  ctx.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 0; k < 4; k++) ctx.fillRect(x + .2 + k * .16, y + .88 - h + .12, .08, .26);
  ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = .03; ctx.beginPath(); ctx.moveTo(x + .82, y + .3 - h); ctx.lineTo(x + .82, y - .1 - h); ctx.stroke();
  circ(x + .82, y - .14 - h, .075, t.done ? '#fff3b0' : '#3a3a3a');
}
function fuseTile(x, y) {
  const t = taskAt[I(x, y)], h = .95;
  ctx.fillStyle = '#1b1b1f'; ctx.fillRect(x + .45, y - 1, .06, .5);
  box(x + .18, y + .35, .64, .45, h, '#5c6168', '#40444b');
  ctx.fillStyle = '#c9a227'; ctx.fillRect(x + .18, y + .8 - h + .05, .64, .08);
  ctx.fillStyle = '#111'; for (let k = 0; k < 4; k++) ctx.fillRect(x + .2 + k * .16, y + .8 - h + .05, .07, .08);
  const lit = Math.round(t.prog * 3);
  for (let k = 0; k < 3; k++) circ(x + .32 + k * .18, y + .8 - h + .35, .05, k < lit || t.done ? '#7dff9a' : '#6a1a1a');
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x + .5, y + .8 - h + .5, .02, .35);
}
function valveTile(x, y) {
  const t = taskAt[I(x, y)], working = isWorked(t);
  box(x - .05, y + .38, .75, .28, .38, '#6d6f73', '#4a4c50');
  ctx.fillStyle = '#55575b'; ctx.fillRect(x + .44, y - .25, .12, .6);
  ctx.save(); ctx.translate(x + .5, y - .28); ctx.rotate(working && Q && Q.hold ? T * 5 : t.done ? 0 : .3);
  ctx.strokeStyle = t.done ? '#3aa35a' : '#b3261e'; ctx.lineWidth = .06; ctx.beginPath(); ctx.arc(0, 0, .2, 0, TAU); ctx.stroke();
  ctx.lineWidth = .04; ctx.beginPath(); ctx.moveTo(-.2, 0); ctx.lineTo(.2, 0); ctx.moveTo(0, -.2); ctx.lineTo(0, .2); ctx.stroke();
  ctx.restore();
  circ(x + .82, y + .02, .11, '#e7e3d6'); ctx.strokeStyle = '#222'; ctx.lineWidth = .025;
  const pa = working && Q ? Math.PI + Q.p * Math.PI : t.done ? Math.PI * 1.5 : Math.PI * 1.2;
  ctx.beginPath(); ctx.moveTo(x + .82, y + .02); ctx.lineTo(x + .82 + Math.cos(pa) * .09, y + .02 + Math.sin(pa) * .09); ctx.stroke();
}
/* Duo-Station: Schaltpult mit Schlüsselschalter. Lämpchen: rot = frei, gelb = besetzt, grün = fertig */
function duoTile(x, y) {
  const t = taskAt[I(x, y)], me = t.stations[0].x === x && t.stations[0].y === y ? 0 : 1, h = .8;
  const occ = [0, 1].map(k => SV.some(v => v.work === t && v.station === k)), both = occ[0] && occ[1];
  ell(x + .5, y + .86, .42, .13, 'rgba(0,0,0,.4)');
  box(x + .13, y + .34, .74, .5, h, '#56625a', '#3b453f');
  ctx.fillStyle = '#262d29'; ctx.fillRect(x + .19, y + .38 - h, .62, .32);
  ctx.fillStyle = t.done ? '#7dff9a' : both ? (Math.sin(T * 10) > 0 ? '#f2c14b' : '#8a6a20') : '#1d2b23'; ctx.fillRect(x + .25, y + .43 - h, .32, .2);
  if (!t.done && t.prog > 0) { ctx.fillStyle = 'rgba(242,193,75,.85)'; ctx.fillRect(x + .27, y + .58 - h, .28 * t.prog, .03); }
  circ(x + .69, y + .53 - h, .065, t.done ? '#7dff9a' : occ[me] ? '#f2c14b' : '#a01818');
  ctx.fillStyle = 'rgba(235,231,220,.65)'; for (let k = 0; k <= me; k++) ctx.fillRect(x + .2 + k * .07, y + .86 - h + .08, .035, .14);
  ctx.fillStyle = '#9aa1aa'; ctx.fillRect(x + .44, y + .86 - h + .16, .13, .17);
  ctx.save(); ctx.translate(x + .505, y + .86 - h + .245); ctx.rotate(occ[me] || t.done ? Math.PI / 2 : 0); ctx.fillStyle = '#1b1b1b'; ctx.fillRect(-.018, -.055, .036, .11); ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + .13, y + .84 - h, .74, .03);
}
function plankBox(x, y, w, d, h, horiz) {
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + .05, y + .07, w, d);
  ctx.fillStyle = '#8d6c41'; ctx.fillRect(x, y - h, w, d);
  ctx.fillStyle = '#5e4527'; ctx.fillRect(x, y + d - h, w, h);
  ctx.fillStyle = 'rgba(40,25,10,.55)';
  if (horiz) for (let k = 1; k < 6; k++) ctx.fillRect(x + k * w / 6, y - h, .03, d); else for (let k = 1; k < 6; k++) ctx.fillRect(x, y - h + k * d / 6, w, .03);
}
function palletTile(x, y) {
  const p = palletAt[I(x, y)];
  if (p.state === 2) { ctx.fillStyle = '#4a3620'; for (let k = 0; k < 6; k++) { const v = hash(x * 7 + k, y * 3); ctx.save(); ctx.translate(x + .15 + v * .7, y + .2 + hash(k, x) * .6); ctx.rotate(v * 6); ctx.fillRect(-.15, -.03, .3, .06); ctx.restore(); } return; }
  if (p.state === 1) { if (p.ax.y !== 0) plankBox(x - .18, y + .28, 1.36, .44, .16, true); else plankBox(x + .28, y - .18, .44, 1.36, .16, false); return; }
  if (p.ax.y !== 0) {
    const bx = x + .02, h = 1.0, w = .46;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(bx, y + .08, w + .06, .88);
    ctx.fillStyle = '#94723f'; ctx.beginPath(); ctx.moveTo(bx + w, y + .94); ctx.lineTo(bx + w, y + .06); ctx.lineTo(bx + .06, y + .06 - h); ctx.lineTo(bx + .06, y + .94 - h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(45,28,10,.7)'; ctx.lineWidth = .05; ctx.beginPath();
    for (let k = 1; k < 5; k++) { const t = k / 5; ctx.moveTo(bx + w, y + .06 + t * .88); ctx.lineTo(bx + .06, y + .06 + t * .88 - h); } ctx.stroke();
    ctx.fillStyle = '#6b4f2c'; ctx.beginPath(); ctx.moveTo(bx + w, y + .94); ctx.lineTo(bx + .06, y + .94 - h); ctx.lineTo(bx - .02, y + .94 - h); ctx.lineTo(bx + w - .08, y + .94); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,190,.12)'; ctx.beginPath(); ctx.moveTo(bx + w, y + .06); ctx.lineTo(bx + .06, y + .06 - h); ctx.lineTo(bx + .12, y + .06 - h); ctx.lineTo(bx + w, y + .14); ctx.closePath(); ctx.fill();
  } else {
    const h = 1.0; box(x + .06, y + .04, .88, .2, h, '#7a5c36', '#8d6c41');
    ctx.fillStyle = 'rgba(40,25,10,.55)'; for (let k = 1; k < 5; k++) ctx.fillRect(x + .06, y + .24 - h + k * .2, .88, .04);
    ctx.fillStyle = '#5e4527'; for (let k = 0; k < 3; k++) ctx.fillRect(x + .1 + k * .36, y + .24 - h, .08, h);
  }
}
function gateDraw(g) {
  const x0 = g.x0, x1 = g.x1 + 1, y = g.y, h = 1.55, lift = g.open;
  const top = y + .5 - h + .18, bottom = y + .55 - lift * 1.25;
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x0, y + .45, x1 - x0, .2);
  if (bottom > top) {
    ctx.strokeStyle = '#2a2d31'; ctx.lineWidth = .06;
    ctx.beginPath(); for (let k = 1; k < 10; k++) { const gx = x0 + k * (x1 - x0) / 10; ctx.moveTo(gx, top); ctx.lineTo(gx, bottom); } ctx.stroke();
    ctx.fillStyle = '#34373c'; ctx.fillRect(x0, bottom - .08, x1 - x0, .08); ctx.fillRect(x0, lerp(top, bottom, .5), x1 - x0, .05);
  }
  box(x0 - .14, y + .3, .28, .4, h, '#4b4f55', '#33363b');
  box(x1 - .14, y + .3, .28, .4, h, '#4b4f55', '#33363b');
  ctx.fillStyle = '#3a3d42'; ctx.fillRect(x0 - .14, y + .3 - h, x1 - x0 + .28, .18);
  for (let k = 0; k < 3; k++) circ(x0 + .5 + k * .5, y + .39 - h, .06, gatesPowered ? '#7dffa0' : '#ff3030');
}
function carDraw() {
  const x = car.x0, y = car.y0, w = car.x1 - car.x0 + 1, d = car.y1 - car.y0 + 1, h = .62;
  rr(x + .15, y + .3, w - .1, d - .1, .3, 'rgba(0,0,0,.45)');
  rr(x + .05, y + .1 - h, w - .1, d - .2, .3, '#c8cfd8');
  ctx.fillStyle = '#9aa3ae'; ctx.fillRect(x + .12, y + d - .1 - h, w - .24, h - .05);
  ctx.fillStyle = '#1c4fb0'; ctx.fillRect(x + .12, y + d - .1 - h + .2, w - .24, .13);
  circ(x + .75, y + d - .12, .2, '#0d0e10'); circ(x + w - .75, y + d - .12, .2, '#0d0e10');
  circ(x + .75, y + d - .12, .08, '#5c6168'); circ(x + w - .75, y + d - .12, .08, '#5c6168');
  rr(x + .95, y + .28 - h, 2.1, d - .56, .15, '#aeb7c2');
  ctx.fillStyle = '#121720'; ctx.fillRect(x + .72, y + .3 - h, .22, d - .6); ctx.fillRect(x + 3.06, y + .3 - h, .18, d - .6);
  ctx.fillStyle = '#1c4fb0'; ctx.fillRect(x + .3, y + .18 - h, .35, d - .4);
  const rt = tasks.find(t => t.type === 'radio'), on = endgame || (rt && rt.done);
  const blink = on ? (Math.sin(T * 12) > 0) : false;
  rr(x + 1.62, y + .72 - h, .76, .24, .06, '#1a1d24');
  rr(x + 1.66, y + .75 - h, .32, .18, .05, blink ? '#8fb6ff' : '#233a6e');
  rr(x + 2.02, y + .75 - h, .32, .18, .05, !blink && on ? '#8fb6ff' : '#233a6e');
  if (rt) circ(rt.x + .5, y + .15 - h, .07, rt.done ? '#7dff9a' : '#ff3b3b');
}
function drawTile(x, y) {
  const c = ch(x, y);
  switch (c) {
    case '#': wallTile(x, y); break;
    case 'W': windowTile(x, y); break;
    case 'T': treeTile(x, y); break;
    case 't': deskTile(x, y, false); break;
    case 'k': deskTile(x, y, true); break;
    case 'B': tallTile(x, y); break;
    case 'O': boilerTile(x, y); break;
    case 'L': lockerTile(x, y); break;
    case 'H': hookTile(x, y); break;
    case 'G': genTile(x, y); break;
    case 'F': fuseTile(x, y); break;
    case 'V': valveTile(x, y); break;
    case 'Y': duoTile(x, y); break;
    case 'P': palletTile(x, y); break;
    case 'C': case 'R': if (x === car.x0 && y === car.y1) carDraw(); break;
    case 'E': { const g = gateAt[I(x, y)]; if (g.x0 === x) gateDraw(g); break; }
  }
}

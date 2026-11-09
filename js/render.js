'use strict';
/* Dead Mobile – Zeichnen: Canvas-Setup, Grundformen, Boden vorzeichnen, Raum-Pfade */
/* ================= Zeichnen ================= */
let VW = 0, VH = 0, DPR = 1, TP = 32, SAT = 0, SAB = 0, SAL = 0, SAR = 0;
const LS = .25, FR = 48;
const lc = document.createElement('canvas'), lx = lc.getContext('2d');
const floorCv = document.createElement('canvas');
function resize() {
  VW = window.innerWidth; VH = window.innerHeight; DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR); cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
  TP = clamp(Math.min(VW, VH) / 11.5, 26, 60);
  lc.width = Math.ceil(VW * LS) + 2; lc.height = Math.ceil(VH * LS) + 2;
  if (window.matchMedia && matchMedia('(orientation: portrait) and (pointer: coarse)').matches && state === 'play') pauseGame();
  const cs = getComputedStyle($('#safe'));
  SAT = parseFloat(cs.paddingTop) || 0; SAB = parseFloat(cs.paddingBottom) || 0; SAL = parseFloat(cs.paddingLeft) || 0; SAR = parseFloat(cs.paddingRight) || 0;
}
function ell(x, y, rx, ry, col) { if (col) ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, TAU); ctx.fill(); }
function circ(x, y, r, col) { ell(x, y, r, r, col); }
function rrp(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function rr(x, y, w, h, r, col) { if (col) ctx.fillStyle = col; rrp(ctx, x, y, w, h, r); ctx.fill(); }
function box(x, y, w, d, h, top, front) { ctx.fillStyle = top; ctx.fillRect(x, y - h, w, d); if (front) { ctx.fillStyle = front; ctx.fillRect(x, y + d - h, w, h); } }

/* Boden einmal vorzeichnen */
function buildFloor() {
  floorCv.width = W * FR; floorCv.height = H * FR;
  const f = floorCv.getContext('2d'), rnd = mulberry(1337);
  f.setTransform(FR, 0, 0, FR, 0, 0);
  f.fillStyle = '#080c09'; f.fillRect(0, 0, W, H);
  const A_ = (a) => `rgba(0,0,0,${a})`, L_ = (a) => `rgba(255,235,210,${a})`;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = G[y][x], r = floorRoom(x, y), ft = c === 'T' ? 'forest' : (ROOMS[r] ? ROOMS[r].f : 'forest');
    switch (ft) {
      case 'wood':
        f.fillStyle = '#3b2c21'; f.fillRect(x, y, 1, 1);
        for (let k = 0; k < 4; k++) { const s = rnd(); f.fillStyle = s < .5 ? A_(.05 + rnd() * .08) : L_(.02 + rnd() * .04); f.fillRect(x, y + k * .25, 1, .25); f.fillStyle = A_(.4); f.fillRect(x, y + k * .25, 1, .02); f.fillRect(x + ((x * 3 + k * 5 + y) % 4) / 4, y + k * .25, .02, .25); }
        break;
      case 'lino':
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { f.fillStyle = (i + j + x + y) % 2 ? '#2d3431' : '#28302d'; f.fillRect(x + i * .5, y + j * .5, .5, .5); }
        f.fillStyle = A_(.25); f.fillRect(x, y, 1, .02); f.fillRect(x, y, .02, 1);
        if (rnd() < .3) { f.fillStyle = A_(.12); f.beginPath(); f.ellipse(x + rnd(), y + rnd(), .3, .15, rnd() * 3, 0, TAU); f.fill(); }
        break;
      case 'gym':
        for (let k = 0; k < 5; k++) { f.fillStyle = ['#6a4a2c', '#634528', '#6f4f30', '#5f4226'][(k + x * 2 + y * 3) % 4]; f.fillRect(x + k * .2, y, .2, 1); f.fillStyle = A_(.25); f.fillRect(x + k * .2, y, .015, 1); }
        f.fillStyle = A_(.2); f.fillRect(x, y + ((x * 7) % 5) / 5, 1, .015);
        break;
      case 'tiles':
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { f.fillStyle = (i + j) % 2 ? '#34373e' : '#25272c'; f.fillRect(x + i * .5, y + j * .5, .5, .5); }
        break;
      case 'concrete': case 'cellar': {
        f.fillStyle = ft === 'cellar' ? '#222226' : '#2b2b2e'; f.fillRect(x, y, 1, 1);
        for (let k = 0; k < 6; k++) { f.fillStyle = rnd() < .5 ? A_(.18) : L_(.03); f.fillRect(x + rnd(), y + rnd(), .05, .05); }
        if (rnd() < .18) { f.fillStyle = ft === 'cellar' ? 'rgba(40,55,70,.35)' : A_(.2); f.beginPath(); f.ellipse(x + .5, y + .5, .35 + rnd() * .3, .2 + rnd() * .15, rnd() * 3, 0, TAU); f.fill(); }
        if (rnd() < .12) { f.strokeStyle = A_(.4); f.lineWidth = .025; f.beginPath(); f.moveTo(x + rnd(), y); f.lineTo(x + rnd(), y + .5); f.lineTo(x + rnd(), y + 1); f.stroke(); }
        break; }
      case 'asphalt':
        f.fillStyle = '#212226'; f.fillRect(x, y, 1, 1);
        for (let k = 0; k < 10; k++) { f.fillStyle = rnd() < .5 ? A_(.25) : L_(.035); f.fillRect(x + rnd(), y + rnd(), .04, .04); }
        if (rnd() < .08) { f.strokeStyle = A_(.45); f.lineWidth = .03; f.beginPath(); f.moveTo(x, y + rnd()); f.lineTo(x + .5, y + rnd()); f.lineTo(x + 1, y + rnd()); f.stroke(); }
        break;
      case 'grass':
        f.fillStyle = '#16221a'; f.fillRect(x, y, 1, 1);
        if (rnd() < .2) { f.fillStyle = '#29261c'; f.beginPath(); f.ellipse(x + .5, y + .5, .5, .35, rnd() * 3, 0, TAU); f.fill(); }
        f.strokeStyle = '#223527'; f.lineWidth = .025;
        for (let k = 0; k < 7; k++) { const gx = x + rnd(), gy = y + rnd(); f.beginPath(); f.moveTo(gx, gy); f.lineTo(gx + rnd() * .08 - .04, gy - .1); f.stroke(); }
        break;
      default:
        f.fillStyle = '#0a100c'; f.fillRect(x, y, 1, 1);
        for (let k = 0; k < 4; k++) { f.fillStyle = A_(.3); f.fillRect(x + rnd(), y + rnd(), .06, .06); }
    }
  }
  // Kartenspezifische Bodenbemalung (Linien, Markierungen …)
  if (MAPDEF.decorFloor) MAPDEF.decorFloor(f, rnd);
  // Schatten an Wänden
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = G[y][x]; if (!(c === '.' || c === 'D' || c === 'P')) continue;
    if (WALLISH(ch(x, y - 1))) { const g = f.createLinearGradient(0, y, 0, y + .6); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); f.fillStyle = g; f.fillRect(x, y, 1, .6); }
    if (WALLISH(ch(x - 1, y))) { f.fillStyle = 'rgba(0,0,0,.25)'; f.fillRect(x, y, .14, 1); }
    if (WALLISH(ch(x + 1, y))) { f.fillStyle = 'rgba(0,0,0,.25)'; f.fillRect(x + .86, y, .14, 1); }
  }
  // Flecken, Blätter, Papiere
  const splat = (x, y, s) => { f.fillStyle = 'rgba(80,6,10,.7)'; for (let k = 0; k < 7; k++) { f.beginPath(); f.ellipse(x + (rnd() - .5) * s, y + (rnd() - .5) * s * .6, s * (.1 + rnd() * .3), s * (.08 + rnd() * .2), rnd() * 3, 0, TAU); f.fill(); } };
  hooks.forEach(h => splat(h.front.x, h.front.y - .2, 1));
  if (MAPDEF.decorStains) MAPDEF.decorStains(f, rnd, splat); else defaultStains(f, rnd, splat);
}

/* Standard-Deko für neue Karten: Papiere in Innenräumen, Laub draußen, ein paar Blutflecken */
function defaultStains(f, rnd, splat) {
  const inside = [], outside = [];
  for (let r = 1; r <= NR; r++) if (ROOMS[r] && roomFloor[r]) (ROOMS[r].out ? outside : inside).push(...roomFloor[r].filter((_, k) => ROOMS[r].out || ['wood', 'lino', 'tiles'].includes(ROOMS[r].f) || k % 3 === 0));
  for (let k = 0; k < 6 && inside.length; k++) { const i = inside[(rnd() * inside.length) | 0]; splat(i % W + .5, ((i / W) | 0) + .5, .5 + rnd() * .4); }
  for (let k = 0, n = inside.length / 12; k < n; k++) { const i = inside[(rnd() * inside.length) | 0]; f.save(); f.translate(i % W + rnd(), ((i / W) | 0) + rnd()); f.rotate(rnd() * 3); f.fillStyle = `rgba(215,210,195,${.25 + rnd() * .25})`; f.fillRect(-.12, -.09, .24, .17); f.restore(); }
  for (let k = 0, n = outside.length / 3; k < n; k++) { const i = outside[(rnd() * outside.length) | 0]; f.fillStyle = ['rgba(110,60,25,.5)', 'rgba(140,90,30,.4)', 'rgba(80,40,20,.5)'][k % 3]; f.beginPath(); f.ellipse(i % W + rnd(), ((i / W) | 0) + rnd(), .07, .04, rnd() * 3, 0, TAU); f.fill(); }
}

/* Raum-Pfade fürs Licht */
let roomPath = {}, pathCache = {};
function buildRoomPaths() {
  for (let r = 1; r <= NR; r++) {
    const p = new Path2D();
    for (let i = 0; i < N; i++) if (lmask[i] & (1 << r)) { const x = i % W, y = (i / W) | 0, h = OBJH[G[y][x]] || 0; p.rect(x - .02, y - h - .02, 1.04, 1.04 + h); }
    roomPath[r] = p;
  }
}
function maskPath(m) {
  if (pathCache[m]) return pathCache[m];
  const p = new Path2D(); for (let r = 1; r <= NR; r++) if (m & (1 << r) && roomPath[r]) p.addPath(roomPath[r]);
  return (pathCache[m] = p);
}
/* Nach einem Kartenwechsel: Boden und Licht-Pfade neu aufbauen */
function onMapLoaded() { roomPath = {}; pathCache = {}; buildFloor(); buildRoomPaths(); }

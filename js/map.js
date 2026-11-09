'use strict';
/* Dead Mobile – Karte: Raster, Räume, Objekte, Lampen, Spawns, Kollision, Sichtlinie, A* */
/* ================= Karte =================
   # Wand  T Baum  W Fenster  D Tür  P Palette  t Tisch  k Theke  B Regal/Tribüne  O Kessel
   L Spind  H Haken  G Aggregat  F Sicherungskasten  V Ventil  R Funk (Streifenwagen C)  E Tor
   1–9 Raum-Marker */
const MAP = [
"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
"TTTTTTTTTTTTTTTTTTTTTEETTTTTTTTTTTTTTTTTTTTTTT",
"T.9.........................T................T",
"T...............TT..........T.......H........T",
"T.......G.......T...........T................T",
"T......................T....P...........T....T",
"T..TT.......T...............T..........TT....T",
"T...T.......P...............T....T...........T",
"T...........T................................T",
"######W############D###########W#########D####",
"#........tt..#........tt.#...................#",
"#1...........#2..........#........G..........#",
"#.tt.tt..tt..#.tt.tt..tt.#..................4#",
"#............W...........W...................#",
"#.ttPtt..tt..#.tt.ttPttt.#....B.BBBBBBB.B....#",
"#............#...........#....BPBBBBBBBPB....#",
"#L...........#..........L#....B.BBBBBBB.B....#",
"#####D##############D#####...................#",
"#.......LL..L.........LL.#...................#",
"#3..........P............D.................H.#",
"#...........L..LL........#L..................#",
"####D############D##################D#########",
"#............5#L....#.......................L#",
"#F............#.....#..BBBB..........B.......#",
"#kkkPkk.tt.tt.#B....#........OOOO....B...BBB.#",
"#.......tt.tt.#B....D........OOOOV...P.......#",
"#.............#.6...#..BBBB..OOOO....B.......#",
"#..tt.tt.tt...#...BB#................B.......#",
"#H............#L....#L......................7#",
"########W###D###############W###########D#####",
"T............................................T",
"T.............................T...........T..T",
"T........TT.....CRCC..........T.......H......T",
"T.........T.....CCCC..........P..............T",
"T..T....H.....................T......TT......T",
"T.............................T..............T",
"T8...........................................T",
"TTTTTTTTTTTTTTTTTTTTTTTTEETTTTTTTTTTTTTTTTTTTT"
];
const ROOMS = {
  1: { f: 'wood', amb: .56 },  2: { f: 'wood', amb: .56 },  3: { f: 'lino', amb: .54 },
  4: { f: 'gym', amb: .6 },  5: { f: 'tiles', amb: .56 }, 6: { f: 'concrete', amb: .5 },
  7: { f: 'cellar', amb: .5 }, 8: { f: 'asphalt', amb: .64, out: 1 }, 9: { f: 'grass', amb: .64, out: 1 },
};
const W = MAP[0].length, H = MAP.length, N = W * H;
const G = MAP.map(r => r.split(''));
const ch = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 'T' : G[y][x];
const I = (x, y) => y * W + x;
const D4 = [[0, 1], [1, 0], [-1, 0], [0, -1]];
const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const WALLISH = c => c === '#' || c === 'W';
const TALL = new Set(['#', 'T', 'B', 'O', 'L', 'C', 'R', 'E']);
const OBJH = { '#': .6, W: .6, T: 1.05, B: 1.1, O: 1.3, L: 1.3, H: 1.9, E: 1.6, C: .7, R: .7, F: 1.05, G: .95, V: .7, t: .38, k: .5, P: 1.05 };
const WH = 0.55; // sichtbare Wandhöhe

const room = new Int8Array(N);
(function flood() {
  const block = '#DWE';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = G[y][x]; if (c < '1' || c > '9') continue;
    const id = +c, st = [I(x, y)]; room[I(x, y)] = id;
    while (st.length) {
      const i = st.pop(), px = i % W, py = (i / W) | 0;
      for (const [dx, dy] of D4) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = I(nx, ny); if (room[j] || block.includes(G[ny][nx])) continue;
        room[j] = id; st.push(j);
      }
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (G[y][x] >= '1' && G[y][x] <= '9') G[y][x] = '.';
})();
const mask = new Uint16Array(N), lmask = new Uint16Array(N);
for (let i = 0; i < N; i++) if (room[i]) mask[i] = 1 << room[i];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = I(x, y);
  if (G[y][x] === 'D') for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && room[I(nx, ny)]) mask[i] |= 1 << room[I(nx, ny)]; }
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = I(x, y); lmask[i] = mask[i];
  if (!mask[i]) for (const [dx, dy] of D8) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && room[I(nx, ny)]) lmask[i] |= 1 << room[I(nx, ny)]; }
}
function floorRoom(x, y) { const r = room[I(x, y)]; if (r) return r; for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && room[I(nx, ny)]) return room[I(nx, ny)]; } return 0; }
const stSolid = (x, y) => { const c = ch(x, y); return !(c === '.' || c === 'D' || c === 'P'); };
const firstBit = m => { for (let r = 1; r <= 9; r++) if (m & (1 << r)) return r; return 0; };

/* Objekte aus der Karte */
const tasks = [], pallets = [], windows = [], lockers = [], hooks = [], gates = [], openings = [];
const palletAt = {}, windowAt = {}, lockerAt = {}, taskAt = {}, hookAt = {}, gateAt = {};
const car = { x0: 99, y0: 99, x1: 0, y1: 0 };
const roomFloor = {}; for (let r = 1; r <= 9; r++) roomFloor[r] = [];
function freeNeighbor(x, y) {
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const c = ch(x + dx, y + dy); if (c === '.' || c === 'D') return { x: x + dx + .5, y: y + dy + .5 }; }
  return { x: x + .5, y: y + 1.5 };
}
const axisAt = (x, y) => (stSolid(x - 1, y) && stSolid(x + 1, y)) ? { x: 0, y: 1 } : { x: 1, y: 0 };
const TASK_T = { G: 'gen', F: 'fuse', V: 'valve', R: 'radio' };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const c = G[y][x], i = I(x, y);
  if (c === '.' && room[i]) roomFloor[room[i]].push(i);
  if (TASK_T[c]) {
    const t = { type: TASK_T[c], x, y, cx: x + .5, cy: y + .5, prog: 0, done: false, room: room[i] };
    const a = freeNeighbor(x, y); t.ax = a.x; t.ay = a.y;
    t.aura = c === 'R' ? { x: x - .15, y: y - .95, w: 1.3, h: 1.25 } : c === 'F' ? { x: x + .12, y: y - .75, w: .76, h: 1.6 } : { x: x + .02, y: y - .62, w: .96, h: 1.55 };
    tasks.push(t); taskAt[i] = t;
  }
  if (c === 'P') { const p = { x, y, cx: x + .5, cy: y + .5, ax: axisAt(x, y), state: 0 }; pallets.push(p); palletAt[i] = p; }
  if (c === 'W') { const w = { x, y, cx: x + .5, cy: y + .5, ax: axisAt(x, y), blockedUntil: 0, vaults: [] }; windows.push(w); windowAt[i] = w; }
  if (c === 'L') {
    let f = null;
    for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) { if (ch(x + dx, y + dy) === '.') { f = { x: x + dx + .5, y: y + dy + .5 }; break; } }
    const L = { x, y, cx: x + .5, cy: y + .5, front: f || freeNeighbor(x, y), anim: 0, known: false };
    lockers.push(L); lockerAt[i] = L;
  }
  if (c === 'H') { const h = { x, y, cx: x + .5, cy: y + .5, front: freeNeighbor(x, y) }; hooks.push(h); hookAt[i] = h; }
  if (c === 'C' || c === 'R') { car.x0 = Math.min(car.x0, x); car.y0 = Math.min(car.y0, y); car.x1 = Math.max(car.x1, x); car.y1 = Math.max(car.y1, y); }
  if (c === 'E') {
    let g = gates.find(g => g.y === y && Math.abs(g.x1 + 1 - x) < 1);
    if (!g) { g = { x0: x, x1: x, y, open: 0, north: y < H / 2 }; gates.push(g); } else g.x1 = x;
    gateAt[i] = g;
  }
  if (c === 'D' || c === 'W') {
    const ax = axisAt(x, y), sides = [];
    for (const s of [-1, 1]) { const nx = x + ax.x * s, ny = y + ax.y * s, r = room[I(nx, ny)]; if (r) sides.push({ r, x: x + .5 + ax.x * s * .55, y: y + .5 + ax.y * s * .55 }); }
    for (const sd of sides) { sd.x = x + .5 + (sd.x - x - .5) * 1.5; sd.y = y + .5 + (sd.y - y - .5) * 1.5; }
    if (sides.length === 2) openings.push({ cx: x + .5, cy: y + .5, sides });
  }
}
const TASK_ORDER = ['gen', 'fuse', 'radio', 'valve'];
tasks.sort((a, b) => TASK_ORDER.indexOf(a.type) - TASK_ORDER.indexOf(b.type));
const LAMPS = [
  { x: 6.5, y: 19.3, r: 3.3, a: .7, fl: .15 }, { x: 19.5, y: 19.3, r: 3.3, a: .7, fl: 0 },
  { x: 35.5, y: 12.5, r: 5, a: .6, fl: .5 }, { x: 7, y: 23, r: 3.6, a: .6, fl: .1 },
  { x: 27, y: 25.5, r: 3.8, a: .55, fl: .3, red: 1 }, { x: 17.5, y: 23.6, r: 2.4, a: .6, fl: .6 },
  { x: 41.5, y: 25, r: 3, a: .4, fl: .7, red: 1 },
];
LAMPS.forEach(L => L.room = room[I(L.x | 0, L.y | 0)]);
const SPAWNS = [
  { s: [2.5, 11.5], k: [42.5, 27.5] }, { s: [10.5, 22.5], k: [42.5, 11.5] },
  { s: [3.5, 3.5], k: [41.5, 34.5] }, { s: [21.5, 26.5], k: [5.5, 3.5] },
];

/* Dynamische Begehbarkeit */
function solidAt(tx, ty) {
  const c = ch(tx, ty);
  if (c === '.' || c === 'D') return false;
  if (c === 'P') return palletAt[I(tx, ty)].state === 1;
  if (c === 'E') return gateAt[I(tx, ty)].open < 1;
  return true;
}
function circleHit(x, y, r) {
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (!solidAt(tx, ty)) continue;
    const dx = x - clamp(x, tx, tx + 1), dy = y - clamp(y, ty, ty + 1);
    if (dx * dx + dy * dy < r * r - 1e-6) return true;
  }
  return false;
}
function resolve(e) {
  const r = e.r;
  for (let it = 0; it < 4; it++) {
    let any = false;
    const x0 = Math.floor(e.x - r), x1 = Math.floor(e.x + r), y0 = Math.floor(e.y - r), y1 = Math.floor(e.y + r);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!solidAt(tx, ty)) continue;
      const dx = e.x - clamp(e.x, tx, tx + 1), dy = e.y - clamp(e.y, ty, ty + 1), d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      any = true;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), p = r - d; e.x += dx / d * p; e.y += dy / d * p; }
      else {
        const l = e.x - tx, rr = tx + 1 - e.x, u = e.y - ty, dd = ty + 1 - e.y, m = Math.min(l, rr, u, dd);
        if (m === l) e.x = tx - r; else if (m === rr) e.x = tx + 1 + r; else if (m === u) e.y = ty - r; else e.y = ty + 1 + r;
      }
    }
    if (!any) break;
  }
}
function moveEnt(e, dx, dy) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.12));
  for (let i = 0; i < n; i++) { e.x += dx / n; resolve(e); e.y += dy / n; resolve(e); }
}
function lineWalk(x0, y0, x1, y1, r) {
  const dx = x1 - x0, dy = y1 - y0, d = hyp(dx, dy), n = Math.ceil(d / 0.25);
  for (let i = 1; i <= n; i++) { const t = i / n; if (circleHit(x0 + dx * t, y0 + dy * t, r)) return false; }
  return true;
}
function losClear(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, d = hyp(dx, dy), n = Math.ceil(d / 0.2);
  for (let i = 1; i < n; i++) {
    const x = Math.floor(x0 + dx * i / n), y = Math.floor(y0 + dy * i / n), c = ch(x, y);
    if (TALL.has(c) && !(c === 'E' && gateAt[I(x, y)] && gateAt[I(x, y)].open >= 1)) return false;
  }
  return true;
}

/* A* für den Killer (Fenster = Sprung, liegende Palette = zerbrechen) */
const gS = new Float32Array(N), par = new Int32Array(N), seen = new Uint32Array(N), shut = new Uint32Array(N);
let stampN = 0; const HP = [], HF = [];
function hpush(i, f) { HP.push(i); HF.push(f); let k = HP.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (HF[p] <= HF[k]) break; [HP[p], HP[k]] = [HP[k], HP[p]]; [HF[p], HF[k]] = [HF[k], HF[p]]; k = p; } }
function hpop() {
  const top = HP[0], li = HP.pop(), lf = HF.pop();
  if (HP.length) { HP[0] = li; HF[0] = lf; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < HP.length && HF[l] < HF[m]) m = l; if (r < HP.length && HF[r] < HF[m]) m = r; if (m === k) break; [HP[m], HP[k]] = [HP[k], HP[m]]; [HF[m], HF[k]] = [HF[k], HF[m]]; k = m; } }
  return top;
}
function kc(x, y) { const c = ch(x, y); if (c === '.' || c === 'D') return 1; if (c === 'P') return palletAt[I(x, y)].state === 1 ? 3 : 1; if (c === 'W') return 2; return 0; }
const axisOf = (x, y) => (windowAt[I(x, y)] || palletAt[I(x, y)]).ax;
function nearestWalk(x, y) {
  if (kc(x, y) === 1) return [x, y];
  for (let r = 1; r <= 3; r++) { let best = null, bd = 1e9; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (kc(x + dx, y + dy) === 1) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [x + dx, y + dy]; } } } if (best) return best; }
  return null;
}
function findPath(sx, sy, gx, gy) {
  const s0 = nearestWalk(sx, sy), g0 = nearestWalk(gx, gy); if (!s0 || !g0) return null;
  const s = I(s0[0], s0[1]), g = I(g0[0], g0[1]); if (s === g) return [g];
  stampN++; HP.length = 0; HF.length = 0;
  gS[s] = 0; par[s] = -1; seen[s] = stampN; hpush(s, 0);
  while (HP.length) {
    const i = hpop(); if (shut[i] === stampN) continue; shut[i] = stampN; if (i === g) break;
    const x = i % W, y = (i / W) | 0, k = kc(x, y);
    for (const [dx, dy] of D8) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = kc(nx, ny); if (!nk) continue;
      const diag = dx !== 0 && dy !== 0;
      if (k > 1) { if (diag) continue; const a = axisOf(x, y); if (!((dx === a.x && dy === a.y) || (dx === -a.x && dy === -a.y))) continue; }
      if (nk > 1) { if (diag) continue; const a = axisOf(nx, ny); if (!((dx === a.x && dy === a.y) || (dx === -a.x && dy === -a.y))) continue; }
      if (diag && (nk !== 1 || kc(x + dx, y) !== 1 || kc(x, y + dy) !== 1)) continue;
      const j = I(nx, ny); if (shut[j] === stampN) continue;
      const cost = gS[i] + (diag ? 1.414 : 1) + (nk === 2 ? CFG.costWin : nk === 3 ? CFG.costPal : 0);
      if (seen[j] !== stampN || cost < gS[j]) {
        seen[j] = stampN; gS[j] = cost; par[j] = i;
        const hx = Math.abs(nx - g0[0]), hy = Math.abs(ny - g0[1]);
        hpush(j, cost + Math.max(hx, hy) + 0.414 * Math.min(hx, hy));
      }
    }
  }
  if (seen[g] !== stampN) return null;
  const path = []; for (let i = g; i !== s; i = par[i]) path.push(i); path.reverse(); return path;
}

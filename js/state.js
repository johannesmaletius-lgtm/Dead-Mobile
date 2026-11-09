'use strict';
/* Dead Mobile – Spielzustand, Speicherstand, Figuren anlegen, Spielstart */
/* ================= Zustand ================= */
let state = 'title', prevState = 'play';
let T = 0, timeScale = 1, slowT = 0;
/* SV: alle Überlebenden, S: der eigene (lokal gesteuerte), MODE: 'solo' | 'team' */
let SV = [], MODE = 'solo';
let S, K, Q = null, seq = null, marks = [], parts = [], splats = [], noises = [];
let endgame = false, gatesPowered = false, flash = 0, flashCol = '195,18,31', eyeT = -9, chaseFlash = 0;
let endWon = false, TUT = null, toastMsg = null, toastT = -9;
const qteSeen = new Set();
function toast(msg) { toastMsg = msg; toastT = T; }
let hbNext = 0, hbPulse = 0, terror = 0, everMoved = false, isTouch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
const stats = { t0: 0, end: 0, fails: 0 };
const resetStats = () => Object.assign(stats, { t0: T, end: 0, fails: 0, chase: 0, pallets: 0, vaults: 0, stuns: 0, checks: 0, chasesWon: 0 });
const cam = { x: 22, y: 19, z: 1, sh: 0 };
let actNow = null;
let save = { best: 0, wins: 0 };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) save = Object.assign(save, s); } catch (e) {}
function persist() { if (TEST) return; try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }
try { const s = localStorage.getItem(KEY + '-snd'); if (s === '0') A.on = false; } catch (e) {}

function newSurv(x, y, o) { return Object.assign({ id: 0, kind: 'local', skin: 'cop', name: '', x, y, r: CFG.sR, dir: -Math.PI / 2, moving: false, running: false, walk: 0, z: 0, act: null, work: null, hidden: null, mask: mask[I(x | 0, y | 0)], markAcc: 0, stepT: 0, carried: false, hung: null, ghost: false, flinch: 0, hp: 2, burst: 0, dropT: 0, breathT: 3, out: null, station: 0 }, o); }
function newKiller(x, y) { return { x, y, r: CFG.kR, dir: Math.PI / 2, mode: 'patrol', act: null, path: null, pi: 0, pathGoal: -1, repathT: 0, goal: null, inv: null, search: null, aware: 0, seenT: -99, lastSeen: { x, y }, chaseT: 0, blood: 0, trailT: 0, scanT: 0, moving: false, walk: 0, z: 0, stuck: 0, mask: mask[I(x | 0, y | 0)], lastContact: 0, stepT: 0 }; }

function resetWorld() {
  tasks.forEach(t => { t.prog = 0; t.done = false; });
  SV = [];
  pallets.forEach(p => p.state = 0);
  windows.forEach(w => { w.blockedUntil = 0; w.vaults = []; });
  lockers.forEach(L => { L.anim = 0; L.known = false; });
  gates.forEach(g => g.open = 0);
  endgame = false; gatesPowered = false; marks = []; parts = []; noises = []; seq = null; Q = null;
  splats = []; flash = 0; eyeT = -9; chaseFlash = 0; timeScale = 1;
}
function uiPlay(tut) {
  $('#title').hidden = true; $('#end').hidden = true; $('#pause').hidden = true;
  $('#pauseBtn').hidden = tut; $('#tutCard').hidden = !tut;
}
/* Karte wechseln (nur wenn nötig – baut Boden und Licht neu) */
function useMap(id) { if (MAPID !== id) { loadMap(id); onMapLoaded(); } }
function startGame() {
  A.init();
  useMap('schule'); MODE = 'solo';
  TUT = null; endWon = false; toastMsg = null;
  resetWorld();
  const sp = pick(SPAWNS);
  S = newSurv(sp.s[0], sp.s[1], { skin: save.skin || 'cop' }); SV = [S]; K = newKiller(sp.k[0], sp.k[1]);
  K.lastContact = T;
  resetStats();
  cam.x = S.x; cam.y = S.y; cam.z = 1;
  state = 'play';
  uiPlay(false);
}

/* ================= Team-Modus: 3 Überlebende =================
   roster: [{ kind: 'local'|'bot'|'remote', id, name, skin }]; freie Plätze füllen Bots. */
const skinList = () => typeof SKINS !== 'undefined' ? SKINS : ['cop'];
const skinOf = sv => (typeof LOOK !== 'undefined' && LOOK[sv.skin]) ? sv.skin : 'cop';
function assignSkins(roster) {
  const used = new Set(roster.map(p => p.skin).filter(Boolean));
  return roster.map(p => p.skin || skinList().find(k => !used.has(k) && used.add(k)) || 'cop');
}
function startTeam(mapId = 'schule-team', roster, spawnIdx) {
  A.init();
  useMap(mapId); MODE = 'team';
  TUT = null; endWon = false; toastMsg = null;
  resetWorld();
  roster = (roster || [{ kind: 'local', skin: save.skin }]).slice(0, 3);
  while (roster.length < 3) roster.push({ kind: 'bot' });
  const skins = assignSkins(roster), sp = spawnIdx != null ? SPAWNS[spawnIdx % SPAWNS.length] : pick(SPAWNS);
  SV = roster.map((p, i) => { const pos = sp.ss[i % sp.ss.length]; return newSurv(pos[0], pos[1], { id: p.id != null ? p.id : i, kind: p.kind, skin: skins[i], name: p.name || (typeof SKIN_NAMES !== 'undefined' && SKIN_NAMES[skins[i]]) || 'Überlebender ' + (i + 1) }); });
  S = SV.find(v => v.kind === 'local') || SV[0];
  K = newKiller(sp.k[0], sp.k[1]); K.lastContact = T;
  resetStats();
  cam.x = S.x; cam.y = S.y; cam.z = 1;
  state = 'play';
  uiPlay(false);
}
/* Wird gerade bearbeitet? (jemand arbeitet an Aufgabe t) */
const isWorked = t => SV.some(v => v.work === t);
/* Aus wessen Sicht wird gezeigt (später: Zuschauen nach Tod/Flucht) */
const viewer = () => S;
/* Im Spiel sichtbar und im Blickbereich (visM = sichtbare Räume)? */
const survShown = (sv, visM) => !sv.ghost && !sv.hidden && !sv.carried && !sv.hung && !sv.out && (sv.mask & visM) !== 0;
/* Noch im Spiel (nicht raus, nicht tot) */
const inPlay = sv => !sv.ghost && !sv.out;

'use strict';
/* Dead Mobile – Spielzustand, Speicherstand, Figuren anlegen, Spielstart */
/* ================= Zustand ================= */
let state = 'title', prevState = 'play';
let T = 0, timeScale = 1, slowT = 0;
/* SV: alle Überlebenden, S: der eigene (lokal gesteuerte), MODE: 'solo' | 'team' */
let SV = [], MODE = 'solo';
/* KP: Wer steuert den Killer? null = KI, 'local' = ich selbst (dann ist S nur ein Platzhalter), 'remote' = ein Mitspieler */
let KP = null;
let S, K, Q = null, seq = null, marks = [], parts = [], splats = [], noises = [];
let endgame = false, gatesPowered = false, flash = 0, flashCol = '195,18,31', eyeT = -9, chaseFlash = 0;
let endWon = false, TUT = null, toastMsg = null, toastT = -9;
let netPaused = false; // Online: Pause ist nur eine Überlagerung, das Spiel läuft weiter (js/main.js)
const qteSeen = new Set();
function toast(msg) { toastMsg = msg; toastT = T; }
let hbNext = 0, hbPulse = 0, terror = 0, everMoved = false, isTouch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
const stats = { t0: 0, end: 0, fails: 0 };
const resetStats = () => Object.assign(stats, { t0: T, end: 0, fails: 0, chase: 0, pallets: 0, vaults: 0, stuns: 0, checks: 0, chasesWon: 0, heals: 0, rescues: 0 });
const cam = { x: 22, y: 19, z: 1, sh: 0 };
let actNow = null;
let save = { best: 0, wins: 0 };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) save = Object.assign(save, s); } catch (e) {}
function persist() { if (TEST) return; try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }
try { const s = localStorage.getItem(KEY + '-snd'); if (s === '0') A.on = false; } catch (e) {}

function newSurv(x, y, o) { return Object.assign({ id: 0, kind: 'local', skin: 'cop', name: '', x, y, r: CFG.sR, dir: -Math.PI / 2, moving: false, running: false, walk: 0, z: 0, act: null, work: null, hidden: null, mask: mask[I(x | 0, y | 0)], markAcc: 0, stepT: 0, carried: false, hung: null, ghost: false, flinch: 0, hp: 2, burst: 0, dropT: 0, breathT: 3, out: null, station: 0,
  // Team-Regeln (js/rules.js)
  hookN: 0, hookProg: 0, unhookProg: 0, healProg: 0, wiggle: 0, heal: null, unhook: null, healedT: -9, unhookT: -9, outT: 0, leave: null, spec: null }, o); }
function newKiller(x, y) { return { x, y, r: CFG.kR, dir: Math.PI / 2, mode: 'patrol', act: null, path: null, pi: 0, pathGoal: -1, repathT: 0, goal: null, inv: null, search: null, aware: 0, seenT: -99, lastSeen: { x, y }, chaseT: 0, blood: 0, trailT: 0, scanT: 0, moving: false, walk: 0, z: 0, stuck: 0, mask: mask[I(x | 0, y | 0)], lastContact: 0, stepT: 0,
  // Team-Regeln (js/rules.js): Getragener, Haken-Ziel, kein Camping, 40-s-Regel
  carry: null, hookGoal: null, carryT: 0, campUntil: -99, campRoom: 0, hunt: { sv: null, t: 0, last: -99 }, ignore: null,
  // Lernen aus Wiederholungen (js/killer.js) und Killer als Spieler (js/hkiller.js); die Survivor-Felder braucht viewer()
  mem: { loops: {}, stuns: 0 }, loop: { sv: null, x: 0, y: 0, t: 0, fake: -99, alt: null }, swT: 0, human: null,
  hp: 2, hidden: null, out: null, carried: false, hung: null, work: null, heal: null, name: 'Killer', kstats: { hits: 0, downs: 0, hooks: 0, kills: 0 } }; }

function resetWorld() {
  tasks.forEach(t => { t.prog = 0; t.done = false; });
  SV = [];
  pallets.forEach(p => p.state = 0);
  windows.forEach(w => { w.blockedUntil = 0; w.vaults = []; });
  lockers.forEach(L => { L.anim = 0; L.known = false; L.uses = 0; L.memT = -99; });
  gates.forEach(g => g.open = 0);
  endgame = false; gatesPowered = false; marks = []; parts = []; noises = []; seq = null; Q = null;
  splats = []; flash = 0; eyeT = -9; chaseFlash = 0; timeScale = 1;
}
function uiPlay(tut) {
  $('#title').hidden = true; $('#end').hidden = true; $('#pause').hidden = true;
  $('#pauseBtn').hidden = tut; $('#tutCard').hidden = !tut;
  $('#specBar').hidden = true; $('#teamRes').hidden = true; netPaused = false;
}
/* Karte wechseln (nur wenn nötig – baut Boden und Licht neu) */
function useMap(id) { if (MAPID !== id) { loadMap(id); onMapLoaded(); } }
function startGame() {
  A.init();
  useMap('schule'); MODE = 'solo'; KP = null;
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
/* killer: null = KI, 'local' = ich spiele den Killer (alle Survivors sind dann Bots oder Mitspieler), 'remote' = ein Mitspieler */
function startTeam(mapId = 'schule-team', roster, spawnIdx, killer) {
  A.init();
  useMap(mapId); MODE = 'team'; KP = killer || null;
  TUT = null; endWon = false; toastMsg = null;
  resetWorld(); teamReset(); teamRoster = roster || null;
  roster = (roster || [KP === 'local' ? { kind: 'bot' } : { kind: 'local', skin: save.skin }]).slice(0, 3);
  while (roster.length < 3) roster.push({ kind: 'bot' });
  const skins = assignSkins(roster), sp = spawnIdx != null ? SPAWNS[spawnIdx % SPAWNS.length] : pick(SPAWNS);
  SV = roster.map((p, i) => { const pos = sp.ss[i % sp.ss.length]; return newSurv(pos[0], pos[1], { id: p.id != null ? p.id : i, kind: p.kind, skin: skins[i], name: p.name || (typeof SKIN_NAMES !== 'undefined' && SKIN_NAMES[skins[i]]) || 'Überlebender ' + (i + 1) }); });
  S = SV.find(v => v.kind === 'local') || SV[0];
  K = newKiller(sp.k[0], sp.k[1]); K.lastContact = T; K.human = KP;
  // Killer-Spieler: der eigene Survivor ist ein unsichtbarer Platzhalter außerhalb von SV
  if (KP === 'local') S = newSurv(K.x, K.y, { id: -99, kind: 'none', ghost: true, name: '' });
  resetStats();
  cam.x = viewer().x; cam.y = viewer().y; cam.z = 1;
  if (typeof Bots !== 'undefined') Bots.attach();   // freie Plätze bekommen die Bot-KI (js/bots.js)
  if (KP === 'local') toast('Du bist der Killer – jage die Überlebenden!');
  state = 'play';
  uiPlay(false);
}
/* Wird gerade bearbeitet? (jemand arbeitet an Aufgabe t) */
const isWorked = t => SV.some(v => v.work === t);
/* Aus wessen Sicht wird gezeigt: der eigene Survivor – ist er raus (Team), nach kurzem Abschied (Lauf durchs Tor,
   Klauen) ein Teamkollege im Spiel (S.spec). Ist niemand mehr im Spiel, bleibt die Sicht bei dem, der zuletzt rausging. */
const specDelay = () => S.out === 'dead' ? 2.6 : 1.7;
function viewer() {
  if (MODE === 'team' && KP === 'local') return K;
  if (MODE !== 'team' || !S || !S.out || T - S.outT < specDelay()) return S;
  if (S.spec && inPlay(S.spec)) return S.spec;
  const a = SV.filter(inPlay);
  if (a.length) return (S.spec = a[0]);
  return SV.reduce((b, v) => (v.outT > b.outT ? v : b), S);
}
/* Wird der Betrachter gerade gejagt? Solo: jede Jagd. Team: nur das Jagdziel selbst (und der Killer-Spieler, wenn er jagt) –
   davon hängen Jagdmusik, Kamera-Zoom und der rote Rand ab. */
const chasedView = () => !!K && K.mode === 'chase' && (MODE !== 'team' || KP === 'local' || K.target === viewer());
/* Im Spiel sichtbar und im Blickbereich (visM = sichtbare Räume)? */
const survShown = (sv, visM) => !sv.ghost && !sv.hidden && !sv.carried && !sv.hung && !sv.out && (sv.mask & visM) !== 0;
/* Noch im Spiel (nicht raus, nicht tot) */
const inPlay = sv => !sv.ghost && !sv.out;

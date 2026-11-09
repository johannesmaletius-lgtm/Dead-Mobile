'use strict';
/* Dead Mobile – Tutorial (spielbar, in der Turnhalle) */
/* ================= Tutorial (spielbar, in der Turnhalle) ================= */
const ctlIdle = () => { K.moving = false; };
function ctlRoute(pts, spd, then) {
  let i = 0, w = 0;
  return dt => {
    if (i >= pts.length) { K.moving = false; if (then) { const f = then; then = null; f(); } return; }
    const p = pts[i];
    if (p.wait) { K.moving = false; w += dt; if (p.look != null) K.dir = p.look + Math.sin(w * 2.4) * .9; if (w >= p.wait) { w = 0; i++; } return; }
    if (goTo(K, p.x, p.y, spd, dt)) i++;
  };
}
function tutChase() { if (K.mode !== 'chase') { K.mode = 'chase'; K.seenT = T; K.lastSeen = { x: S.x, y: S.y }; K.path = null; K.goal = null; K.chaseT = 0; } }
const tutGen = () => tasks.find(t => t.type === 'gen' && t.x === 34);
const tutLocker = () => lockers.find(l => l.x === 26 && l.y === 20);
const TAP = () => isTouch ? 'tippen' : 'Leertaste drücken';
const TSTEPS = [
  { text: () => isTouch ? 'Zieh auf der linken Bildschirmhälfte, um zu laufen. Ganz gedrückt rennst du, halb gedrückt schleichst du – leise und ohne Spuren. Lauf zum hellen Kreis.'
      : 'Laufen mit WASD oder den Pfeiltasten. Mit gedrückter Umschalttaste schleichst du – leise und ohne Spuren. Lauf zum hellen Kreis.',
    enter() { TUT.targets = [{ x: 31.5, y: 12.5 }]; },
    done: () => hyp(S.x - 31.5, S.y - 12.5) < .8 },
  { text: () => 'Gelb umrandet = Aufgabe. Stell dich davor und ' + (isTouch ? 'tipp den runden Knopf rechts unten.' : 'drück die Leertaste.') + ' Kommt die rote Nadel ins weiße Feld: ' + TAP() + '! Daneben macht Lärm – dann weiß der Killer, wo du bist.',
    enter() { const g = tutGen(); TUT.targets = [{ x: g.ax, y: g.ay }]; },
    done: () => tutGen().done },
  { text: 'Achtung! Ein roter Fleck an einer Tür heißt: Der Killer kommt gleich herein. Versteck dich schnell im Spind!',
    enter() { const L = tutLocker(); TUT.targets = [{ x: L.front.x, y: L.front.y }]; K.x = 36.5; K.y = 26.5; K.act = null; K.path = null; K.mode = 'patrol'; K.ctl = ctlRoute([{ x: 36.5, y: 22.35 }], 1.6); },
    update() { if (!K.moving) K.dir = -Math.PI / 2; },
    done: () => !!S.hidden },
  { text: 'Ganz still … Im Spind sieht er dich nicht. Warte, bis er wieder weg ist.',
    enter() { K.ctl = ctlRoute([{ x: 36.5, y: 19.3 }, { wait: 1.6, look: -Math.PI / 2 }, { x: 28.6, y: 18.6 }, { wait: 1.6, look: Math.PI * .8 }, { x: 41.5, y: 10.5 }, { x: 41.5, y: 6.5 }], 3, () => { TUT.flag.gone = true; K.ctl = ctlIdle; }); },
    update() { if (!S.hidden && !S.act && T - toastT > 3) toast('Zurück in den Spind – warte, bis er weg ist!'); },
    done: () => TUT.flag.gone },
  { text: () => isTouch ? 'Er ist weg. Tipp den Knopf, um herauszukommen.' : 'Er ist weg. Drück die Leertaste, um herauszukommen.',
    done: () => !S.hidden && !S.act },
  { text: 'Er kommt zurück und hat dich gesehen – renn! Lauf an einer Palette (Holzbrett) vorbei und wirf sie um, sobald er direkt hinter dir ist.',
    enter() {
      pallets.forEach(p => p.state = 0);
      TUT.targets = pallets.filter(p => room[I(p.x, p.y)] === 4).map(p => ({ x: p.cx, y: p.cy }));
      K.x = 41.5; K.y = 7.5; K.act = null; K.path = null;
      K.ctl = ctlRoute([{ x: 41.5, y: 10.6 }], 3.6, () => { K.ctl = null; K.mode = 'patrol'; startChase(); });
    },
    update() { TUT.kChase = 3.7; TUT.noLunge = true; TUT.omni = !K.ctl; },
    done: () => TUT.flag.drop },
  { text: 'Gut! Über Fenster springst du viel schneller als er. Spring durch ein Fenster!',
    enter() { windows.forEach(w => { w.blockedUntil = 0; w.vaults = []; }); TUT.targets = windows.filter(w => (w.x === 25 && w.y === 13) || (w.x === 31 && w.y === 9)).map(w => ({ x: w.cx, y: w.cy })); },
    update() { TUT.kChase = 3.7; TUT.noLunge = true; TUT.omni = true; if (!K.act) tutChase(); },
    done: () => TUT.flag.vault },
  { text: 'Er holt auf! Ein Treffer kostet dich ein Herz (oben links) – danach bist du kurz viel schneller. Beim zweiten Treffer bringt er dich zum Haken.',
    update() { TUT.kChase = 5.4; TUT.noLunge = false; TUT.omni = true; if (!K.act) tutChase(); },
    done: () => TUT.flag.hit },
  { text: 'Jetzt weg! Nutze den Schub, brich den Sichtkontakt – um Ecken, durch Türen – und schleich dann. Ohne Spuren verliert er dich.',
    update() { TUT.kChase = 4.0; if (TUT.t > 25 && K.mode === 'chase' && !K.act) { loseChase(); toast('Er hat deine Spur verloren.'); } },
    done: () => K.mode !== 'chase' && TUT.t > 1 },
  { final: true, text: 'Geschafft! Im echten Spiel erledigst du alle 5 Aufgaben (oben links). Dann öffnen sich die Tore – lauf hinaus. Viel Glück!',
    enter() { K.ctl = ctlIdle; K.act = null; K.mode = 'patrol'; K.x = 42.5; K.y = 34.5; K.path = null; } },
];
function startTutorial() {
  A.init();
  useMap('schule'); MODE = 'solo';
  resetWorld(); endWon = false; toastMsg = null;
  S = newSurv(27.5, 12.5, { skin: save.skin || 'cop' }); S.dir = 0; SV = [S]; K = newKiller(40.5, 27.5); K.ctl = ctlIdle;
  resetStats();
  cam.x = S.x; cam.y = S.y; cam.z = 1;
  state = 'play';
  TUT = { i: -1, t: 0, flag: {}, targets: [] };
  uiPlay(true);
  tutNext();
}
function tutNext() {
  TUT.i++; TUT.t = 0; TUT.flag = {}; TUT.targets = []; TUT.kChase = 0; TUT.noLunge = false; TUT.omni = false;
  const st = TSTEPS[TUT.i];
  if (st.enter) st.enter();
  $('#tutStep').textContent = 'Übung ' + (TUT.i + 1) + ' / ' + TSTEPS.length;
  $('#tutText').textContent = typeof st.text === 'function' ? st.text() : st.text;
  $('#tutGoRow').hidden = !st.final;
  if (TUT.i > 0) SFX.chirp();
}
function tutUpdate(dt) {
  TUT.t += dt;
  const st = TSTEPS[TUT.i];
  if (st.update) st.update(dt);
  if (!st.final && st.done()) tutNext();
}
function finishTutorial() { save.tut = 1; persist(); startGame(); }
function demoInit() {
  resetWorld();
  S = newSurv(-50, -50); S.ghost = true; SV = [S];
  K = newKiller(34.5, 19.5);
  cam.x = K.x; cam.y = K.y;
}

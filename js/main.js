'use strict';
/* Dead Mobile – Eingabe (Touch/Tastatur), Bildschirme, Start, Spielschleife, Test-API */
/* ================= Eingabe ================= */
function hitAct(x, y) { const b = actBtn(); return hyp(x - b.x, y - b.y) < b.r + 22; }
function hitArrow(x, y) { for (const b of arrowPad()) if (hyp(x - b.x, y - b.y) < 36) return b.d; return -1; }
const ptr = new Map();
function actionDown() { if (state !== 'play') return; if (Q) { qteDown(); return; } doAction(); }
function actionUp() { qteUp(); }
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (e.pointerType === 'touch') isTouch = true;
  A.init();
  if (state !== 'play') return;
  const x = e.clientX, y = e.clientY;
  if (Q && Q.type === 'radio') { const d = hitArrow(x, y); if (d >= 0) { qteArrow(d); ptr.set(e.pointerId, 'arrow'); return; } }
  if (hitAct(x, y) && !(Q && Q.type === 'radio')) { ptr.set(e.pointerId, 'act'); actionDown(); return; }
  if (x < VW * .5 && joy.id === null) { joy.id = e.pointerId; joy.bx = joy.x = x; joy.by = joy.y = y; ptr.set(e.pointerId, 'joy'); try { cv.setPointerCapture(e.pointerId); } catch (er) {} return; }
  if (Q && Q.type !== 'radio') { ptr.set(e.pointerId, 'act'); actionDown(); }
}, { passive: false });
cv.addEventListener('pointermove', e => {
  if (ptr.get(e.pointerId) !== 'joy') return;
  e.preventDefault();
  joy.x = e.clientX; joy.y = e.clientY;
  const dx = joy.x - joy.bx, dy = joy.y - joy.by, l = hyp(dx, dy), max = JOY_R * 1.25;
  if (l > max) { joy.bx = joy.x - dx / l * max; joy.by = joy.y - dy / l * max; }
}, { passive: false });
const endPtr = e => { const k = ptr.get(e.pointerId); if (k === 'joy') joy.id = null; if (k === 'act') actionUp(); ptr.delete(e.pointerId); };
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => { if (e.target === cv) e.preventDefault(); });
const KMAP = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
const ADIR = { u: 0, r: 1, d: 2, l: 3 };
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play') { if (Q && e.code === 'Escape') stopWork(); else pauseGame(); } else if (state === 'paused') resumeGame(); return; }
  if ((e.code === 'Space' || e.code === 'Enter') && (state === 'title' || state === 'end') && document.activeElement === document.body) { e.preventDefault(); playPressed(); return; }
  if (state !== 'play') return;
  const k = KMAP[e.code];
  if (k) {
    e.preventDefault();
    if (Q && Q.type === 'radio') { if (!e.repeat) qteArrow(ADIR[k]); return; }
    keys[k] = 1; return;
  }
  if (e.key === 'Shift') keys.shift = 1;
  if ((e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); A.init(); actionDown(); }
});
window.addEventListener('keyup', e => {
  const k = KMAP[e.code]; if (k) keys[k] = 0;
  if (e.key === 'Shift') keys.shift = 0;
  if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') actionUp();
});

/* ================= Bildschirme ================= */
function pauseGame() { if (state !== 'play') return; prevState = state; state = 'paused'; $('#pause').hidden = false; $('#pauseBtn').hidden = true; for (const k in keys) keys[k] = 0; joy.id = null; qteUp(); }
function resumeGame() { if (state !== 'paused') return; state = prevState; $('#pause').hidden = true; $('#pauseBtn').hidden = !!TUT; A.init(); }
const SND_ON = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SND_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
function sndUI() { for (const id of ['#sndT', '#sndP']) { $(id).innerHTML = A.on ? SND_ON : SND_OFF; $(id).setAttribute('aria-pressed', A.on ? 'true' : 'false'); } }
function toggleSnd() { A.init(); A.set(!A.on); try { localStorage.setItem(KEY + '-snd', A.on ? '1' : '0'); } catch (e) {} sndUI(); }
$('#sndT').addEventListener('click', toggleSnd); $('#sndP').addEventListener('click', toggleSnd);
function playPressed() { if (save.tut) startGame(); else startTutorial(); }
$('#play').addEventListener('click', playPressed);
$('#tutBtn').addEventListener('click', startTutorial);
$('#tutSkip').addEventListener('click', finishTutorial);
$('#tutGo').addEventListener('click', finishTutorial);
$('#again').addEventListener('click', startGame);
$('#resume').addEventListener('click', resumeGame);
$('#restart').addEventListener('click', startGame);
$('#pauseBtn').addEventListener('click', pauseGame);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
function showTitle() {
  if (save.best) { const b = $('#best'); b.hidden = false; b.innerHTML = gateSvg + fmt(save.best); }
  sndUI();
}

/* ================= Start ================= */
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
buildFloor(); buildRoomPaths();
demoInit(); showTitle(); installAppMeta();
function installAppMeta() {
  try {
    // App-Icon: Killer-Gesicht im Spielstil (Kreide, Blut, Nacht)
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d');
    const bg = x.createRadialGradient(256, 230, 40, 256, 256, 360); bg.addColorStop(0, '#1a1c28'); bg.addColorStop(1, '#06070c');
    x.fillStyle = bg; x.fillRect(0, 0, 512, 512);
    const rg = x.createRadialGradient(256, 290, 60, 256, 290, 250); rg.addColorStop(0, 'rgba(195,18,31,.45)'); rg.addColorStop(1, 'rgba(195,18,31,0)');
    x.fillStyle = rg; x.fillRect(0, 0, 512, 512);
    x.fillStyle = '#4a2a19';
    for (let i = 0; i < 11; i++) { const a = -Math.PI + (i + .5) * Math.PI / 11; x.beginPath(); x.moveTo(256 + Math.cos(a + .35) * 120, 250 + Math.sin(a + .35) * 120); x.lineTo(256 + Math.cos(a) * 205, 250 + Math.sin(a) * 190); x.lineTo(256 + Math.cos(a - .35) * 120, 250 + Math.sin(a - .35) * 120); x.fill(); }
    x.beginPath(); x.ellipse(256, 245, 150, 140, 0, 0, TAU); x.fill();
    x.fillStyle = '#ebe6dc'; x.beginPath(); x.ellipse(256, 285, 125, 135, 0, 0, TAU); x.fill();
    x.fillStyle = '#111'; x.beginPath(); x.moveTo(350, 175); x.lineTo(372, 205); x.lineTo(190, 345); x.lineTo(165, 318); x.closePath(); x.fill();
    x.fillStyle = '#0d0d0d'; x.beginPath(); x.arc(210, 268, 17, 0, TAU); x.arc(302, 268, 17, 0, TAU); x.fill();
    x.strokeStyle = '#c3121f'; x.lineWidth = 22; x.lineCap = 'round';
    x.beginPath(); x.moveTo(160, 318); x.quadraticCurveTo(256, 420, 352, 318); x.stroke();
    x.fillStyle = '#8e0f16'; x.fillRect(196, 360, 10, 40); x.fillRect(318, 352, 9, 30);
    const url = c.toDataURL('image/png');
    document.getElementById('appIcon').href = url;
    document.getElementById('favIcon').href = url;
    const man = { name: 'Dead Mobile', short_name: 'Dead Mobile', display: 'fullscreen', orientation: 'landscape',
      background_color: '#06070c', theme_color: '#06070c', start_url: location.href.split('#')[0],
      icons: [{ src: url, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] };
    const l = document.createElement('link'); l.rel = 'manifest';
    l.href = URL.createObjectURL(new Blob([JSON.stringify(man)], { type: 'application/manifest+json' }));
    document.head.appendChild(l);
  } catch (e) {}
}
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now; if (dt > .25) dt = .25;
  if (state !== 'paused' && !window.__freeze) {
    acc += dt; const STEP = 1 / 60; let n = 0;
    while (acc >= STEP && n < 6) { step(STEP); acc -= STEP; n++; }
    if (n >= 6) acc = 0;
    updateMusic();
  }
  render();
}
requestAnimationFrame(frame);

window.__ns = {
  get S() { return S; }, get K() { return K; }, get Q() { return Q; }, get state() { return state; }, get act() { return actNow; },
  tasks, pallets, windows, lockers, hooks, gates, findPath, ch, startGame, caught, stains, killerVisible, killerSees,
  tp(x, y) { S.x = x; S.y = y; }, ktp(x, y) { K.x = x; K.y = y; K.path = null; K.goal = null; K.act = null; },
  finish(n = tasks.length) { tasks.slice(0, n).forEach(t => { if (!t.done) complete(t); }); },
  down: actionDown, up: actionUp, arrow: qteArrow, keys, joy,
  tick(sec = 1) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { step(1 / 60); updateMusic(); } render(); },
};

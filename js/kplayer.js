'use strict';
/* Dead Mobile – Gespielter Killer: Steuerung, Jagd-Erkennung, Aktionen, Instinkt, HUD, Endbildschirm.
   Aktiv, wenn K.human gesetzt ist (startTeam(..., { killer: 'local' | 'remote' })). Die Team-Regeln (js/rules.js) bleiben
   dieselben: Treffer, am Boden, Tragen, Haken. Statt der KI (js/killer.js) steuert der Spieler:
     Laufen            Joystick/WASD (Umschalt oder halber Ausschlag = langsam)
     Angriff           Hauptknopf/Leertaste: Ausfallschritt (kStart 'attack'); beim Tragen: Aufhängen am freien Haken
     Aktion            Zweitknopf/E: Aufheben · Palette zerbrechen · durchs Fenster · Spind durchsuchen · Aufgabe treten
     Instinkt          Drittknopf/Q: zeigt kurz, wo Überlebende in der Nähe gerade sind (nicht im Spind), mit Abklingzeit
   K.mode bleibt für Bots, Musik und Netz aussagekräftig: 'patrol' | 'chase' | 'carry'. Eine Jagd beginnt, wenn er einen
   Überlebenden eine Weile im Blick hat (K.aware wie bei der KI), und endet CFG.loseAfter s nach dem letzten Sichtkontakt.
   Online (js/sync.js): Der Host rechnet kPerceive; der Killer-Spieler bestimmt Position und Aktionen selbst, die Wirkungen
   (hitSurvivor, pickUp, hookSurv, kKick, kLockerOpen, kBreakDone) bestätigt der Host. */

/* ================= Wahrnehmung: Jagd beginnt und endet ================= */
function kPerceive(dt) {
  const seen = SV.filter(sv => killerSees(sv));
  let foc = null, fd = 1e9;
  for (const sv of seen) { const d = hyp(sv.x - K.x, sv.y - K.y) - (sv === K.target && K.mode === 'chase' ? 3 : 0); if (d < fd) { fd = d; foc = sv; } }
  K.focus = foc; if (foc) K.lastContact = T;
  if (K.carry) { K.mode = 'carry'; K.aware = 0; return; }
  if (K.mode !== 'chase') {
    K.mode = 'patrol';
    if (foc) {
      const d = hyp(foc.x - K.x, foc.y - K.y);
      K.aware += lerp(3.4, 1.05, clamp((d - 1.5) / 8, 0, 1)) * (foc.running ? 1.7 : foc.moving ? 1 : .7) * 1.35 * dt;
      if (K.aware >= 1 && !(K.act && K.act.kind === 'stun')) startChase(foc);
    } else K.aware = Math.max(0, K.aware - dt * .5);
    return;
  }
  const tg = K.target;
  if (!tg || !isFree(tg)) { kEndChase(); return; }
  K.chaseT += dt;
  if (seen.includes(tg)) { K.seenT = T; K.lastSeen = { x: tg.x, y: tg.y }; K.blood = Math.min(3, Math.floor(K.chaseT / 12)); }
  else if (foc && T - K.seenT > 1) { K.target = foc; K.seenT = T; K.chaseT = 0; K.blood = 0; }   // er hat sich einen anderen gesucht
  if (T - K.seenT > CFG.loseAfter) kEndChase();
}
function kEndChase() { K.mode = 'patrol'; K.target = null; K.aware = 0; K.blood = 0; K.chaseT = 0; }

/* ================= Steuerung (lokaler Spieler) ================= */
function killerPlayer(dt, noSense) {
  if (K.moving) { K.stepT -= dt; if (K.stepT <= 0) { K.stepT = K.mode === 'chase' ? .28 : .42; if (state === 'play') SFX.kstep(); } }
  if (!noSense) kPerceive(dt);
  K.instCd = Math.max(0, K.instCd - dt);
  const inp = netPaused || state !== 'play' ? { x: 0, y: 0, mag: 0 } : readInput();
  // Zielrichtung für den Ausfallschritt: Eingabe, mit etwas Zielhilfe auf den nächsten Überlebenden vor ihm
  K.aim = inp.mag > .25 ? Math.atan2(inp.y, inp.x) : K.dir;
  if (K.act && K.act.kind === 'lunge') {
    let b = null, bd = CFG.kpAssistR;
    for (const v of SV) if (isFree(v) && !v.hidden) { const d = hyp(v.x - K.x, v.y - K.y); if (d < bd && Math.abs(angDiff(Math.atan2(v.y - K.y, v.x - K.x), K.aim)) < CFG.kpAssist && losClear(K.x, K.y, v.x, v.y)) { bd = d; b = v; } }
    if (b) K.aim = Math.atan2(b.y - K.y, b.x - K.x);
  }
  if (K.carry) K.carryT += dt;
  if (K.act) runAct(dt);
  else if (inp.mag < .15) K.moving = false;
  else {
    everMoved = true;
    const slow = inp.walk || inp.mag <= .62;
    // volles Tempo nur in der Jagd (mit Blutrausch); beim Suchen etwas langsamer, beim Tragen wie die KI
    const spd = (K.carry ? CFG.carryV : K.mode === 'chase' ? CFG.kpSpeed * (1 + .035 * K.blood) : CFG.kpRoam) * (slow ? CFG.kpWalk : 1), ox = K.x, oy = K.y;
    K.dir = Math.atan2(inp.y, inp.x);
    moveEnt(K, Math.cos(K.dir) * spd * dt, Math.sin(K.dir) * spd * dt);
    const md = hyp(K.x - ox, K.y - oy); K.moving = md > .0005; K.walk += md * 4.6;
  }
  const cs = K.carry; if (cs) { cs.x = K.x; cs.y = K.y; cs.mask = K.mask; }
  K.acts = kActions();
  kHints();
}
/* Killer eines Mitspielers beim Host: Position und Aktionen kommen aus dessen Strom (K.rctl, js/sync.js) */
function killerRemote(dt) {
  if (K.rctl) K.rctl(dt);
  kPerceive(dt);
  if (K.carry) { K.carryT += dt; const cs = K.carry; cs.x = K.x; cs.y = K.y; cs.mask = K.mask; }
}

/* ================= Aktionen ================= */
const K_ALT_TXT = { pick: 'Aufheben', break: 'Zerbrechen', kvault: 'Fenster', search: 'Durchsuchen', kick: 'Treten' };
function kActions() {
  if (state !== 'play' || K.act) return { main: null, alt: null };
  // Beim Tragen: Hauptknopf hängt auf; Fenster und Paletten gehen weiter (wie bei der KI), sonst nichts
  let main = { kind: 'attack' };
  const carry = !!K.carry;
  if (carry) {
    let h = null, bd = 1.3;
    for (const o of hooks) { if (hookBusy(o)) continue; const d = hyp(K.x - o.front.x, K.y - o.front.y); if (d < bd) { bd = d; h = o; } }
    main = h ? { kind: 'hook', o: h } : { kind: 'carry', off: true };
  }
  let alt = null, bs = 1e9;
  const take = (kind, o, sc) => { if (sc < bs) { bs = sc; alt = { kind, o }; } };
  if (!carry) for (const v of SV) if (isDowned(v)) { const d = hyp(v.x - K.x, v.y - K.y); if (d < 1.2) take('pick', v, d - 3); }
  for (const p of pallets) {
    if (p.state !== 1) continue;
    const dx = K.x - p.cx, dy = K.y - p.cy; if (dx * dx + dy * dy > 4) continue;
    const al = Math.abs(dx * p.ax.x + dy * p.ax.y), lat = Math.abs(dx * p.ax.y - dy * p.ax.x);
    if (lat < .75 && al > .4 && al < 1.5) take('break', p, al - .7);
  }
  for (const w of windows) {
    const dx = K.x - w.cx, dy = K.y - w.cy; if (dx * dx + dy * dy > 4) continue;
    const al = Math.abs(dx * w.ax.x + dy * w.ax.y), lat = Math.abs(dx * w.ax.y - dy * w.ax.x);
    if (lat < .5 && al > .35 && al < 1.4) take('kvault', w, al - .5);
  }
  if (carry) return { main, alt };
  for (const L of lockers) { const d = hyp(K.x - L.front.x, K.y - L.front.y); if (d < .85) take('search', L, d); }
  for (const t of tasks) {
    if (t.done || t.prog <= .05 || isWorked(t)) continue;
    for (const s of t.stations || [t]) { const d = hyp(K.x - s.cx, K.y - s.cy); if (d < 1.4) take('kick', t, d + .1); }
  }
  return { main, alt };
}
/* Knopf gedrückt: which = 'main' | 'alt' */
function kDo(which) {
  if (state !== 'play' || ROLE !== 'killer' || K.act || netPaused) return;
  const a = kActions()[which]; if (!a || a.off) return;
  kStart(a);
}
function kStart(a) {
  const face = (x, y) => { K.dir = Math.atan2(y - K.y, x - K.x); };
  K.moving = false;
  switch (a.kind) {
    case 'attack': K.act = { kind: 'lunge', t: 0, dur: CFG.lungeT }; SFX.whoosh(); break;
    case 'hook': { const h = a.o; K.x = h.front.x; K.y = h.front.y; face(h.cx, h.cy); K.act = { kind: 'hook', t: 0, dur: CFG.hookT, sv: K.carry, h }; break; }
    case 'pick': face(a.o.x, a.o.y); K.act = { kind: 'pick', t: 0, dur: CFG.pickT, sv: a.o }; break;
    case 'break': face(a.o.cx, a.o.cy); K.act = { kind: 'break', t: 0, dur: CFG.kBreak, p: a.o }; break;
    case 'kvault': {
      const w = a.o, s = Math.sign((K.x - w.cx) * w.ax.x + (K.y - w.cy) * w.ax.y) || 1;
      K.dir = Math.atan2(-w.ax.y * s, -w.ax.x * s);
      K.act = { kind: 'vault', t: 0, dur: CFG.kVault, fx: K.x, fy: K.y, tx: w.cx - w.ax.x * s * .88, ty: w.cy - w.ax.y * s * .88 }; SFX.vault(false); break;
    }
    case 'search': face(a.o.cx, a.o.cy); K.act = { kind: 'locker', t: 0, dur: .9, L: a.o }; break;
    case 'kick': face(a.o.cx, a.o.cy); K.act = { kind: 'kick', t: 0, dur: 1.1, task: a.o }; break;
  }
}
/* Instinkt: zeigt für CFG.instShow s, wo Überlebende im Umkreis gerade sind (Momentaufnahme; Spinde schützen) */
function kInstinct() {
  if (state !== 'play' || ROLE !== 'killer' || netPaused || K.instCd > 0 || (K.act && K.act.kind === 'stun')) return false;
  K.instCd = CFG.instCd;
  kReveal(SV.filter(v => inPlay(v) && !v.hidden && !v.carried && !v.hung && hyp(v.x - K.x, v.y - K.y) < CFG.instR));
  return true;
}
/* Wirkung des Instinkts (das Netz verschickt sie): der Killer sieht die Stellen, die Entdeckten bekommen eine Warnung */
function kReveal(list) {
  K.instT = T; K.inst = list.map(v => ({ sv: v, x: v.x, y: v.y }));
  if (ROLE === 'killer') { A.tone('sine', 70, 46, 1.1, .5); A.tone('sawtooth', 220, 110, .9, .05); A.noise(.9, .12, 'bandpass', 500, 180, 2); flash = .3; flashCol = '195,18,31'; }
  if (ROLE !== 'killer' && list.includes(S)) { eyeT = T; toast('Er spürt dich!'); A.tone('sine', 70, 46, .9, .4); buzz(40); }
}
/* Betäubt (Palette): Rückmeldung für den Killer-Spieler */
function kStunned() { shake(.6); flash = .5; flashCol = '235,231,220'; buzz(120); }
/* Lärm (Skill-Check daneben, Palette, schneller Fenstersprung …): Hinweis für den Killer-Spieler */
function kHear(x, y, R, loud) {
  if (hyp(K.x - x, K.y - y) > R) return;
  const l = K.heard[K.heard.length - 1];
  if (l && T - l.t < .5 && hyp(l.x - x, l.y - y) < 1.5) { l.t = T; l.loud = l.loud || loud; return; }
  K.heard.push({ x, y, t: T, loud }); if (K.heard.length > 6) K.heard.shift();
  if (ROLE === 'killer' && loud) A.tone('triangle', 660, 520, .22, .12);
}
/* Kurze Hinweise beim ersten Mal (je Partie) */
function kHints() {
  if (ROLE !== 'killer' || state !== 'play') return;
  const h = K.hintN || (K.hintN = {}), key = isTouch ? ['den roten Knopf', 'den kleinen Knopf', 'das Auge'] : ['Leertaste', 'E', 'Q'];
  const say = (k, msg) => { if (!h[k] && T - toastT > 2.8) { h[k] = 1; toast(msg); } };
  if (T - stats.t0 > .6) say('go', `Finde die Überlebenden – Angriff: ${key[0]}`);
  if (T - stats.t0 > 9) say('inst', `Instinkt (${key[2]}) zeigt kurz, wer in der Nähe ist`);
  if (SV.some(isDowned) && !(K.act && K.act.kind === 'wipe')) say('pick', `Am Boden! Heb dein Opfer auf (${key[1]})`);
  if (K.carry) say('hook', `Trag dein Opfer zu einem Haken – dort ${key[0]}`);
  if (K.acts && K.acts.alt && K.acts.alt.kind === 'break') say('brk', `Palette im Weg: zerbrich sie (${key[1]})`);
  if (endgame) say('end', 'Die Tore sind offen – lass sie nicht entkommen!');
}

/* ================= HUD ================= */
function altBtn() { const b = actBtn(); return { x: b.x - 94, y: b.y + 20, r: 30 }; }
function powBtn() { const b = actBtn(); return { x: b.x + 4, y: b.y - 96, r: 27 }; }
const hitBtn = (b, x, y, pad = 16) => hyp(x - b.x, y - b.y) < b.r + pad;
function killerHUD(edge) {
  const hy = SAT + 24;
  // Abzeichen statt Herzen: Messer, darunter Blutrausch-Stufen
  ctx.fillStyle = K.mode === 'chase' ? `rgba(195,18,31,${.75 + .2 * Math.sin(T * 6)})` : 'rgba(120,12,20,.85)'; ctx.beginPath(); ctx.arc(SAL + 29, hy, 15, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(235,231,220,.45)'; ctx.lineWidth = 1.5; ctx.stroke();
  icon('knife', SAL + 29, hy, 8.5, '#ebe7dc', 2);
  for (let k = 0; k < K.blood; k++) { ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(SAL + 20 + k * 9, hy + 22, 3, 0, TAU); ctx.fill(); }
  // Pfeile: angefangene Aufgaben, offene Tore, Liegende, Hängende, beim Tragen freie Haken, Lärm, Instinkt
  for (const t of tasks) if (!t.done && t.prog > .02) edge(t.cx, t.cy - .3, `rgba(242,193,75,${.35 + .5 * t.prog})`);
  if (gatesPowered) for (const g of gates) edge((g.x0 + g.x1 + 1) / 2, g.y + .5, 'rgba(125,255,160,.9)', 'gate');
  for (const sv of SV) if (inPlay(sv)) {
    if (sv.hung) edge(sv.hung.cx + .3, sv.hung.cy - .6, 'rgba(255,60,60,.6)', 'hook');
    else if (sv.hp <= 0 && !sv.carried) edge(sv.x, sv.y - .3, `rgba(255,150,60,${.75 + .25 * Math.sin(T * 7)})`, 'down');
  }
  if (K.carry) {
    // heller Pfeil: der Haken mit dem kürzesten Weg (K.hookGoal, beim Aufheben berechnet); blass: der nächste andere
    if (!K.hookGoal || hookBusy(K.hookGoal)) K.hookGoal = nearestFreeHook();
    const g = K.hookGoal, o = hooks.filter(h => h !== g && !hookBusy(h)).sort((a, b) => hyp(a.cx - K.x, a.cy - K.y) - hyp(b.cx - K.x, b.cy - K.y))[0];
    if (o) edge(o.cx + .3, o.cy - .8, 'rgba(235,231,220,.45)', 'hook');
    if (g) edge(g.cx + .3, g.cy - .8, `rgba(255,235,200,${.8 + .2 * Math.sin(T * 6)})`, 'hook');
  }
  for (const n of K.heard) { const a = 1 - (T - n.t) / CFG.hearShow; if (a > 0) edge(n.x, n.y, n.loud ? `rgba(255,70,50,${.4 + .6 * a})` : `rgba(255,220,200,${.25 + .5 * a})`, 'noise'); }
  if (K.inst && T - K.instT < CFG.instShow) for (const r of K.inst) edge(r.x, r.y - .5, 'rgba(255,60,60,.95)', 'eye');
  teamHUD(K);
  kStatus();
  // Knöpfe: Angriff/Haken, Aktion, Instinkt
  const acts = K.acts || { main: null, alt: null }, b = actBtn(), m = acts.main, pulse = .5 + .5 * Math.sin(T * 6);
  const btn = (q, on, hot, ic, sz, key) => {
    ctx.fillStyle = on ? (hot ? `rgba(195,18,31,${.5 + .25 * pulse})` : 'rgba(235,231,220,.16)') : 'rgba(6,7,12,.35)';
    ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = on ? `rgba(235,231,220,${.55 + .3 * pulse})` : 'rgba(235,231,220,.18)'; ctx.lineWidth = 2.5; ctx.stroke();
    if (ic) icon(ic, q.x, q.y, sz, on ? '#ebe7dc' : 'rgba(235,231,220,.35)', 2.6);
    if (key && !isTouch) { ctx.font = '11px "Special Elite", "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(235,231,220,.6)'; ctx.fillText(key, q.x, q.y + q.r + 10); }
  };
  const busy = !!K.act, a = K.act;
  btn(b, !busy && m && !m.off, m && (m.kind === 'hook' || (m.kind === 'attack' && K.focus && hyp(K.focus.x - K.x, K.focus.y - K.y) < 3)), m ? (m.kind === 'attack' ? 'knife' : m.kind) : a && a.kind === 'stun' ? 'wiggle' : 'knife', 19, 'Leertaste');
  if (a && a.dur) { ctx.strokeStyle = a.kind === 'stun' ? '#f2c14b' : 'rgba(235,231,220,.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(a.t / a.dur, 0, 1)); ctx.stroke(); }
  if (acts.alt) {
    const q = altBtn(), k = acts.alt.kind;
    btn(q, true, k === 'pick', { pick: 'carry', break: 'break', kvault: 'vault', search: 'hide', kick: 'kick' }[k], 14, 'E');
    ctx.font = '12px "Special Elite", "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tx = K_ALT_TXT[k], w = ctx.measureText(tx).width + 16;
    ctx.fillStyle = 'rgba(6,7,12,.7)'; rrp(ctx, q.x - w / 2, q.y - q.r - 24, w, 20, 10); ctx.fill();
    ctx.fillStyle = '#f2c14b'; ctx.fillText(tx, q.x, q.y - q.r - 13);
  }
  const p = powBtn(), ready = K.instCd <= 0;
  btn(p, ready, false, 'eye', 12, 'Q');
  if (!ready) { ctx.strokeStyle = 'rgba(255,60,60,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - K.instCd / CFG.instCd)); ctx.stroke(); }
}
/* Großanzeige: betäubt, trägt jemanden */
function kStatus() {
  const a = K.act, y = VH > VW ? VH - SAB - 300 : VH - SAB - 58;
  const panel = (p, col, head, headCol, sub) => {
    ctx.font = '13px "Special Elite", "Courier New", monospace';
    const w = 230, bw = Math.min(VW - 24, Math.max(w + 28, sub ? ctx.measureText(sub).width + 32 : 0));
    ctx.fillStyle = 'rgba(6,7,12,.74)'; rrp(ctx, VW / 2 - bw / 2, y - 34, bw, sub ? 74 : 54, 16); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.7)'; rrp(ctx, VW / 2 - w / 2, y, w, 12, 6); ctx.fill();
    ctx.fillStyle = col; rrp(ctx, VW / 2 - w / 2, y, Math.max(12, w * clamp(p, 0, 1)), 12, 6); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '17px "Special Elite", "Courier New", monospace'; ctx.fillStyle = headCol; ctx.fillText(head, VW / 2, y - 17, VW - 40);
    if (sub) { ctx.font = '13px "Special Elite", "Courier New", monospace'; ctx.fillStyle = 'rgba(235,231,220,.75)'; ctx.fillText(sub, VW / 2, y + 28, VW - 40); }
  };
  if (a && a.kind === 'stun') panel(1 - a.t / a.dur, '#f2c14b', 'Betäubt!', '#f2c14b');
  else if (K.carry) panel(K.carry.wiggle, '#f2c14b', K.carry.name + ' zappelt', '#ebe7dc', 'Schnell zum Haken, bevor sich dein Opfer losreißt');
}
/* Welt-Ebene für den Killer-Spieler (im Glow-Durchgang, js/light.js): frische Kratzspuren leuchten auch im Dunkeln,
   Lärm und Instinkt als Ringe */
function drawKillerSense() {
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const m of marks) {
    const a = 1 - (T - m.t) / CFG.markLife; if (a <= 0) continue;
    const dx = Math.cos(m.a) * m.l / 2, dy = Math.sin(m.a) * m.l / 2;
    ctx.strokeStyle = `rgba(255,70,40,${.5 * a})`; ctx.lineWidth = .06;
    ctx.beginPath(); ctx.moveTo(m.x - dx, m.y - dy); ctx.lineTo(m.x + dx, m.y + dy); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const n of K.heard) {
    const a = (T - n.t) / CFG.hearShow; if (a > 1) continue;
    const p = (T * 1.4) % 1;
    ctx.strokeStyle = n.loud ? `rgba(255,60,40,${.8 * (1 - a) * (1 - p)})` : `rgba(255,220,200,${.5 * (1 - a) * (1 - p)})`; ctx.lineWidth = .07;
    ctx.beginPath(); ctx.arc(n.x, n.y, .3 + p * 1.2, 0, TAU); ctx.stroke();
  }
  if (K.inst && T - K.instT < CFG.instShow) {
    const a = (T - K.instT) / CFG.instShow, w = clamp((T - K.instT) / .5, 0, 1);
    ctx.strokeStyle = `rgba(255,30,30,${.35 * (1 - w)})`; ctx.lineWidth = .12; ctx.beginPath(); ctx.arc(K.x, K.y - .4, CFG.instR * w, 0, TAU); ctx.stroke();
    for (const r of K.inst) {
      const p = (T * 1.6) % 1, al = Math.min(1, (1 - a) * 2.5);
      ctx.fillStyle = `rgba(255,40,40,${.28 * al})`; ctx.beginPath(); ctx.ellipse(r.x, r.y - .5, .34, .62, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,60,60,${.9 * al * (1 - p)})`; ctx.lineWidth = .07; ctx.beginPath(); ctx.ellipse(r.x, r.y, .4 + p * .6, (.4 + p * .6) * .5, 0, 0, TAU); ctx.stroke();
    }
  }
}

/* ================= Endbildschirm ================= */
const K_WORDS = ['Outplayed', 'Hungry', 'Brutal', 'Massacre'];
function showKillerEnd() {
  if (state === 'end') return;
  teamEndAt = 0; stats.end = T; state = 'end';
  const kills = SV.filter(v => v.out === 'dead').length, esc = SV.filter(v => v.out === 'escaped').length;
  const w = $('#endWord'); w.textContent = K_WORDS[Math.min(3, kills)]; w.className = 'logo ' + (kills >= 2 ? 'lose' : 'win');
  endWon = kills >= 2;
  const score = Math.round(Math.min(100, kills * 24 + Math.min(K.hooksN, 6) * 3 + Math.min(K.hits, 8) + (esc === 0 && kills === SV.length ? 10 : 0)));
  const g = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  $('#grade').textContent = g; $('#grade').className = score >= 60 ? '' : 'lo'; $('#score').textContent = score + ' / 100';
  const rows = [['Sacrifices', kills + ' / ' + SV.length], ['Escaped', esc], ['Hits', K.hits], ['Hooks', K.hooksN], ['Chases', K.chases], ['Chase Time', fmt(stats.chase)], ['Pallets Broken', K.breaks], ['Times Stunned', stats.stuns]];
  $('#sgrid').innerHTML = rows.map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join('');
  $('#endStats').innerHTML = `<span class="time">${fmt(stats.end - stats.t0)}</span>`;
  if (!TEST) { save.kgames = (save.kgames || 0) + 1; if (kills > (save.kbest || 0)) save.kbest = kills; persist(); }
  $('#endBest').hidden = true;
  $('#teamRes').innerHTML = SV.map((sv, i) => {
    const res = sv.out || 'alive', url = portraitURL(sv.skin, 104);
    const pic = url ? `<img src="${url}" alt="">` : `<span style="background:${SLOT_COL[i % 3]}">${initial(sv)}</span>`;
    return `<div class="tr ${res}"><div class="tp">${pic}</div><b>${sv.name}</b><i>${RES_TXT[res] || 'Noch drin'}</i></div>`;
  }).join('');
  $('#teamRes').hidden = false; $('#specBar').hidden = true; $('#end').hidden = false; $('#pauseBtn').hidden = true;
  setTimeout(() => { try { $('#again').focus({ preventScroll: true }); } catch (e) {} }, 50);
}
/* Haptik (Handy): kurzes Vibrieren bei Treffern, Betäubung, verpatzten Skill-Checks */
function buzz(ms) { if (TEST || save.haptics === 0) return; try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

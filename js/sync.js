'use strict';
/* Dead Mobile – Netz Teil 2: Synchronisierung des Team-Spiels (baut auf js/net.js und js/lobby.js auf).
   Der Host ist maßgeblich: Er simuliert Killer, Bots, Welt und alle Zustandswechsel (Funktionen aus js/rules.js).
   Clients bestimmen nur die eigene Position/Animation und die eigenen QTEs.

   Nachrichten (20×/s bzw. sofort):
     Killer-Client → Host  { t:'k', … }  eigener Killer: Position, Richtung, laufende Aktion (a, an, ai), bestätigte Zwangslage kf
     Client → Host  { t:'c', … }  eigener Zustand: Position, Richtung, Animation, Aufgabe + Fortschritt, wen er heilt/rettet
                    { t:'e', k }  Ereignis: pallet · vault · hide · unhide · qfail/tfail/hfail (Skill-Check daneben → Lärm) ·
                                  great · done (Aufgabe fertig) · wig (Zappeln)
     Host → Clients { t:'s', … }  Schnappschuss: Killer, alle Survivors, Aufgaben, Paletten, Fenster, Tore
                    { t:'v', k }  Zustandswechsel – der Client spielt dieselbe Funktion aus js/rules.js nach (samt Effekten):
                                  hit · down · pick · drop · hook · unhook · healed · kill · esc
                    { t:'fx', k, src }  Effekte ohne Zustandswechsel (fail, stage, pallet, vault, locker, toast). src = ID des
                                  Spielers, der ihn selbst ausgelöst und schon abgespielt hat (kein Doppelton).
                    { t:'end' }   Spielende für alle    ·    { t:'nowork' }  Aufgabe war schon besetzt
   Dafür werden beim Spielstart einige globale Funktionen überschrieben und beim Ende wiederhergestellt (wrap/restore).
   Fremde Figuren werden aus den letzten Schnappschüssen interpoliert (DELAY s hinter dem Sender).
   Verlässt ein Mitspieler das Spiel, übernimmt beim Host ein Bot seine Figur. „Ergebnis" beim Zuschauen beendet
   online nur die eigene Ansicht (Host: erst, wenn kein Mitspieler mehr im Spiel ist).
   Haken: Net.onGameStart → start(), Net.onGameEnd → stop(); js/flow.js ruft Sync.tick(dt) am Ende jedes Schritts. */
const Sync = (() => {
  const RATE = 1 / 20, DELAY = .1, HDELAY = .07;
  const X = { active: false, host: false, sent: 0, got: 0 };
  let orig = {}, offs = [], acc = 0, evN = 0, evSeen = 0, mute = 0, clock = null, lastSnap = null, bg = null, hidAt = 0;
  let kId = -1, kfSeen = 0;   // Killer-Spieler: seine Spieler-ID (−1 = KI) und die letzte bestätigte Zwangslage
  const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
  const byId = id => SV.find(v => v.id === id) || null;
  const live = () => X.active && MODE === 'team' && state === 'play';

  /* ---------- globale Funktionen überschreiben / wiederherstellen ---------- */
  const G = {
    hitSurvivor: [() => hitSurvivor, f => { hitSurvivor = f; }], downSurv: [() => downSurv, f => { downSurv = f; }], pickUp: [() => pickUp, f => { pickUp = f; }],
    dropCarried: [() => dropCarried, f => { dropCarried = f; }], hookSurv: [() => hookSurv, f => { hookSurv = f; }], unhookSurv: [() => unhookSurv, f => { unhookSurv = f; }],
    healDone: [() => healDone, f => { healDone = f; }], killSurv: [() => killSurv, f => { killSurv = f; }], escapeSurv: [() => escapeSurv, f => { escapeSurv = f; }],
    teamCheckEnd: [() => teamCheckEnd, f => { teamCheckEnd = f; }], teamStep: [() => teamStep, f => { teamStep = f; }], teamGiveUp: [() => teamGiveUp, f => { teamGiveUp = f; }],
    showTeamEnd: [() => showTeamEnd, f => { showTeamEnd = f; }], fx: [() => fx, f => { fx = f; }], noise: [() => noise, f => { noise = f; }],
    dropPallet: [() => dropPallet, f => { dropPallet = f; }], vaultOver: [() => vaultOver, f => { vaultOver = f; }], hide: [() => hide, f => { hide = f; }], unhide: [() => unhide, f => { unhide = f; }],
    healStep: [() => healStep, f => { healStep = f; }], unhookStep: [() => unhookStep, f => { unhookStep = f; }], healFail: [() => healFail, f => { healFail = f; }],
    taskFail: [() => taskFail, f => { taskFail = f; }], fail: [() => fail, f => { fail = f; }], wiggle: [() => wiggle, f => { wiggle = f; }], complete: [() => complete, f => { complete = f; }],
    checkPress: [() => checkPress, f => { checkPress = f; }], giveUpChase: [() => giveUpChase, f => { giveUpChase = f; }],
  };
  function wrap(name, make) { if (!(name in orig)) orig[name] = G[name][0](); G[name][1](make(orig[name])); }
  function restore() { for (const k in orig) G[k][1](orig[k]); orig = {}; }
  // die unveränderte Funktion (auch wenn sie gerade überschrieben ist)
  const base = name => orig[name] || G[name][0]();

  /* ---------- Interpolation: Puffer aus { t, x, y, d } ---------- */
  function push(buf, t, x, y, d) {
    const l = buf[buf.length - 1];
    if (l && t <= l.t) return;
    if (l && hyp(x - l.x, y - l.y) > 3.5) buf.length = 0;   // Sprung (z. B. vom Haken): nicht dazwischen gleiten
    buf.push({ t, x, y, d }); if (buf.length > 8) buf.shift();
  }
  function sample(buf, t, out) {
    const n = buf.length; if (!n) return false;
    let a = buf[0], b = buf[n - 1];
    if (t <= a.t) b = a;
    else if (t >= b.t) {   // kurz vorausrechnen, dann stehen bleiben
      a = n > 1 ? buf[n - 2] : b;
      const k = a === b || b.t - a.t < 1e-4 ? 0 : Math.min(t - b.t, .12) / (b.t - a.t);
      out.x = b.x + (b.x - a.x) * k; out.y = b.y + (b.y - a.y) * k; out.d = b.d; return true;
    } else for (let i = 1; i < n; i++) if (buf[i].t >= t) { a = buf[i - 1]; b = buf[i]; break; }
    const k = a === b ? 0 : (t - a.t) / (b.t - a.t);
    out.x = lerp(a.x, b.x, k); out.y = lerp(a.y, b.y, k); out.d = a.d + angDiff(b.d, a.d) * k; return true;
  }
  // Uhr des Senders mitführen (läuft lokal weiter, wird sanft nachgestellt)
  const newClock = () => ({ t: null });
  function clockSet(c, t) { if (c.t == null || Math.abs(t - c.t) > .4) c.t = t; else c.t += (t - c.t) * .1; }
  const tmp = { x: 0, y: 0, d: 0 };

  /* =====================================================================================
     HOST
     ===================================================================================== */
  const send = (m, to) => { X.sent++; Net.send(m, to); };
  // Zustandswechsel verschicken; bis der Betroffene ihn kennt, gilt seine alte Position nicht mehr
  const ev = (k, sv, o) => { evN++; send(Object.assign({ t: 'v', k, n: evN, sv: sv.id }, o)); if (sv.net) { sv.net.minEv = evN; sv.net.buf.length = 0; } };
  const srcOf = sv => sv && sv.kind === 'remote' ? sv.id : -1;

  function hostOn() {
    for (const sv of SV) if (sv.kind === 'remote') remote(sv);
    // Zustandswechsel: erst das Ereignis verschicken, dann ausführen (verschachtelte Wechsel kommen so in der richtigen Reihenfolge an)
    wrap('hitSurvivor', o => function (sv = S) { if (live() && sv.hp >= 2 && !TUT) ev('hit', sv); return o(sv); });
    wrap('downSurv', o => function (sv) { if (live() && inPlay(sv) && sv.hp > 0 && !sv.carried && !sv.hung) ev('down', sv); return o(sv); });
    wrap('pickUp', o => function (sv) { if (live() && inPlay(sv) && !sv.carried && !sv.hung) ev('pick', sv); return o(sv); });
    wrap('dropCarried', o => function (why) { if (live() && K.carry) ev('drop', K.carry, { why }); return o(why); });
    wrap('hookSurv', o => function (sv, h) { if (live()) ev('hook', sv, { h: hooks.indexOf(h), c: sv.hookN + 1 }); return o(sv, h); });
    wrap('unhookSurv', o => function (sv, by) { if (live() && sv.hung && !sv.out) ev('unhook', sv, { h: hooks.indexOf(sv.hung), by: by ? by.id : -1 }); return o(sv, by); });
    wrap('healDone', o => function (sv) { if (live()) ev('healed', sv, { hp: Math.min(2, sv.hp + 1), by: SV.filter(v => v.heal === sv).map(v => v.id) }); return o(sv); });
    wrap('killSurv', o => function (sv, how) { if (live() && !sv.out) ev('kill', sv, { how }); return o(sv, how); });
    wrap('escapeSurv', o => function (sv, g) { if (live() && !sv.out) ev('esc', sv, { g: gates.indexOf(g) }); return o(sv, g); });
    // Effekte ohne Zustandswechsel
    wrap('fx', o => function (kind, sv, e) {
      o(kind, sv, e);
      if (!live()) return;
      if (kind === 'fail') send({ t: 'fx', k: 'fail', sv: sv.id, src: srcOf(sv), o: { x: r2(e.x), y: r2(e.y), kind: e.kind } });
      else if (kind === 'stage') send({ t: 'fx', k: 'stage', sv: sv.id, src: -1, h: hooks.indexOf(e) });
    });
    wrap('dropPallet', o => function (p, sv = S) {
      const a0 = K.act; o(p, sv);
      if (live()) send({ t: 'fx', k: 'pallet', i: pallets.indexOf(p), stun: !!(K.act && K.act !== a0 && K.act.kind === 'stun'), src: srcOf(sv), kx: r2(K.x), ky: r2(K.y) });
    });
    wrap('vaultOver', o => function (w, isWin, sv = S) { const fast = sv.running; o(w, isWin, sv); if (live()) send({ t: 'fx', k: 'vault', fast, src: srcOf(sv), x: r2(w.cx), y: r2(w.cy) }); });
    wrap('hide', o => function (L, sv = S) { o(L, sv); if (live()) send({ t: 'fx', k: 'locker', i: lockers.indexOf(L), src: srcOf(sv) }); });
    wrap('unhide', o => function (sv = S) { const L = sv.hidden; o(sv); if (live()) send({ t: 'fx', k: 'locker', i: lockers.indexOf(L), src: srcOf(sv) }); });
    wrap('giveUpChase', o => function (sv) { o(sv); if (live() && sv.kind === 'remote') send({ t: 'fx', k: 'toast', msg: 'Er hat genug von dir – er sucht die anderen!' }, sv.id); });
    // Spielende an alle; „Ergebnis" beim Zuschauen nur, wenn kein Mitspieler mehr im Spiel ist
    wrap('showTeamEnd', o => function () { if (state === 'end') return; const on = live(); o(); if (on) send({ t: 'end', out: SV.map(v => v.out || '') }); netPause(false); });
    wrap('teamGiveUp', o => function () {
      if (SV.some(v => v.kind === 'remote' && inPlay(v))) { toast('Deine Mitspieler sind noch im Spiel.'); return; }
      o();
    });
    offs.push(Net.on('c', onClient), Net.on('e', onEvent), Net.on('leave', onLeave));
    // Ein Mitspieler steuert den Killer: Position und Aktionen kommen aus seinem Strom
    if (KP === 'remote') { K.rk = { buf: [], clk: newClock(), st: null, at: -9, lastId: 0, own: null }; K.kf = 0; offs.push(Net.on('k', onKiller)); }
  }
  /* ---------- Killer eines Mitspielers (Host) ----------
     Der Client bestimmt Position und eigene Aktionen (Ausfallschritt, Sprung, Zerbrechen, Aufheben, Aufhängen …), der Host
     die Folgen (Treffer, Zustandswechsel). Betäubung und Klinge-Abwischen bestimmt der Host: bis der Client sie kennt
     (Zähler kf im Schnappschuss), zählt sein Strom nicht. */
  const HOSTRUN = new Set(['break', 'kick', 'locker', 'pick', 'hook']);
  function onKiller(m, from) {
    if (!live() || from !== kId || K.human !== 'remote') return;
    const n = K.rk; X.got++;
    if (!(m.kf >= K.kf)) return;
    n.st = m; n.at = T; clockSet(n.clk, m.T);
    if (isFinite(m.x) && isFinite(m.y)) push(n.buf, m.T, clamp(m.x, 0, W), clamp(m.y, 0, H), +m.d || 0);
  }
  function startMirror(kind, st) {
    const i = st.ai | 0, near = (x, y, r) => hyp(K.x - x, K.y - y) < r;
    switch (kind) {
      case 'lunge': hear(K.x, K.y, SFX.whoosh); return { kind, dur: CFG.lungeT };
      case 'recover': hear(K.x, K.y, SFX.whiff); return { kind, dur: CFG.recover };
      case 'vault': return { kind, dur: CFG.kVault };
      case 'break': { const p = pallets[i]; return p && p.state === 1 && near(p.cx, p.cy, 2.6) ? { kind, dur: CFG.kBreak, p } : null; }
      case 'kick': { const t = tasks[i]; return t && !t.done && (t.stations || [t]).some(s => near(s.cx, s.cy, 2.6)) ? { kind, dur: 1.1, task: t } : null; }
      case 'locker': { const L = lockers[i]; return L && near(L.cx, L.cy, 2.6) ? { kind, dur: .9, L } : null; }
      case 'pick': { const sv = byId(i); return sv && isDowned(sv) && near(sv.x, sv.y, 2.6) ? { kind, dur: CFG.pickT, sv } : null; }
      case 'hook': { const h = hooks[i]; return h && K.carry && !hookBusy(h) && near(h.front.x, h.front.y, 2.6) ? { kind, dur: CFG.hookT, sv: K.carry, h } : null; }
    }
    return null;
  }
  function hostKiller(dt) {
    const n = K.rk; if (!n) return;
    let a = K.act;
    if (a && (a.kind === 'stun' || a.kind === 'wipe')) {
      if (n.own !== a) { n.own = a; K.kf++; n.buf.length = 0; n.st = null; }
      runAct(dt);
    } else {
      const st = n.st, fresh = !!st && T - n.at < .6;
      if (n.clk.t != null) n.clk.t += dt;
      const ox = K.x, oy = K.y;
      if (st && sample(n.buf, n.clk.t - HDELAY, tmp)) { K.x = tmp.x; K.y = tmp.y; K.dir = tmp.d; }
      const md = hyp(K.x - ox, K.y - oy);
      K.moving = md > .0005; K.walk += md * 4.6; K.z = fresh ? +st.z || 0 : 0;
      const kind = fresh ? st.a : '', id = fresh ? st.an | 0 : 0;
      if (a && a.remote && !HOSTRUN.has(a.kind) && (a.rid !== id || !kind)) a = K.act = null;
      if (!a && kind && id !== n.lastId) { n.lastId = id; a = K.act = startMirror(kind, st); if (a) { a.remote = true; a.rid = id; a.t = 0; } }
      if (a) {
        if (HOSTRUN.has(a.kind)) runAct(dt);
        else { a.t += dt; if (a.kind === 'lunge') lungeHit(.08); if (K.act === a && a.t > a.dur + .8) K.act = null; }
      }
      if (K.moving) { K.stepT -= dt; if (K.stepT <= 0) { K.stepT = K.mode === 'chase' ? .28 : .42; if (killerVisible()) hear(K.x, K.y, SFX.kstep); } }
    }
    hkAware(dt); hkCarry(dt);
  }
  function remote(sv) {
    sv.bot = null; sv.ctl = remoteCtl;
    sv.net = { buf: [], clk: newClock(), st: null, at: -9, minEv: 0, nw: -9 };
  }
  /* Mitspieler weg: ein Bot übernimmt seine Figur */
  function onLeave(p) {
    if (!live() || !p) return;
    if (p.id === kId && K.human === 'remote') {   // der Killer-Spieler ist weg: die KI übernimmt
      K.human = null; KP = null; kId = -1; K.rk = null; K.z = 0; K.act = null; K.path = null; K.goal = null; if (K.mode !== 'carry') { K.mode = 'patrol'; K.target = null; }
      const msg = 'Der Killer hat das Spiel verlassen – die KI übernimmt'; toast(msg); send({ t: 'fx', k: 'toast', msg });
      return;
    }
    const sv = byId(p.id); if (!sv || sv.kind !== 'remote') return;
    if (sv.work) stopWorkFor(sv); sv.heal = null; sv.unhook = null;
    sv.kind = 'bot'; sv.net = null; sv.ctl = null;
    if (typeof Bots !== 'undefined') Bots.give(sv);
  }
  /* Zustand eines Clients (20×/s) */
  function onClient(m, from) {
    if (!live()) return;
    const sv = byId(from); if (!sv || !sv.net) return;
    const n = sv.net; X.got++;
    if (!(m.ev >= n.minEv)) return;   // er kennt den letzten Zustandswechsel noch nicht (z. B. gerade fallen gelassen)
    n.st = m; n.at = T;
    clockSet(n.clk, m.T);
    if (isFinite(m.x) && isFinite(m.y)) push(n.buf, m.T, clamp(m.x, 0, W), clamp(m.y, 0, H), +m.d || 0);
    if (!isFree(sv) || sv.act) return;
    // Aufgabe: Besetzen prüft der Host, den Fortschritt normaler Aufgaben bestimmt das QTE des Clients
    const t = m.w >= 0 ? tasks[m.w] : null;
    if (!t) { if (sv.work) stopWorkFor(sv); return; }
    if (t.done) return;
    if (sv.work !== t || (t.type === 'duo' && sv.station !== m.st)) {
      if (sv.work) stopWorkFor(sv);
      const p = t.type === 'duo' ? t.stations[m.st === 1 ? 1 : 0] : t;
      if (hyp(m.x - p.cx, m.y - p.cy) > 2.2 || !startWorkFor(sv, t, t.type === 'duo' ? (m.st === 1 ? 1 : 0) : undefined)) {
        if (T - n.nw > .5) { n.nw = T; send({ t: 'nowork', i: m.w }, from); }
        return;
      }
    }
    if (t.type !== 'duo' && isFinite(m.pr)) { t.prog = clamp(m.pr, 0, 1); if (t.prog >= 1) complete(t, sv); }
  }
  /* Figur eines Mitspielers beim Host: Position aus seinem Strom, Heilen/Retten nach seiner Absicht */
  function remoteCtl(sv, dt) {
    const n = sv.net, st = n.st; if (!st) { sv.moving = sv.running = false; return; }
    if (sv.carried || sv.hung) return;
    if (n.clk.t != null) n.clk.t += dt;
    const ox = sv.x, oy = sv.y, fresh = T - n.at < .6;
    if (sample(n.buf, n.clk.t - HDELAY, tmp)) { sv.x = tmp.x; sv.y = tmp.y; sv.dir = tmp.d; }
    if (sv.hidden) { sv.x = sv.hidden.cx; sv.y = sv.hidden.cy; sv.moving = sv.running = false; return; }
    sv.running = fresh && !!st.r && sv.hp > 0; sv.z = fresh ? +st.z || 0 : 0;
    survMoved(sv, hyp(sv.x - ox, sv.y - oy), dt);   // Kratzspuren, Blut, Tor
    if (sv.out || !fresh) return;
    if (st.h >= 0) { const b = byId(st.h); if (b) healStep(sv, b, dt, null); }
    if (st.u >= 0) { const b = byId(st.u); if (b) unhookStep(sv, b, dt); }
  }
  /* Ereignisse eines Clients */
  function onEvent(m, from) {
    if (!live()) return;
    const sv = byId(from); if (!sv || !sv.net) return;
    const place = () => { if (isFinite(m.x) && isFinite(m.y) && hyp(m.x - sv.x, m.y - sv.y) < 4) { sv.x = m.x; sv.y = m.y; } };
    switch (m.k) {
      case 'pallet': { const p = pallets[m.i]; if (p && p.state === 0 && isFree(sv) && !sv.hidden) { place(); if (hyp(sv.x - p.cx, sv.y - p.cy) < 2.4) dropPallet(p, sv); } break; }
      case 'vault': { const o = m.win ? windows[m.i] : pallets[m.i]; if (o && isFree(sv) && !sv.hidden && !sv.act) { place(); if (hyp(sv.x - o.cx, sv.y - o.cy) < 2.4) { sv.running = !!m.run; vaultOver(o, !!m.win, sv); } } break; }
      case 'hide': { const L = lockers[m.i]; if (L && isFree(sv) && !sv.hidden && !sv.act && !SV.some(v => v.hidden === L)) { place(); if (hyp(sv.x - L.front.x, sv.y - L.front.y) < 1.6) { sv.running = !!m.run; hide(L, sv); } } break; }
      case 'unhide': if (sv.hidden && !sv.act) unhide(sv); break;
      case 'qfail': { const t = tasks[m.i]; if (t && sv.work === t) { noise(t.cx, t.cy, 99, true); fx('fail', sv, { x: t.cx, y: t.cy, kind: t.type }); } break; }
      case 'tfail': { const t = tasks[m.i]; if (t && sv.work === t && !t.done) taskFail(sv, t); break; }
      case 'hfail': { const b = byId(m.to); if (b && canHeal(sv, b)) healFail(sv, b); break; }
      case 'great': { if (m.heal) { const b = byId(m.to); if (b && sv.heal === b) b.healProg = Math.min(.99, b.healProg + .03); } else { const t = tasks[m.i]; if (t && sv.work === t && !t.done) t.prog = Math.min(.99, t.prog + .02); } break; }
      case 'done': { const t = tasks[m.i]; if (t && !t.done && sv.work === t && t.type !== 'duo') { t.prog = 1; complete(t, sv); } break; }
      case 'wig': wiggle(sv); break;
    }
  }
  /* Schnappschuss (kompakt, als Felder) */
  function snapshot() {
    const a = K.act, ix = v => v ? SV.indexOf(v) : -1;
    return {
      t: 's', T: r3(T), n: evN,
      k: [r2(K.x), r2(K.y), r2(K.dir), K.mode, a ? a.kind : '', a ? r2(a.t) : 0, a ? r2(a.dur) : 0, r2(K.z), K.moving ? 1 : 0, ix(K.carry), ix(K.target), r2(K.aware), K.kf | 0],
      s: SV.map(v => [r2(v.x), r2(v.y), r2(v.dir), (v.moving ? 1 : 0) | (v.running ? 2 : 0) | (v.carried ? 4 : 0) | (v.burst > 0 ? 8 : 0) | (T - v.healedT < .25 ? 16 : 0) | (v.act ? 32 : 0) | (v.flinch > 0 ? 64 : 0),
        r2(v.z), v.hp, v.hung ? hooks.indexOf(v.hung) : -1, v.out || '', v.hookN, r3(v.hookProg), r2(v.unhookProg), r3(v.healProg), r2(v.wiggle),
        v.work ? tasks.indexOf(v.work) : -1, v.station, v.hidden ? lockers.indexOf(v.hidden) : -1, v.heal ? v.heal.id : -1, v.unhook ? v.unhook.id : -1]),
      tk: tasks.map(t => t.done ? 2 : r3(t.prog)),
      p: pallets.map(p => p.state).join(''),
      w: windows.map(w => T < w.blockedUntil ? Math.ceil(w.blockedUntil - T) : 0),
      g: gates.map(g => r2(g.open)), eg: endgame ? 1 : 0,
    };
  }

  /* =====================================================================================
     CLIENT
     ===================================================================================== */
  const tell = (k, o) => { X.sent++; Net.send(Object.assign({ t: 'e', k }, o)); };
  const quiet = fn => { mute++; try { return fn(); } finally { mute--; } };

  function clientOn() {
    clock = newClock(); lastSnap = null; evSeen = 0; hidAt = 0; kfSeen = 0;
    for (const sv of SV) if (sv !== S) { sv.bot = null; sv.ctl = otherCtl; sv.net = { buf: [], hid: null }; }
    K.nb = [];
    if (KP === 'local') {
      // Ich steuere den Killer selbst (js/hkiller.js); was daraus folgt, entscheidet der Host und schickt es als Zustandswechsel
      for (const k of ['hitSurvivor', 'downSurv', 'pickUp', 'hookSurv', 'killSurv', 'dropCarried']) wrap(k, () => function () {});
    } else K.net = killerNet;
    // Der Host entscheidet: lokal kein Team-Ende, kein Killer, keine fremden Zustandswechsel
    wrap('teamCheckEnd', () => function () {});
    wrap('teamStep', () => clientTeamStep);
    wrap('escapeSurv', () => function () {});                    // der Host merkt, wenn ich durchs Tor laufe
    wrap('noise', () => function (x, y, R, loud) { noises.push({ x, y, t: T, loud }); });   // nur die Anzeige; Lärm macht der Host
    wrap('showTeamEnd', o => function () { if (state === 'end') return; o(); netPause(false); });
    // Eigene Aktionen: lokal sofort zeigen, dem Host melden
    wrap('dropPallet', o => function (p, sv = S) {
      if (sv !== S) return;
      tell('pallet', { i: pallets.indexOf(p), x: r2(S.x), y: r2(S.y) });
      const al = (S.x - p.cx) * p.ax.x + (S.y - p.cy) * p.ax.y, kl = (K.x - p.cx) * p.ax.x + (K.y - p.cy) * p.ax.y;
      const s = Math.abs(al) > .15 ? Math.sign(al) : (kl ? -Math.sign(kl) : 1);
      p.state = 1; p.pred = T; stats.pallets++;
      if (Math.abs(al) < .85) { S.x += p.ax.x * (s * .85 - al); S.y += p.ax.y * (s * .85 - al); }
      S.act = { kind: 'drop', t: 0, dur: .28 };
      palletFx(p); shake(.25);
    });
    wrap('vaultOver', o => function (w, isWin, sv = S) {
      if (sv !== S) return;
      tell('vault', { i: (isWin ? windows : pallets).indexOf(w), win: isWin ? 1 : 0, run: S.running ? 1 : 0, x: r2(S.x), y: r2(S.y) });
      quiet(() => o(w, isWin, S));
    });
    wrap('hide', o => function (L, sv = S) {
      if (sv !== S) return;
      tell('hide', { i: lockers.indexOf(L), run: S.running ? 1 : 0, x: r2(S.x), y: r2(S.y) });
      S.act = { kind: 'enter', t: 0, dur: .45, fx: S.x, fy: S.y, L }; SFX.locker();
    });
    wrap('unhide', o => function (sv = S) { if (sv !== S) return; tell('unhide'); o(S); });
    wrap('wiggle', o => function (sv) {
      if (sv !== S || !S.carried || (K.act && K.act.kind === 'hook')) return false;
      tell('wig'); S.wiggle = Math.min(.99, S.wiggle + 1 / CFG.wiggleN); S.wigT = T; return true;
    });
    // Heilen/Retten: der Fortschritt läuft beim Host; hier nur prüfen, hinschauen, stillhalten
    wrap('healStep', o => function (healer, target) {
      if (!canHeal(healer, target)) { if (healer.heal === target) stopHeal(healer); return false; }
      healer.heal = target; healer.healAt = T; healer.moving = healer.running = false; healer.dir = Math.atan2(target.y - healer.y, target.x - healer.x);
      return true;
    });
    wrap('unhookStep', o => function (sv, target) {
      if (!canUnhook(sv, target)) { if (sv.unhook === target) sv.unhook = null; return false; }
      sv.unhook = target; sv.unhookAt = T; sv.moving = sv.running = false; sv.dir = Math.atan2(target.hung.cy - sv.y, target.hung.cx + .3 - sv.x);
      return true;
    });
    // Skill-Check daneben: Effekt lokal, Strafe und Lärm beim Host
    const miss = () => { stats.fails++; if (Q) { Q.lock = .7; Q.flash = .6; } };
    wrap('healFail', o => function (sv, target) { if (sv !== S) return; tell('hfail', { to: target.id }); miss(); base('fx')('fail', S, { x: (S.x + target.x) / 2, y: (S.y + target.y) / 2, kind: 'heal' }); });
    wrap('taskFail', o => function (sv, t) { if (sv !== S) return; tell('tfail', { i: tasks.indexOf(t) }); miss(); const p = S.work === t ? workSpot(S) : t; base('fx')('fail', S, { x: p.cx, y: p.cy, kind: t.type }); });
    wrap('fail', o => function (t, pen) { tell('qfail', { i: tasks.indexOf(t) }); o(t, pen); });
    wrap('checkPress', o => function (q) {
      const g0 = q.great; o(q);
      if (q.great > g0 && q.great >= .6) tell('great', q.type === 'heal' ? { heal: 1, to: q.heal.id } : { i: tasks.indexOf(q.task) });
    });
    wrap('complete', o => function (t, sv = S) { if (!t.done && sv === S) { t.pred = T; tell('done', { i: tasks.indexOf(t) }); } o(t, sv); });
    offs.push(Net.on('s', onSnap), Net.on('v', onState), Net.on('fx', onFx), Net.on('end', onEnd), Net.on('nowork', m => { if (live() && S.work === tasks[m.i]) { stopWork(); toast('Schon besetzt'); } }));
  }
  function palletFx(p) {
    hear(p.cx, p.cy, SFX.pallet);
    for (let i = 0; i < 14; i++) parts.push({ x: p.cx + rand(-.6, .6), y: p.cy + rand(-.3, .3), z: .1, vx: rand(-1, 1), vy: rand(-.5, .5), vz: rand(.5, 2), g: 6, life: rand(.4, .8), max: .8, col: '140,120,95', sz: .05 });
  }
  /* Zustandswechsel vom Host: mit denselben Funktionen nachspielen (Effekte und Hinweise entstehen dabei von selbst) */
  function onState(m) {
    evSeen = Math.max(evSeen, m.n | 0);
    if (!live()) return;
    const sv = byId(m.sv); if (!sv) return;
    const o = { hitSurvivor: base('hitSurvivor'), downSurv: base('downSurv'), pickUp: base('pickUp'), dropCarried: base('dropCarried'), hookSurv: base('hookSurv'),
      unhookSurv: base('unhookSurv'), healDone: base('healDone'), killSurv: base('killSurv'), escapeSurv: base('escapeSurv') };
    switch (m.k) {
      case 'hit': if (sv.out) break; sv.hp = 2; o.hitSurvivor(sv); break;
      case 'down': if (sv.out) break; if (sv.hp <= 0) sv.hp = 1; sv.carried = false; sv.hung = null; o.downSurv(sv); break;
      case 'pick': if (sv.out) break; sv.carried = false; sv.hung = null; if (sv === S && S.act) S.act = null; o.pickUp(sv); break;
      case 'drop': if (sv.out) break; K.carry = sv; sv.carried = true; o.dropCarried(m.why); break;
      case 'hook': { const h = hooks[m.h]; if (!h || sv.out) break; K.carry = sv; sv.hookN = Math.max(0, (m.c | 0) - 1); o.hookSurv(sv, h); break; }
      case 'unhook': { const h = hooks[m.h]; if (!h || sv.out) break; sv.hung = h; o.unhookSurv(sv, byId(m.by)); break; }
      case 'healed': if (sv.out) break; sv.hp = Math.max(0, (m.hp | 0) - 1); o.healDone(sv); if ((m.by || []).includes(S.id)) { stats.heals++; qteSeen.add('heal'); } break;
      case 'kill': o.killSurv(sv, m.how); break;
      case 'esc': { const g = gates[m.g]; if (g) o.escapeSurv(sv, g); break; }
    }
  }
  function onFx(m) {
    if (!live()) return;
    const mine = m.src === S.id, sv = m.sv != null ? byId(m.sv) : null;
    switch (m.k) {
      case 'fail': if (!mine && sv) base('fx')('fail', sv, m.o); break;
      case 'stage': if (sv && hooks[m.h]) base('fx')('stage', sv, hooks[m.h]); break;
      case 'pallet': {
        const p = pallets[m.i]; if (!p) break;
        if (!mine) { if (p.state === 0) p.state = 1; palletFx(p); }
        if (m.stun) {
          hear(p.cx, p.cy, () => { SFX.stun(); shake(mine ? .5 : .3); }); if (mine) stats.stuns++;
          if (KP === 'local') { if (isFinite(m.kx) && isFinite(m.ky)) { K.x = m.kx; K.y = m.ky; } K.z = 0; K.act = { kind: 'stun', t: 0, dur: CFG.stun }; }
        }
        break;
      }
      case 'vault': if (!mine) { if (isFinite(m.x)) hear(m.x, m.y, () => SFX.vault(!!m.fast)); else SFX.vault(!!m.fast); } break;
      case 'locker': { const L = lockers[m.i]; if (L) L.anim = 1; if (!mine) { if (L) hear(L.cx, L.cy, SFX.locker); else SFX.locker(); } break; }
      case 'toast': toast(String(m.msg || '').slice(0, 80)); break;
    }
  }
  function onEnd(m) {
    if (!live()) return;
    (m.out || []).forEach((o, i) => { const sv = SV[i]; if (sv && o && !sv.out) { sv.out = o; sv.outT = T; } });
    showTeamEnd();
  }
  /* Schnappschuss übernehmen */
  function onSnap(m) {
    if (!live() || !m.k || !m.s) return;
    X.got++; lastSnap = m;
    clockSet(clock, m.T);
    const k = m.k, a = K.act;
    if (KP === 'local') {
      // Mein Killer: nur Zwangslagen vom Host übernehmen (Betäubung, Klinge abwischen), falls sie noch nicht angekommen sind
      const kf = k[12] | 0;
      if (kf > kfSeen) {
        kfSeen = kf;
        if ((k[4] === 'stun' || k[4] === 'wipe') && !(a && a.kind === k[4])) { K.act = { kind: k[4], t: k[5], dur: k[6] }; K.z = 0; if (k[4] === 'stun') { K.x = k[0]; K.y = k[1]; } }
      }
    } else {
    push(K.nb, m.T, k[0], k[1], k[2]);
    K.mode = k[3]; K.moving = !!k[8]; K.carry = SV[k[9]] || null; K.target = SV[k[10]] || null; K.aware = k[11]; K.nz = k[7];
    if (!k[4]) K.act = null;
    else if (!a || a.kind !== k[4] || k[5] < a.t - .3) { K.act = { kind: k[4], t: k[5], dur: k[6], base: K.dir }; killerFx(k[4]); }
    else { a.t = Math.max(a.t, k[5]); a.dur = k[6]; }
    }
    m.s.forEach((d, i) => {
      const sv = SV[i]; if (!sv) return;
      const f = d[3], me = sv === S;
      // maßgeblich für alle (auch für mich): Leben, Tragen, Haken, raus
      sv.hp = d[5]; sv.carried = !!(f & 4); sv.hung = d[6] >= 0 ? hooks[d[6]] || null : (sv.out === 'dead' ? sv.hung : null);
      if (d[7] && !sv.out) { sv.out = d[7]; sv.outT = T; }
      sv.hookN = d[8]; sv.hookProg = d[9]; sv.unhookProg = d[10]; sv.healProg = d[11];
      if (d[10] > 0) sv.unhookT = T;
      if (f & 16) sv.healedT = T;
      if (!me || d[12] > sv.wiggle || !sv.carried) { if (d[12] > sv.wiggle + .001) sv.wigT = T; sv.wiggle = d[12]; }
      if (me) {
        if (sv.hidden && d[15] < 0 && !sv.act && hidAt && T - hidAt > .8) sv.hidden = null;   // der Host hat das Verstecken nicht angenommen
        return;
      }
      push(sv.net.buf, m.T, d[0], d[1], d[2]);
      sv.running = !!(f & 2); sv.nz = d[4]; sv.nmove = !!(f & 1);
      sv.burst = f & 8 ? Math.max(sv.burst, .2) : 0; if (f & 64) sv.flinch = Math.max(sv.flinch, .1);
      sv.work = d[13] >= 0 ? tasks[d[13]] || null : null; sv.station = d[14];
      const L = d[15] >= 0 ? lockers[d[15]] || null : null;
      if (L !== sv.hidden) { if (L) L.anim = 1; else if (sv.hidden) sv.hidden.anim = 1; sv.hidden = L; }
      sv.heal = d[16] >= 0 ? byId(d[16]) : null; if (sv.heal) sv.healAt = T;
      sv.unhook = d[17] >= 0 ? byId(d[17]) : null; if (sv.unhook) sv.unhookAt = T;
    });
    // Welt
    m.tk.forEach((v, i) => {
      const t = tasks[i]; if (!t) return;
      if (v === 2) { if (!t.done) remoteDone(t); return; }
      if (t.done) { if (T - (t.pred || -9) > 1.5) { t.done = false; t.prog = v; } return; }   // der Host hat nicht bestätigt
      if (S.work !== t || t.type === 'duo') t.prog = v;
    });
    for (let i = 0; i < pallets.length; i++) {
      const p = pallets[i], st = +m.p[i];
      if (st > p.state) { if (st === 2) breakFx(p); p.state = st; }
      else if (st < p.state && T - (p.pred || -9) > 1.2) p.state = st;
    }
    m.w.forEach((v, i) => { const w = windows[i]; if (w) w.blockedUntil = v > 0 ? T + v : 0; });
    m.g.forEach((v, i) => { const g = gates[i]; if (g) g.open = Math.max(v, endgame ? g.open : 0); });
    if (m.eg && !endgame) { endgame = true; gatesPowered = true; SFX.siren(); } else if (!m.eg && endgame && !tasks.some(t => t.done && T - (t.pred || -9) < 1.5)) { endgame = gatesPowered = false; }
  }
  // Aufgabe von jemand anderem erledigt
  function remoteDone(t) {
    t.done = true; t.prog = 1; qteSeen.add(t.type);
    for (const v of SV) if (v.work === t) { v.work = null; if (v === S) Q = null; }
    hear(t.cx, t.cy, SFX.done, .6);
    for (let i = 0; i < 20; i++) parts.push({ x: t.cx, y: t.cy, z: .6, vx: rand(-1.2, 1.2), vy: rand(-1, 1), vz: rand(1, 3), g: 3, life: rand(.5, 1), max: 1, col: '255,225,140', sz: .05 });
  }
  function breakFx(p) {
    hear(p.cx, p.cy, () => { SFX.crack(); shake(.2); });
    for (let i = 0; i < 18; i++) parts.push({ x: p.cx, y: p.cy, z: .2, vx: rand(-2, 2), vy: rand(-1.5, 1.5), vz: rand(1, 3), g: 8, life: rand(.4, .9), max: .9, col: '120,90,55', sz: .06 });
  }
  // Töne zu den Aktionen des Killers (der Host hört sie aus runAct)
  function killerFx(kind) {
    if (kind === 'lunge') hear(K.x, K.y, SFX.whoosh); else if (kind === 'recover') hear(K.x, K.y, SFX.whiff); else if (kind === 'kick') setTimeout(() => { if (live()) hear(K.x, K.y, SFX.kick); }, 600);
    else if (kind === 'locker') setTimeout(() => { if (live()) hear(K.x, K.y, SFX.locker); }, 400);
  }
  /* Killer beim Client: nur darstellen */
  function killerNet(dt) {
    if (clock.t != null) clock.t += dt;
    const ox = K.x, oy = K.y;
    if (sample(K.nb, clock.t - DELAY, tmp)) { K.x = tmp.x; K.y = tmp.y; K.dir = tmp.d; }
    const md = hyp(K.x - ox, K.y - oy);
    K.walk += md * 4.6; K.z = K.nz || 0;
    if (K.act) K.act.t += dt;
    if (K.moving) { K.stepT -= dt; if (K.stepT <= 0) { K.stepT = K.mode === 'chase' ? .28 : .42; if (killerVisible()) hear(K.x, K.y, SFX.kstep); } }
  }
  /* Fremde Survivors beim Client: aus den Schnappschüssen interpolieren */
  function otherCtl(sv, dt) {
    const ox = sv.x, oy = sv.y, run = sv.running;
    if (sample(sv.net.buf, clock.t - DELAY, tmp)) { sv.x = tmp.x; sv.y = tmp.y; sv.dir = tmp.d; }
    sv.z = sv.nz || 0;
    if (sv.hidden || sv.hp <= 0) sv.running = false;
    survMoved(sv, hyp(sv.x - ox, sv.y - oy), dt);
    sv.running = run; if (!sv.moving && sv.nmove && !sv.work) sv.moving = true;
  }
  function clientTeamStep(dt) {
    if (S.carried && K.carry === S) { S.x = K.x; S.y = K.y; S.mask = K.mask; }
    else if (S.hung && !S.out) { S.x = S.hung.front.x; S.y = S.hung.front.y; }
    for (const sv of SV) if (sv.leave) {
      const L = sv.leave, dir = L.g.north ? -1 : 1; L.t += dt;
      if (L.t < 2) { sv.dir = dir * Math.PI / 2; sv.moving = sv.running = true; sv.walk += dt * 20; sv.y += dir * 2.6 * dt; }
    }
    for (const d of deaths) if (!d.gone && T - d.t0 > 2.4) { d.gone = true; if (d.sv.hung === d.h) d.sv.hung = null; base('fx')('vanish', d.sv, d); }
    specUI();
  }
  function clientState() {
    const w = S.work ? tasks.indexOf(S.work) : -1;
    if (!S.hidden) hidAt = 0; else if (!hidAt) hidAt = T;
    return { t: 'c', T: r3(T), ev: evSeen, x: r2(S.x), y: r2(S.y), d: r2(S.dir), r: S.running ? 1 : 0, z: r2(S.z),
      w, st: S.station | 0, pr: w >= 0 ? r3(S.work.prog) : 0, h: S.heal ? S.heal.id : -1, u: S.unhook && actHeld ? S.unhook.id : -1 };
  }

  /* Killer-Spieler (Client): eigener Zustand – Position, laufende Aktion (a = Art, an = laufende Nummer, ai = Objekt) */
  function killerState() {
    const a = K.act, own = a && a.kind !== 'stun' && a.kind !== 'wipe';
    return { t: 'k', T: r3(T), kf: kfSeen, x: r2(K.x), y: r2(K.y), d: r2(K.dir), z: r2(K.z), a: own ? a.kind : '', an: own ? a.n | 0 : 0, ai: own && a.ai != null ? a.ai : -1 };
  }

  /* =====================================================================================
     Start / Ende / Takt
     ===================================================================================== */
  function start(info) {
    stop();
    if (!Net.active || MODE !== 'team') return;
    kId = info && info.killer != null ? info.killer : -1;
    X.active = true; X.host = Net.isHost; acc = 0; evN = 0; X.sent = X.got = 0;
    if (X.host) hostOn(); else clientOn();
    bgStart();
  }
  function stop() {
    if (!X.active) return;
    X.active = false;
    for (const f of offs) f(); offs = [];
    restore(); bgStop(); netPause(false);
    if (K) { K.net = null; }
  }
  // am Ende jedes Simulationsschritts (js/flow.js)
  function tick(dt) {
    if (!live()) return;
    acc += dt; if (acc < RATE) return;
    acc = Math.min(acc - RATE, RATE);
    if (X.host) send(snapshot()); else { X.sent++; Net.send(KP === 'local' ? killerState() : clientState()); }
  }
  /* Tab im Hintergrund: requestAnimationFrame steht dann still. Online darf vor allem der Host nicht einfrieren –
     ein Worker-Taktgeber (wird im Hintergrund nicht gedrosselt) treibt die Spielschleife weiter (bgFrame in js/main.js). */
  function bgStart() {
    bgStop();
    const run = () => { if (X.active && document.hidden && typeof bgFrame === 'function') bgFrame(); };
    try {
      const w = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 50)'], { type: 'text/javascript' })));
      w.onmessage = run; w.onerror = () => { bgStop(); bg = { iv: setInterval(run, 50) }; };
      bg = { w };
    } catch (e) { bg = { iv: setInterval(run, 50) }; }
  }
  function bgStop() { if (!bg) return; if (bg.w) bg.w.terminate(); if (bg.iv) clearInterval(bg.iv); bg = null; }

  Net.onGameStart(start);
  Net.onGameEnd(stop);
  return Object.assign(X, { start, stop, tick, snapshot, hostKiller, get lastSnap() { return lastSnap; } });
})();

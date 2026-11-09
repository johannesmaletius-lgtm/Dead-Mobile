'use strict';
/* Dead Mobile – Bots (Phase 3): KI-Überlebende für freie Plätze (kind 'bot'). Bots.attach() läuft am Ende von startTeam
   und gibt jedem Bot sv.ctl = think (wird aus updateOther aufgerufen, auch am Boden/getragen/am Haken).
   Rangfolge je Bot:  getragen → zappeln · am Boden → wegkriechen · im Spind → abwarten ·
     Flucht (gejagt oder entdeckt: rennen, Fenster/Paletten nutzen, Palette werfen, Sicht brechen, ab und zu Spind) ·
     Ausweichen (Killer nah, sieht mich aber nicht: leise aus der Sicht gehen) · Auftrag vom Team-Plan.
   Team-Plan (alle 0,4 s, plan()): retten (genau ein Bot je Haken, nur wenn der Killer weit weg ist) · heilen ·
     Duo-Aufgabe zu zweit · Aufgaben verteilt · Endspiel → Tor.
   Nicht geschummelt: Ein Bot kennt den Killer nur bei Sicht (gleicher Raum, freie Linie) oder näher als 12 Kacheln
     (Herzschlag) und merkt ihn sich kurz. Dass er selbst gejagt wird, weiß er (wie der Spieler durch die Musik).
   Gerannt wird nur auf der Flucht – und zu einem Haken, wenn die Zeit sonst nicht reicht.
   Schnittstelle: Bots.on (false = keine Bots, für Tests), Bots.attach(), Bots.give(sv) (Survivor wird Bot, z. B. wenn
     ein Mitspieler geht), Bots.take(sv). Test: tools/botsim.js. */
const Bots = (() => {
  /* Stellschrauben (Bots.cfg): Bots sollen gut, aber nicht unfehlbar sein – abgestimmt mit tools/botsim.js */
  const C = {
    react: [.45, 1.0],   // Schrecksekunde, bevor ein Bot losrennt (s)
    workSee: 6.5,        // bei der Arbeit/beim Heilen bemerkt er den Killer erst so nah (sonst Sichtweite)
    noise: 2.5,          // Unschärfe bei der Wahl des Fluchtziels (0 = immer das beste)
    horizon: 5.5,        // wie weit er Fluchtwege vorausplant (s)
    rethink: .45,        // Fluchtziel neu wählen alle … s
    stun: .6,            // Anteil richtig getimter Palettenwürfe (sonst zu früh)
    win: .5,             // wie viel Zeit er dem Killer an einem Fenster zutraut (s; echt: 1,85) – kleiner = nutzt Fenster seltener
    rescueAim: [.4, .6], // der Retter bricht so auf, dass er etwa bei diesem Haken-Fortschritt ankommt (erst die eigene Arbeit)
    healBusy: 1,         // 1 = wer gerade arbeitet, unterbricht nicht zum Heilen (außer der Verletzte steht daneben)
    rescueSafe: 12,      // gerettet wird nur, wenn der Killer (soweit bekannt) weiter als so viele Kacheln vom Haken weg ist
    healSafe: 13,        // geheilt wird nur, wenn der Killer weiter als so viele Kacheln vom Verletzten weg ist
    healRange: 28,       // so weit läuft ein Bot, um einen anderen Bot zu heilen (Kacheln)
    calm: 8,             // außer Sicht schleicht er erst, wenn der Killer so weit weg ist (Rennen hinterlässt Spuren)
    vault: .55,          // gefühlte eigene Zeit für einen Fenstersprung auf der Flucht (s; echt: 0,55) – größer = seltener
    pal: 1.6,            // Vorliebe für stehende Paletten als Fluchtziel
    rescueRun: 0,        // 1 = zum Haken rennen, wenn die Zeit sonst nicht reicht
    hear: 9,             // Killer näher als so viele Kacheln (Herzschlag): Arbeit unterbrechen und ausweichen (0 = aus)
    pause: [4, 9],       // Umschau-Pause nach einer Aufgabe bzw. nach einer Flucht (s)
    locker: .3,          // Anteil der Jagden, in denen er einen Spind versucht
  };
  const DEF = Object.assign({}, C);
  const B = { on: true, cfg: C, override: null };   // override: Werte für Tests (tools/botsim.js --cfg)
  const INF = 1e9, MEM = 2.5, MEMP = 7, HEAR = 12;
  const hookSeen = new Map();
  let planT = -9, duoFull = -99, fS = null, fK = null, pS = null, fN = 0;

  function mind() {
    return { skill: rand(.8, .9), wigT: rand(11, 15), kx: 0, ky: 0, kT: -99, kd: 99, los: false, losT: -99, known: false,
      mode: 'job', job: null, healer: null, fleeUntil: 0, fleeT: 0, ft: null, hold: null, palSkip: null, palSkipT: 0, wasChased: false, react: rand(C.react[0], C.react[1]), trigT: -1,
      roll: Math.random(), avoid: new Map(), hideT: 0, want: false, chkT: 0, px: 0, py: 0, still: 0, nudge: null, crawlT: 0, ct: null, stuckN: 0, pauseT: 0, had: null };
  }
  function give(sv) { sv.bot = mind(); sv.ctl = think; sv.path = null; planT = -9; }
  function take(sv) { if (sv.ctl === think) sv.ctl = null; sv.bot = null; planT = -9; }
  function attach() {
    planT = -9; duoFull = -99; hookSeen.clear();
    // Standardwerte, dann die Abstimmung der Karte (MAPS[id].bots), dann Test-Werte
    Object.assign(C, DEF, (typeof MAPDEF !== 'undefined' && MAPDEF && MAPDEF.bots) || null, B.override);
    if (!B.on) return;
    for (const sv of SV) if (sv.kind === 'bot') give(sv);
  }

  /* ================= Wahrnehmung ================= */
  function sense(sv, b) {
    const d = hyp(K.x - sv.x, K.y - sv.y);
    b.kd = d;
    b.los = !sv.hidden && (K.mask & sv.mask) !== 0 && d < 16 && losClear(sv.x, sv.y - .1, K.x, K.y - .1);
    if (b.los) b.losT = T;
    if (b.los || d < HEAR) { b.kx = K.x; b.ky = K.y; b.kT = T; }
    b.known = T - b.kT < MEM;
  }
  const kNear = (v, x, y, R) => T - v.bot.kT < MEMP && hyp(v.bot.kx - x, v.bot.ky - y) < R;
  const stand = sv => { sv.moving = sv.running = false; };
  function go(sv, b, x, y, run, dt) {
    b.want = true; sv.running = !!run && sv.hp > 0;
    const arr = goTo(sv, x, y, survSpeed(sv, run), dt);
    if (!sv.moving) sv.running = false;
    return arr;
  }

  /* ================= Zeitfelder (Dijkstra): Sekunden bis zu jeder Kachel =================
     Survivors springen schnell über Fenster und liegende Paletten, der Killer braucht dafür lange. */
  function fields() { if (fN !== N) { fN = N; fS = new Float32Array(N); fK = new Float32Array(N); pS = new Int32Array(N); } }
  function flood(out, par, sx, sy, forK, spd, maxT, vault = .55) {
    out.fill(INF); kcS = !forK;
    const s0 = nearestWalk(sx | 0, sy | 0); if (!s0) return -1;
    const s = I(s0[0], s0[1]); out[s] = 0; if (par) par[s] = -1;
    HP.length = 0; HF.length = 0; hpush(s, 0);
    const cw = forK ? C.win : vault, cp = forK ? CFG.kBreak + .2 : .7;
    while (HP.length) {
      const f = HF[0], i = hpop(); if (f > out[i] + 1e-6) continue; if (f > maxT) break;
      const x = i % W, y = (i / W) | 0, k = kc(x, y);
      for (const [dx, dy] of D8) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nk = kc(nx, ny); if (!nk) continue;
        const diag = dx !== 0 && dy !== 0;
        if (k > 1) { if (diag) continue; const a = axisOf(x, y); if (!((dx === a.x && dy === a.y) || (dx === -a.x && dy === -a.y))) continue; }
        if (nk > 1) { if (diag) continue; const a = axisOf(nx, ny); if (!((dx === a.x && dy === a.y) || (dx === -a.x && dy === -a.y))) continue; }
        if (diag && (nk !== 1 || kc(x + dx, y) !== 1 || kc(x, y + dy) !== 1)) continue;
        const j = I(nx, ny), c = f + (diag ? 1.414 : 1) / spd + (nk === 2 ? cw : nk === 3 ? cp : 0);
        if (c < out[j]) { out[j] = c; if (par) par[j] = i; hpush(j, c); }
      }
    }
    kcS = false;
    return s;
  }
  function pathTo(sv, i, s) {
    const p = []; for (let c = i, n = 0; c !== s && c >= 0 && n < 400; c = pS[c], n++) p.push(c);
    p.reverse(); sv.path = p; sv.pi = 0; sv.pathGoal = i; sv.repathT = T + 9;
  }
  const cellOf = (x, y) => I(clamp(x | 0, 0, W - 1), clamp(y | 0, 0, H - 1));
  // Wie lange ist der Killer noch beschäftigt (betäubt, wischt die Klinge ab …)?
  const kDelay = () => K.act && ['stun', 'wipe', 'break', 'vault', 'recover', 'pick', 'hook'].includes(K.act.kind) ? Math.max(0, K.act.dur - K.act.t) : 0;

  /* ================= Flucht ================= */
  function pickFlee(sv, b) {
    fields(); b.fleeT = T + C.rethink;
    const s = flood(fS, pS, sv.x, sv.y, false, CFG.sRun, C.horizon + .5, C.vault), old = b.ft;
    flood(fK, null, b.kx, b.ky, true, CFG.kChase, 14);
    b.ft = null; if (s < 0) return;
    const kd = kDelay(), top = [];
    const add = (i, x, y, sc, o) => { top.push(Object.assign({ i, x, y, sc }, o)); top.sort((a, c) => c.sc - a.sc); if (top.length > 9) top.length = 9; };
    const base = i => { const adv = Math.min(fK[i], 14) + kd - fS[i]; return Math.min(adv, 3.5) + Math.min(fS[i], 4) * .35 - (adv < .4 ? 8 : 0); };
    for (let i = 0; i < N; i++) {
      if (fS[i] > C.horizon || fS[i] < .2) continue;
      const x = i % W, y = (i / W) | 0; if ((x * 7 + y * 13) % 3) continue;
      const sc = base(i); if (top.length < 9 || sc > top[top.length - 1].sc) add(i, x + .5, y + .5, sc);
    }
    // Stehende Paletten: auf die Seite, die der Killer später erreicht – dort warten und werfen
    for (const p of pallets) {
      if (p.state !== 0 || (p === b.palSkip && T < b.palSkipT) || hyp(p.cx - sv.x, p.cy - sv.y) > 22) continue;
      const a = cellOf(p.x + p.ax.x, p.y + p.ax.y), c = cellOf(p.x - p.ax.x, p.y - p.ax.y);
      if (fK[a] >= INF || fK[c] >= INF) continue;
      const sg = fK[a] > fK[c] ? 1 : -1, far = sg > 0 ? a : c;
      if (fS[far] > C.horizon || fS[far] + .35 > fK[far] + kd) continue;
      add(far, p.cx + p.ax.x * sg, p.cy + p.ax.y * sg, base(far) + C.pal, { pal: p });
    }
    // Offenes Tor: raus, wenn ich vor ihm da bin
    if (endgame) for (const g of gates) {
      const gx = (g.x0 + g.x1 + 1) / 2, ins = cellOf(gx, g.y + (g.north ? 1 : -1));
      if (fS[ins] < 7 && fS[ins] + .2 < fK[ins] + kd) add(ins, gx, g.y + .5, 12 - fS[ins], { gate: g });
    }
    let best = null, bs = -INF;
    for (const c of top) {
      let sc = c.sc + (c.gate ? 0 : rand(0, C.noise));
      if (!c.gate && !losClear(b.kx, b.ky, c.x, c.y)) sc += .7;
      if (old && hyp(old.x - c.x, old.y - c.y) < 1.5) sc += .5;
      // unterwegs nie hinter den Killer zurückfallen
      let m = INF; for (let j = c.i, n = 0; j !== s && j >= 0 && n < 400; j = pS[j], n++) if (fS[j] > .35) m = Math.min(m, fK[j] + kd - fS[j]);
      if (m < .12) sc -= 5;
      if (sc > bs) { bs = sc; best = c; }
    }
    if (!best) return;
    b.ft = best; pathTo(sv, best.i, s);
  }
  /* An einer stehenden Palette: auf der sicheren Seite warten, werfen, wenn der Killer hindurchkommt */
  function palletPlay(sv, b, chased, dt) {
    if (!b.known || !chased) { b.hold = null; return false; }
    for (const p of pallets) {
      if (p.state !== 0 || (p === b.palSkip && T < b.palSkipT)) continue;
      const dx = sv.x - p.cx, dy = sv.y - p.cy; if (dx * dx + dy * dy > 2.2) continue;
      const al = dx * p.ax.x + dy * p.ax.y, lat = Math.abs(dx * p.ax.y - dy * p.ax.x);
      if (lat > .5 || Math.abs(al) < .55 || Math.abs(al) > 1.32) continue;
      const kl = (K.x - p.cx) * p.ax.x + (K.y - p.cy) * p.ax.y, klat = Math.abs((K.x - p.cx) * p.ax.y - (K.y - p.cy) * p.ax.x);
      const kd = hyp(K.x - p.cx, K.y - p.cy), ks = hyp(K.x - sv.x, K.y - sv.y);
      if (kl * al > 0 && Math.abs(kl) > .45) continue;                               // er steht auf meiner Seite
      const zone = Math.abs(kl) < .5 + K.r - .04 && klat < .5 + K.r * .5 - .03 && !(K.act && K.act.kind === 'vault');
      if (zone) { dropPallet(p, sv); b.hold = null; return true; }
      if (ks < 2.3 && klat > .6) { b.palSkip = p; b.palSkipT = T + 4; continue; }    // er kommt außen herum
      if (!b.hold || b.hold.p !== p) b.hold = { p, t: T, early: Math.random() > C.stun };
      if (T - b.hold.t > 7) { b.palSkip = p; b.palSkipT = T + 8; b.hold = null; continue; }
      if (b.hold.early && kd < 2.5 && klat < .7) { dropPallet(p, sv); b.hold = null; return true; }   // zu früh geworfen
      const s = Math.sign(al), tx = p.cx + p.ax.x * s, ty = p.cy + p.ax.y * s;
      if (hyp(tx - sv.x, ty - sv.y) > .12) { sv.running = true; moveAgent(sv, tx, ty, survSpeed(sv, true), dt); }
      else { stand(sv); sv.dir = Math.atan2(K.y - sv.y, K.x - sv.x); }
      return true;
    }
    b.hold = null; return false;
  }
  function nearLocker(sv, b, maxT) {
    let best = null, bt = maxT;
    for (const L of lockers) {
      if (SV.some(v => v !== sv && (v.hidden === L || (v.act && v.act.L === L)))) continue;
      const i = cellOf(L.front.x, L.front.y), t = fS[i];
      if (t < bt && fK[i] - t > 2) { bt = t; best = L; }
    }
    return best;
  }
  function flee(sv, b, chased, dt) {
    if (sv.work || sv.heal || sv.unhook) clearInteract(sv);
    b.want = true;
    if (palletPlay(sv, b, chased, dt)) { b.want = false; return; }
    const hidden = !b.los && T - b.losT > 1.7;
    const run = !chased || !hidden || b.kd < C.calm || sv.burst > 0;
    if (b.locker) {
      const L = b.locker;
      if (!hidden || T > b.lockerT) b.locker = null;
      else { if (hyp(sv.x - L.front.x, sv.y - L.front.y) < .3) { b.locker = null; b.hideT = T; hide(L, sv); return; } go(sv, b, L.front.x, L.front.y, b.kd < 9, dt); return; }
    }
    if (!b.ft || T >= b.fleeT || (!sv.path && !lineWalk(sv.x, sv.y, b.ft.x, b.ft.y, sv.r)) || hyp(sv.x - b.ft.x, sv.y - b.ft.y) < .35) {
      pickFlee(sv, b);
      if (chased && hidden && b.roll < C.locker && b.kd > 5) { const L = nearLocker(sv, b, 1.3); if (L) { b.locker = L; b.lockerT = T + 4; b.roll = 1; return; } }
    }
    const f = b.ft; if (!f) { stand(sv); return; }
    if (f.gate && f.gate.open < 1 && hyp(sv.x - f.x, sv.y - f.y) < 1.3) { stand(sv); return; }
    sv.running = run;
    if (sv.path) followPath(sv, f.x, f.y, survSpeed(sv, run), dt); else moveAgent(sv, f.x, f.y, survSpeed(sv, run), dt);
    if (!sv.moving) sv.running = false;
  }
  /* Killer nah, sieht mich aber (noch) nicht: leise dorthin, wo er mich nicht sieht – oder in einen Spind */
  function evade(sv, b, dt) {
    if (sv.work || sv.heal || sv.unhook) clearInteract(sv);
    if (b.locker) {
      const L = b.locker;
      if (b.los || T > b.lockerT) b.locker = null;
      else { if (hyp(sv.x - L.front.x, sv.y - L.front.y) < .3) { b.locker = null; b.hideT = T; hide(L, sv); return; } go(sv, b, L.front.x, L.front.y, false, dt); return; }
    }
    if (!b.et || T >= b.evT) {
      fields(); b.evT = T + .6;
      const s = flood(fS, pS, sv.x, sv.y, false, CFG.sWalk, 5.5);
      flood(fK, null, b.kx, b.ky, true, CFG.kPatrol, 12);
      let best = null, bs = -INF;
      if (s >= 0) for (let i = 0; i < N; i++) {
        if (fS[i] > 5.2) continue;
        const x = i % W, y = (i / W) | 0; if (i !== s && (x + 2 * y) % 3) continue;
        const sc = (losClear(b.kx, b.ky, x + .5, y + .5) ? 0 : 3) + Math.min(fK[i], 5) * .7 - fS[i] * .35 + (b.et && b.et.i === i ? .4 : 0);
        if (sc > bs) { bs = sc; best = { i, x: x + .5, y: y + .5 }; }
      }
      b.et = best;
      if (best && !b.los && b.roll < .25) { const L = nearLocker(sv, b, 2.2); if (L) { b.locker = L; b.lockerT = T + 5; b.roll = 1; return; } }
    }
    if (!b.et || hyp(sv.x - b.et.x, sv.y - b.et.y) < .3) { stand(sv); return; }
    go(sv, b, b.et.x, b.et.y, false, dt);
  }
  function inLocker(sv, b) {
    stand(sv);
    const t = T - b.hideT;
    if ((t > 6 && T - b.kT > 3.5) || t > 28) { b.roll = Math.random(); unhide(sv); }
  }
  /* Am Boden: weg vom Killer, sonst zum nächsten freien Teamkollegen */
  function crawl(sv, b, dt) {
    if (T >= b.crawlT) {
      b.crawlT = T + 1.2; b.ct = null;
      let mate = null, md = INF;
      for (const v of SV) if (v !== sv && isFree(v)) { const d = hyp(v.x - sv.x, v.y - sv.y); if (d < md) { md = d; mate = v; } }
      let bs = -INF;
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4, x = sv.x + Math.cos(a) * 2.5, y = sv.y + Math.sin(a) * 2.5;
        if (circleHit(x, y, sv.r) || !lineWalk(sv.x, sv.y, x, y, sv.r)) continue;
        const sc = (b.known ? hyp(x - b.kx, y - b.ky) : 0) - (mate && (!b.known || b.kd > 8) ? hyp(x - mate.x, y - mate.y) : 0);
        if (sc > bs) { bs = sc; b.ct = { x, y }; }
      }
      if (mate && md < 1.1 && !b.known) b.ct = null;
    }
    if (b.ct) { sv.running = false; moveAgent(sv, b.ct.x, b.ct.y, survSpeed(sv, false), dt); } else stand(sv);
  }

  /* ================= Team-Plan ================= */
  const same = (j, kind, o) => j && j.kind === kind && j.o === o;
  function plan() {
    planT = T;
    const bots = SV.filter(v => v.bot && v.ctl === think && isFree(v) && !v.hidden);
    const used = new Set(), ok = v => v.bot.mode === 'job' && !used.has(v);
    for (const v of bots) { v.bot.prev = v.bot.job; v.bot.job = null; v.bot.healer = null; }
    // nächster verfügbarer Bot zu (x, y); wer den Auftrag schon hat, behält ihn bevorzugt
    const choose = (x, y, kind, o, filter) => {
      let best = null, bd = INF;
      for (const v of bots) {
        if (!ok(v) || (filter && !filter(v))) continue;
        const d = hyp(v.x - x, v.y - y) * (same(v.bot.prev, kind, o) ? .6 : 1);
        if (d < bd) { bd = d; best = v; }
      }
      return best;
    };
    const setJob = (v, j) => { used.add(v); v.bot.job = j; };
    // 1) Retten: genau ein Bot je Haken, nur wenn der Killer (soweit bekannt) weit weg ist
    for (const X of SV) if (X.hung && !X.out) {
      const h = X.hung, left = (1 - X.hookProg) * 2 * CFG.hookStage, urgent = left < 22;
      let hs = hookSeen.get(X); if (!hs || hs.n !== X.hookN) hookSeen.set(X, hs = { n: X.hookN, aim: rand(C.rescueAim[0], C.rescueAim[1]), go: false });
      const v = choose(h.front.x, h.front.y, 'rescue', X, v => !kNear(v, h.front.x, h.front.y, urgent ? 5 : C.rescueSafe));
      // erst aufbrechen, wenn es Zeit wird (bis dahin weiterarbeiten)
      if (v && !hs.go && X.hookProg + hyp(v.x - h.front.x, v.y - h.front.y) * 1.3 / CFG.sWalk / (2 * CFG.hookStage) < hs.aim) continue;
      hs.go = true;
      if (v) setJob(v, { kind: 'rescue', o: X, run: !!C.rescueRun && hyp(v.x - h.front.x, v.y - h.front.y) * 1.5 / CFG.sWalk > left - 6 });
    }
    // 2) Heilen (nicht mitten in einer Flucht; Menschen nur, wenn sie in der Nähe stehen bleiben)
    const hurt = SV.filter(X => inPlay(X) && X.hp < 2 && !X.carried && !X.hung && !X.hidden && !(X.bot && X.bot.mode !== 'job') && !(!X.bot && X.running));
    for (const X of hurt) {
      const lim = endgame ? 7 : X.bot ? C.healRange : 10;
      let v = choose(X.x, X.y, 'heal', X, v => v !== X && hyp(v.x - X.x, v.y - X.y) < (C.healBusy && v.work && !same(v.bot.prev, 'heal', X) ? 5 : lim) && !kNear(v, X.x, X.y, C.healSafe));
      // zwei Verletzte heilen sich gegenseitig
      if (!v) v = bots.find(w => w !== X && w.bot.healer === X && ok(w) && hyp(w.x - X.x, w.y - X.y) < 3) || null;
      if (v && X.hp <= 0 && kNear(v, X.x, X.y, 14)) v = null;
      if (!v) continue;
      setJob(v, { kind: 'heal', o: X });
      if (X.bot) X.bot.healer = v;
    }
    // 3) Duo-Aufgabe: zwei Bots – oder einer, wenn ein Mensch an einer Station steht
    const duo = !endgame && tasks.find(t => t.type === 'duo' && !t.done);
    if (duo) {
      const st = duo.stations, human = k => SV.some(v => !v.bot && isFree(v) && ((v.work === duo && v.station === k) || (!v.work && hyp(v.x - st[k].ax, v.y - st[k].ay) < 2.2 && hyp(v.x - st[k].ax, v.y - st[k].ay) <= hyp(v.x - st[1 - k].ax, v.y - st[1 - k].ay))));
      const need = [0, 1].filter(k => !human(k)), free = bots.filter(ok);
      const near = v => !kNear(v, duo.cx, duo.cy, 8) || v.work === duo;
      if (need.length < 2 || free.length >= 2) duoFull = need.length < 2 && !free.length ? duoFull : T;
      if (need.length && (free.length >= need.length || (free.length && T - duoFull < 10))) {
        if (need.length === 2 && free.length >= 2) {
          // beste Paarung nach Gesamtweg
          let bp = null, bd = INF;
          for (const a of free) for (const c of free) if (a !== c && near(a) && near(c)) {
            const d = hyp(a.x - st[0].ax, a.y - st[0].ay) * (same(a.bot.prev, 'duo', duo) && a.bot.prev.st === 0 ? .6 : 1) + hyp(c.x - st[1].ax, c.y - st[1].ay) * (same(c.bot.prev, 'duo', duo) && c.bot.prev.st === 1 ? .6 : 1);
            if (d < bd) { bd = d; bp = [a, c]; }
          }
          if (bp) { setJob(bp[0], { kind: 'duo', o: duo, st: 0 }); setJob(bp[1], { kind: 'duo', o: duo, st: 1 }); }
        } else for (const k of need) {
          const keep = free.find(v => ok(v) && same(v.bot.prev, 'duo', duo) && v.bot.prev.st === k && near(v));
          const v = keep || (need.length === 1 || free.length >= need.length ? choose(st[k].ax, st[k].ay, 'duo', duo, near) : null);
          if (v) setJob(v, { kind: 'duo', o: duo, st: k });
        }
      }
    }
    // 4) Rest: im Endspiel zum Tor, sonst Aufgaben verteilen
    const rest = bots.filter(v => !used.has(v) && v.bot.mode === 'job');
    if (endgame) { for (const v of rest) v.bot.job = { kind: 'gate', o: pickGate(v) }; return; }
    const claimed = new Set();
    const valid = (v, t) => !t.done && t.type !== 'duo' && !claimed.has(t) && !SV.some(w => w !== v && w.work === t) && !(v.bot.avoid.get(t) > T) && (v.work === t || !kNear(v, t.cx, t.cy, 8));
    for (const v of rest) { const p = v.bot.prev; if (p && p.kind === 'task' && valid(v, p.o)) { v.bot.job = p; claimed.add(p.o); } }
    for (const v of rest) {
      if (v.bot.job) continue;
      let best = null, bd = INF;
      for (const t of tasks) { if (!valid(v, t)) continue; const d = hyp(v.x - t.ax, v.y - t.ay) - t.prog * 8; if (d < bd) { bd = d; best = t; } }
      if (best) { v.bot.job = { kind: 'task', o: best }; claimed.add(best); } else v.bot.job = { kind: 'idle' };
    }
  }
  function pickGate(v) {
    let best = gates[0], bd = INF;
    for (const g of gates) { const gx = (g.x0 + g.x1 + 1) / 2, d = hyp(v.x - gx, v.y - g.y) + (kNear(v, gx, g.y, 9) ? 40 : 0) - (same(v.bot.prev, 'gate', g) ? 6 : 0); if (d < bd) { bd = d; best = g; } }
    return best;
  }
  const replan = b => { b.job = null; planT = -9; };

  /* ================= Aufträge ausführen ================= */
  function doJob(sv, b, dt) {
    const j = b.job;
    if (sv.work && !(j && (j.kind === 'task' || j.kind === 'duo') && j.o === sv.work)) stopWorkFor(sv);
    // Ich werde geheilt: dem Heiler entgegengehen und stillhalten (an einer Aufgabe arbeite ich dabei weiter)
    const hl = b.healer;
    if (hl && !sv.work && !(j && (j.kind === 'heal' || j.kind === 'rescue'))) {
      if (hyp(hl.x - sv.x, hl.y - sv.y) > 2.2) go(sv, b, hl.x, hl.y, false, dt); else stand(sv);
      return;
    }
    // Aufgabe fertig: kurz umsehen, bevor es weitergeht
    if (b.had && b.had.done) b.pauseT = T + rand(C.pause[0], C.pause[1]);
    b.had = sv.work;
    if (!j || j.kind === 'idle' || (T < b.pauseT && !sv.work && j.kind !== 'rescue' && j.kind !== 'heal' && !endgame)) { stand(sv); if (j && j.kind !== 'idle') sv.dir += Math.sin(T * 2.3 + sv.id) * dt * 2.2; return; }
    const X = j.o;
    if (j.kind === 'rescue') {
      if (!X.hung || X.out) return replan(b);
      if (canUnhook(sv, X)) { unhookStep(sv, X, dt); return; }
      go(sv, b, X.hung.front.x, X.hung.front.y, j.run, dt);
    } else if (j.kind === 'heal') {
      if (!inPlay(X) || X.hp >= 2 || X.carried || X.hung) return replan(b);
      if (canHeal(sv, X)) { healStep(sv, X, dt, b.skill); return; }
      go(sv, b, X.x, X.y, false, dt);
    } else if (j.kind === 'task' || j.kind === 'duo') {
      if (X.done) return replan(b);
      if (sv.work === X) { workStep(sv, X, dt, b.skill); return; }
      const p = j.kind === 'duo' ? X.stations[j.st] : X;
      if (hyp(sv.x - p.ax, sv.y - p.ay) < .3) {
        if (!startWorkFor(sv, X, j.kind === 'duo' ? j.st : undefined)) { if (j.kind === 'task') b.avoid.set(X, T + 6); else stand(sv); return replan(b); }
        return;
      }
      if (go(sv, b, p.ax, p.ay, false, dt) && hyp(sv.x - p.ax, sv.y - p.ay) > .6) { b.avoid.set(X, T + 20); replan(b); }
    } else if (j.kind === 'gate') {
      const g = X, gx = (g.x0 + g.x1 + 1) / 2, iy = g.y + .5 + (g.north ? 1.3 : -1.3);
      if (g.open >= 1) go(sv, b, gx, g.y + .5, b.known && b.kd < 14, dt);
      else if (hyp(sv.x - gx, sv.y - iy) < .4) stand(sv);
      else go(sv, b, gx, iy, b.known && b.kd < 14, dt);
    }
  }

  /* ================= Denken (je Schritt) ================= */
  function think(sv, dt) {
    const b = sv.bot;
    if (sv.hung) return;
    if (sv.carried) { wiggle(sv, dt / b.wigT); return; }
    sense(sv, b);
    if (sv.hidden) { inLocker(sv, b); return; }
    if (sv.hp <= 0) { crawl(sv, b, dt); return; }
    b.want = false;
    if (b.nudge) {   // hing fest: kurz einen Schritt zur Seite
      if (T > b.nudge.t) b.nudge = null;
      else { sv.running = false; moveAgent(sv, b.nudge.x, b.nudge.y, survSpeed(sv, false), dt); return; }
    }
    const chased = K.mode === 'chase' && K.target === sv;
    if (chased && !b.wasChased) { b.roll = Math.random(); b.locker = null; }
    b.wasChased = chased;
    const act = K.act ? K.act.kind : '';
    const harmless = !!K.carry || act === 'stun' || act === 'wipe' || act === 'pick' || act === 'hook' || (K.mode === 'fetch' && b.kd > 3.5);
    const cone = b.kd < 1.9 || Math.abs(angDiff(Math.atan2(sv.y - K.y, sv.x - K.x), K.dir)) < CFG.viewA + .2;
    // Entdeckt oder gejagt: nach einer Schrecksekunde rennen (bei der Arbeit bemerkt er den Killer später)
    const see = sv.work || sv.heal ? C.workSee : CFG.viewR + .5;
    if (chased || (b.los && !harmless && ((cone && b.kd < see) || b.kd < 3.5))) {
      if (b.trigT < 0) b.trigT = T;
      if (T < b.fleeUntil + 3 || T - b.trigT >= b.react) b.fleeUntil = T + 1;
    } else if (T > b.fleeUntil + 2) b.trigT = -1;
    const hear = C.hear && b.kd < C.hear + (b.mode === 'evade' ? 1.5 : 0);
    const mode = T < b.fleeUntil ? 'flee' : b.known && !harmless && (hear || (!sv.work && ((b.los && b.kd < 9) || b.kd < 4))) ? 'evade' : 'job';
    if (mode !== b.mode) { if (mode === 'job') b.pauseT = T + rand(C.pause[0], C.pause[1]); b.mode = mode; b.ft = null; b.et = null; b.hold = null; sv.path = null; if (mode !== 'job') planT = Math.min(planT, T - .3); }
    if (T - planT > .4) plan();
    if (mode === 'flee') flee(sv, b, chased, dt);
    else if (mode === 'evade') evade(sv, b, dt);
    else doJob(sv, b, dt);
    // Kein Hängenbleiben: will er laufen und kommt nicht vom Fleck, Weg verwerfen und einen Schritt zur Seite
    if (T >= b.chkT) {
      b.chkT = T + .75;
      const stuck = b.want && !sv.act && hyp(sv.x - b.px, sv.y - b.py) < .12;
      b.still = stuck ? b.still + 1 : 0; b.px = sv.x; b.py = sv.y;
      if (b.still >= 2) {
        b.still = 0; b.stuckN++; sv.path = null; sv.repathT = 0; b.ft = null; b.et = null; resolve(sv);
        // steckt er in einer Wand (eingeklemmt), auf die nächste freie Kachel setzen
        if (circleHit(sv.x, sv.y, sv.r - .06)) { const c = nearestWalk(sv.x | 0, sv.y | 0); if (c) { sv.x = c[0] + .5; sv.y = c[1] + .5; } }
        if (b.job && b.job.kind === 'task') b.avoid.set(b.job.o, T + 15);
        for (let k = 0; k < 8; k++) { const a = rand(0, TAU), x = sv.x + Math.cos(a) * 1.2, y = sv.y + Math.sin(a) * 1.2; if (!circleHit(x, y, sv.r) && lineWalk(sv.x, sv.y, x, y, sv.r)) { b.nudge = { x, y, t: T + .6 }; break; } }
        replan(b);
      }
    }
  }
  return Object.assign(B, { attach, give, take, plan, think });
})();

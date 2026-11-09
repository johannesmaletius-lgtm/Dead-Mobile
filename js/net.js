'use strict';
/* Dead Mobile – Netz: Räume mit bis zu 3 Spielern. Transport über PeerJS (WebRTC, wird erst bei Bedarf geladen)
   oder BroadcastChannel (?net=local: mehrere Tabs im selben Browser, für Tests). Eigener PeerJS-Server: ?peer=host:port
   Stern: Clients reden nur mit dem Host (ID 0), der vergibt die IDs 1 und 2. Nachrichten = JSON-Objekte mit Typ t.
   API:  Net.host(ich) → Promise<code>        Net.join(code, ich) → Promise<meineId>     ich = { name, skin }
         Net.send(msg, an?)  Host: an alle Clients | an = ID | an = [IDs];  Client: immer an den Host
         Net.on(t, fn(msg, von)) / Net.off(t, fn)    Net.leave()
         Net.isHost, Net.myId, Net.code, Net.peers (alle Spieler im Raum inkl. mir: [{ id, name, skin }]),
         Net.active (im Raum), Net.phase ('off' | 'connecting' | 'lobby' | 'game'), Net.game (Startdaten)
   Ereignisse über Net.on: 'peers' (Liste geändert), 'join' (peer), 'leave' (peer, grund), 'close' (grund, text)
   Spiel-Haken für die Synchronisierung: Net.onGameStart(fn(info)), Net.onGameEnd(fn(grund)) – geben eine Abmeldefunktion zurück.
   Reservierte Typen (nicht selbst senden): hello welcome reject peers ping bye ~ join leave close */
const Net = (() => {
  const PROTO = 1, MAXP = 3, PREFIX = 'deadmobile-', ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const LIBS = ['https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js', 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js'];
  const URLP = new URLSearchParams(location.search);
  const LOCAL = URLP.get('net') === 'local';
  const TIMEOUT = 6500, CHUNK = 4000;
  const SYS = new Set(['hello', 'welcome', 'reject', 'peers', 'ping', 'bye', '~', 'join', 'leave', 'close']);
  const TEXT = {
    offline: 'Online-Spiel nicht verfügbar (keine Internetverbindung?)',
    browser: 'Dein Browser unterstützt kein Online-Spiel.',
    notfound: 'Raum nicht gefunden',
    full: 'Raum ist voll (max. 3)',
    running: 'In diesem Raum läuft gerade ein Spiel.',
    version: 'Andere Spielversion – bitte beide neu laden.',
    timeout: 'Zeitüberschreitung – der Raum antwortet nicht.',
    code: 'Der Code hat 4 Buchstaben (ohne I und O).',
    taken: 'Kein freier Raumcode – bitte nochmal versuchen.',
    lost: 'Verbindung verloren',
    hostleft: 'Host hat den Raum verlassen',
    aborted: 'Abgebrochen',
  };
  const fail = code => { const e = new Error(TEXT[code] || code); e.code = code; return e; };
  const now = () => performance.now();
  const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14);
  const cleanSkin = s => /^[a-z]{2,12}$/.test(s) ? s : 'cop';
  const newCode = () => { let c = ''; for (let i = 0; i < 4; i++) c += ABC[(Math.random() * ABC.length) | 0]; return c; };
  const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
  const okCode = c => c.length === 4 && [...c].every(ch => ABC.includes(ch));

  /* ---------- PeerJS nachladen (zwei CDNs) ---------- */
  let libP = null;
  function loadScript(src, ms) {
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.async = true;
      const to = setTimeout(() => { s.remove(); rej(new Error('timeout')); }, ms);
      s.onload = () => { clearTimeout(to); res(); };
      s.onerror = () => { clearTimeout(to); s.remove(); rej(new Error('load')); };
      document.head.appendChild(s);
    });
  }
  function loadLib() {
    if (window.Peer) return Promise.resolve();
    if (navigator.onLine === false && !URLP.get('peer')) return Promise.reject(fail('offline'));
    return libP || (libP = (async () => {
      for (const u of LIBS) { try { await loadScript(u, 9000); } catch (e) {} if (window.Peer) return; }
      libP = null; throw fail('offline');
    })());
  }

  /* ---------- Verbindung (vom Transport geliefert): { send(o), close(), onmsg, onclose } ---------- */
  function wrapDC(dc) {
    const c = { onmsg: null, onclose: null, dead: false }; let acc = '';
    c.send = o => {
      if (c.dead || !dc.open) return;
      const s = JSON.stringify(o);
      // Der JSON-Kanal von PeerJS verträgt nur ~16 KB je Nachricht: größere in Stücke teilen (Kanal ist geordnet)
      if (s.length <= CHUNK) { dc.send(o); return; }
      const n = Math.ceil(s.length / CHUNK);
      for (let i = 0; i < n; i++) dc.send({ t: '~', i, n, s: s.slice(i * CHUNK, (i + 1) * CHUNK) });
    };
    c.close = () => { if (c.dead) return; c.dead = true; try { dc.close(); } catch (e) {} };
    dc.on('data', d => {
      if (!d || typeof d !== 'object') return;
      if (d.t === '~') { if (d.i === 0) acc = ''; acc += d.s; if (d.i === d.n - 1) { const s = acc; acc = ''; try { d = JSON.parse(s); } catch (e) { return; } } else return; }
      if (c.onmsg) c.onmsg(d);
    });
    dc.on('close', () => { if (c.dead) return; c.dead = true; if (c.onclose) c.onclose(); });
    dc.on('error', e => console.warn('Netz:', e && (e.type || e.message)));
    return c;
  }

  /* ---------- Transport 1: PeerJS (je Sitzung eine neue Instanz) ---------- */
  const makePJ = () => ({
    peer: null,
    opts() {
      const o = { debug: 0 }, p = URLP.get('peer'), m = p && p.match(/^([\w.\-]+)(?::(\d+))?$/);
      if (m) Object.assign(o, { host: m[1], port: +(m[2] || 9000), path: '/', secure: false });
      return o;
    },
    // Peer anmelden; löst bei 'open' auf
    start(id) {
      return new Promise((res, rej) => {
        let p;
        try { p = id ? new Peer(id, this.opts()) : new Peer(this.opts()); } catch (e) { rej(fail('browser')); return; }
        this.peer = p;
        let ok = false, tries = 0;
        const to = setTimeout(() => { if (!ok) { this.stop(); rej(fail('offline')); } }, 10000);
        p.on('open', () => { ok = true; tries = 0; clearTimeout(to); res(p); });
        p.on('error', e => {
          if (ok) return;   // nach dem Öffnen: Fehler gehen an die Verbindungen (peer-unavailable) bzw. Neuverbindung
          clearTimeout(to); this.stop();
          rej(fail(e.type === 'unavailable-id' ? 'taken' : e.type === 'browser-incompatible' ? 'browser' : 'offline'));
        });
        // Signalserver weg (Verbindungen bleiben): ein paar Mal neu anmelden, damit weitere Spieler beitreten können
        p.on('disconnected', () => { if (ok && this.peer === p && !p.destroyed && tries++ < 5) setTimeout(() => { if (this.peer === p && !p.destroyed && p.disconnected) try { p.reconnect(); } catch (e) {} }, 1500 * tries); });
      });
    },
    async listen(code, onConn) {
      await loadLib();
      const p = await this.start(PREFIX + code);
      p.on('connection', dc => {
        const c = wrapDC(dc); let opened = false;
        dc.on('open', () => { opened = true; onConn(c); });
        setTimeout(() => { if (!opened) c.close(); }, 15000);
      });
    },
    async connect(code) {
      await loadLib();
      const p = await this.start();
      return new Promise((res, rej) => {
        const dc = p.connect(PREFIX + code, { reliable: true, serialization: 'json' }), c = wrapDC(dc);
        let done = false;
        const end = (e, v) => { if (done) return; done = true; clearTimeout(to); e ? rej(e) : res(v); };
        const to = setTimeout(() => end(fail('timeout')), 12000);
        dc.on('open', () => end(null, c));
        dc.on('close', () => end(fail('notfound')));
        p.on('error', e => { if (e.type === 'peer-unavailable') end(fail('notfound')); else if (!done && /network|server|socket/.test(e.type)) end(fail('offline')); });
      });
    },
    stop() { const p = this.peer; this.peer = null; if (p) try { p.destroy(); } catch (e) {} },
  });

  /* ---------- Transport 2: BroadcastChannel (gleiche Verbindungs-Objekte, JSON wie bei PeerJS) ---------- */
  const makeBC = () => ({
    ch: null, me: Math.random().toString(36).slice(2, 10), conns: new Map(), listening: false, onConn: null, cb: null,
    open(code) {
      if (typeof BroadcastChannel === 'undefined') throw fail('browser');
      this.ch = new BroadcastChannel(PREFIX + code);
      this.ch.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (er) { return; } this.rx(m); };
    },
    post(k, to, d) { if (this.ch) this.ch.postMessage(JSON.stringify({ k, from: this.me, to, d })); },
    conn(tok) {
      const c = { onmsg: null, onclose: null, dead: false };
      c.send = o => { if (!c.dead) this.post('m', tok, o); };
      c.close = () => { if (c.dead) return; c.dead = true; this.post('x', tok); this.conns.delete(tok); };
      this.conns.set(tok, c); return c;
    },
    rx(m) {
      if (m.to !== '*' && m.to !== this.me) return;
      const c = this.conns.get(m.from);
      switch (m.k) {
        case 'probe': if (this.listening) this.post('here', m.from); break;
        case 'knock': if (this.listening && !c) { const n = this.conn(m.from); this.post('ok', m.from); this.onConn(n); } break;
        case 'here': case 'ok': if (this.cb) this.cb(m); break;
        case 'm': if (c && c.onmsg) c.onmsg(m.d); break;
        case 'x': if (c) { this.conns.delete(m.from); c.dead = true; if (c.onclose) c.onclose(); } break;
      }
    },
    ask(k, ms) { return new Promise(res => { const to = setTimeout(() => { this.cb = null; res(null); }, ms); this.cb = m => { clearTimeout(to); this.cb = null; res(m); }; this.post(k, '*'); }); },
    async listen(code, onConn) {
      this.open(code);
      if (await this.ask('probe', 300)) { this.stop(); throw fail('taken'); }   // Code gehört schon einem anderen Tab
      this.onConn = onConn; this.listening = true;
    },
    async connect(code) {
      this.open(code);
      const m = await this.ask('knock', 1500);
      if (!m) { this.stop(); throw fail('notfound'); }
      return this.conn(m.from);
    },
    stop() { this.listening = false; this.cb = null; this.onConn = null; this.conns.clear(); if (this.ch) { try { this.ch.close(); } catch (e) {} this.ch = null; } },
  });
  const makeTr = () => LOCAL ? makeBC() : makePJ();

  /* ---------- Raum-Logik (unabhängig vom Transport) ---------- */
  const N = { isHost: false, myId: -1, code: null, peers: [], active: false, phase: 'off', game: null, transport: LOCAL ? 'local' : 'peer', TEXT };
  const hand = {}, startFns = [], endFns = [];
  let tr = null, gen = 0, beat = 0, lastBeat = 0;
  const links = new Map();   // Host: Client-ID → Link; Client: 0 → Link zum Host
  const pend = new Set();    // Host: Verbindungen, die sich noch nicht vorgestellt haben
  function emit(t, a, b) { for (const fn of (hand[t] || []).slice()) { try { fn(a, b); } catch (e) { console.error(e); } } }
  function tx(L, o) { L.lastTx = now(); L.c.send(o); }
  const sortPeers = () => N.peers.sort((a, b) => a.id - b.id);
  function bcast(o, except) { for (const L of links.values()) if (L.id !== except) tx(L, o); }

  function startBeat() {
    clearInterval(beat); lastBeat = now();
    beat = setInterval(() => {
      const t = now(), lag = t - lastBeat > 3000; lastBeat = t;
      for (const L of [...links.values(), ...pend]) {
        if (lag) L.lastRx = t;   // wir selbst hingen (Tab im Hintergrund) – dem anderen nichts vorwerfen
        else if (t - L.lastRx > TIMEOUT) { if (N.isHost) drop(L, 'lost'); else gone('lost'); continue; }
        if (L.id >= 0 && t - (L.lastTx || 0) > 900) tx(L, { t: 'ping' });
      }
    }, 1000);
  }
  function reset() {
    clearInterval(beat); beat = 0;
    for (const L of [...links.values(), ...pend]) L.c.close();
    links.clear(); pend.clear();
    if (tr) tr.stop(); tr = null;
    Object.assign(N, { isHost: false, myId: -1, code: null, peers: [], active: false, phase: 'off', game: null });
  }
  function endGame(why) { if (N.phase !== 'game') return; N.phase = N.active ? 'lobby' : 'off'; N.game = null; for (const fn of endFns.slice()) { try { fn(why); } catch (e) { console.error(e); } } }
  // Client: Host weg
  function gone(why) { if (!N.active || N.isHost) return; endGame(why); reset(); emit('close', why, TEXT[why]); }

  /* Host */
  function onConn(c) {
    const L = { c, id: -1, lastRx: now(), lastTx: 0, peer: null };
    pend.add(L);
    c.onmsg = m => rxHost(L, m);
    c.onclose = () => drop(L, 'lost');
    setTimeout(() => { if (L.id < 0 && pend.has(L)) { pend.delete(L); c.close(); } }, 10000);
  }
  function refuse(L, why) { L.refused = true; pend.delete(L); tx(L, { t: 'reject', why }); setTimeout(() => L.c.close(), 600); }
  function welcome(L) { tx(L, { t: 'welcome', v: PROTO, id: L.id, code: N.code, peers: N.peers }); }
  function rxHost(L, m) {
    if (!m || typeof m.t !== 'string') return;
    L.lastRx = now();
    if (L.id < 0) {
      if (m.t !== 'hello' || L.refused) return;
      if (m.v !== PROTO) return refuse(L, 'version');
      if (N.phase === 'game') return refuse(L, 'running');
      let id = 1; while (links.has(id)) id++;
      if (id >= MAXP) return refuse(L, 'full');
      pend.delete(L); L.id = id; L.peer = { id, name: cleanName(m.name), skin: cleanSkin(m.skin) };
      links.set(id, L); N.peers.push(L.peer); sortPeers();
      welcome(L); bcast({ t: 'peers', peers: N.peers }, id);
      emit('join', L.peer); emit('peers', N.peers);
      return;
    }
    switch (m.t) {
      case 'hello': welcome(L); return;           // Wiederholung (falls das erste welcome verloren ging)
      case 'bye': drop(L, 'left'); return;
      case 'ping': return;
    }
    if (!SYS.has(m.t)) emit(m.t, m, L.id);
  }
  function drop(L, why) {
    if (L.gone) return; L.gone = true; pend.delete(L);
    if (why === 'lost' && L.id >= 0) tx(L, { t: 'bye', why: 'lost' });   // falls er doch noch zuhört: richtige Meldung
    if (L.id >= 0 && links.get(L.id) === L) {
      links.delete(L.id); N.peers = N.peers.filter(p => p.id !== L.id);
      bcast({ t: 'peers', peers: N.peers });
      emit('leave', L.peer, why); emit('peers', N.peers);
    }
    L.c.close();
  }
  async function host(me = {}) {
    reset(); const g = ++gen, t = tr = makeTr(); N.phase = 'connecting';
    let code;
    for (let i = 0; ; i++) {
      code = newCode();
      try { await t.listen(code, c => { if (g === gen) onConn(c); else c.close(); }); break; }
      catch (e) { if (g !== gen) { t.stop(); throw fail('aborted'); } if (e.code === 'taken' && i < 6) continue; reset(); throw e; }
    }
    if (g !== gen) { t.stop(); throw fail('aborted'); }
    Object.assign(N, { isHost: true, myId: 0, code, active: true, phase: 'lobby', peers: [{ id: 0, name: cleanName(me.name), skin: cleanSkin(me.skin) }] });
    startBeat(); emit('peers', N.peers);
    return code;
  }

  /* Client */
  async function join(code, me = {}) {
    code = normCode(code);
    if (!okCode(code)) throw fail('code');
    reset(); const g = ++gen, t = tr = makeTr(); N.phase = 'connecting';
    let c;
    try { c = await t.connect(code); } catch (e) { t.stop(); if (g === gen) reset(); throw g === gen ? e : fail('aborted'); }
    if (g !== gen) { c.close(); t.stop(); throw fail('aborted'); }
    return new Promise((res, rej) => {
      const L = { c, id: 0, lastRx: now(), lastTx: 0 };
      let done = false;
      const hello = () => tx(L, { t: 'hello', v: PROTO, name: cleanName(me.name), skin: cleanSkin(me.skin) });
      const end = (e, v) => { if (done) return; done = true; clearInterval(rep); clearTimeout(to); if (e) { if (g === gen) reset(); rej(g === gen ? e : fail('aborted')); } else res(v); };
      const rep = setInterval(() => { if (g !== gen) end(fail('aborted')); else hello(); }, 1000);
      const to = setTimeout(() => end(fail('timeout')), 9000);
      c.onclose = () => { if (!done) end(fail('lost')); else if (links.get(0) === L) gone('hostleft'); };
      c.onmsg = m => {
        if (!m || typeof m.t !== 'string') return;
        L.lastRx = now();
        if (!done) {
          if (m.t === 'welcome' && g === gen) {
            Object.assign(N, { isHost: false, myId: m.id, code, peers: m.peers || [], active: true, phase: 'lobby' });
            links.set(0, L); startBeat(); end(null, m.id); emit('peers', N.peers);
          } else if (m.t === 'reject') end(fail(TEXT[m.why] ? m.why : 'notfound'));
          return;
        }
        switch (m.t) {
          case 'peers': N.peers = m.peers || []; emit('peers', N.peers); return;
          case 'bye': gone(m.why === 'lost' ? 'lost' : 'hostleft'); return;
          case 'ping': case 'welcome': return;
        }
        if (!SYS.has(m.t)) emit(m.t, m, 0);
      };
      hello();
    });
  }

  function leave() {
    gen++;
    if (N.phase === 'game') endGame('left');
    for (const L of links.values()) tx(L, { t: 'bye' });
    // erst kurz danach schließen, damit das 'bye' noch rausgeht (beim Schließen des Tabs bleibt dafür keine Zeit)
    const ls = [...links.values(), ...pend], t = tr;
    links.clear(); pend.clear(); tr = null;
    reset();
    if (ls.length) setTimeout(() => { for (const L of ls) L.c.close(); if (t) t.stop(); }, 150);
    else if (t) t.stop();
  }
  function send(o, to) {
    if (!N.active) return;
    if (!N.isHost) { const L = links.get(0); if (L) tx(L, o); return; }
    if (to == null) bcast(o);
    else for (const id of [].concat(to)) { const L = links.get(id); if (L) tx(L, o); }
  }
  function on(t, fn) { (hand[t] = hand[t] || []).push(fn); return () => off(t, fn); }
  function off(t, fn) { const a = hand[t]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
  const hook = arr => fn => { arr.push(fn); return () => { const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1); }; };
  // Von der Lobby aufgerufen: Spiel läuft (alle haben startTeam aufgerufen) bzw. ist vorbei
  function gameStarted(info) { N.phase = 'game'; N.game = info; for (const fn of startFns.slice()) { try { fn(info); } catch (e) { console.error(e); } } }

  // Tab wird geschlossen: das 'bye' so früh wie möglich losschicken (beforeunload kommt vor pagehide), dann aufräumen
  window.addEventListener('beforeunload', () => { for (const L of links.values()) tx(L, { t: 'bye' }); });
  window.addEventListener('pagehide', () => { if (N.active) leave(); });
  return Object.assign(N, { host, join, leave, send, on, off, onGameStart: hook(startFns), onGameEnd: hook(endFns), gameStarted, gameEnded: endGame, normCode, okCode, ABC, MAXP });
})();

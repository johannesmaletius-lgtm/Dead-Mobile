'use strict';
/* Dead Mobile – Team-Menü und Lobby: Name, Figur, mit Bots spielen, Raum erstellen/beitreten, Kartenwahl, Start.
   Bildschirme #team und #room liegen über der Titel-Demo (state bleibt 'title'). Start im Netz:
   Host sendet { t: 'start', map, spawn, roster: [{ id, name, skin, human }] }, alle rufen startTeam(map, roster, spawn).
   Weitere Lobby-Nachrichten: { t: 'lobby', map } (Kartenwahl), { t: 'back' } (Host kehrt zur Lobby zurück). */
const Lobby = (() => {
  const FB = { cop: ['#3f63b8', 'Polizist'], medic: ['#c3121f', 'Sanitäterin'], janitor: ['#6b7a30', 'Hausmeister'] };
  const skins = () => typeof SKINS !== 'undefined' && SKINS.length ? SKINS : ['cop', 'medic', 'janitor'];
  const skinName = s => (typeof SKIN_NAMES !== 'undefined' && SKIN_NAMES[s]) || (FB[s] && FB[s][1]) || s;
  // Alle Team-Karten; die großen zuerst (die erste ist Standard), danach der Rest in Ladereihenfolge
  const PREF = ['ferienlager', 'krankenhaus'];
  const teamMaps = () => { const ids = Object.keys(MAPS).filter(id => MAPS[id].team), rk = id => { const i = PREF.indexOf(id); return i < 0 ? PREF.length : i; }; return ids.map((id, i) => [rk(id), i, id]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]); };
  const mapName = id => (MAPS[id] && MAPS[id].name) || id;
  const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14);
  const mySkin = () => skins().includes(save.skin) ? save.skin : skins()[0];
  const me = () => ({ name: cleanName(save.name), skin: mySkin() });
  const shown = p => p.name || skinName(p.skin);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  let view = null;        // null | 'team' | 'room'
  let busy = false;       // Verbindungsaufbau läuft
  let net = false;        // läuft gerade ein Online-Spiel (oder dessen Endbildschirm)?
  let last = null;        // letztes Offline-Spiel { map, roster, opt } für „Nochmal"
  let roomMap = null;
  let roomKiller = -1;    // Wer spielt den Killer: -1 = KI, sonst die ID eines Spielers im Raum (der Host bestimmt)
  let built = false, noticeT = 0;

  /* ---------- Porträts: skinPortrait(skin, px) aus figures.js, sonst Farbkreis mit Silhouette ---------- */
  const pcache = {};
  function portrait(skin, css) {
    const px = Math.round(css * Math.min(3, Math.max(1, window.devicePixelRatio || 1)));
    if (typeof skinPortrait === 'function') {
      try { const r = skinPortrait(skin, px); if (typeof r === 'string') return r; if (r && r.toDataURL) return r.toDataURL(); } catch (e) {}
    }
    const key = skin + '@' + px; if (pcache[key]) return pcache[key];
    const c = document.createElement('canvas'); c.width = c.height = px;
    const x = c.getContext('2d'), r = px / 2, col = (FB[skin] || ['#8a8478'])[0];
    x.fillStyle = '#0b0d12'; x.beginPath(); x.arc(r, r, r, 0, TAU); x.fill();
    x.save(); x.beginPath(); x.arc(r, r, r * .92, 0, TAU); x.clip();
    const g = x.createRadialGradient(r, r * .62, r * .1, r, r, r * 1.05); g.addColorStop(0, col); g.addColorStop(1, '#07080c');
    x.fillStyle = g; x.fillRect(0, 0, px, px);
    x.fillStyle = 'rgba(6,7,12,.55)';
    x.beginPath(); x.arc(r, r * .8, r * .3, 0, TAU); x.fill();
    x.beginPath(); x.ellipse(r, r * 1.62, r * .64, r * .5, 0, 0, TAU); x.fill();
    x.restore();
    x.strokeStyle = 'rgba(235,231,220,.18)'; x.lineWidth = Math.max(1, px * .025); x.beginPath(); x.arc(r, r, r * .95, 0, TAU); x.stroke();
    return (pcache[key] = c.toDataURL());
  }
  const por = (skin, css, cls) => { const i = el('img', cls || 'por'); i.alt = ''; i.draggable = false; i.src = portrait(skin, css); return i; };

  /* ---------- Hilfen für Bildschirme ---------- */
  function setMsg(id, txt, kind) { const m = $(id); m.textContent = txt || ''; m.className = 'nmsg' + (kind ? ' ' + kind : ''); }
  function notice(txt) {
    const n = $('#notice'); n.textContent = txt; n.hidden = false; n.classList.remove('out');
    clearTimeout(noticeT); noticeT = setTimeout(() => { n.classList.add('out'); noticeT = setTimeout(() => { n.hidden = true; }, 400); }, 6000);
  }
  function hideNotice() { clearTimeout(noticeT); $('#notice').hidden = true; }
  function setBusy(on, txt) {
    busy = on;
    for (const s of ['#tBots', '#tKill', '#tHost', '#tJoin', '#tName', '#tCode']) $(s).disabled = on;
    for (const b of document.querySelectorAll('#tSkins .skin, #tMaps button')) b.disabled = on;
    setMsg('#tMsg', txt, on ? 'busy' : '');
  }
  function screens(v) {
    view = v;
    $('#team').hidden = v !== 'team'; $('#room').hidden = v !== 'room';
    if (v) { $('#title').hidden = true; hideNotice(); }
  }
  // Spielwelt zurück auf die Titel-Demo (Schule, der Killer streift umher)
  function titleScene() {
    useMap('schule'); MODE = 'solo'; TUT = null; demoInit(); state = 'title';
    for (const k in keys) keys[k] = 0; joy.id = null;
    $('#end').hidden = true; $('#pause').hidden = true; $('#pauseBtn').hidden = true; $('#tutCard').hidden = true; netPaused = false;
  }
  // Pause- und Endbildschirm: im Team-Spiel „Zum Menü" bzw. „Raum verlassen", online kein Neustart
  function gameButtons(on) {
    $('#restart').hidden = on && net;
    const lp = $('#leaveP'), el2 = $('#endLeave');
    lp.hidden = el2.hidden = !on;
    lp.setAttribute('aria-label', net ? 'Raum verlassen' : 'Zum Menü');
    el2.lastChild.textContent = net ? 'Raum verlassen' : 'Menü';
  }

  /* ---------- Team-Bildschirm ---------- */
  function build() {
    if (built) return; built = true;
    const box = $('#tSkins');
    for (const s of skins()) {
      const b = el('button', 'skin'); b.type = 'button'; b.dataset.skin = s; b.setAttribute('role', 'radio');
      b.append(por(s, 76), el('span', '', skinName(s)));
      b.addEventListener('click', () => { save.skin = s; persist(); renderSkins(); });
      box.append(b);
    }
  }
  function renderSkins() {
    const cur = mySkin();
    for (const b of document.querySelectorAll('#tSkins .skin')) b.setAttribute('aria-checked', b.dataset.skin === cur ? 'true' : 'false');
    $('#tName').placeholder = skinName(cur);
  }
  const pickMap = () => { const tm = teamMaps(); return tm.includes(save.map) ? save.map : tm[0] || 'schule-team'; };
  // Kartenwahl als Blätterknopf ‹ Name › (braucht bei beliebig vielen Karten nur eine Zeile); mit nur einer Karte: Name
  function mapPicker(box, cur, choose) {
    const tm = teamMaps(), i = Math.max(0, tm.indexOf(cur)), had = box.contains(document.activeElement) && document.activeElement.dataset.d;
    box.textContent = '';
    if (tm.length < 2 || !choose) { box.append(el('span', 'mapname', mapName(cur))); return; }
    const sel = el('div', 'mapsel'), arrow = (d, lbl, path) => {
      const b = el('button', 'arr'); b.type = 'button'; b.dataset.d = d; b.setAttribute('aria-label', lbl);
      b.innerHTML = `<svg viewBox="0 0 24 24"><path d="${path}"/></svg>`;
      b.addEventListener('click', () => choose(tm[(i + d + tm.length) % tm.length]));
      return b;
    };
    sel.append(arrow(-1, 'Vorige Karte', 'M15 5l-7 7 7 7'), el('span', 'mapname', mapName(tm[i])), arrow(1, 'Nächste Karte', 'M9 5l7 7-7 7'));
    box.append(sel);
    if (had) { const b = sel.querySelector(`[data-d="${had}"]`); if (b) b.focus(); }   // Tastatur: Fokus bleibt auf dem Pfeil
  }
  // Team-Menü: Kartenwahl fürs Bot-Spiel (und als Vorgabe für einen neuen Raum), nur bei mehreren Team-Karten
  function renderMaps() {
    const mb = $('#tMaps'); mb.hidden = teamMaps().length < 2;
    if (mb.hidden) return;
    mapPicker(mb, pickMap(), id => { save.map = id; persist(); renderMaps(); });
    mb.prepend(el('span', 'lbl', 'Karte'));
  }
  function open(msg, isErr) {
    build(); screens('team');
    $('#tName').value = cleanName(save.name);
    renderSkins(); renderMaps();
    if (!busy) setMsg('#tMsg', msg, isErr ? 'err' : '');
  }
  function toTitle() {
    if (busy) { busy = false; setBusy(false); }
    net = false; screens(null); titleScene(); gameButtons(false);
    $('#title').hidden = false; showTitle();
  }
  function back() {
    if (view === 'room') { Net.leave(); open(); return; }
    if (busy) { Net.leave(); setBusy(false); return; }   // Verbindungsaufbau abbrechen
    toTitle();
  }

  /* ---------- Spielen ---------- */
  // roster: [{ id, name, skin, kind }]; online kommt spawn vom Host
  function launch(map, roster, spawn, online, opt) {
    screens(null); hideNotice(); net = online;
    startTeam(map, roster, spawn, opt);
    gameButtons(true);
  }
  // Offline als Killer: alle drei Überlebenden sind Bots
  function playKiller() {
    if (busy) return;
    const map = pickMap(), roster = skins().slice(0, 3).map((s, i) => ({ id: i, kind: 'bot', skin: s })), opt = { killer: 'local' };
    last = { map, roster, opt };
    launch(map, roster, undefined, false, opt);
  }
  function playBots() {
    if (busy) return;
    const m = me(), free = skins().filter(s => s !== m.skin);
    const map = pickMap(), roster = [Object.assign({ id: 0, kind: 'local' }, m), { id: 1, kind: 'bot', skin: free[0] }, { id: 2, kind: 'bot', skin: free[1] }];
    last = { map, roster };
    launch(map, roster, undefined, false);
  }
  async function create() {
    if (busy) return;
    setBusy(true, 'Raum wird erstellt');
    try { await Net.host(me()); } catch (e) { if (e.code !== 'aborted') { setBusy(false); setMsg('#tMsg', e.message, 'err'); } return; }
    setBusy(false); roomMap = pickMap(); roomKiller = -1; showRoom();
  }
  async function join() {
    if (busy) return;
    const inp = $('#tCode'), code = Net.normCode(inp.value);
    if (!Net.okCode(code)) { setMsg('#tMsg', Net.TEXT.code, 'err'); inp.focus(); return; }
    inp.blur(); roomMap = null; roomKiller = -1; setBusy(true, 'Verbinde mit Raum ' + code);
    try { await Net.join(code, me()); } catch (e) { if (e.code !== 'aborted') { setBusy(false); setMsg('#tMsg', e.message, 'err'); } return; }
    setBusy(false); showRoom();
  }

  /* ---------- Raum (Lobby) ---------- */
  // 3 Plätze, Platz = ID; freie Plätze werden Bots (mit den noch freien Figuren)
  // (Bots bekommen IDs, die kein Spieler hat). Wer den Killer spielt, belegt keinen der drei Plätze.
  const killerPeer = () => Net.peers.find(p => p.id === roomKiller) || null;
  function seats() {
    const ps = Net.peers.filter(p => p.id !== roomKiller).slice(0, 3), used = new Set(ps.map(p => p.skin)), free = skins().filter(s => !used.has(s));
    const ids = [0, 1, 2, 3].filter(i => !Net.peers.some(p => p.id === i)), out = ps.map(p => ({ id: p.id, name: p.name, skin: p.skin, human: true }));
    while (out.length < 3) out.push({ id: ids.shift(), name: '', skin: free.shift() || skins()[out.length % skins().length], human: false });
    return out;
  }
  // Zu viert muss einer der Killer sein
  const canStart = () => Net.peers.length <= 3 || !!killerPeer();
  let lastIds = '';
  function showRoom() { screens('room'); lastIds = ''; renderRoom(); }
  function renderRoom() {
    if (view !== 'room' || !Net.active) return;
    const host = Net.isHost, list = $('#rList'), ss = seats(), ids = Net.peers.map(p => p.id).join();
    $('#rCode').textContent = Net.code;
    $('#rCode').setAttribute('aria-label', 'Raumcode ' + Net.code.split('').join(' '));
    list.textContent = '';
    for (const s of ss) {
      const li = el('li', 'slot' + (s.human ? '' : ' bot') + (s.id === Net.myId ? ' me' : ''));
      if (s.human && lastIds && !lastIds.split(',').includes(String(s.id))) li.classList.add('new');
      const nm = el('div', 'nm');
      nm.append(el('b', '', s.human ? shown(s) : 'Bot'), el('small', '', s.human && !s.name ? 'Spieler ' + (s.id + 1) : skinName(s.skin)));
      li.append(por(s.skin, 46), nm);
      if (s.id === Net.myId) li.append(el('span', 'tag me', 'Du'));
      else if (s.human && s.id === 0) li.append(el('span', 'tag', 'Host'));
      else if (!s.human) li.append(el('span', 'tag', 'frei'));
      list.append(li);
    }
    lastIds = ids;
    // Killer: KI oder ein Spieler (der Host blättert durch)
    const kp = killerPeer(), kb = $('#rKiller'), opts = [-1, ...Net.peers.map(p => p.id)], ki = Math.max(0, opts.indexOf(roomKiller));
    kb.textContent = '';
    const kn = el('span', 'mapname', kp ? shown(kp) + (kp.id === Net.myId ? ' (du)' : '') : 'KI');
    if (host && Net.peers.length > 0) {
      const sel = el('div', 'mapsel'), arrow = (d, lbl, path) => {
        const b = el('button', 'arr'); b.type = 'button'; b.setAttribute('aria-label', lbl); b.innerHTML = `<svg viewBox="0 0 24 24"><path d="${path}"/></svg>`;
        b.addEventListener('click', () => { roomKiller = opts[(ki + d + opts.length) % opts.length]; sendLobby(); renderRoom(); });
        return b;
      };
      sel.append(arrow(-1, 'Voriger', 'M15 5l-7 7 7 7'), kn, arrow(1, 'Nächster', 'M9 5l7 7-7 7')); kb.append(sel);
    } else kb.append(kn);
    $('#rStart').disabled = !canStart();
    $('#rCount').textContent = Net.peers.length + ' / 4';
    $('#rHint').textContent = !canStart() ? 'Zu viert muss einer von euch der Killer sein.' : host ? 'Sag deinen Freunden den Code. Freie Plätze übernehmen Bots.' : 'Du bist drin. Der Host wählt Karte und Killer und startet.';
    if (roomMap) mapPicker($('#rMaps'), roomMap, host && (id => { roomMap = id; save.map = id; persist(); sendLobby(); renderRoom(); }));
    else $('#rMaps').textContent = '…';
    $('#rStart').hidden = !host; $('#rWait').hidden = host;
  }
  const sendLobby = to => { if (Net.isHost) Net.send({ t: 'lobby', map: roomMap, killer: roomKiller }, to); };
  function hostStart() {
    if (!Net.isHost || view !== 'room' || !canStart()) return;
    const kp = killerPeer(), m = { t: 'start', map: roomMap, spawn: (Math.random() * 9973) | 0, roster: seats(), killer: kp ? kp.id : -1, kname: kp ? shown(kp) : '' };
    Net.send(m); begin(m);
  }
  // Alle (Host und Clients): Spiel mit den Daten des Hosts starten
  function begin(m) {
    if (!MAPS[m.map] || !Array.isArray(m.roster)) { Net.leave(); toTitle(); notice('Unbekannte Karte – bitte das Spiel neu laden.'); return; }
    const roster = m.roster.slice(0, 3).map(p => ({ id: p.id, name: cleanName(p.name), skin: p.skin, kind: p.human ? (p.id === Net.myId ? 'local' : 'remote') : 'bot' }));
    // Killer: ich ('local'), ein Mitspieler ('remote') oder die KI
    const opt = m.killer >= 0 ? { killer: m.killer === Net.myId ? 'local' : 'remote', killerId: m.killer, killerName: cleanName(m.kname) || 'Killer' } : {};
    launch(m.map, roster, m.spawn, true, opt);
    Net.gameStarted({ map: m.map, spawn: m.spawn, roster, killer: m.killer });
    if (opt.killer === 'remote') toast(opt.killerName + ' ist der Killer');
  }
  // Nach dem Spiel zurück in den Raum (Host nimmt alle mit)
  function toRoom() {
    if (Net.isHost) Net.send({ t: 'back' });
    Net.gameEnded('back');
    net = false; titleScene(); gameButtons(false); showRoom();
  }
  const inNetGame = () => net && Net.active;

  /* ---------- Knöpfe aus main.js ---------- */
  function again() {   // Endbildschirm „Nochmal" im Team-Modus
    if (inNetGame()) { toRoom(); return; }
    if (last) launch(last.map, last.roster, undefined, false, last.opt); else if (teamRoster) teamRestart(); else playBots();
  }
  function restart() { if (!inNetGame()) again(); }   // Pause-Menü „Neu starten" (online ausgeblendet)
  function leaveGame() { if (inNetGame()) Net.leave(); toTitle(); }
  // Tasten, solange ein Lobby-Bildschirm offen ist: Escape = zurück; sonst nichts an main.js durchreichen
  function key(e) {
    if (!view) return false;
    if (e.code === 'Escape') { e.preventDefault(); back(); }
    return true;
  }

  /* ---------- Netz-Ereignisse ---------- */
  Net.on('peers', () => { if (Net.isHost && roomKiller >= 0 && !killerPeer()) { roomKiller = -1; sendLobby(); } renderRoom(); });
  Net.on('join', p => sendLobby(p.id));
  Net.on('leave', p => { if (inNetGame() && state !== 'title') toast(shown(p) + ' hat das Spiel verlassen'); });
  Net.on('lobby', m => { if (Net.isHost) return; if (MAPS[m.map]) roomMap = m.map; roomKiller = m.killer >= 0 ? m.killer | 0 : -1; renderRoom(); });
  Net.on('start', m => { if (!Net.isHost) begin(m); });
  Net.on('back', () => { if (Net.isHost) return; if (view === 'room') Net.gameEnded('back'); else if (net) toRoom(); });
  Net.on('close', (why, txt) => {
    if (net) { toTitle(); notice(txt); }                       // mitten im Spiel: zurück zum Titel
    else if (view === 'room') open(txt, true);                 // in der Lobby: zurück zum Team-Bildschirm
    else if (view === 'team') setMsg('#tMsg', txt, 'err');
  });

  /* ---------- Verdrahtung ---------- */
  $('#teamBack').addEventListener('click', back);
  $('#roomBack').addEventListener('click', back);
  $('#tBots').addEventListener('click', playBots);
  $('#tKill').addEventListener('click', playKiller);
  $('#tHost').addEventListener('click', create);
  $('#tJoin').addEventListener('click', join);
  $('#rStart').addEventListener('click', hostStart);
  $('#leaveP').addEventListener('click', leaveGame);
  $('#endLeave').addEventListener('click', leaveGame);
  $('#notice').addEventListener('click', hideNotice);
  // Code antippen = kopieren (im Web als Einladungslink ?join=CODE, lokal nur den Code)
  $('#rCode').addEventListener('click', () => {
    const c = Net.code; if (!c || !navigator.clipboard) return;
    const web = /^https?:/.test(location.protocol), q = new URLSearchParams(location.search); q.set('join', c);
    navigator.clipboard.writeText(web ? location.origin + location.pathname + '?' + q : c).then(() => {
      $('#rHint').textContent = web ? 'Einladungslink kopiert.' : 'Code kopiert.'; setTimeout(renderRoom, 1800);
    }, () => {});
  });
  $('#tName').addEventListener('input', e => { save.name = cleanName(e.target.value); persist(); });
  $('#tName').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
  $('#tCode').addEventListener('input', e => { const v = Net.normCode(e.target.value).slice(0, 4); if (e.target.value !== v) e.target.value = v; if ($('#tMsg').classList.contains('err')) setMsg('#tMsg', ''); });
  $('#tCode').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); join(); } });
  // Handy: Bildschirmtastatur verdeckt die untere Hälfte – beim Tippen nur das aktive Feld oben zeigen
  for (const id of ['#tName', '#tCode']) {
    const f = $(id);
    f.addEventListener('focus', () => { if (isTouch) $('#team').classList.add(id === '#tName' ? 'kb-name' : 'kb-code'); });
    f.addEventListener('blur', () => $('#team').classList.remove('kb-name', 'kb-code'));
  }
  // Einladungslink ?join=CODE: Team-Bildschirm mit vorausgefülltem Code öffnen
  const inv = Net.normCode(new URLSearchParams(location.search).get('join'));
  if (Net.okCode(inv)) setTimeout(() => { if (state === 'title' && !view) { open(); $('#tCode').value = inv; } }, 0);

  return { open, again, restart, leaveGame, key, teamMaps, playKiller, get view() { return view; }, get net() { return net; }, get roomMap() { return roomMap; }, get roomKiller() { return roomKiller; }, setKiller(id) { if (Net.isHost) { roomKiller = id; sendLobby(); renderRoom(); } }, notice };
})();

// Netz-Test: Lobby und Verbindungen über die echte Oberfläche (Playwright, Klicks wie ein Mensch).
//   NODE_PATH="$(npm root -g)" node tools/nettest.js [index.html] [--peer <ordner>] [--port 9000] [--shots <ordner>] [--fonts <ordner>] [--only a,b,c]
//   a) BroadcastChannel (?net=local): Host + 2 Clients, volle Lobby, Verlassen/Wiederkommen, Start, Pause, Abbruch, Host weg
//   b) echtes PeerJS mit lokalem Signalserver (?peer=localhost:9000). <ordner> enthält node_modules/peer (Server) und
//      node_modules/peerjs (dist/peerjs.min.js). Die CDN-Adressen werden auf die lokale Datei umgeleitet.
//      Zusätzlich: Ausweich-CDN, kein Netz, falscher Code, Host verlässt das Spiel.
//   c) offline „Mit Bots spielen": 1 lokaler + 2 Bots
//   --shots: Bildschirmfotos der Lobby (900×450, deviceScaleFactor 2). --fonts: Ordner mit fonts.css + *.woff2 (sonst ohne Webfonts).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process'), http = require('http');

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else opt.file = args[i];
const FILE = path.resolve(opt.file || 'index.html'), URL0 = 'file://' + FILE;
const PORT = +(opt.port || 9000), SHOTS = opt.shots, FONTS = opt.fonts, ONLY = (opt.only || 'a,b,c').split(',');
const PEERDIR = opt.peer || process.env.PEER_DEPS;
const CDN1 = /unpkg\.com\/peerjs/, CDN2 = /cdn\.jsdelivr\.net\/npm\/peerjs/;

let fails = 0, oks = 0;
const ok = (c, msg) => { if (c) { oks++; console.log('  ✓ ' + msg); } else { fails++; console.log('  ✗ ' + msg); } return c; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newCtx(browser, cdn) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 450 }, deviceScaleFactor: 2 });
  if (FONTS) {
    await ctx.route(/fonts\.googleapis/, r => r.fulfill({ path: path.join(FONTS, 'fonts.css'), contentType: 'text/css' }));
    await ctx.route(/fonts\.gstatic/, r => r.fulfill({ path: path.join(FONTS, r.request().url().split('/').pop()), contentType: 'font/woff2' }).catch(() => r.abort()));
  } else await ctx.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  // PeerJS-CDNs: auf die lokale Datei umleiten (cdn = { 1: true|false, 2: true|false } je Seite über page.route überschreibbar)
  const lib = PEERDIR && path.join(PEERDIR, 'node_modules/peerjs/dist/peerjs.min.js');
  const serve = r => lib ? r.fulfill({ path: lib, contentType: 'application/javascript' }) : r.abort();
  await ctx.route(CDN1, r => (cdn && cdn[1] === false) ? r.abort() : serve(r));
  await ctx.route(CDN2, r => (cdn && cdn[2] === false) ? r.abort() : serve(r));
  return ctx;
}
async function open(ctx, query, errs, tag) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(tag + ': ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|ERR_INTERNET|net::/.test(m.text())) errs.push(tag + ': ' + m.text()); });
  await p.goto(URL0 + query);
  return p;
}
const shot = async (p, name) => { if (SHOTS) { await sleep(450); await p.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
const st = p => p.evaluate(() => window.__ns.state);
const visible = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && !e.closest('[hidden]') && e.getClientRects().length > 0; }, sel);
const text = (p, sel) => p.evaluate(s => (document.querySelector(s) || {}).textContent || '', sel);
async function profile(p, name, skin) {
  await p.click('#teamBtn');
  await p.fill('#tName', name);
  await p.click(`#tSkins .skin[data-skin=${skin}]`);
}
async function host(p, name, skin) {
  await profile(p, name, skin);
  await p.click('#tHost');
  await p.waitForFunction(() => /^[A-Z]{4}$/.test(document.querySelector('#rCode').textContent) && !document.querySelector('#room').hidden, null, { timeout: 25000 });
  return text(p, '#rCode');
}
async function join(p, name, skin, code) {
  await profile(p, name, skin);
  await p.fill('#tCode', code.toLowerCase());   // klein eingetippt – soll trotzdem gehen
  await p.click('#tJoin');
  await p.waitForFunction(() => !document.querySelector('#room').hidden || document.querySelector('#tMsg').classList.contains('err'), null, { timeout: 25000 });
}
const slots = p => p.evaluate(() => [...document.querySelectorAll('#rList .slot')].map(li => (li.classList.contains('bot') ? 'bot:' : '') + li.querySelector('b').textContent + (li.classList.contains('me') ? '*' : '')));
async function waitSlots(p, want, ms = 8000) {
  const t0 = Date.now(); let s;
  while (Date.now() - t0 < ms) { s = (await slots(p)).join('|'); if (s === want) return true; await sleep(100); }
  console.log('    (Liste: ' + s + ', erwartet: ' + want + ')'); return false;
}
async function errMsg(p, ms = 20000) {
  await p.waitForFunction(() => document.querySelector('#tMsg').classList.contains('err'), null, { timeout: ms }).catch(() => {});
  return text(p, '#tMsg');
}
// Spielzustand einer Seite (eigener Survivor, alle Survivors)
const game = p => p.evaluate(() => { const n = window.__ns; return { state: n.state, mode: n.mode, map: n.map, myId: n.Net.myId,
  S: n.S && { id: n.S.id, kind: n.S.kind, name: n.S.name, skin: n.S.skin }, SV: n.SV.map(v => ({ id: v.id, kind: v.kind, name: v.name, skin: v.skin, x: +v.x.toFixed(2), y: +v.y.toFixed(2) })) }; });

/* ---------- a) und b): gleicher Ablauf, anderer Transport ---------- */
async function lobbyFlow(browser, label, query, extra) {
  console.log(`\n${label}`);
  const errs = [];
  const ctx = await newCtx(browser, extra && extra.cdn);
  const H = await open(ctx, query, errs, 'Host'), C1 = await open(ctx, query, errs, 'Ben'), C2 = await open(ctx, query, errs, 'Cleo');
  const viaCdn2 = [];   // Host lädt PeerJS vom Ausweich-CDN
  if (extra && extra.hostNoUnpkg) { await H.route(CDN1, r => r.abort()); H.on('requestfinished', r => { if (CDN2.test(r.url())) viaCdn2.push(r.url()); }); }
  // Zweite Team-Karte (nur zum Testen der Kartenwahl): vor dem ersten Öffnen des Team-Menüs eintragen
  if (extra && extra.map2) for (const p of [H, C1, C2]) await p.evaluate(() => { MAPS['schule-team-b'] = Object.assign({}, MAPS['schule-team'], { name: 'Schule B' }); });
  if (extra && extra.shots) await shot(H, '1-titel');
  await profile(H, 'Anna', 'medic');
  if (extra && extra.shots) await shot(H, '2-team');
  if (extra && extra.map2 && extra.shots2) await shot(H, '2b-team-kartenwahl');
  await H.click('#tHost');
  await H.waitForFunction(() => /^[A-Z]{4}$/.test(document.querySelector('#rCode').textContent) && !document.querySelector('#room').hidden, null, { timeout: 25000 });
  const code = await text(H, '#rCode');
  ok(/^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/.test(code), `Raum erstellt, Code ${code} (4 Buchstaben ohne I/O)`);
  if (extra && extra.hostNoUnpkg) ok(viaCdn2.length === 1, 'Erstes CDN gesperrt → PeerJS vom Ausweich-CDN geladen');
  ok(await waitSlots(H, 'Anna*|bot:Bot|bot:Bot'), 'Host-Liste: Anna + 2 Bots');
  await join(C1, 'Ben', 'janitor', code);
  ok(await visible(C1, '#room'), 'Ben ist beigetreten');
  await join(C2, 'Cleo', 'cop', code);
  ok(await visible(C2, '#room'), 'Cleo ist beigetreten');
  ok(await waitSlots(H, 'Anna*|Ben|Cleo'), 'Host-Liste zeigt 3 Spieler');
  ok(await waitSlots(C1, 'Anna|Ben*|Cleo'), 'Ben sieht 3 Spieler, sich selbst markiert');
  ok((await text(H, '#rCount')).trim() === '3 / 3', 'Zähler 3 / 3');
  ok(await visible(H, '#rStart') && !(await visible(C1, '#rStart')) && await visible(C1, '#rWait'), 'Nur der Host hat „Starten", Clients warten');
  // Standardkarte = erste Team-Karte (Ferienlager, falls vorhanden); der Client sieht sie mit Namen
  let wantMap = await H.evaluate(() => window.__ns.Lobby.roomMap);
  const first = await H.evaluate(() => window.__ns.Lobby.teamMaps()[0]), wantName = await H.evaluate(m => MAPS[m].name, wantMap);
  ok(wantMap === first && (!(await H.evaluate(() => !!MAPS.ferienlager)) || wantMap === 'ferienlager'), 'Standardkarte: ' + wantName);
  await C1.waitForFunction(n => document.querySelector('#rMaps').textContent.trim() === n, wantName, { timeout: 5000 }).catch(() => {});
  ok((await text(C1, '#rMaps')).trim() === wantName, 'Client sieht die Karte des Hosts: ' + wantName);
  if (extra && extra.map2) {
    // Blättern: ‹ zurück zur letzten Karte (Schule B), dabei sieht der Client jede Änderung
    for (let i = 0; i < 6 && (await text(H, '#rMaps .mapname')).trim() !== 'Schule B'; i++) await H.click('#rMaps .arr[data-d="-1"]');
    wantMap = 'schule-team-b';
    await C1.waitForFunction(() => document.querySelector('#rMaps').textContent.trim() === 'Schule B', null, { timeout: 5000 }).catch(() => {});
    ok((await text(C1, '#rMaps')).trim() === 'Schule B' && (await text(H, '#rMaps .mapname')).trim() === 'Schule B', 'Host blättert zu „Schule B" → Client sieht die neue Karte');
    if (extra.shots2) await shot(H, '3b-host-kartenwahl');
  }
  if (extra && extra.shots) { await shot(H, '3-host'); await shot(C1, '4-client'); }
  if (extra && extra.invite) {
    const J = await open(ctx, query.replace('#', '&join=' + code + '#').replace('?&', '?'), errs, 'Link');
    await J.waitForFunction(() => !document.querySelector('#team').hidden, null, { timeout: 3000 }).catch(() => {});
    ok(await visible(J, '#team') && (await J.inputValue('#tCode')) === code, 'Einladungslink ?join=' + code + ' öffnet das Team-Menü mit dem Code');
    await J.close();
  }

  // Raum voll
  const D = await open(ctx, query, errs, 'Dora');
  await join(D, 'Dora', 'cop', code);
  ok(/voll/.test(await errMsg(D)), 'Vierter Spieler: „' + (await text(D, '#tMsg')) + '"');
  if (extra && extra.shots) await shot(D, '5-fehler-voll');
  await D.close();

  // Verlassen und wiederkommen: Liste aktualisiert sich
  await C2.click('#roomBack');
  ok(await waitSlots(H, 'Anna*|Ben|bot:Bot'), 'Cleo verlässt die Lobby → Host-Liste: Anna, Ben, Bot');
  ok(await waitSlots(C1, 'Anna|Ben*|bot:Bot'), 'Ben sieht die Änderung auch');
  ok(await visible(C2, '#team'), 'Cleo ist wieder im Team-Menü');
  await C2.click('#tJoin');
  await C2.waitForFunction(() => !document.querySelector('#room').hidden, null, { timeout: 20000 });
  ok(await waitSlots(H, 'Anna*|Ben|Cleo'), 'Cleo ist wieder da');

  // Start
  await H.click('#rStart');
  for (const p of [H, C1, C2]) await p.waitForFunction(() => window.__ns.state === 'play', null, { timeout: 10000 }).catch(() => {});
  const g = [await game(H), await game(C1), await game(C2)], names = ['Anna', 'Ben', 'Cleo'];
  ok(g.every(x => x.state === 'play' && x.mode === 'team'), 'Alle drei im Zustand play (Team): ' + g.map(x => x.state).join(', '));
  ok(g.every(x => x.map === wantMap), 'Gleiche Karte überall: ' + g.map(x => x.map).join(', '));
  ok(g.every(x => x.SV.length === 3), 'Je 3 Survivors');
  ok(g.every((x, i) => x.S.kind === 'local' && x.S.name === names[i] && x.S.id === x.myId && x.SV.filter(v => v.kind === 'local').length === 1), 'Der eigene ist jeweils local (richtiger Name und ID)');
  ok(g.every(x => x.SV.filter(v => v.kind === 'remote').length === 2), 'Die anderen beiden sind remote');
  ok(g.every(x => JSON.stringify(x.SV.map(v => [v.id, v.name, v.skin, v.x, v.y])) === JSON.stringify(g[0].SV.map(v => [v.id, v.name, v.skin, v.x, v.y]))), 'Gleiche IDs, Namen, Skins und Startplätze (spawnIdx)');
  ok(g[0].SV.map(v => v.skin).join() === 'medic,janitor,cop', 'Gewählte Skins übernommen');

  // Pause im Online-Spiel: Escape, „Raum verlassen" statt „Neu starten"
  await C1.keyboard.press('Escape');
  ok(await st(C1) === 'paused' && await visible(C1, '#leaveP') && !(await visible(C1, '#restart')), 'Escape pausiert, Pause zeigt „Raum verlassen" statt Neustart');
  await C1.keyboard.press('Escape');
  ok(await st(C1) === 'play', 'Escape setzt fort');

  // Runde vorbei → „Nochmal": der Host nimmt alle mit zurück in den Raum, dann zweite Runde
  await H.evaluate(() => { window.__ns.SV.forEach(v => { v.out = 'escaped'; }); teamCheckEnd(); });
  ok(await st(H) === 'end' && await visible(H, '#endLeave') && /Raum verlassen/.test(await text(H, '#endLeave')), 'Endbildschirm im Online-Spiel zeigt „Raum verlassen"');
  await H.click('#again');
  for (const p of [C1, C2]) await p.waitForFunction(() => !document.querySelector('#room').hidden, null, { timeout: 8000 }).catch(() => {});
  ok(await visible(H, '#room') && await visible(C1, '#room') && await visible(C2, '#room'), '„Nochmal" beim Host → alle wieder im Raum');
  ok(await waitSlots(C2, 'Anna|Ben|Cleo*') && (await H.evaluate(() => window.__ns.Net.phase)) === 'lobby', 'Alle drei noch da, Phase lobby');
  await H.click('#rStart');
  for (const p of [H, C1, C2]) await p.waitForFunction(() => window.__ns.state === 'play', null, { timeout: 10000 }).catch(() => {});
  ok((await Promise.all([H, C1, C2].map(st))).every(s => s === 'play'), 'Zweite Runde läuft bei allen');

  if (extra && extra.freeze) {
    // Cleos Tab hängt 9 s (eingefroren/Funkloch): der Host entfernt sie, sie bekommt danach „Verbindung verloren"
    await C2.evaluate(() => setTimeout(() => { const t = Date.now(); while (Date.now() - t < 9000); }, 0));
    await H.waitForFunction(() => window.__ns.Net.peers.length === 2, null, { timeout: 15000 }).catch(() => {});
    ok((await H.evaluate(() => window.__ns.Net.peers.map(p => p.name).join())) === 'Anna,Ben', 'Client hängt → Host entfernt ihn nach der Zeitüberschreitung');
    await C2.waitForFunction(() => window.__ns.state === 'title', null, { timeout: 15000 }).catch(() => {});
    ok(/Verbindung verloren/.test(await text(C2, '#notice')) && await visible(C2, '#title'), 'Der hängende Client: „' + (await text(C2, '#notice')) + '", zurück zum Titel');
    ok(await st(C1) === 'play' && (await C1.evaluate(() => window.__ns.Net.peers.length)) === 2, 'Ben spielt weiter');
    ok(/Cleo hat das Spiel verlassen/.test(await H.evaluate(() => toastMsg || '')), 'Host bekommt im Spiel den Hinweis „Cleo hat das Spiel verlassen"');
  }

  // Host verlässt das Spiel (Pause → „Raum verlassen" bzw. Tab schließen) → Clients: Meldung + Titel
  if (extra && extra.hostClose) { await H.close({ runBeforeUnload: true }); ok(true, 'Host schließt den Tab mitten im Spiel'); }
  else {
    await H.keyboard.press('Escape');
    await H.click('#leaveP');
    ok(await st(H) === 'title' && await visible(H, '#title'), 'Host verlässt das Spiel über die Pause und ist zurück auf dem Titel');
  }
  await C1.waitForFunction(() => window.__ns.state === 'title', null, { timeout: 12000 }).catch(() => {});
  ok(await st(C1) === 'title' && await visible(C1, '#title') && await visible(C1, '#notice'), 'Ben ist zurück auf dem Titel');
  ok(/Host hat den Raum verlassen/.test(await text(C1, '#notice')), 'Ben sieht: „' + (await text(C1, '#notice')) + '"');
  if (extra && extra.shots) await shot(C1, '6-host-weg');
  ok(!(await C1.evaluate(() => window.__ns.Net.active)), 'Netz ist danach aus');

  // Falscher Code
  const E = await open(ctx, query, errs, 'Emil');
  await join(E, 'Emil', 'cop', code);   // Raum gibt es nicht mehr
  ok(/nicht gefunden/.test(await errMsg(E)), 'Falscher Code: „' + (await text(E, '#tMsg')) + '"');
  if (extra && extra.shots) await shot(E, '7-fehler-code');
  await E.fill('#tCode', 'AB1');
  await E.click('#tJoin');
  ok(/4 Buchstaben/.test(await errMsg(E)), 'Kaputter Code: „' + (await text(E, '#tMsg')) + '"');

  if (extra && extra.offline) {
    // Kein Netz: beide CDNs gesperrt → verständliche Meldung
    const O = await open(ctx, query, errs, 'Offline');
    await O.route(CDN1, r => r.abort()); await O.route(CDN2, r => r.abort());
    await profile(O, 'Olaf', 'cop');
    await O.click('#tHost');
    ok(/nicht verfügbar/.test(await errMsg(O)), 'Ohne PeerJS: „' + (await text(O, '#tMsg')) + '"');
    if (extra.shots2) await shot(O, '8-fehler-offline');
  }
  ok(!errs.length, 'Keine Fehler in der Konsole' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close();
}

/* ---------- c) offline mit Bots ---------- */
async function botsFlow(browser) {
  console.log('\nc) Offline „Mit Bots spielen"');
  const errs = [], ctx = await newCtx(browser), p = await open(ctx, '#test', errs, 'Solo');
  await profile(p, 'Mia', 'janitor');
  await p.click('#tBots');
  await p.waitForFunction(() => window.__ns.state === 'play', null, { timeout: 5000 }).catch(() => {});
  const g = await game(p);
  ok(g.state === 'play' && g.mode === 'team', 'Team-Spiel läuft');
  ok(g.SV.map(v => v.kind).join() === 'local,bot,bot', 'Survivors: ' + g.SV.map(v => v.kind).join(', '));
  ok(g.S.name === 'Mia' && g.S.skin === 'janitor', 'Eigener Survivor: Mia als Hausmeister');
  ok(new Set(g.SV.map(v => v.skin)).size === 3, 'Bots nehmen die übrigen Skins: ' + g.SV.map(v => v.skin).join(', '));
  ok(!(await p.evaluate(() => window.__ns.Net.active)), 'Kein Netz im Bot-Spiel');
  await p.keyboard.press('Escape');
  ok(await st(p) === 'paused' && await visible(p, '#restart') && await visible(p, '#leaveP'), 'Pause: Neustart und „Zum Menü"');
  await p.click('#restart');
  const g2 = await game(p);
  ok(g2.state === 'play' && g2.mode === 'team' && g2.SV.length === 3, 'Neustart bleibt im Team-Modus');
  await p.keyboard.press('Escape');
  await p.click('#leaveP');
  ok(await st(p) === 'title' && await visible(p, '#title') && !(await visible(p, '#leaveP')), 'Zum Menü → Titel');
  await p.click('#play');
  const g3 = await game(p);
  ok(g3.state === 'play' && g3.mode === 'solo' && g3.SV.length === 1, 'Danach startet „Spielen" wieder Solo');
  ok(!(await p.evaluate(() => localStorage.getItem('dead-mobile-v1'))), '#test: nichts gespeichert');
  ok(!errs.length, 'Keine Fehler in der Konsole' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close();
}

/* ---------- Signalserver ---------- */
function startServer() {
  const bin = path.join(PEERDIR, 'node_modules/.bin/peerjs');
  const srv = spawn(bin, ['--port', String(PORT), '--host', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stderr.on('data', d => process.stderr.write('[peerjs] ' + d));
  return new Promise((res, rej) => {
    const t0 = Date.now();
    const poll = () => http.get({ host: '127.0.0.1', port: PORT, path: '/' }, r => { r.resume(); res(srv); })
      .on('error', () => Date.now() - t0 > 8000 ? rej(new Error('Signalserver startet nicht')) : setTimeout(poll, 150));
    poll();
  });
}

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  let srv = null;
  try {
    if (ONLY.includes('a')) await lobbyFlow(browser, 'a) BroadcastChannel (?net=local)', '?net=local#test', { shots: true, freeze: true, invite: true });
    if (ONLY.includes('b')) {
      if (!PEERDIR) console.log('\nb) übersprungen (kein --peer <ordner> mit node_modules/peer und node_modules/peerjs)');
      else {
        srv = await startServer();
        await lobbyFlow(browser, `b) PeerJS mit lokalem Signalserver (?peer=localhost:${PORT})`, `?peer=localhost:${PORT}#test`, { hostNoUnpkg: true, offline: true, shots2: true, freeze: true, hostClose: true, map2: true });
      }
    }
    if (ONLY.includes('c')) await botsFlow(browser);
  } catch (e) { fails++; console.log('  ✗ Abbruch: ' + (e && e.stack || e)); }
  if (srv) srv.kill();
  await browser.close();
  console.log(`\n${oks} ok, ${fails} fehlgeschlagen` + (SHOTS ? ` · Bilder: ${path.resolve(SHOTS)}` : ''));
  process.exit(fails ? 1 : 0);
})();

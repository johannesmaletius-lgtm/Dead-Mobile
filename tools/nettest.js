// Netz-Test: Lobby und Verbindungen über die echte Oberfläche (Playwright, Klicks wie ein Mensch).
//   NODE_PATH="$(npm root -g)" node tools/nettest.js [index.html] [--peer <ordner>] [--port 9000] [--shots <ordner>] [--fonts <ordner>] [--only a,b,c]
//   a) BroadcastChannel (?net=local): Host + 2 Clients, volle Lobby, Verlassen/Wiederkommen, Start, Pause, Abbruch, Host weg
//   b) echtes PeerJS mit lokalem Signalserver (?peer=localhost:9000). <ordner> enthält node_modules/peer (Server) und
//      node_modules/peerjs (dist/peerjs.min.js). Die CDN-Adressen werden auf die lokale Datei umgeleitet.
//      Zusätzlich: Ausweich-CDN, kein Netz, falscher Code, Host verlässt das Spiel.
//   c) offline „Mit Bots spielen": 1 lokaler + 2 Bots
//   d) Synchronisierung im Spiel (Netz Teil 2): Bewegung, Aufgaben, Palette, Treffer/Haken/Retten/Heilen, Pause,
//      Hintergrund-Tab, Mitspieler geht (Bot übernimmt), Spielende – über BroadcastChannel und (mit --peer) PeerJS
//   --shots: Bildschirmfotos der Lobby (900×450, deviceScaleFactor 2). --fonts: Ordner mit fonts.css + *.woff2 (sonst ohne Webfonts).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process'), http = require('http');

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else opt.file = args[i];
const FILE = path.resolve(opt.file || 'index.html'), URL0 = 'file://' + FILE;
const PORT = +(opt.port || 9000), SHOTS = opt.shots, FONTS = opt.fonts, ONLY = (opt.only || 'a,b,c,d,e').split(',');
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
  ok((await text(H, '#rCount')).trim() === '3 / 4', 'Zähler 3 / 4');
  ok((await text(H, '#rKiller b')).trim() === 'KI' && !(await H.evaluate(() => document.querySelector('#rRole').disabled)), 'Killer-Platz: KI, Rolle wählbar');
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

  // Vierter Spieler wird Killer (alle Überlebenden-Plätze sind besetzt), der fünfte passt nicht mehr hinein
  const D = await open(ctx, query, errs, 'Dora');
  await join(D, 'Dora', 'cop', code);
  await H.waitForFunction(() => document.querySelector('#rKiller b').textContent.trim() === 'Dora', null, { timeout: 8000 }).catch(() => {});
  ok(await visible(D, '#room') && (await text(H, '#rKiller b')).trim() === 'Dora' && await waitSlots(H, 'Anna*|Ben|Cleo'), 'Vierter Spieler ist drin und spielt den Killer');
  ok(await D.evaluate(() => document.querySelector('#rRole').disabled && document.querySelector('#rKiller').classList.contains('me')) && await H.evaluate(() => document.querySelector('#rRole').disabled), 'Rollenwechsel gesperrt: Killer vergeben, alle Überlebenden-Plätze voll');
  if (extra && extra.shots) await shot(H, '5-raum-mit-killer');
  const F5 = await open(ctx, query, errs, 'Emil');
  await join(F5, 'Emil', 'cop', code);
  ok(/voll/.test(await errMsg(F5)), 'Fünfter Spieler: „' + (await text(F5, '#tMsg')) + '"');
  if (extra && extra.shots) await shot(F5, '5-fehler-voll');
  await F5.close(); await D.close();
  await H.waitForFunction(() => document.querySelector('#rKiller b').textContent.trim() === 'KI', null, { timeout: 12000 }).catch(() => {});
  ok((await text(H, '#rKiller b')).trim() === 'KI', 'Killer geht: die KI übernimmt den Platz');

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
  ok(await st(C1) === 'play' && await visible(C1, '#pause') && await visible(C1, '#leaveP') && !(await visible(C1, '#restart')), 'Escape: Pause nur als Überlagerung (Spiel läuft weiter), „Raum verlassen" statt Neustart');
  await C1.keyboard.press('Escape');
  ok(await st(C1) === 'play' && !(await visible(C1, '#pause')), 'Escape setzt fort');

  // Runde vorbei → „Nochmal": der Host nimmt alle mit zurück in den Raum, dann zweite Runde
  await H.evaluate(() => { window.__ns.SV.forEach(v => { v.out = 'escaped'; }); teamCheckEnd(); });
  // Team-Ende kommt absichtlich verzögert (Abschied ~2,8 s, siehe js/rules.js)
  await H.waitForFunction(() => window.__ns.state === 'end', null, { timeout: 8000 }).catch(() => {});
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

/* ---------- d) Synchronisierung im Spiel (Netz Teil 2) ---------- */
async function syncFlow(browser, label, query) {
  console.log(`\n${label}`);
  const errs = [], ctx = await newCtx(browser);
  const H = await open(ctx, query, errs, 'Host'), C1 = await open(ctx, query, errs, 'Ben'), C2 = await open(ctx, query, errs, 'Cleo');
  const code = await host(H, 'Anna', 'medic');
  await join(C1, 'Ben', 'janitor', code); await join(C2, 'Cleo', 'cop', code);
  await waitSlots(H, 'Anna*|Ben|Cleo');
  await H.click('#rStart');
  for (const p of [H, C1, C2]) await p.waitForFunction(() => window.__ns.state === 'play', null, { timeout: 10000 }).catch(() => {});
  const wait = (p, fn, arg, ms = 5000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  const ev = (p, fn, arg) => p.evaluate(fn, arg);
  ok(await ev(H, () => Sync.active && Sync.host) && await ev(C1, () => Sync.active && !Sync.host), 'Sync läuft: Anna ist Host, Ben Client');
  // Killer und Welt kommen vom Host
  await ev(H, () => { const n = window.__ns; n.K.ctl = () => { n.K.moving = false; }; n.ktp(n.S.x + 9, n.S.y); });
  await sleep(500);
  const kd = async p => { const a = await ev(H, () => [K.x, K.y]), b = await ev(p, () => [K.x, K.y]); return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  ok(await kd(C1) < .3 && await kd(C2) < .3, 'Killer steht bei den Clients dort, wo der Host ihn hat');
  ok(await ev(C1, () => K.net && SV.filter(v => v !== S).every(v => !v.bot)), 'Client simuliert weder Killer noch Bots');
  // Bewegung: Client → Host → anderer Client, geglättet
  const pos = (p, id) => ev(p, id => { const v = SV.find(v => v.id === id); return [v.x, v.y, v.moving]; }, id);
  const p0 = await pos(C1, 1);
  await C1.keyboard.down('KeyD'); await sleep(450);
  const mid = await pos(H, 1), midC2 = await pos(C2, 1);
  await sleep(300); await C1.keyboard.up('KeyD'); await sleep(450);
  const a1 = await pos(C1, 1), h1 = await pos(H, 1), c1 = await pos(C2, 1);
  ok(Math.hypot(a1[0] - p0[0], a1[1] - p0[1]) > 1 && Math.hypot(a1[0] - h1[0], a1[1] - h1[1]) < .15, `Ben läuft: der Host sieht ihn an derselben Stelle (${h1[0].toFixed(2)} | ${a1[0].toFixed(2)})`);
  ok(Math.hypot(a1[0] - c1[0], a1[1] - c1[1]) < .15 && mid[2] && midC2[2], 'Cleo sieht Ben auch dort; unterwegs lief die Figur bei Host und Cleo');
  await H.keyboard.down('KeyA'); await sleep(500); await H.keyboard.up('KeyA'); await sleep(400);
  const hh = await pos(H, 0), hc = await pos(C1, 0);
  ok(Math.hypot(hh[0] - hc[0], hh[1] - hc[1]) < .15, 'Der Host läuft: Ben sieht ihn an derselben Stelle');
  // Aufgabe: QTE beim Client, Besetzen und Fortschritt beim Host
  await ev(C1, () => { const n = window.__ns, t = n.tasks[0]; n.tp(t.ax, t.ay); });
  await sleep(250); await C1.keyboard.press('KeyE');
  ok(await wait(H, () => SV[1].work === tasks[0] && tasks[0].prog > .02), 'Ben arbeitet am Aggregat: beim Host besetzt, Fortschritt läuft mit');
  ok(await wait(C2, () => SV[1].work === tasks[0] && tasks[0].prog > .02), 'Cleo sieht Bens Arbeit und Fortschritt');
  await ev(H, () => { const n = window.__ns, t = n.tasks[0]; n.tp(t.ax, t.ay); });
  await sleep(200);
  ok(await ev(H, () => { const a = computeAction(); return !a || a.o !== tasks[0]; }), 'Für den Host ist die Aufgabe besetzt');
  await ev(C1, () => { tasks[0].prog = .995; });
  ok(await wait(H, () => tasks[0].done && !SV[1].work) && await wait(C2, () => tasks[0].done), 'Ben wird fertig: Aufgabe bei allen erledigt');
  // Palette werfen: Client sagt es, Host entscheidet über die Betäubung
  await ev(C1, () => { const n = window.__ns, p = n.pallets[0]; n.tp(p.cx + p.ax.x * .8, p.cy + p.ax.y * .8); });
  await ev(H, () => { const n = window.__ns, p = n.pallets[0]; n.ktp(p.cx - p.ax.x * .25, p.cy - p.ax.y * .25); });
  await sleep(300); await C1.keyboard.press('KeyE');
  ok(await wait(H, () => pallets[0].state === 1 && K.act && K.act.kind === 'stun'), 'Ben wirft die Palette: beim Host liegt sie, Killer betäubt');
  ok(await wait(C2, () => pallets[0].state === 1 && K.act && K.act.kind === 'stun') && await ev(C1, () => window.__ns.stats.stuns === 1), 'Cleo sieht Palette und Betäubung, Ben bekommt den Stun gutgeschrieben');
  await ev(H, () => { const n = window.__ns; n.ktp(n.S.x + 12, n.S.y); });
  // Treffer → Boden → Tragen → Zappeln → Haken → Retten (alles Entscheidungen des Hosts)
  await ev(H, () => hitSurvivor(SV[1]));
  ok(await wait(C1, () => S.hp === 1 && S.burst > 0) && await wait(C2, () => SV[1].hp === 1), 'Treffer: Ben ist verletzt (mit Sprint), Cleo sieht es');
  await ev(H, () => { K.ctl = null; hitSurvivor(SV[1]); });
  ok(await wait(C1, () => S.hp === 0), 'Zweiter Treffer: Ben liegt am Boden');
  ok(await wait(C1, () => S.carried && K.carry === S, null, 25000), 'Der Killer hebt Ben auf (Ben wird getragen)');
  const w0 = await ev(H, () => SV[1].wiggle);
  for (let i = 0; i < 6; i++) { await C1.keyboard.press('KeyE'); await sleep(40); }
  ok(await wait(H, w0 => SV[1].wiggle > w0 + .05, w0), 'Ben zappelt: die Leiste füllt sich beim Host');
  ok(await wait(C1, () => !!S.hung, null, 40000) && await wait(C2, () => !!SV[1].hung), 'Ben hängt am Haken – bei ihm und bei Cleo');
  await ev(H, () => { const n = window.__ns; n.K.ctl = () => { n.K.moving = false; }; n.ktp(n.S.x, n.S.y); K.mode = 'patrol'; K.campUntil = -9; n.ktp(2.5, 2.5); });
  await ev(C2, () => { const n = window.__ns, h = SV[1].hung; n.tp(h.front.x + .2, h.front.y + .3); });
  await sleep(300); await C2.keyboard.down('KeyE');
  const freed = await wait(H, () => !SV[1].hung && SV[1].hp === 1, null, 6000);
  await C2.keyboard.up('KeyE');
  ok(freed && await wait(C1, () => !S.hung && S.hp === 1 && !S.carried), 'Cleo hält die Aktion am Haken: Ben ist gerettet');
  ok(await ev(C2, () => window.__ns.stats.rescues === 1), 'Cleo bekommt die Rettung gutgeschrieben');
  // Heilen: Client heilt, Fortschritt beim Host
  await sleep(300);
  await ev(C2, () => { const n = window.__ns, b = SV[1]; n.tp(b.x + .5, b.y + .2); });
  await sleep(350); await C2.keyboard.press('KeyE');
  ok(await wait(H, () => SV[2].heal === SV[1] && SV[1].healProg > .05) && await wait(C1, () => S.healProg > .05), 'Cleo heilt Ben: Fortschritt läuft beim Host und kommt bei Ben an');
  await ev(H, () => { SV[1].healProg = .99; });
  ok(await wait(C1, () => S.hp === 2, null, 6000) && await ev(C2, () => window.__ns.stats.heals === 1), 'Ben ist wieder gesund, Cleo bekommt die Heilung gutgeschrieben');
  // Pause ist online nur eine Überlagerung; der Host läuft auch im Hintergrund-Tab weiter
  await H.keyboard.press('Escape');
  const t0 = await ev(H, () => window.__ns.T); await sleep(500);
  ok(await visible(H, '#pause') && await st(H) === 'play' && (await ev(H, () => window.__ns.T)) > t0 + .3, 'Pause beim Host: Überlagerung, die Simulation läuft weiter');
  await H.keyboard.press('Escape');
  await ev(H, () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); window.requestAnimationFrame = () => 0; document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(300);
  const t1 = await ev(H, () => window.__ns.T), g1 = await ev(C1, () => Sync.got); await sleep(1000);
  const t2 = await ev(H, () => window.__ns.T), g2 = await ev(C1, () => Sync.got);
  ok(await st(H) === 'play' && t2 - t1 > .8 && g2 - g1 >= 12, `Host-Tab im Hintergrund: Simulation läuft weiter (${(t2 - t1).toFixed(2)} s in 1 s, ${g2 - g1} Schnappschüsse)`);
  // „Ergebnis" beim Zuschauen: online endet nur die eigene Ansicht bzw. beim Host gar nichts, solange Mitspieler spielen
  await ev(H, () => { killSurv(S, 'bleed'); });
  await sleep(200); await ev(H, () => teamGiveUp());
  ok(await st(H) === 'play' && /Mitspieler/.test(await ev(H, () => toastMsg || '')), 'Host ist raus und drückt „Ergebnis": das Spiel läuft für die anderen weiter');
  // Mitspieler geht: ein Bot übernimmt
  await C2.close({ runBeforeUnload: true });
  ok(await wait(H, () => SV[2].kind === 'bot' && !!SV[2].bot && !!SV[2].ctl, null, 9000), 'Cleo schließt den Tab: beim Host übernimmt ein Bot ihre Figur');
  const bp = await pos(H, 2); await sleep(2500); const bq = await pos(H, 2);
  ok(Math.hypot(bp[0] - bq[0], bp[1] - bq[1]) > .5 || await ev(H, () => !!SV[2].work), 'Der Bot spielt weiter (läuft oder arbeitet)');
  ok(await st(C1) === 'play', 'Ben spielt weiter');
  // Spielende kommt vom Host
  await ev(H, () => { for (const v of SV) if (!v.out) escapeSurv(v, gates[0]); });
  ok(await wait(C1, () => window.__ns.state === 'end', null, 9000) && await wait(H, () => window.__ns.state === 'end', null, 9000), 'Spielende: Host und Ben sehen den Endbildschirm');
  ok(await ev(C1, () => S.out === 'escaped' && document.querySelector('#endWord').textContent === 'Escaped' && document.querySelectorAll('#teamRes .tr').length === 3), 'Ben: „Escaped", Team-Ergebnis mit 3 Figuren');
  ok(!errs.length, 'Keine Fehler in der Konsole' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close();
}

/* ---------- e) Ein Mitspieler steuert den Killer ---------- */
async function killerFlow(browser, label, query) {
  console.log(`\n${label}`);
  const errs = [], ctx = await newCtx(browser);
  const H = await open(ctx, query, errs, 'Host'), C1 = await open(ctx, query, errs, 'Ben');
  const code = await host(H, 'Anna', 'medic');
  await join(C1, 'Ben', 'janitor', code);
  await waitSlots(H, 'Anna*|Ben|bot:Bot');
  await C1.click('#rRole');
  ok(await waitSlots(H, 'Anna*|bot:Bot|bot:Bot') && (await text(H, '#rKiller b')).trim() === 'Ben', 'Ben wählt die Killer-Rolle: 2 Bots füllen auf');
  await C1.click('#rRole');
  ok(await waitSlots(H, 'Anna*|Ben|bot:Bot') && (await text(H, '#rKiller b')).trim() === 'KI', 'Ben wechselt zurück zum Überlebenden');
  await C1.click('#rRole'); await waitSlots(H, 'Anna*|bot:Bot|bot:Bot');
  await shot(H, '8-raum-killer');
  await H.click('#rStart');
  for (const p of [H, C1]) await p.waitForFunction(() => window.__ns.state === 'play', null, { timeout: 10000 }).catch(() => {});
  const wait = (p, fn, arg, ms = 5000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  const ev = (p, fn, arg) => p.evaluate(fn, arg);
  ok(await ev(H, () => KP === 'remote' && K.human === 'remote' && SV.length === 3 && SV[0] === S) && await ev(C1, () => KP === 'local' && viewer() === K && !K.net && SV.length === 3 && !SV.includes(S)), 'Start: Host kennt den Killer-Spieler, Ben sieht aus Killer-Sicht');
  await ev(H, () => { Bots.on = false; });
  // Bewegung: Client → Host
  const k0 = await ev(C1, () => [K.x, K.y]);
  await C1.keyboard.down('KeyD'); await sleep(700); await C1.keyboard.up('KeyD'); await sleep(450);
  const kc = await ev(C1, () => [K.x, K.y]), kh = await ev(H, () => [K.x, K.y]);
  ok(Math.hypot(kc[0] - k0[0], kc[1] - k0[1]) > 1.5 && Math.hypot(kc[0] - kh[0], kc[1] - kh[1]) < .2, `Ben läuft als Killer: der Host sieht ihn an derselben Stelle (${kh[0].toFixed(2)} | ${kc[0].toFixed(2)})`);
  // Angriff: Anna steht vor ihm
  await ev(H, () => { const n = window.__ns; n.tp(K.x + 1.2, K.y); });
  await ev(C1, () => { K.dir = 0; });
  await sleep(400);
  ok(await ev(C1, () => { const a = window.__ns.act; return a && a.kind === 'attack' && !!a.o; }) && await ev(H, () => K.mode === 'chase' && K.target === S && chasedView()), 'Anna in Reichweite: Angriff am Knopf, bei Anna läuft die Jagd');
  await C1.keyboard.press('KeyE');
  ok(await wait(H, () => S.hp === 1 && K.act && K.act.kind === 'wipe') && await wait(C1, () => SV[0].hp === 1 && K.act && K.act.kind === 'wipe'), 'Treffer: Anna verletzt, Killer wischt die Klinge ab (beide Seiten)');
  await wait(C1, () => !K.act, null, 6000);
  // Palette: Anna betäubt ihn
  await ev(H, () => { const n = window.__ns, p = n.pallets[0]; S.burst = 0; n.tp(p.cx + p.ax.x * .8, p.cy + p.ax.y * .8); });
  await ev(C1, () => { const p = window.__ns.pallets[0]; K.x = p.cx - p.ax.x * .25; K.y = p.cy - p.ax.y * .25; });
  await sleep(400); await H.keyboard.press('KeyE');
  ok(await wait(C1, () => pallets[0].state === 1 && K.act && K.act.kind === 'stun') && await ev(H, () => K.act && K.act.kind === 'stun'), 'Anna wirft die Palette: Ben ist betäubt');
  await wait(C1, () => !K.act, null, 6000);
  // Palette zerbrechen
  await ev(H, () => { window.__ns.tp(K.x + 9, K.y + 5); });
  await sleep(500);
  ok(await ev(C1, () => { const a = window.__ns.act; return a && a.kind === 'kbreak'; }), 'An der liegenden Palette: Zerbrechen am Knopf');
  await C1.keyboard.press('KeyE');
  ok(await wait(H, () => pallets[0].state === 2, null, 6000) && await wait(C1, () => pallets[0].state === 2), 'Ben zerbricht die Palette (Host bestätigt)');
  // Zweiter Treffer, aufheben, aufhängen
  await wait(C1, () => !K.act, null, 4000);
  await ev(H, () => { const n = window.__ns; n.tp(K.x + 1.1, K.y); });
  await ev(C1, () => { K.dir = 0; });
  await sleep(400); await C1.keyboard.press('KeyE');
  ok(await wait(H, () => S.hp === 0), 'Zweiter Treffer: Anna liegt am Boden');
  await wait(C1, () => !K.act, null, 6000);
  await ev(C1, () => { K.x = SV[0].x + .5; K.y = SV[0].y; });
  await sleep(400);
  ok(await ev(C1, () => { const a = window.__ns.act; return a && a.kind === 'kpick'; }), 'Am Liegenden: Aufheben am Knopf');
  await C1.keyboard.press('KeyE');
  ok(await wait(H, () => S.carried && K.carry === S, null, 6000) && await wait(C1, () => K.carry === SV[0] && K.mode === 'carry'), 'Ben hebt Anna auf');
  await ev(C1, () => { const h = window.__ns.hooks[0]; K.x = h.front.x; K.y = h.front.y; });
  await sleep(400);
  ok(await ev(C1, () => { const a = window.__ns.act; return a && a.kind === 'khook'; }), 'Am Haken: Aufhängen am Knopf');
  await C1.keyboard.press('KeyE');
  ok(await wait(H, () => !!S.hung && S.hookN === 1, null, 6000) && await wait(C1, () => !!SV[0].hung && !K.carry), 'Ben hängt Anna auf');
  await shot(C1, '9-killer-sicht'); await shot(H, '9-am-haken');
  // Killer geht: KI übernimmt
  await C1.close();
  ok(await wait(H, () => KP === null && !K.human, null, 12000), 'Killer-Spieler weg: beim Host übernimmt die KI');
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
    if (ONLY.includes('d')) {
      await syncFlow(browser, 'd) Synchronisierung im Spiel (BroadcastChannel)', '?net=local#test');
      if (PEERDIR) { if (!srv) srv = await startServer(); await syncFlow(browser, 'd) Synchronisierung im Spiel (PeerJS)', `?peer=localhost:${PORT}#test`); }
    }
    if (ONLY.includes('e')) {
      await killerFlow(browser, 'e) Killer als Spieler (BroadcastChannel)', '?net=local#test');
      if (PEERDIR) { if (!srv) srv = await startServer(); await killerFlow(browser, 'e) Killer als Spieler (PeerJS)', `?peer=localhost:${PORT}#test`); }
    }
  } catch (e) { fails++; console.log('  ✗ Abbruch: ' + (e && e.stack || e)); }
  if (srv) srv.kill();
  await browser.close();
  console.log(`\n${oks} ok, ${fails} fehlgeschlagen` + (SHOTS ? ` · Bilder: ${path.resolve(SHOTS)}` : ''));
  process.exit(fails ? 1 : 0);
})();

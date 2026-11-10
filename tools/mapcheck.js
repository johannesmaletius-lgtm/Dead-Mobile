// Kartenprüfer und -import für Dead Mobile.
//   Prüfen:     node tools/mapcheck.js js/maps/schule.js              (alle Karten der Datei)
//   Import:     node tools/mapcheck.js antwort.md --id ferienlager      (ChatGPT-Antwort: Raster + JSON, ```-Zeilen optional)
//   Selbsttest: node tools/mapcheck.js --selftest
//               … --write   schreibt js/maps/<id>.js (nur wenn keine Fehler)
// Fehler (✗) machen die Karte unspielbar, Warnungen (!) sind Designhinweise. Exit-Code 1 bei Fehlern.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const FLOORS = ['wood', 'lino', 'gym', 'tiles', 'concrete', 'cellar', 'asphalt', 'grass'];
const roomId = c => c >= '1' && c <= '9' ? +c : c >= 'a' && c <= 'f' ? c.charCodeAt(0) - 87 : 0;
const D4 = [[0, 1], [1, 0], [-1, 0], [0, -1]];

function check(def, id) {
  const E = [], Wn = [], info = [];
  const err = m => E.push(m), warn = m => Wn.push(m);
  const rows = def.grid;
  if (!Array.isArray(rows) || !rows.length) { err('Kein Raster'); return { E, Wn, info }; }
  const W = rows[0].length, H = rows.length;
  rows.forEach((r, y) => { if (r.length !== W) err(`Zeile ${y} hat Länge ${r.length} statt ${W}`); });
  if (E.length) return { E, Wn, info };
  const G = rows.map(r => r.split(''));
  const ch = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 'T' : G[y][x];
  const at = (x, y) => `(${x},${y})`;
  const legal = new Set('T#WD.PtkBOLHGFVRCEY123456789abcdef'.split(''));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!legal.has(G[y][x])) err(`Unbekanntes Zeichen '${G[y][x]}' bei ${at(x, y)}`);
  // Rand
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x > 0 && y > 0 && x < W - 1 && y < H - 1) continue;
    const c = G[y][x];
    if (c === 'E' && (y === 0 || y === H - 1)) continue;
    if (c !== 'T' && c !== '#') err(`Rand muss Baum (oder Wand) sein: '${c}' bei ${at(x, y)}`);
  }
  // Räume (wie im Spiel: Flutfüllung, Wände/Türen/Fenster/Tore trennen)
  const room = new Int32Array(W * H), I = (x, y) => y * W + x, seenMarker = {};
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = G[y][x], rid = roomId(c); if (!rid) continue;
    if (seenMarker[c]) err(`Raum-Marker '${c}' doppelt: ${at(...seenMarker[c])} und ${at(x, y)}`);
    seenMarker[c] = [x, y];
    if (room[I(x, y)]) { err(`Marker '${c}' bei ${at(x, y)} liegt im selben Bereich wie Raum ${room[I(x, y)]} – Bereiche müssen durch Wände/Türen/Fenster getrennt sein`); continue; }
    const st = [I(x, y)]; room[I(x, y)] = rid;
    while (st.length) {
      const i = st.pop(), px = i % W, py = (i / W) | 0;
      for (const [dx, dy] of D4) { const nx = px + dx, ny = py + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = I(nx, ny); if (room[j] || '#DWE'.includes(G[ny][nx])) continue; room[j] = rid; st.push(j); }
    }
  }
  const markers = Object.keys(seenMarker);
  if (markers.length > 15) err(`Zu viele Räume: ${markers.length} (max. 15)`);
  for (const [c, [x, y]] of Object.entries(seenMarker)) G[y][x] = '.';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((G[y][x] === '.' || G[y][x] === 'P') && !room[I(x, y)]) { err(`Bodenkachel ohne Raum bei ${at(x, y)} – dort fehlt ein Raum-Marker`); y = H; break; }
  // Raumtabelle
  const rdefs = def.rooms || {};
  const outRoom = r => { const d = rdefs[r] || rdefs[r > 9 ? String.fromCharCode(87 + r) : String(r)]; return !!(d && (d.out || d.outside)); };
  for (const c of markers) {
    const d = rdefs[c] || rdefs[roomId(c)];
    if (!d) { err(`Raum '${c}' fehlt in "rooms"`); continue; }
    const f = d.f || d.floor; if (!FLOORS.includes(f)) err(`Raum '${c}': unbekannter Boden "${f}"`);
  }
  for (const k of Object.keys(rdefs)) if (!markers.includes(String(k)) && !markers.includes(String.fromCharCode(87 + +k))) warn(`Raum ${k} steht in "rooms", hat aber keinen Marker`);
  // Hilfen
  const solid = (x, y) => { const c = ch(x, y); return !(c === '.' || c === 'D' || c === 'P'); };
  const free = (x, y) => { const c = ch(x, y); return c === '.' || c === 'D'; };
  const wallish = (x, y) => '#WD'.includes(ch(x, y));
  const touchesFloor = (x, y) => D4.some(([dx, dy]) => ch(x + dx, y + dy) === '.' || ch(x + dx, y + dy) === 'D');
  const count = {}; for (const r of G) for (const c of r) count[c] = (count[c] || 0) + 1;
  // Paletten
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (G[y][x] === 'P') {
    const h = solid(x - 1, y) && solid(x + 1, y) && free(x, y - 1) && free(x, y + 1);
    const v = solid(x, y - 1) && solid(x, y + 1) && free(x - 1, y) && free(x + 1, y);
    if (!h && !v) err(`Palette bei ${at(x, y)}: braucht links+rechts fest und oben+unten frei (oder umgekehrt)`);
    for (const [dx, dy] of D4) if (ch(x + dx, y + dy) === 'P') { warn(`Paletten direkt nebeneinander bei ${at(x, y)}`); break; }
  }
  // Türen und Fenster
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (G[y][x] === 'D' || G[y][x] === 'W') {
    const c = G[y][x], h = wallish(x - 1, y) && wallish(x + 1, y), v = wallish(x, y - 1) && wallish(x, y + 1);
    if (!h && !v) { err(`${c === 'D' ? 'Tür' : 'Fenster'} bei ${at(x, y)} sitzt nicht in einer Wandlinie`); continue; }
    const [a, b] = h ? [[x, y - 1], [x, y + 1]] : [[x - 1, y], [x + 1, y]];
    const okA = ch(...a) === '.' || ch(...a) === 'P', okB = ch(...b) === '.' || ch(...b) === 'P';
    if (!okA || !okB) err(`${c === 'D' ? 'Tür' : 'Fenster'} bei ${at(x, y)}: beide Seiten müssen Boden sein`);
    else if (room[I(...a)] === room[I(...b)] && !(c === 'W' && outRoom(room[I(...a)]))) warn(`${c === 'D' ? 'Tür' : 'Fenster'} bei ${at(x, y)} verbindet denselben Raum`);   // draußen erlaubt: Jungle Gym
  }
  // Objekte, die Boden berühren müssen
  const names = { G: 'Aggregat', F: 'Sicherungskasten', V: 'Ventil', H: 'Haken', Y: 'Duo-Station' };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = G[y][x];
    if (names[c] && !touchesFloor(x, y)) err(`${names[c]} bei ${at(x, y)} berührt keinen Boden`);
    if (c === 'L' && !D4.some(([dx, dy]) => ch(x + dx, y + dy) === '.')) err(`Spind bei ${at(x, y)} hat keine freie Vorderseite`);
  }
  // Auto mit Funkgerät
  if (count.R || count.C) {
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ('CR'.includes(G[y][x])) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 - x0 !== 3 || y1 - y0 !== 1 || (count.C || 0) + (count.R || 0) !== 8 || count.R !== 1) err(`Auto muss genau ein 4×2-Block sein (obere Zeile CRCC, untere CCCC), gefunden ${x1 - x0 + 1}×${y1 - y0 + 1}`);
    else if (G[y0][x0 + 1] !== 'R') err('Funkgerät R muss im Auto oben an zweiter Stelle stehen (CRCC)');
  }
  // Aufgaben
  const regular = (count.G || 0) + (count.F || 0) + (count.V || 0) + (count.R || 0), team = def.team !== false && !!(count.Y);
  if (count.Y && count.Y !== 2) err(`Duo-Aufgabe braucht genau 2 'Y' (gefunden ${count.Y})`);
  if (count.Y === 2) {
    const ys = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (G[y][x] === 'Y') ys.push([x, y]);
    const d = Math.hypot(ys[0][0] - ys[1][0], ys[0][1] - ys[1][1]);
    if (d < 3 || d > 6.5) warn(`Duo-Stationen sind ${d.toFixed(1)} Kacheln auseinander (gewünscht 3–6)`);
    const ra = room[I(...ys[0])] || room[I(ys[0][0], ys[0][1] + 1)], rb = room[I(...ys[1])] || room[I(ys[1][0], ys[1][1] + 1)];
    if (ra !== rb) warn('Duo-Stationen liegen in verschiedenen Räumen');
  }
  if (team && (regular < 7 || regular > 10)) warn(`Team-Karte: ${regular} normale Aufgaben (gewünscht 9)`);
  if ((count.G || 0) < (team ? 3 : 1)) warn(`Nur ${count.G || 0} Aggregate`);
  const points = regular + (count.Y === 2 ? 2 : 0);
  if (def.need && def.need > points) err(`need=${def.need}, aber nur ${points} Punkte vorhanden`);
  // Mengen
  const rng = (c, lo, hi, name) => { const n = count[c] || 0; if (n < lo || n > hi) warn(`${n} ${name} (gewünscht ${lo}–${hi})`); };
  if (team) { rng('H', 6, 8, 'Haken'); rng('P', 12, 18, 'Paletten'); rng('W', 8, 16, 'Fenster'); rng('L', 12, 18, 'Spinde'); }
  if ((count.H || 0) < 3) err(`Nur ${count.H || 0} Haken`);
  // Tore
  const gates = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (G[y][x] === 'E') {
    const g = gates.find(g => g.y === y && g.x1 + 1 === x); if (g) g.x1 = x; else gates.push({ y, x0: x, x1: x });
  }
  for (const g of gates) {
    if (g.x1 - g.x0 !== 1) err(`Tor bei ${at(g.x0, g.y)} ist ${g.x1 - g.x0 + 1} breit (muss 2 sein)`);
    if (g.y > 1 && g.y < H - 1) err(`Tor bei ${at(g.x0, g.y)} nicht in der obersten/untersten Zeile`);
    const iy = g.y < H / 2 ? g.y + 1 : g.y - 1;
    for (let x = g.x0; x <= g.x1; x++) if (ch(x, iy) !== '.') err(`Vor dem Tor bei ${at(x, iy)} muss Boden sein`);
  }
  if (!gates.length) err('Kein Tor');
  if (team && gates.length !== 2) warn(`${gates.length} Tore (gewünscht 2)`);
  // Erreichbarkeit (Fenster und Paletten sind passierbar)
  const walk = c => '.DPWE'.includes(c);
  let start = null;
  const sp0 = (def.spawns || [])[0];
  if (sp0) { const s = sp0.survivors ? sp0.survivors[0] : (Array.isArray(sp0.s[0]) ? sp0.s[0] : sp0.s); start = [s[0] | 0, s[1] | 0]; }
  if (!start || !walk(ch(...start))) for (let y = 0; y < H && !start; y++) for (let x = 0; x < W; x++) if (G[y][x] === '.') { start = [x, y]; break; }
  const reach = new Uint8Array(W * H), st = [I(...start)]; reach[I(...start)] = 1;
  while (st.length) { const i = st.pop(), px = i % W, py = (i / W) | 0; for (const [dx, dy] of D4) { const nx = px + dx, ny = py + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = I(nx, ny); if (!reach[j] && walk(G[ny][nx])) { reach[j] = 1; st.push(j); } } }
  const unreach = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (G[y][x] === '.' && !reach[I(x, y)]) unreach.push(at(x, y));
  if (unreach.length) err(`${unreach.length} Bodenkacheln nicht erreichbar, z. B. ${unreach.slice(0, 5).join(' ')}`);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ('GFVHYL'.includes(G[y][x]) || G[y][x] === 'R') {
    const ok = D4.some(([dx, dy]) => reach[I(x + dx, y + dy)] && '.D'.includes(ch(x + dx, y + dy)));
    if (!ok && touchesFloor(x, y)) err(`Objekt '${G[y][x]}' bei ${at(x, y)} ist nicht erreichbar`);
  }
  // Startpunkte
  const onFloor = (p) => ch(p[0] | 0, p[1] | 0) === '.';
  (def.spawns || []).forEach((sp, k) => {
    const ss = sp.survivors || (Array.isArray(sp.s[0]) ? sp.s : [sp.s]), kp = sp.killer || sp.k;
    ss.forEach(p => { if (!onFloor(p)) err(`Spawn ${k + 1}: Survivor ${p} steht nicht auf Boden`); });
    if (!onFloor(kp)) err(`Spawn ${k + 1}: Killer ${kp} steht nicht auf Boden`);
    const dmin = Math.min(...ss.map(p => Math.hypot(p[0] - kp[0], p[1] - kp[1])));
    if (dmin < 15) warn(`Spawn ${k + 1}: Killer nur ${dmin.toFixed(1)} Kacheln vom nächsten Survivor (gewünscht ≥ 15)`);
    if (team && ss.length < 3) warn(`Spawn ${k + 1}: nur ${ss.length} Survivor-Startpunkte`);
  });
  if (!(def.spawns || []).length) err('Keine Startpunkte (spawns)');
  // Lampen
  (def.lamps || []).forEach(L => { const x = Array.isArray(L) ? L[0] : L.x, y = Array.isArray(L) ? L[1] : L.y; if (!room[I(x | 0, y | 0)]) warn(`Lampe bei (${x},${y}) liegt außerhalb eines Raums`); });
  info.push(`${W}×${H}, ${markers.length} Räume, Aufgaben ${regular}${count.Y === 2 ? ' + Duo' : ''} (Punkte ${points}${def.need ? ', nötig ' + def.need : ''}), Haken ${count.H || 0}, Paletten ${count.P || 0}, Fenster ${count.W || 0}, Spinde ${count.L || 0}, Tore ${gates.length}`);
  return { E, Wn, info };
}

function report(id, def) {
  const { E, Wn, info } = check(def, id);
  console.log(`\n== ${id} (${def.name || '?'}) – ${info.join('; ')}`);
  // gleiche Meldungen zusammenfassen (z. B. viele Randkacheln)
  const show = (list, mark) => { const g = {}; for (const m of list) (g[m.replace(/ bei \(.*$/, '')] = g[m.replace(/ bei \(.*$/, '')] || []).push(m);
    for (const k in g) { g[k].slice(0, 3).forEach(m => console.log(`  ${mark} ${m}`)); if (g[k].length > 3) console.log(`  ${mark} … und ${g[k].length - 3} weitere: ${k}`); } };
  show(E, '✗'); show(Wn, '!');
  if (!E.length) console.log(Wn.length ? '  → spielbar, Hinweise beachten' : '  → alles in Ordnung');
  return E.length;
}

/* ChatGPT-Antwort (Markdown) → Kartendefinition.
   Robust gegen Kopierfehler: ```-Zeilen dürfen fehlen, vor der ersten Rasterzeile darf Fremdtext kleben,
   das JSON darf direkt an der letzten Rasterzeile hängen. */
const GRID_CHARS = 'T#WD.PtkBOLHGFVRCEY123456789abcdef';
const isGridLine = l => l.length >= 20 && [...l].every(c => GRID_CHARS.includes(c));
const gridShare = l => l.length ? [...l].filter(c => GRID_CHARS.includes(c)).length / l.length : 0;
const cleanLine = l => l.replace(/\s+$/, '').replace(/^\s*"/, '').replace(/",?$/, '');
const fences = txt => [...txt.matchAll(/```([a-zA-Z]*)[ \t]*\r?\n([\s\S]*?)```/g)].map(m => ({ lang: m[1].toLowerCase(), body: m[2], start: m.index, end: m.index + m[0].length }));
/* JSON: ```json-Block, sonst vom ersten { bis zur passenden } (Zeichenketten beachtet) */
function findJson(txt) {
  const f = fences(txt).find(b => b.lang === 'json' || /^\s*\{/.test(b.body));
  if (f) return f;
  const a = txt.indexOf('{'); if (a < 0) return null;
  let depth = 0, str = false, esc = false;
  for (let i = a; i < txt.length; i++) {
    const c = txt[i];
    if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; continue; }
    if (c === '"') str = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) return { body: txt.slice(a, i + 1), start: a, end: i + 1 };
  }
  return null;
}
/* Raster: Codeblock mit Rasterzeilen, sonst die längste Folge gleich langer Rasterzeilen (≥ 20 Zeichen) */
function findGrid(txt, notes) {
  for (const f of fences(txt)) {
    const rows = f.body.split(/\r?\n/).map(cleanLine).filter(r => r.length);
    if (rows.length >= 10 && rows.filter(isGridLine).length >= rows.length * .8) return rows;
  }
  const L = txt.split(/\r?\n/).map(cleanLine);
  let best = null;
  for (let i = 0; i < L.length;) {
    if (!isGridLine(L[i])) { i++; continue; }
    let j = i + 1; while (j < L.length && isGridLine(L[j]) && L[j].length === L[i].length) j++;
    if (!best || j - i > best.j - best.i || (j - i === best.j - best.i && L[i].length > best.w)) best = { i, j, w: L[i].length };
    i = j;
  }
  if (!best || best.j - best.i < 10) return null;
  const rows = L.slice(best.i, best.j), w = best.w, seg = /[T#WD.PtkBOLHGFVRCEY1-9a-f]+/g;
  // Nachbarzeilen gleicher Breite mit einzelnen Tippfehlern mitnehmen (der Prüfer meldet die Zeichen)
  let i = best.i - 1, j = best.j;
  while (i >= 0 && L[i].length === w && gridShare(L[i]) >= .9) rows.unshift(L[i--]);
  while (j < L.length && L[j].length === w && gridShare(L[j]) >= .9) rows.push(L[j++]);
  // Fremdtext vor/nach der ersten bzw. letzten Rasterzeile abschneiden
  if (i >= 0) { const m = (L[i].match(seg) || []).pop(); if (m && m.length === w && L[i].endsWith(m)) { rows.unshift(m); notes.push(`Fremdtext vor der ersten Rasterzeile entfernt: "${L[i].slice(0, L[i].length - w)}"`); } }
  if (j < L.length) { const m = (L[j].match(seg) || [])[0]; if (m && m.length === w && L[j].startsWith(m)) { rows.push(m); notes.push(`Fremdtext nach der letzten Rasterzeile entfernt: "${L[j].slice(w)}"`); } }
  return rows;
}
function parseAnswer(txt, notes = []) {
  const js = findJson(txt);
  if (!js) throw new Error('JSON nicht gefunden (Block mit "name", "rooms", "lamps", "spawns")');
  let meta;
  try { meta = JSON.parse(js.body); } catch (e) { throw new Error('JSON fehlerhaft: ' + e.message); }
  // JSON herausschneiden, damit eine angeklebte Rasterzeile ("TTTT{") frei wird
  const rows = findGrid(txt.slice(0, js.start) + '\n' + txt.slice(js.end), notes);
  if (!rows) throw new Error('Raster nicht gefunden (mindestens 10 gleich lange Zeilen aus Rasterzeichen)');
  const rooms = {}; for (const [k, d] of Object.entries(meta.rooms || {})) rooms[k] = { name: d.name, f: d.floor || d.f, out: d.outside || d.out ? 1 : 0 };
  return { name: meta.name, team: true, need: meta.need || 8, grid: rows, rooms, lamps: meta.lamps || [], spawns: meta.spawns || [] };
}
/* Selbsttest: dieselbe Antwort in mehreren Kopier-Varianten muss gleich ausgelesen werden */
function selftest() {
  const ctx = { MAPS: {}, TAU: Math.PI * 2, Math, Object, JSON };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'maps', 'schule.js'), 'utf8'), ctx);
  const d = ctx.MAPS['schule-team'], rooms = {};
  for (const [k, v] of Object.entries(d.rooms)) rooms[k] = { name: v.name, floor: v.f, outside: !!v.out };
  const grid = d.grid.join('\n'), json = JSON.stringify({ name: 'Test', rooms, lamps: [[6.5, 19.3, 3, 'warm']], spawns: d.spawns.map(s => ({ survivors: s.s, killer: s.k })) }, null, 2);
  const v = {
    'Raster und JSON in Codeblöcken': `Hier ist die Karte:\n\n\`\`\`\n${grid}\n\`\`\`\n\nUnd die Daten:\n\n\`\`\`json\n${json}\n\`\`\`\n`,
    'Raster ohne Codeblock': `Hier ist die Karte:\n\n${grid}\n\nUnd die Daten:\n\n\`\`\`json\n${json}\n\`\`\`\n`,
    'Raster mit Text-Codeblock': `\`\`\`text\n${grid}\n\`\`\`\n\`\`\`json\n${json}\n\`\`\``,
    'ohne alle Codeblöcke, JSON angeklebt': `(hier einfügen)${grid}${json}`,
    'JSON ohne Codeblock, Raster mit': `\`\`\`\n${grid}\n\`\`\`\n${json}\n`,
    'Raster als JS-Strings': d.grid.map(r => `  "${r}",`).join('\n') + '\n' + json,
  };
  let ok = true; const ref = JSON.stringify(parseAnswer(v['Raster und JSON in Codeblöcken']));
  for (const [name, txt] of Object.entries(v)) {
    let res; try { res = JSON.stringify(parseAnswer(txt)); } catch (e) { res = 'FEHLER: ' + e.message; }
    const pass = res === ref; ok = ok && pass; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  → ' + res.slice(0, 80)}`);
  }
  for (const [name, txt, want] of [['ohne Raster', `\`\`\`json\n${json}\n\`\`\``, 'Raster nicht gefunden'], ['ohne JSON', `\`\`\`\n${grid}\n\`\`\``, 'JSON nicht gefunden']]) {
    let msg = ''; try { parseAnswer(txt); } catch (e) { msg = e.message; }
    const pass = msg.startsWith(want); ok = ok && pass; console.log(`${pass ? 'PASS' : 'FAIL'}  Fehlermeldung ${name}: "${msg}"`);
  }
  return ok;
}
function toJs(id, def) {
  const q = s => JSON.stringify(s);
  const rooms = Object.entries(def.rooms).map(([k, d]) => `    ${/^\d+$/.test(k) ? k : q(k)}: { name: ${q(d.name || '')}, f: ${q(d.f)}${d.out ? ', out: 1' : ''} },`).join('\n');
  return `'use strict';
/* Karte: ${def.name} (Team-Modus) – entworfen mit ChatGPT, geprüft mit tools/mapcheck.js */
MAPS[${q(id)}] = {
  name: ${q(def.name)}, team: true, need: ${def.need},
  grid: [
${def.grid.map(r => '    ' + q(r) + ',').join('\n')}
  ],
  rooms: {
${rooms}
  },
  lamps: ${JSON.stringify(def.lamps)},
  spawns: ${JSON.stringify(def.spawns.map(s => ({ s: s.survivors || s.s, k: s.killer || s.k })))},
};
`;
}

(function main() {
  const args = process.argv.slice(2), file = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--id');
  if (args.includes('--selftest')) process.exit(selftest() ? 0 : 1);
  if (!file) { console.log('Aufruf: node tools/mapcheck.js <js/maps/x.js | antwort.md --id name [--write]>'); process.exit(2); }
  const txt = fs.readFileSync(file, 'utf8');
  let errors = 0;
  if (file.endsWith('.js')) {
    const ctx = { MAPS: {}, TAU: Math.PI * 2, Math, Object, JSON };
    vm.runInNewContext(txt, ctx, { filename: file });
    for (const [id, def] of Object.entries(ctx.MAPS)) errors += report(id, def);
  } else {
    const ia = args.indexOf('--id'), id = ia >= 0 ? args[ia + 1] : path.basename(file).replace(/\.\w+$/, '');
    const notes = [];
    let def;
    try { def = parseAnswer(txt, notes); } catch (e) { console.log('✗ ' + e.message); process.exit(1); }
    notes.forEach(n => console.log('  i ' + n));
    errors += report(id, def);
    if (args.includes('--write')) {
      if (errors) { console.log('\nNicht geschrieben: erst die Fehler beheben.'); }
      else { const out = path.join(__dirname, '..', 'js', 'maps', id + '.js'); fs.writeFileSync(out, toJs(id, def)); console.log('\nGeschrieben: ' + out + '  (in index.html eintragen!)'); }
    }
  }
  process.exit(errors ? 1 : 0);
})();

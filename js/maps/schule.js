'use strict';
/* Karte: Schule – Solo-Karte (unverändert) und kleine Team-Variante mit Duo-Aufgabe in der Turnhalle */
MAPS.schule = {
  name: 'Schule',
  grid: [
  "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
  "TTTTTTTTTTTTTTTTTTTTTEETTTTTTTTTTTTTTTTTTTTTTT",
  "T.9.........................T................T",
  "T...............TT..........T.......H........T",
  "T.......G.......T...........T................T",
  "T......................T....P...........T....T",
  "T..TT.......T...............T..........TT....T",
  "T...T.......P...............T....T...........T",
  "T...........T................................T",
  "######W############D###########W#########D####",
  "#........tt..#........tt.#...................#",
  "#1...........#2..........#........G..........#",
  "#.tt.tt..tt..#.tt.tt..tt.#..................4#",
  "#............W...........W...................#",
  "#.ttPtt..tt..#.tt.ttPttt.#....B.BBBBBBB.B....#",
  "#............#...........#....BPBBBBBBBPB....#",
  "#L...........#..........L#....B.BBBBBBB.B....#",
  "#####D##############D#####...................#",
  "#.......LL..L.........LL.#...................#",
  "#3..........P............D.................H.#",
  "#...........L..LL........#L..................#",
  "####D############D##################D#########",
  "#............5#L....#.......................L#",
  "#F............#.....#..BBBB..........B.......#",
  "#kkkPkk.tt.tt.#B....#........OOOO....B...BBB.#",
  "#.......tt.tt.#B....D........OOOOV...P.......#",
  "#.............#.6...#..BBBB..OOOO....B.......#",
  "#..tt.tt.tt...#...BB#................B.......#",
  "#H............#L....#L......................7#",
  "########W###D###############W###########D#####",
  "T............................................T",
  "T.............................T...........T..T",
  "T........TT.....CRCC..........T.......H......T",
  "T.........T.....CCCC..........P..............T",
  "T..T....H.....................T......TT......T",
  "T.............................T..............T",
  "T8...........................................T",
  "TTTTTTTTTTTTTTTTTTTTTTTTEETTTTTTTTTTTTTTTTTTTT"  ],
  /* f: Boden, amb: Grundhelligkeit, out: draußen, wall: Wandschmuck (poster, gym, tile, pipe) */
  rooms: {
    1: { name: 'Klassenzimmer', f: 'wood', amb: .56 }, 2: { name: 'Klassenzimmer', f: 'wood', amb: .56 },
    3: { name: 'Flur', f: 'lino', amb: .54, wall: 'poster' }, 4: { name: 'Turnhalle', f: 'gym', amb: .6, wall: 'gym' },
    5: { name: 'Mensa', f: 'tiles', amb: .56, wall: 'tile' }, 6: { name: 'Lager', f: 'concrete', amb: .5, wall: 'pipe' },
    7: { name: 'Heizungskeller', f: 'cellar', amb: .5, wall: 'pipe' }, 8: { name: 'Parkplatz', f: 'asphalt', amb: .64, out: 1 },
    9: { name: 'Schulhof', f: 'grass', amb: .64, out: 1 },
  },
  /* Tafeln an der Nordwand der Klassenzimmer */
  boards: [{ y: 9, x0: 3, x1: 10, r: 1, art: 'tally' }, { y: 9, x0: 15, x1: 22, r: 2, art: 'smile' }],
  lamps: [
    { x: 6.5, y: 19.3, r: 3.3, a: .7, fl: .15 }, { x: 19.5, y: 19.3, r: 3.3, a: .7, fl: 0 },
    { x: 35.5, y: 12.5, r: 5, a: .6, fl: .5 }, { x: 7, y: 23, r: 3.6, a: .6, fl: .1 },
    { x: 27, y: 25.5, r: 3.8, a: .55, fl: .3, red: 1 }, { x: 17.5, y: 23.6, r: 2.4, a: .6, fl: .6 },
    { x: 41.5, y: 25, r: 3, a: .4, fl: .7, red: 1 },
  ],
  spawns: [
    { s: [2.5, 11.5], k: [42.5, 27.5] }, { s: [10.5, 22.5], k: [42.5, 11.5] },
    { s: [3.5, 3.5], k: [41.5, 34.5] }, { s: [21.5, 26.5], k: [5.5, 3.5] },
  ],
  demoRooms: [1, 2, 3, 4, 5, 7, 8, 9], patrolFallback: 3,
  /* Bodenbemalung: Turnhallen-Linien, Parkplatz, Hüpfkästchen, Kreide-Grinsen */
  decorFloor(f) {
    f.strokeStyle = 'rgba(230,225,215,.2)'; f.lineWidth = .06;
    f.strokeRect(27, 10.8, 17, 9.4); f.beginPath(); f.moveTo(35.5, 10.8); f.lineTo(35.5, 20.2); f.stroke();
    f.beginPath(); f.arc(35.5, 15.5, 2.2, 0, TAU); f.stroke();
    f.strokeStyle = 'rgba(180,40,40,.3)'; f.beginPath(); f.arc(27, 15.5, 3, -Math.PI / 2, Math.PI / 2); f.stroke(); f.beginPath(); f.arc(44, 15.5, 3, Math.PI / 2, Math.PI * 1.5); f.stroke();
    f.strokeStyle = 'rgba(220,220,210,.22)'; f.lineWidth = .07;
    for (const px of [15.4, 20.6, 25.8]) { f.beginPath(); f.moveTo(px, 31.2); f.lineTo(px, 34.6); f.stroke(); }
    f.strokeStyle = 'rgba(235,231,220,.2)'; f.lineWidth = .05;
    [[4, 30.6], [4, 31.4], [3.6, 32.2], [4.4, 32.2], [4, 33]].forEach(([hx, hy]) => f.strokeRect(hx, hy, .8, .8));
    f.beginPath(); f.arc(25, 34.8, .9, 0, TAU); f.stroke();
    f.fillStyle = 'rgba(235,231,220,.25)'; f.fillRect(24.55, 34.4, .14, .22); f.fillRect(25.3, 34.4, .14, .22);
    f.strokeStyle = 'rgba(195,18,31,.45)'; f.lineWidth = .09; f.beginPath(); f.moveTo(24.35, 34.95); f.quadraticCurveTo(25, 35.55, 25.65, 34.95); f.stroke();
  },
  /* Flecken, Papiere im Schulhaus, Blätter draußen */
  decorStains(f, rnd, splat) {
    splat(10.5, 19.5, .8); splat(33.5, 12.5, .6); splat(3.5, 26, .7); splat(25, 27.5, .9); splat(42, 18, .5);
    for (let k = 0; k < 26; k++) { const i = pick([...roomFloor[1], ...roomFloor[2], ...roomFloor[3]]); f.save(); f.translate(i % W + rnd(), ((i / W) | 0) + rnd()); f.rotate(rnd() * 3); f.fillStyle = `rgba(215,210,195,${.25 + rnd() * .25})`; f.fillRect(-.12, -.09, .24, .17); f.restore(); }
    for (let k = 0; k < 140; k++) { const i = pick([...roomFloor[8], ...roomFloor[9]]); f.fillStyle = ['rgba(110,60,25,.5)', 'rgba(140,90,30,.4)', 'rgba(80,40,20,.5)'][k % 3]; f.beginPath(); f.ellipse(i % W + rnd(), ((i / W) | 0) + rnd(), .07, .04, rnd() * 3, 0, TAU); f.fill(); }
  },
};
/* Team-Variante (klein, zum Testen): Duo-Aufgabe an der Südwand der Turnhalle, 5 von 7 Punkten nötig */
MAPS['schule-team'] = Object.assign({}, MAPS.schule, {
  name: 'Schule (klein)', team: true, need: 5,
  // Bot-Abstimmung (js/bots.js, Bots.cfg): Die kleine Karte hat sehr viele Fenster – Bots nutzen sie auf der Flucht seltener
  bots: { vault: 2.2, win: 0 },
  grid: MAPS.schule.grid.map((r, y) => y === 20 ? r.slice(0, 30) + 'Y' + r.slice(31, 35) + 'Y' + r.slice(36) : r),
  spawns: [
    { s: [[2.5, 11.5], [10.5, 22.5], [21.5, 26.5]], k: [42.5, 11.5] },
    { s: [[3.5, 3.5], [21.5, 26.5], [2.5, 11.5]], k: [41.5, 34.5] },
    { s: [[10.5, 22.5], [3.5, 3.5], [21.5, 26.5]], k: [42.5, 27.5] },
  ],
});

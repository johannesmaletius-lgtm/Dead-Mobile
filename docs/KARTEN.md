# Karten für den Team-Modus (Vorgabe für ChatGPT)

Diese Datei kann **komplett** in ChatGPT eingefügt werden. Das Ergebnis (Raster + JSON-Block) kommt
zurück zu Claude Code, wird dort mit `tools/mapcheck.js` geprüft und eingebaut.

---

## Auftrag

Entwirf **eine** Karte für ein Stealth-Horror-Spiel in Draufsicht (Kacheln, 1 Zeichen = 1 Kachel).
3 Überlebende reparieren Aufgaben und fliehen durch ein Tor, ein Killer (KI) jagt sie.
Gewünscht sind zwei Karten (bitte nacheinander, jeweils eine Antwort):

1. **„Ferienlager"** – Waldcamp: Blockhütten, Speisesaal, Bootshaus, Waschhaus, viel Wald und Wiese.
2. **„Krankenhaus"** – verlassene Klinik: Flure, Krankenzimmer, OP, Keller mit Kesseln, Parkplatz, Innenhof.

## Größe

Breite 58–70 Zeichen, Höhe 40–50 Zeilen. **Alle Zeilen exakt gleich lang.**

## Legende

| Zeichen | Bedeutung | Hinweise |
|---|---|---|
| `T` | Baum | Der **komplette Außenrand** besteht aus `T`. Bäume im Inneren sind Hindernisse (nur draußen). |
| `#` | Wand | Gebäude-Außen- und Innenwände |
| `D` | Tür | in einer Wandlinie (links+rechts Wand **oder** oben+unten Wand), auf den beiden anderen Seiten Boden |
| `W` | Fenster (zum Drüberspringen) | wie Tür: sitzt in einer Wandlinie, beide Seiten Boden |
| `.` | Boden | |
| `P` | Palette (umwerfbar) | in einer **1 Kachel breiten Lücke**: links+rechts fest **oder** oben+unten fest, die anderen zwei Seiten Boden. „Fest" ist alles außer `.`, `D`, `P`. |
| `t` | Tisch (niedrig) | auch Bänke, Betten |
| `k` | Theke | Tresen, Anmeldung, Küchenzeile |
| `B` | Regal / Tribüne (hoch) | |
| `O` | Kessel (hoch) | als Block, mindestens 3×2 |
| `L` | Spind (Versteck) | muss an mindestens einer Seite `.` berühren |
| `H` | Haken | **6–8 Stück**, gut verteilt, jeder berührt Boden |
| `G` | Aggregat (Aufgabe) | berührt Boden |
| `F` | Sicherungskasten (Aufgabe) | berührt Boden |
| `V` | Ventil (Aufgabe) | berührt Boden |
| `R`,`C` | Funkgerät im Streifenwagen (Aufgabe) | optional, genau dieser Block draußen: obere Zeile `CRCC`, untere Zeile `CCCC` |
| `Y` | Duo-Aufgabe | **genau 2× `Y`**, 3–6 Kacheln auseinander, im selben Raum, jedes berührt Boden. Braucht zwei Spieler gleichzeitig, zählt doppelt. |
| `E` | Tor (Ausgang) | **genau 2 Tore**, je 2 nebeneinander (`EE`), nur in der **obersten oder untersten Zeile** (ersetzen dort zwei `T`). Direkt innen davor Boden. Am besten ein Tor oben, eins unten, weit auseinander. |
| `1`–`9`, `a`–`f` | Raum-Markierung | genau **eine** pro abgeschlossenem Bereich (Raum oder Außenzone), auf eine Bodenkachel. Max. 15. Wände, Türen und Fenster trennen Räume. |

## Spielregeln für gutes Kartendesign

- **Aufgaben:** genau **7 normale Aufgaben** (`G`, `F`, `V`, ggf. `R`; mindestens 3 `G`) plus das Duo-Paar `Y`.
  Höchstens eine Aufgabe pro Raum (große Außenzonen dürfen zwei haben). Die Aufgaben sollen über die ganze Karte verteilt sein.
- **Paletten:** 12–18, in Gängen, Türdurchgängen und an „Schleifen" um Möbelblöcke, Bäume und Gebäudeecken,
  damit man den Killer im Kreis laufen lassen kann (Loops). Nie zwei Paletten direkt nebeneinander.
- **Fenster:** 8–14, zwischen Räumen und nach draußen, ebenfalls für Loops.
- **Spinde:** 12–18, oft in Zweier- oder Dreiergruppen an Wänden.
- **Alles verbunden:** Jede Bodenkachel muss zu Fuß erreichbar sein (Türen/Paletten offen gedacht).
  Keine Sackgassen ohne Ausweg rund um Aufgaben.
- **Gebäude** brauchen mehrere Eingänge (Türen + Fenster), große Räume dürfen innen Möbel-Inseln haben.
- **Draußen** viel Platz zwischen Baumgruppen (Bäume als Einzelbäume oder Gruppen von 2–4).

## Ausgabeformat (bitte genau so)

1. Das Raster in **einem** Codeblock, ohne Zeilennummern und ohne Anführungszeichen.
2. Danach **ein** JSON-Codeblock:

```json
{
  "name": "Ferienlager",
  "rooms": {
    "1": { "name": "Speisesaal", "floor": "tiles" },
    "2": { "name": "Hütte Nord", "floor": "wood" },
    "8": { "name": "Wald Nord", "floor": "grass", "outside": true }
  },
  "lamps": [[12.5, 8.5, 3.5, "warm"], [40.5, 20.5, 3, "red"]],
  "spawns": [
    { "survivors": [[5.5, 6.5], [30.5, 40.5], [60.5, 12.5]], "killer": [33.5, 22.5] },
    { "survivors": [[8.5, 38.5], [55.5, 6.5], [20.5, 20.5]], "killer": [50.5, 30.5] },
    { "survivors": [[44.5, 41.5], [6.5, 20.5], [30.5, 3.5]], "killer": [15.5, 30.5] }
  ]
}
```

- `floor`: einer von `wood`, `lino`, `gym`, `tiles`, `concrete`, `cellar`, `asphalt`, `grass`.
- `outside: true` für Außenzonen (heller).
- `lamps`: 6–12 Lampen `[x, y, radius, "warm" | "red"]` (x/y = Kachel + 0.5), nur auf Boden in Innenräumen oder am Auto.
- `spawns`: 3 Varianten. Die drei Überlebenden starten **auf Boden**, weit voneinander entfernt; der Killer mindestens 15 Kacheln von jedem.

## Beispiel: die bestehende Schule (46×38, Solo-Karte)

Ziffern sind Raum-Markierungen. Raum 4 ist die Turnhalle, 5 die Mensa, 6/7 der Keller, 8/9 sind draußen.

```
TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
TTTTTTTTTTTTTTTTTTTTTEETTTTTTTTTTTTTTTTTTTTTTT
T.9.........................T................T
T...............TT..........T.......H........T
T.......G.......T...........T................T
T......................T....P...........T....T
T..TT.......T...............T..........TT....T
T...T.......P...............T....T...........T
T...........T................................T
######W############D###########W#########D####
#........tt..#........tt.#...................#
#1...........#2..........#........G..........#
#.tt.tt..tt..#.tt.tt..tt.#..................4#
#............W...........W...................#
#.ttPtt..tt..#.tt.ttPttt.#....B.BBBBBBB.B....#
#............#...........#....BPBBBBBBBPB....#
#L...........#..........L#....B.BBBBBBB.B....#
#####D##############D#####...................#
#.......LL..L.........LL.#...................#
#3..........P............D.................H.#
#...........L..LL........#L..................#
####D############D##################D#########
#............5#L....#.......................L#
#F............#.....#..BBBB..........B.......#
#kkkPkk.tt.tt.#B....#........OOOO....B...BBB.#
#.......tt.tt.#B....D........OOOOV...P.......#
#.............#.6...#..BBBB..OOOO....B.......#
#..tt.tt.tt...#...BB#................B.......#
#H............#L....#L......................7#
########W###D###############W###########D#####
T............................................T
T.............................T...........T..T
T........TT.....CRCC..........T.......H......T
T.........T.....CCCC..........P..............T
T..T....H.....................T......TT......T
T.............................T..............T
T8...........................................T
TTTTTTTTTTTTTTTTTTTTTTTTEETTTTTTTTTTTTTTTTTTTT
```

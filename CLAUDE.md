# Dead Mobile – Leitfaden für KI-Agenten

Stealth-Horror-Browserspiel (Canvas 2D, Web Audio). Kein Build, keine Abhängigkeiten.
Es läuft per Doppelklick auf `index.html` (file://). Deshalb gibt es **keine ES-Module**:
Alle `js/*.js` sind klassische Skripte und teilen sich den globalen Gültigkeitsbereich.
Die Reihenfolge der `<script>`-Tags in `index.html` ist die Ladereihenfolge.

Plan und Spielregeln für den Mehrspieler-Ausbau: `docs/PLAN.md`. Kartenformat: `docs/KARTEN.md`.

## Dateien (lies nur, was du brauchst)
| Datei | Inhalt |
|---|---|
| `index.html` | Markup (Titel, Pause, Ende, Tutorial-Karte) + Skript-Reihenfolge |
| `css/style.css` | Gesamtes CSS |
| `js/core.js` | Hilfsfunktionen (`clamp`, `lerp`, `hash` …), `CFG` (Stellschrauben), Kartenregister `MAPS` |
| `js/maps/*.js` | Kartendefinitionen `MAPS[id] = { grid, rooms, lamps, spawns, need, decor… }` (`schule` = Solo, `schule-team` = kleine Team-Testkarte) |
| `js/map.js` | `loadMap(id)`: Räume/Masken, Objekte (Aufgaben inkl. Duo, Paletten, Fenster, Spinde, Haken, Tore, Kessel), `LAMPS`, `SPAWNS`, `NEED`; Kollision, Sichtlinie, A* (`findPath`) |
| `js/audio.js` | Web-Audio-Synth `A`, Soundeffekte `SFX`, Verfolgungsmusik |
| `js/state.js` | Globale Spielzustände (`state`, `S`, `K`, `T` …), Speicherstand, `newSurv`/`newKiller`, `startGame` |
| `js/tutorial.js` | Spielbares Tutorial (Schritte `TSTEPS`) |
| `js/survivor.js` | Eingabe lesen, Survivor-Bewegung, Aktionen (Palette, Fenster, Spind) |
| `js/tasks.js` | Aufgaben + Quick-Time-Events (Aggregat, Sicherung, Funk, Ventil) |
| `js/killer.js` | Killer-KI (Sicht, Patrouille, Suche, Verfolgung, Ausfallschritt, Lärm) |
| `js/flow.js` | Treffer, Erwischt-/Haken-Sequenz, Sieg, Endbildschirm, `step()` (Welt-Update), Kamera |
| `js/rules.js` | Team-Regeln: Boden, Tragen, Haken, Retten, Heilen, Zappeln, Duo, Killer-Teamteil, Team-Ende, Zuschauen |
| `js/hkiller.js` | Killer als Spieler: Bewegung, Aktionsknopf (`killerAction`/`killerDo`), Jagd-Erkennung (`hkAware`) |
| `js/bots.js` | Bots (`Bots`): KI-Überlebende für freie Plätze – Flucht, Ausweichen, Team-Plan (retten, heilen, Duo, Aufgaben, Tor) |
| `js/render.js` | Canvas-Setup, Grundformen, Boden vorzeichnen, Raum-Pfade fürs Licht |
| `js/figures.js` | Figuren zeichnen: Skins `SKINS` (`cop`, `medic`, `janitor`), `SKIN_NAMES`, Killer, `skinPortrait(skin, px)`; Vorschau `tools/skins.html` |
| `js/tiles.js` | Kacheln zeichnen (Wände, Möbel, Aufgaben, Paletten, Tore, Auto) |
| `js/light.js` | Licht, Leuchten, `render()` setzt das Bild zusammen |
| `js/hud.js` | Bildschirm-Ebenen, HUD, Aktionsknopf, QTE-Anzeige |
| `js/net.js` | Netz: Räume, Spieler-IDs, Nachrichten (`Net`), Transport PeerJS bzw. BroadcastChannel |
| `js/lobby.js` | Team-Menü und Lobby (`Lobby`): Name, Figur, Bots, Raum erstellen/beitreten, Start |
| `js/sync.js` | Netz Teil 2 (`Sync`): Synchronisierung im Spiel – Host maßgeblich, Schnappschüsse, Ereignisse, Glättung |
| `js/main.js` | Eingabe (Touch/Tastatur), Bildschirme, Start, Spielschleife, Test-API `window.__ns` |

## Mehrere Überlebende
- `SV` = alle Survivors, `S` = der eigene (Eingabe, Kamera, HUD), `MODE` = `'solo'` | `'team'`.
  `startGame()` = Solo (unverändert), `startTeam(mapId, roster, spawnIdx?, killer?)` = Team mit 3 Plätzen (Bots füllen auf; `spawnIdx` online vom Host;
  `killer` = `'local'` | `'remote'` | leer → `KP`).
- Fremde Survivors laufen über `updateOther(sv, dt)` → `sv.ctl(sv, dt)` (Bot-KI bzw. Netz setzt das).
- Bewegung für beliebige Figuren: `goTo(e, x, y, spd, dt)` (A*, springt/zerbricht), `moveAgent`,
  `survMove(sv, inp, dt)`, `survMoved(sv, md, dt)` (Spuren, Blut, Tor). Aktionen nehmen den Survivor als
  letzten Parameter: `dropPallet(p, sv)`, `vaultOver(o, isWin, sv)`, `hide(L, sv)`, `unhide(sv)`, `hitSurvivor(sv)`.
- Killer: `K.target` (Jagdziel), `K.focus` (gerade gesehen), `killerSees(sv)`, `huntTarget()`.
- Aufgaben haben `points` (Duo = 2, `t.stations`), Tore öffnen bei `taskPoints() >= NEED`.
- Team-Regeln (Phase 2) stehen in `js/rules.js` (siehe unten).
- `viewer()` (wessen Sicht), `isWorked(t)`, `skinOf(sv)`, `inPlay(sv)`, `chasedView()` (wird der Betrachter gejagt? → Musik, Zoom, roter Rand)
  stehen in `js/state.js`.
- Aufgaben im Team dauern länger und sind enger: `genTime()`, `fuseN()`, `radioN()`, `taskTime(t)` (Bots) und `CFG.tGen` … in `js/core.js`.
  Solo/Tutorial nutzen weiter `CFG.genTime`/`valveTime` (3 Sicherungstreffer, 2 Funkrunden).
- Ton: `hear(x, y, fn, min?)` (`js/audio.js`) spielt Welt-Geräusche im Team je nach Entfernung zum Betrachter leiser; `fx()` nutzt es für alle,
  die nicht selbst betroffen sind. Neue Welt-Geräusche darüber abspielen. Stich + Blitz beim Jagdbeginn: `chaseCue()` (nur der Gejagte).

## Killer: KI-Köpfchen und Killer als Spieler
- **KI (nur Team, `CFG.smart`):** `swipe` (schlägt jeden in Reichweite, auch Nicht-Ziele), `retarget` (Zielwechsel auf Nähere/Verletzte),
  `smartChase` (Finte: `altPath` sperrt die nächsten Wegkacheln über `kAvoid` → er kommt andersherum; Fenster/lauernde Paletten umlaufen),
  `loopLimit`/`memAdd` (`K.mem.loops`: Paletten früher zerbrechen), `L.uses` (beliebte Spinde zuerst prüfen). 35-s-Regel: `CFG.loopDrop`.
- **Spieler (`KP`, `K.human`):** `KP === 'local'` → `S` ist ein Platzhalter (`ghost`, nicht in `SV`), `viewer()` liefert `K`
  (dafür trägt `K` die Felder `hp`, `hidden`, `out` …). `updateKiller` → `humanKiller(dt)`; Aktionen laufen als `K.act` wie bei der KI (`runAct`),
  Ausfallschritt/Erholung lenkt der Spieler. `computeAction`/`doAction` reichen an `killerAction`/`killerDo` weiter.
  Für Menschen gelten 35-s-Regel und Camping-Verbot nicht; dafür läuft die Haken-Zeit halb so schnell, solange er am Haken steht (`CFG.hkCampR`).
  Offline: „Als Killer spielen“ (`Lobby`), online: Rolle im Raum („Killer spielen“, `Net.setRole`, Nachricht `role`).

## Team-Regeln (Phase 2, `js/rules.js`)
Alles wirkt nur mit `MODE === 'team'`. Kopfkommentar in `js/rules.js` = vollständige Schnittstelle.
- **Zustandswechsel** (nur über diese Funktionen, fürs Netz): `downSurv(sv)`, `pickUp(sv)`, `dropCarried('wiggle'|'pallet')`,
  `hookSurv(sv, h)`, `unhookSurv(sv, retter)`, `healDone(sv)`, `escapeSurv(sv, tor)`, `killSurv(sv, 'hook'|'bleed'|'mori')`, `teamCheckEnd()`.
- **Effekte** getrennt: `fx(art, sv, extra)` → `FX[art]` (Ton, Partikel; Flash/Zeitlupe/starkes Shake nur für `S`).
- **Bots (Phase 3)**, für jeden Survivor, ohne QTE: `startWorkFor(sv, t, station)`, `stopWorkFor(sv)`, `workStep(sv, t, dt, skill)`,
  `duoStation(t, sv)`, `canHeal`/`healStep(heiler, ziel, dt, skill)`, `canUnhook`/`unhookStep(retter, ziel, dt)`, `wiggle(sv)`,
  `survSpeed(sv, rennen)`, `isFree`, `isDowned`, `hookBusy`. `sv.ctl` läuft auch am Boden/getragen/am Haken.
- **Felder Survivor:** `hp` 2/1/0, `carried`, `hung`, `out`, `hookN`, `hookProg` (0–1, ab 0,5 Kampfphase), `unhookProg`, `healProg`,
  `wiggle`, `heal`/`unhook` (wen er gerade heilt/rettet), `healedT`, `outT`, `leave`, `spec`.
  **Killer:** `carry`, `hookGoal`, `campUntil`/`campRoom`, `hunt {sv, t, last}` (35-s-Regel), `ignore {sv, until}`, Modi `'fetch'`/`'carry'`.
- Wer geheilt wird (`beingHealed(sv)`), darf nichts anderes tun: Aufgabe/Heilen/Retten brechen ab, der Aktionsknopf ist gesperrt (`'healed'`).
- Eigener Spieler: Heilen = antippen, dann Skill-Checks (QTE `'heal'`), Bewegen bricht ab; Retten = Aktion **halten** (`actHeld`);
  getragen = Aktion hämmern; Duo-Station nach Nähe (`actNow.st`). Am Boden kriecht `survMove` automatisch mit `CFG.crawl`.
- Zuschauen: `viewer()` zeigt nach kurzem Abschied einen Teamkollegen (`S.spec`); Banner `#specBar`, Knopf „Ergebnis" → `teamGiveUp()`
  (offline: Ende; das Netz darf die Funktion überschreiben). Ende: `showTeamEnd()` mit `#teamRes`. Stellschrauben in `CFG` (`crawl` … `duoTime`).
- Test: `NODE_PATH="$(npm root -g)" node tools/teamtest.js [bildordner]` (Szenarien PASS/FAIL, Screenshots);
  mit `--map <id>` kartenunabhängig (alle Haken, Paletten-Stuns beim Tragen, Tore, Duo, Dauerlauf mit freier Killer-KI).
  Der Test schaltet die Bots ab (`Bots.on = false`) und steuert die anderen Survivors selbst.

## Bots (Phase 3, `js/bots.js`)
- `startTeam` ruft `Bots.attach()`: jeder Platz mit `kind: 'bot'` bekommt `sv.bot` (Gedächtnis) und `sv.ctl = Bots.think`.
  `Bots.give(sv)` macht nachträglich einen Bot aus einer Figur (Mitspieler geht), `Bots.on = false` schaltet sie ab (Tests).
- Rangfolge je Schritt: getragen → `wiggle` · am Boden → wegkriechen · im Spind → abwarten · **Flucht** (gejagt/entdeckt:
  rennen, Fenster und Paletten nutzen, Palette werfen, wenn der Killer hindurchkommt, Sicht brechen, ab und zu Spind) ·
  **Ausweichen** (Killer nah: Arbeit unterbrechen, leise aus der Sicht) · **Auftrag** aus dem Team-Plan.
- Team-Plan (`plan()`, alle 0,4 s, für alle Bots gemeinsam): retten (genau ein Bot je Haken, nur wenn der Killer weit weg
  ist) → heilen → Duo-Aufgabe zu zweit (oder mit einem Menschen an der Station) → Aufgaben verteilt → im Endspiel zum Tor.
- Nicht geschummelt: Killer-Position nur bei Sicht oder näher als 12 Kacheln (kurzes Gedächtnis). Gerannt wird nur auf der Flucht.
- Fluchtwege über zwei Zeitfelder (`flood`: Sekunden bis zu jeder Kachel für Bot und Killer). Hängt ein Bot fest, verwirft
  er Weg und Auftrag und macht einen Schritt zur Seite.
- Stellschrauben in `Bots.cfg` (Schrecksekunde, Unschärfe, Vorsicht, Pausen …), je Karte überschreibbar mit `MAPS[id].bots`.
  Sie machen die Bots absichtlich fehlbar. Die Messwerte streuen stark (±10 Punkte bei 30 Partien): mehrere `--seed` vergleichen.
  Abstimmen mit `node tools/botsim.js [--n 30] [--seed 2] [--maps …] [--cfg hear=9,noise=2] [--log]`: 3 Bots allein gegen den Killer;
  `--game tGen=20,smart=0` überschreibt Spiel-Stellschrauben (`CFG`), `--need 7` die nötigen Punkte.
  Ziel je Karte: Fluchtquote 15–50 %, ⌀ Dauer 5–10 min, Duo meist erledigt, kein Hängenbleiben (Exit-Code 1).
- `updateSurv` reicht an `updateOther` weiter, wenn `S` kein lokaler Spieler ist (nur in der Simulation).
## Netz & Lobby (`js/net.js`, `js/lobby.js`)
- Titel → **Team**: Name (`save.name`), Figur (`save.skin`), „Mit Bots spielen" (offline), „Raum erstellen",
  „Als Killer spielen" (offline gegen 3 Bots), Code + „Beitreten". Raum: Code (4 Buchstaben ohne I/O, Peer-ID `deadmobile-CODE`), bis zu 4 Spieler:
  3 Überlebenden-Plätze (leer = Bot) + Killer-Platz (leer = KI; `peer.role` = `'surv'` | `'killer'`, der 4. Spieler wird automatisch Killer),
  Kartenwahl (alle `MAPS` mit `team: true`, `save.map`), „Starten" nur beim Host. Einladungslink `?join=CODE`.
- Transport: PeerJS 1.5.5 (erst bei Bedarf von unpkg, sonst jsDelivr), zuverlässiger Kanal, `json`.
  `?peer=host:port` = eigener Signalserver (unverschlüsselt, Pfad `/`). `?net=local` = BroadcastChannel (Tabs im selben Browser).
- Stern: Host = ID 0, vergibt 1 bis 3; Clients reden nur mit dem Host. Herzschlag 1/s, nach 6,5 s Stille „Verbindung verloren".
- API: `Net.host({name, skin})` → Code, `Net.join(code, {name, skin})` → meine ID, `Net.send(msg, an?)` (Host: alle |
  ID | [IDs]; Client: an den Host), `Net.on(t, fn(msg, von))`, `Net.off`, `Net.leave()`. Zustand: `Net.isHost`,
  `Net.myId`, `Net.code`, `Net.peers` (alle im Raum inkl. mir: `{id, name, skin}`), `Net.active`, `Net.phase`
  (`off|connecting|lobby|game`). Ereignisse über `Net.on`: `peers`, `join`(peer), `leave`(peer, grund), `close`(grund, text).
- **Haken für die Synchronisierung:** `Net.onGameStart(fn({map, spawn, roster}))` läuft nach `startTeam` auf allen;
  `Net.onGameEnd(fn(grund))` mit `back` (Host zurück in die Lobby), `left` (selbst verlassen), `hostleft`, `lost`.
  Beide geben eine Abmeldefunktion zurück. Nachrichten > 4000 Zeichen werden automatisch gestückelt.
- Nachrichtentypen: intern `hello` `welcome` `reject` `peers` `ping` `bye` `~` (reserviert, nicht selbst senden);
  Lobby `lobby {map}`, `role {r}` (Rollenwunsch an den Host), `start {map, spawn, roster:[{id, name, skin, human}], killer}` (`killer` = Spieler-ID
  oder −1), `back`. Alle rufen `startTeam(map, roster, spawn, killer)`; im Roster ist der eigene Eintrag `local`, andere Menschen `remote`, freie Plätze `bot`.
- Im Team-Spiel: Pause zeigt „Zum Menü" bzw. online „Raum verlassen" statt Neustart; „Nochmal" bleibt im Team
  (online: alle zurück in den Raum). Host weg → Meldung auf dem Titel.

## Synchronisierung im Spiel (Netz Teil 2, `js/sync.js`)
- `Sync.start()` hängt an `Net.onGameStart`, `Sync.stop()` an `Net.onGameEnd`; `step()` ruft am Ende `Sync.tick(dt)` (20×/s senden).
- **Host maßgeblich:** Killer, Bots, Welt, alle Zustandswechsel. Figuren der Mitspieler (`kind: 'remote'`) bekommen
  `sv.ctl = remoteCtl`: Position aus dem Strom des Clients (geglättet), Heilen/Retten nach dessen Absicht.
- **Client:** eigene Position/Animation und eigene QTEs. Kein Killer (`K.net` in `updateKiller`), keine Bots, kein Team-Ende.
- Nachrichten: Client→Host `c` (Zustand: Position, Aufgabe + Fortschritt, wen er heilt/rettet) und `e` (Ereignis: `pallet`
  `vault` `hide` `unhide` `qfail` `tfail` `hfail` `great` `done` `wig`). Host→Clients `s` (Schnappschuss), `v`
  (Zustandswechsel: der Client spielt dieselbe Funktion aus `js/rules.js` nach – samt Effekten), `fx` (Effekte ohne
  Zustandswechsel, Feld `src` = wer ihn schon selbst abgespielt hat), `end` (Spielende), `nowork` (Aufgabe besetzt).
- Dafür überschreibt `Sync` beim Start globale Funktionen (`wrap`) und stellt sie beim Ende wieder her. **Neue
  Zustandswechsel oder Effekte, die alle sehen sollen, dort eintragen** (Host: verschicken, Client: nachspielen).
  Nur `function`-Deklarationen lassen sich überschreiben, `const`-Funktionen nicht.
- Schnappschüsse sind Felder fester Reihenfolge (`snapshot()` ↔ `onSnap()`); Zeiten als Restdauer, weil jede Seite ihr eigenes `T` hat.
- Pause ist online nur eine Überlagerung (`netPaused`, `netPause()` in `js/main.js`), niemand hält das Spiel an. Im
  Hintergrund-Tab treibt ein Worker-Taktgeber die Simulation weiter (`bgFrame()`), damit der Host nicht einfriert.
- **Killer-Spieler als Client:** Er simuliert seinen Killer selbst (`K.human = 'local'`, kein `K.net`) und schickt `k` (Position, laufende Aktion
  `a`/`an`/`ai`). Der Host führt ihn nach (`Sync.hostKiller`): Position aus dem Strom, Aktionen gespiegelt (`startMirror`; Zerbrechen, Aufheben,
  Aufhängen, Treten, Spind laufen beim Host über `runAct`), Treffer per `lungeHit`. Betäubung und Klinge-Abwischen bestimmt der Host; bis der
  Client sie bestätigt (`kf` im Schnappschuss ↔ in `k`), zählt sein Strom nicht. Zustandswechsel ruft der Killer-Client nie selbst aus.
  Geht er, übernimmt die KI.
- Mitspieler weg (`Net.on('leave')`) → beim Host übernimmt ein Bot. „Ergebnis" beim Zuschauen (`teamGiveUp`): beim Client
  endet nur die eigene Ansicht, beim Host erst, wenn kein Mitspieler mehr im Spiel ist. Kein Wiedereinstieg mitten im Spiel.

## Karten prüfen und importieren
`node tools/mapcheck.js js/maps/schule.js` prüft Karten, `--selftest` testet den Import. `node tools/mapcheck.js antwort.md --id name --write`
macht aus einer ChatGPT-Antwort (Format: `docs/KARTEN.md`) eine Kartendatei; danach in `index.html` eintragen.

## Regeln für Änderungen
- Code, der beim Laden ausgeführt wird, darf nur nutzen, was in **früher geladenen** Dateien steht.
  Funktionen, die erst zur Laufzeit aufgerufen werden, dürfen alles nutzen.
- Neue Datei: `<script src="js/…">` an der passenden Stelle in `index.html` eintragen.
- Keine globalen Namen, die mit `window`-Eigenschaften kollidieren (`name`, `status`, `top`, `parent` …).
- Stil beibehalten: kompakt, deutsche Kommentare und Spieltexte, Einheiten in Kacheln, Zeit in Sekunden.
  Die Simulation läuft fest mit 60 Hz in `step(dt)`, gezeichnet wird nur in `render()`.
- **Solo-Modus und Tutorial dürfen sich nicht verändern.** Vor jedem Commit den Regressionstest laufen lassen.

## Testen
```bash
# Ablauf + Screenshots + Fehler:
NODE_PATH="$(npm root -g)" node tools/regress.js index.html /tmp/bilder
# Vergleich mit dem letzten Commit (Solo/Tutorial müssen IDENTISCH bleiben):
git worktree add /tmp/alt HEAD && NODE_PATH="$(npm root -g)" node tools/regress.js /tmp/alt/index.html index.html
```
Netz und Lobby (a: BroadcastChannel, b: echtes PeerJS mit lokalem Signalserver, c: offline mit Bots, d: Synchronisierung im Spiel,
e: ein Mitspieler steuert den Killer):
```bash
# <deps> enthält node_modules/peer (Server) und node_modules/peerjs; ohne --peer wird b übersprungen
NODE_PATH="$(npm root -g)" node tools/nettest.js index.html --peer <deps> [--shots /tmp/netz] [--fonts <ordner>] [--only a,c]
# Bots: 3 Bots allein gegen den Killer, Statistik je Karte
NODE_PATH="$(npm root -g)" node tools/botsim.js --n 30
```
Mit `#test` in der URL wird nichts gespeichert. `window.__ns` ist die Test-API (`startGame`, `tick(sek)`,
`tp`, `ktp`, `finish`, `caught`, `down`/`up`, `keys` …). Feste Zufallszahlen und eine abgeschaltete
`requestAnimationFrame`-Schleife machen Läufe reproduzierbar (siehe `tools/regress.js`).

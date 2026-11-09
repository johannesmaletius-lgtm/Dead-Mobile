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
| `js/render.js` | Canvas-Setup, Grundformen, Boden vorzeichnen, Raum-Pfade fürs Licht |
| `js/figures.js` | Figuren zeichnen: Skins `SKINS` (`cop`, `medic`, `janitor`), `SKIN_NAMES`, Killer, `skinPortrait(skin, px)`; Vorschau `tools/skins.html` |
| `js/tiles.js` | Kacheln zeichnen (Wände, Möbel, Aufgaben, Paletten, Tore, Auto) |
| `js/light.js` | Licht, Leuchten, `render()` setzt das Bild zusammen |
| `js/hud.js` | Bildschirm-Ebenen, HUD, Aktionsknopf, QTE-Anzeige |
| `js/main.js` | Eingabe (Touch/Tastatur), Bildschirme, Start, Spielschleife, Test-API `window.__ns` |

## Mehrere Überlebende (Stand Phase 1)
- `SV` = alle Survivors, `S` = der eigene (Eingabe, Kamera, HUD), `MODE` = `'solo'` | `'team'`.
  `startGame()` = Solo (unverändert), `startTeam(mapId, roster)` = Team mit 3 Plätzen (Bots füllen auf).
- Fremde Survivors laufen über `updateOther(sv, dt)` → `sv.ctl(sv, dt)` (Bot-KI bzw. Netz setzt das).
- Bewegung für beliebige Figuren: `goTo(e, x, y, spd, dt)` (A*, springt/zerbricht), `moveAgent`,
  `survMove(sv, inp, dt)`, `survMoved(sv, md, dt)` (Spuren, Blut, Tor). Aktionen nehmen den Survivor als
  letzten Parameter: `dropPallet(p, sv)`, `vaultOver(o, isWin, sv)`, `hide(L, sv)`, `unhide(sv)`, `hitSurvivor(sv)`.
- Killer: `K.target` (Jagdziel), `K.focus` (gerade gesehen), `killerSees(sv)`, `huntTarget()`.
- Aufgaben haben `points` (Duo = 2, `t.stations`), Tore öffnen bei `taskPoints() >= NEED`.
- Team-Regeln (Phase 2) stehen in `js/rules.js` (siehe unten).
- `viewer()` (wessen Sicht), `isWorked(t)`, `skinOf(sv)`, `inPlay(sv)` stehen in `js/state.js`.

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
  **Killer:** `carry`, `hookGoal`, `campUntil`/`campRoom`, `hunt {sv, t, last}` (40-s-Regel), `ignore {sv, until}`, Modi `'fetch'`/`'carry'`.
- Eigener Spieler: Heilen = antippen, dann Skill-Checks (QTE `'heal'`), Bewegen bricht ab; Retten = Aktion **halten** (`actHeld`);
  getragen = Aktion hämmern; Duo-Station nach Nähe (`actNow.st`). Am Boden kriecht `survMove` automatisch mit `CFG.crawl`.
- Zuschauen: `viewer()` zeigt nach kurzem Abschied einen Teamkollegen (`S.spec`); Banner `#specBar`, Knopf „Ergebnis" → `teamGiveUp()`
  (offline: Ende; das Netz darf die Funktion überschreiben). Ende: `showTeamEnd()` mit `#teamRes`. Stellschrauben in `CFG` (`crawl` … `duoTime`).
- Test: `NODE_PATH="$(npm root -g)" node tools/teamtest.js [bildordner]` (Szenarien PASS/FAIL, Screenshots);
  mit `--map <id>` kartenunabhängig (alle Haken, Paletten-Stuns beim Tragen, Tore, Duo, Dauerlauf mit freier Killer-KI).

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
Mit `#test` in der URL wird nichts gespeichert. `window.__ns` ist die Test-API (`startGame`, `tick(sek)`,
`tp`, `ktp`, `finish`, `caught`, `down`/`up`, `keys` …). Feste Zufallszahlen und eine abgeschaltete
`requestAnimationFrame`-Schleife machen Läufe reproduzierbar (siehe `tools/regress.js`).

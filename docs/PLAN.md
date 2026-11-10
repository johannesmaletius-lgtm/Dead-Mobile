# Plan: Team-Modus (3 Überlebende, Killer-KI, Online-Mehrspieler)

Grundsatz: **Qualität vor Token-Sparen.** Gespart wird nur, wo das Spiel nicht leidet: Jeder Agent
liest nur `CLAUDE.md`, diesen Plan und die Dateien seines Auftrags.

## Arbeitsteilung

| Phase | Wer | Modell | Auftrag | Dateien |
|---|---|---|---|---|
| 0 | Claude (Koordinator) | – | Code in Dateien aufteilen, Regressionstest, Leitfaden | erledigt |
| 1 | Claude (Koordinator) | – | **Fundament:** Karten-Lader (mehrere Karten), Liste von Survivors statt einem `S`, Bewegung/Pfadsuche für beliebige Figuren, Kartenprüfer `tools/mapcheck.js`, Team-Variante der Schule zum Testen | fast alle |
| 1 ∥ | Agent „Skins" | Opus | 3 Survivor-Skins + Porträt-Funktion für Menü/HUD | `js/figures.js` |
| 2 | Agent „Regeln" | Opus | Boden/Tragen/Haken/Heilen/Retten/Zappeln, Paletten-Stun lässt fallen, Duo-Aufgabe, Killer-KI für 3 Ziele, 40-s-Regel, Team-Ende, Zuschauen, Team-HUD | `survivor`, `killer`, `flow`, `tasks`, `hud`, neu `rules.js` |
| 3 | Agent „Bots" | Opus | KI-Überlebende füllen freie Plätze | erledigt: `js/bots.js`, `tools/botsim.js` |
| 3 ∥ | Agent „Netz" | Opus | Online-Mehrspieler (PeerJS), Lobby, Synchronisierung | erledigt: `js/net.js`, `js/lobby.js`, `js/sync.js` |
| 4 | ChatGPT | – | 2 große Karten nach `docs/KARTEN.md` | – |
| 4 | Claude (Koordinator) | – | Karten prüfen, einbauen, Licht und Deko | `js/maps/*` |
| 5 | Agent „QA" | Sonnet | Testläufe aller Modi per Playwright, Fehlerliste mit Screenshots | `tools/` |
| 5 | Claude (Koordinator) | – | Fehler beheben, Review, Commit, Push | – |

Warum Phase 1 der Koordinator selbst macht: Der Umbau berührt jede Datei, und der Koordinator hat
den ganzen Code schon gelesen. Ein Agent müsste alles neu lesen (teurer, fehleranfälliger).
Parallele Agenten arbeiten in eigenen Git-Worktrees; der Koordinator prüft und führt zusammen.

## Spielregeln Team-Modus (verbindlich für alle Agenten)

**Solo-Modus und Tutorial bleiben exakt wie bisher** (1 Survivor, Schule, 2. Treffer = Haken-Sequenz).

- **Spieler:** 3 Überlebende, Menschen + Bots füllen auf. Den Killer steuert die KI oder ein Spieler (Rolle im Raum bzw.
  „Als Killer spielen“ offline; `KP`, `js/hkiller.js`).
- **Zustände:** gesund (2) → verletzt (1) → am Boden (0, kriecht 0,9 Kacheln/s, keine Aktionen)
  → getragen → am Haken → tot. Dazu: entkommen.
- **Heilen:** neben verletztem oder liegendem Teamkollegen Aktion halten. Verletzt→gesund 12 s,
  am Boden→verletzt 10 s. Mehrere Heiler addieren sich. Fortschritt bleibt bei Abbruch erhalten.
  Gelegentliche Skill-Checks wie beim Aggregat: daneben = −10 % und Lärm. Selbstheilung gibt es nicht.
- **Aufheben und Tragen:** Der Killer hebt Liegende auf (1 s) und trägt sie (3,6 Kacheln/s) zum nächsten freien Haken (0,9 s Aufhängen).
  Öffnet er einen Spind mit Survivor darin, wird dieser sofort getragen.
- **Zappeln:** Getragene drücken die Aktionstaste. Ist die Leiste voll (ca. 12 s eifriges Drücken), sind sie frei
  (verletzt, kurzer Sprint), und der Killer ist 2 s betäubt.
- **Paletten-Stun beim Tragen:** Der Killer lässt den Survivor fallen (frei, verletzt) und ist betäubt.
- **Haken:** Der Fortschritt läuft von 0 bis 1 in 2 × 36 s (halb so schnell, solange ein Killer-Spieler am Haken steht). Ab 0,5 läuft die Kampfphase (nur Optik).
  Zweites Aufhängen: Start bei mindestens 0,5. Drittes Aufhängen: sofort tot.
  **Retten:** Teamkollege hält 1,2 s Aktion am Haken → frei, verletzt, 1,5 s Sprint.
- **Kein Camping:** Nach dem Aufhängen sucht der Killer mindestens 12 s in anderen Räumen.
- **35-s-Regel** (nur KI): Jagt der Killer denselben Survivor länger als 35 s ohne Treffer, bricht er ab. Er
  ignoriert diesen Survivor 20 s lang (Aufmerksamkeit ×0,2, außer näher als 2 Kacheln) und sucht im
  Raum des nächsten anderen freien Survivors (ungenau, ±5 Kacheln). Für den Gejagten erscheint der Hinweis:
  „Er hat genug von dir – er sucht die anderen!"
- **Aufgaben:** Team-Karten haben 9 normale Aufgaben und 1 Duo-Aufgabe (2 Stationen `Y`). Gebraucht werden
  **8 Punkte**, die Duo-Aufgabe zählt **2**. Im Team dauern Aufgaben länger (Aggregat 18 s, Ventil 10 s, Sicherung 5 Treffer,
  Funk 3 Runden) und die Skill-Checks sind enger.
  Wer geheilt wird, kann nichts anderes tun. Normale Aufgaben bearbeitet nur eine Person gleichzeitig (sonst „besetzt").
  Die Duo-Aufgabe läuft nur, wenn beide Stationen gleichzeitig besetzt sind (22 s). Jede Person hat dabei Skill-Checks.
- **Klügerer Killer (KI):** Seitenhieb auf jeden in Reichweite, Zielwechsel auf nähere/verletzte Ziele, Lernen aus
  Wiederholungen (Paletten früher zerbrechen, Finte andersherum um ein Hindernis, Fenster und lauernde Paletten umlaufen,
  beliebte Spinde zuerst prüfen).
- **Für jeden einzeln:** Jagdmusik, roter Rand und Zoom (näher) nur für das Jagdziel; Geräusche werden mit der Entfernung leiser.
- **Jungle Gyms:** je große Karte ein Jungle Gym (Fenster + Palette) und eine TL-Mauer (Palette) im Außenbereich.
- **Ende:** Ein Survivor, der durch ein offenes Tor läuft, ist entkommen. Ist kein Survivor mehr frei
  (alle liegen, hängen oder sind raus) und trägt der Killer niemanden, sterben die übrigen. Das Spiel
  endet, wenn niemand mehr im Spiel ist. Wer raus ist, schaut zu (Kamera folgt einem Teamkollegen).
- **Skins:** Polizist (blau, Mütze), Sanitäterin (rot, Reflexstreifen, Pferdeschwanz), Hausmeister
  (oliv Latzhose, orange Strickmütze, Bart). Jeder Spieler wählt einen; Bots nehmen die übrigen.

## Netz-Architektur (für Agent „Netz")

- **PeerJS** (MIT) wird nur bei Bedarf vom CDN geladen. Raum-ID `deadmobile-XXXX` (4 Buchstaben ohne
  Verwechsler), max. 4 Spieler (3 Überlebende + 1 Killer). Test-Transport über `BroadcastChannel` (`?net=local` in der URL, mehrere Tabs).
- **Host ist maßgeblich:** Er simuliert Killer, Bots, Welt und alle Zustände.
- **Clients bestimmen nur:** die eigene Position/Richtung/Animation und eigene QTEs. Sie senden 20×/s
  ihren Zustand und Ereignisse (Palette, Fenster, Spind, Lärm, Aufgabenfortschritt, Heilen/Retten, Zappeln).
- Der Host sendet 20×/s einen Schnappschuss (Killer, alle Survivors, Aufgaben, Paletten, Fenster,
  Spinde, Tore) plus Effekt-Ereignisse (Ton, Partikel). Clients glätten fremde Positionen.
  Eigene vorhergesagte Effekte werden nicht doppelt abgespielt (Feld `src`).
- Bei getragenen oder hängenden Survivors setzt der Host die Position.
- Umsetzung und Nachrichtentypen: `CLAUDE.md`, Abschnitt „Synchronisierung im Spiel", und Kopfkommentar von `js/sync.js`.

## Bots (umgesetzt)

- Bots sollen sich wie brauchbare, aber fehlbare Mitspieler anfühlen: Sie schleichen, unterbrechen die Arbeit, wenn der
  Killer nah ist, rennen nur auf der Flucht, nutzen Fenster und Paletten, retten und heilen – und lassen dem Menschen Arbeit übrig.
- Zielwerte (3 Bots allein, `tools/botsim.js`): Fluchtquote 15–50 %, ⌀ Dauer 5–10 min, Duo-Aufgabe meist erledigt
  (seit den längeren Aufgaben und dem klügeren Killer absichtlich schwerer).

# Dead Mobile

Stealth-Horror-Browsergame: verlassene Orte, ein geschminkter Killer. Aufgaben erledigen, unentdeckt bleiben, durchs Tor entkommen.

Läuft komplett im Browser, ohne Installation und ohne Build: einfach `index.html` öffnen (Handy: quer spielen).

## Spielmodi

- **Solo** (Knopf ▶): ein Polizist in der Schule. Der zweite Treffer bedeutet den Haken.
- **Tutorial:** spielbare Einführung in Bewegung, Aufgaben, Paletten, Fenster und Spinde.
- **Team:** drei Überlebende gegen den Killer, auf den Karten *Ferienlager*, *Krankenhaus* und *Schule (klein)*.
  - **Mit Bots spielen** (offline): zwei KI-Mitspieler füllen das Team auf.
  - **Raum erstellen / Beitreten** (online): bis zu vier Spieler – drei Überlebende (freie Plätze übernehmen Bots) und,
    wenn der Host es einstellt, einer als Killer. Der Host bekommt einen Code aus 4 Buchstaben; die anderen tippen ihn
    ein oder öffnen den Einladungslink (`?join=CODE`).
- **Killer:** du jagst selbst – offline gegen drei Bots (Knopf *Killer* auf dem Titel) oder online gegen deine Freunde.

Die Stärke der Killer-KI (Solo und Team) lässt sich auf dem Titel einstellen: *Leicht*, *Normal*, *Schwer*.

### Als Killer spielen

- **Angriff** (roter Knopf / Leertaste): ein Ausfallschritt nach vorn. Daneben kostet Zeit. Zwei Treffer bringen jemanden zu Boden.
- **Aktion** (kleiner Knopf / E): Liegende aufheben, umgeworfene Paletten zerbrechen, durch Fenster steigen, Spinde durchsuchen,
  angefangene Aufgaben treten. Beim Tragen hängt der Hauptknopf dein Opfer am nächsten freien Haken auf.
- **Instinkt** (Auge / Q): zeigt kurz, wer in der Nähe ist – außer er steckt in einem Spind. Die Entdeckten werden gewarnt.
- Am Bildschirmrand siehst du Lärm, angefangene Aufgaben, Liegende und Hängende. Frische Kratzspuren von Rennenden leuchten.
- Wer am Haken lauert, verliert: Die Zeit dort läuft dann deutlich langsamer.

### Team-Regeln in Kürze

- Gesund → verletzt → am Boden → getragen → am Haken. Teamkollegen können **heilen** (antippen, Skill-Checks treffen)
  und vom Haken **retten** (Aktion halten). Getragene **zappeln** sich frei (Aktion hämmern); ein Paletten-Treffer lässt
  den Killer fallen, wen er trägt.
- Am Haken läuft die Zeit: Beim zweiten Mal beginnt sie bei der Hälfte, das dritte Mal ist das Ende.
- Gebraucht werden 6 Punkte (kleine Schule: 5). Die **Duo-Aufgabe** zählt 2 und läuft nur, wenn zwei gleichzeitig an ihren Stationen stehen.
- Wer durchs offene Tor läuft, ist entkommen. Wer raus ist, schaut den anderen zu.
- Sind die Tore offen, läuft die Zeit: Nach zweieinhalb Minuten holt es alle, die noch drin sind.

### Online spielen

- Die Verbindung läuft direkt zwischen den Browsern (WebRTC über [PeerJS](https://peerjs.com/)); das Spiel des Hosts ist
  maßgeblich. Dafür ist eine Internetverbindung nötig, auch wenn das Spiel selbst als Datei geöffnet wird.
- Der Host sollte das Spiel offen lassen: Schließt er den Tab oder sperrt sein Handy, endet die Runde für alle.
  Im Hintergrund-Tab am Rechner läuft das Spiel des Hosts weiter.
- Pause hält online niemanden an – sie ist nur eine Überlagerung. Verlässt jemand das Spiel, übernimmt ein Bot.
- Zum Ausprobieren ohne Internet: `index.html?net=local` in mehreren Tabs desselben Browsers.

## Aufbau

- `index.html` – Seite und Ladereihenfolge der Skripte
- `css/style.css` – Gestaltung
- `js/*.js` – Spielcode, nach Themen aufgeteilt (Karte, Killer-KI, Team-Regeln, Bots, Netz, Zeichnen …)
- `js/maps/*.js` – Karten
- `tools/` – Tests und Werkzeuge (Playwright): `regress.js` (Solo/Tutorial), `teamtest.js` (Team-Regeln), `killertest.js`
  (gespielter Killer, Autopilot), `nettest.js` (Lobby und Synchronisierung), `botsim.js` (Bots gegen den Killer),
  `mapcheck.js` (Karten prüfen/importieren)
- `docs/` – Plan für den Team-Modus und Kartenformat

Details für Entwickler und KI-Agenten: `CLAUDE.md`.

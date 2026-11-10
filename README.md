# Dead Mobile

Stealth-Horror-Browsergame: verlassene Orte, ein geschminkter Killer. Aufgaben erledigen, unentdeckt bleiben, durchs Tor entkommen.

Läuft komplett im Browser, ohne Installation und ohne Build: einfach `index.html` öffnen (Handy: quer spielen).

## Spielmodi

- **Solo** (Knopf ▶): ein Polizist in der Schule. Der zweite Treffer bedeutet den Haken.
- **Tutorial:** spielbare Einführung in Bewegung, Aufgaben, Paletten, Fenster und Spinde.
- **Team:** drei Überlebende gegen den Killer, auf den Karten *Ferienlager*, *Krankenhaus* und *Schule (klein)*.
  - **Mit Bots spielen** (offline): zwei KI-Mitspieler füllen das Team auf.
  - **Als Killer spielen** (offline): du jagst drei Bots.
  - **Raum erstellen / Beitreten** (online): bis zu vier Spieler – drei Überlebende und, wenn jemand im Raum
    „Killer spielen“ wählt, ein Killer. Freie Plätze übernehmen Bots, den Killer sonst die KI. Der Host bekommt einen
    Code aus 4 Buchstaben; die anderen tippen ihn ein oder öffnen den Einladungslink (`?join=CODE`).

### Team-Regeln in Kürze

- Gesund → verletzt → am Boden → getragen → am Haken. Teamkollegen können **heilen** (antippen, Skill-Checks treffen)
  und vom Haken **retten** (Aktion halten). Getragene **zappeln** sich frei (Aktion hämmern); ein Paletten-Treffer lässt
  den Killer fallen, wen er trägt.
- Am Haken läuft die Zeit: Beim zweiten Mal beginnt sie bei der Hälfte, das dritte Mal ist das Ende.
- Gebraucht werden 8 von 11 Punkten (kleine Schule: 7 von 9). Die **Duo-Aufgabe** zählt 2 und läuft nur, wenn zwei gleichzeitig
  an ihren Stationen stehen. Aufgaben dauern im Team länger und haben engere Skill-Checks als im Solo-Spiel.
- Wer geheilt wird, kann währenddessen nichts anderes tun (weglaufen bricht die Heilung ab).
- Der Killer (KI) lässt nach 35 s Jagd ohne Treffer von dir ab, schlägt jeden, der in Reichweite steht, und lernt aus
  Wiederholungen: Schleifen um dieselbe Stelle, dasselbe Fenster, dieselbe Palette, derselbe Spind.
- Jagdmusik, roter Rand und der nähere Kamera-Ausschnitt gelten nur für den, der gerade gejagt wird. Geräusche werden
  mit der Entfernung leiser.
- **Killer als Spieler:** Aktionsknopf = Angriff; steht nichts in Reichweite, das Naheliegende (aufheben, aufhängen,
  Palette zerbrechen, durchs Fenster steigen, Spind öffnen, Aufgabe treten).
- Wer durchs offene Tor läuft, ist entkommen. Wer raus ist, schaut den anderen zu.

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
- `tools/` – Tests und Werkzeuge (Playwright): `regress.js` (Solo/Tutorial), `teamtest.js` (Team-Regeln),
  `nettest.js` (Lobby und Synchronisierung), `botsim.js` (Bots gegen den Killer), `mapcheck.js` (Karten prüfen/importieren)
- `docs/` – Plan für den Team-Modus und Kartenformat

Details für Entwickler und KI-Agenten: `CLAUDE.md`.

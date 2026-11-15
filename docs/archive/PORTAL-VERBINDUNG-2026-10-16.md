# Rückmeldungswechsel – Version 2026.10.16.27

Anlass: Auf einem iPhone wurde beim schnellen Wechsel zwischen Rückmeldungen eine unterbrochene Verbindung gemeldet. Der öffentliche Dienst antwortete bei der Erreichbarkeitsprüfung mit HTTP 200 und dem erwarteten CORS-Ursprung. Der konkrete Fehler auf dem Gerät konnte nicht direkt reproduziert werden.

## Korrekturen

- Nach einer bestätigten Speicherung wird die bestehende Terminkarte mit Status und Version aus der Serverantwort aktualisiert. Kein zusätzlicher Abruf von Terminliste und Nachweisen nach jedem Tastendruck.
- Während einer laufenden Speicherung bleiben die Tasten gesperrt. Dieselbe bereits gewählte Antwort erzeugt keinen weiteren Auftrag. Folgende Änderungen verwenden die zuletzt bestätigte Version.
- Unbestätigte Speicherantworten behalten den Auftrag samt Kennung für „Speicherung erneut prüfen“. Keine vorgetäuschte Erfolgsmeldung und keine automatische zweite Buchung. Fachliche Fehlermeldungen werden nicht sofort durch ein automatisches Neuladen überschrieben.
- Der Worker nutzt für Rückmeldungen den synchronisierten Kalenderstand, statt beim Tastendruck einen Google-Abruf anzustoßen. Die bisherige Frischegrenze von fünf Minuten bleibt erhalten; ältere Stände sperren Schreiben mit einer erklärten Fehlermeldung. Der bestehende Cron muss den Kalender weiterhin aktualisieren.
- Versions- und Cachekennungen sowie Worker-Bundle aktualisiert.

## Nachweis

485 automatisierte Tests bestanden. Neue Tests prüfen schnelle Antwortfolgen, konkurrierende Eingaben, bestätigte Versionsnummern, verlorene Antworten mit identischer Wiederholung und sichtbare Versionskonflikte. Worker-Test: kein Google-Abruf beim Antworten und keine Änderung mit zu altem Kalenderstand. Browserprüfung: Speichern/Zurücknehmen und Kartenfarbe funktionieren ohne erneuten Abruf von Terminen/Nachweisen; Wischgesten funktionieren weiter. Syntaxprüfungen bestanden. Ausschließlich künstliche Testdaten.

## Veröffentlichung und Grenzen

Für die vollständige Korrektur `cloudflare/push/worker.bundle.js` im bestehenden Cloudflare Worker veröffentlichen bzw. den erfolgreichen Cloudflare-Build dieses Commits prüfen. D1, Secrets und Cron erhalten; keine Migration erforderlich. Ein produktiver Deploy wurde nicht bestätigt.

Auf dem iPhone unter „Mehr → Hilfe zum H₂O Portal → Probleme beheben → Neueste Ansicht laden“ aktualisieren. Unbestätigte Vorgänge vorher über „Speicherung erneut prüfen“ klären. Anschließend die Antwortfolge „? → Bin dabei → Entschuldigt → ?“ prüfen, jeweils nach Ende des kurzen Speichervorgangs. Die reale Safari-/iPhone-Netzwerksituation bleibt mangels Gerätezugriff unbestätigt.

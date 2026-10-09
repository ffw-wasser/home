# Getränke-Strichliste – Integration und Prüfung

Ausgangsstand: GitHub `ffw-wasser/home`, main `1ddfba93bbfc5c46587f42b1f81b3850a8271485`.
Der lokale Ausgangsstand wurde anhand sämtlicher GitHub-Dateihashes verglichen.

## Umsetzung

- Menüpunkt Getränke; bestehende OneDrive-Mitgliederkennungen und Namen.
- Persönliche vierstellige PIN, Verwaltung unter Einstellungen → Mitglieder.
- PIN mit individuellem Salt und PBKDF2-SHA256 abgeleitet; keine Klartext-PIN.
- Neue Striche kosten 150 Cent und lassen sich vor dem Speichern korrigieren.
- Fünf Biergläser werden zu einem unbeschrifteten Comic-Fass; keine Legende.
- Start-Ranking „Die größten Deckel“ nach offenen Cent-Beträgen.
- Bar- und PayPal-Teilzahlungen werden nach Mitgliedsbestätigung eingetragen.
- Echtes QR-Bild entsteht lokal, einschließlich des gewählten Euro-Betrags.
- Getränkekonten liegen im OneDrive-Unterordner Getraenke. Finanzdaten und
  PIN-Ableitungen werden weder in localStorage/IndexedDB noch auf GitHub abgelegt.
- Buchungen haben eindeutige IDs. Schreiben verwendet die gelesene Dateiversion;
  bei Konflikten wird neu gelesen. Verlorene Antworten werden anhand derselben
  Buchungsnummer geprüft. Keine Buchungen ohne Internet/OneDrive-Verbindung.
- Alte Historiensynchronisierung und öffentliche Offline-App-Dateien bleiben
  erhalten; der Service Worker nimmt keine OneDrive-Antworten in seinen Cache auf.

## Validierung

`node --test tests/*.test.cjs`: **76 Tests erfolgreich**. Darunter die 61 bisherigen
Prüfungen und 15 neue Getränkeszenarien: Betragsrechnung, Voll-/Teilzahlungen,
ungültige Daten, doppelte IDs, PIN-Ableitung/-Änderung, parallele Buchungen und
Vollzahlungen, verlorene Schreibantworten, Versionskonflikte und Offline-Sperre.

Browserprüfung mit der vollständigen Anwendung und einem simulierten OneDrive:
PIN über die echte Mitgliederverwaltung gespeichert; fünf Striche als Fass;
Rücknahme/Zurücksetzen; nach erneutem Öffnen erhaltener gebuchter Betrag; Ranking;
5,00 € Barzahlung von 7,50 €; verbleibende 2,50 € per PayPal bestätigt; anschließend
0,00 € und drei erhaltene Buchungen. Keine JavaScript-Laufzeitfehler und keine
neuen persönlichen Einträge im Browserspeicher. Der beim Speichern entdeckte
Fehler mit gesperrten Namensbuttons wurde korrigiert und der Ablauf erneut geprüft.

Layout geprüft bei 320, 650, 820, 1024 und 1180 Pixeln; Konto- und PayPal-Ansicht
auch bei schmalen Fenstern ohne horizontale Überläufe. Screenshots der
Start-, Konto- und PayPal-Ansicht wurden kontrolliert. Prüfung erfolgte in einem
Headless-Chromium, nicht auf einem physischen iPad.

QR-Code aus dem tatsächlichen Canvas mit einem unabhängigen Decoder gelesen:
`https://paypal.me/FeuerwehrWasser/2.50EUR`. Zusätzlich 7,50 € und 12,00 € geprüft.
Es wurde keine echte Zahlung ausgelöst.

## Praktische Grenzen

Die Prüfung schrieb keine echten Mitgliedsdaten oder Buchungen in den
verbundenen OneDrive-Ordner. Vor dem ersten Einsatz dort PINs einrichten und eine
kontrollierte Buchung/Teilzahlung prüfen. Die PIN schützt die App-Bedienung;
OneDrive-Dateiberechtigungen bleiben der tatsächliche Zugriffsschutz.
PayPal.Me meldet keine Zahlung zurück. „Zahlung durchgeführt“ ist eine
Mitgliedsbestätigung und kein automatischer Zahlungsnachweis.

Getränkekonten sind nicht Teil des bisherigen JSON-Anwendungsbackups. Für eine
vollständige Sicherung den gesamten OneDrive-Unterordner Getraenke sichern.

## Ergänzung vom 09.10.2026 · Version 2026.10.09.10

- Wein als eigene Kategorie mit 300 Cent pro Glas; bisherige Bierstriche bleiben bei 150 Cent. Alte Buchungen werden nicht umgeschrieben.
- Direkte Mitgliedskarten zeigen heutige Bierstriche/Fässer und Weingläser. Weinbuchung und heutige Rücknahme sind auf der Getränke-Hauptseite bedienbar; freiwillige PIN wird berücksichtigt.
- Bier und Wein können gemeinsam vorgemerkt werden. Gemischte Sammlungen werden atomar in einer OneDrive-Dateiversion gespeichert und mit denselben Buchungsnummern erneut geprüft.
- Korrekturen verwenden den Preis des ursprünglichen Getränks. Bezahlte Beträge und verbrauchtes Bonusguthaben werden als Guthaben zurückgegeben. Der Bonus zählt weiterhin tatsächliche Zahlungen; Wein für 3 Euro entspricht zwei Einheiten à 1,50 Euro.
- Verschlüsselte Handyansichten enthalten die Getränkekategorie ohne Buchungs- oder Mitgliederkennung.
- Bierdeckel-Symbol mit regulären, Apple- und maskierbaren PNG-Icons. Die erste QR-Ansicht zeigt eine Installationshilfe. Android bietet den nativen Dialog nach ausdrücklichem Tippen an, sofern verfügbar; iOS zeigt die Schritte über Teilen. Kein automatisches Installieren oder Anfordern von Benachrichtigungen.
- Persönliche Installationslinks werden nach Nutzeraktion ausschließlich auf dem eigenen Handy gespeichert. Öffentliche Manifeste enthalten keine Schlüssel. Erinnerungen lassen sich deaktivieren, ohne den gespeicherten Installationslink zu entfernen.
- `node --test tests/*.test.cjs`: 188 Tests bestanden. Abgedeckt sind gemischte Preise, Tageskorrekturen, Bonus, atomare Speicherung bei Konflikten/verlorenen Antworten, direkte Karten und Installationsabläufe. Keine neue Prüfung auf physischen iOS-/Android-Geräten durchgeführt.

- Dankesdialog schließt nach 3 Sekunden automatisch (mit Bonus nach 4,5 Sekunden), entfernt das Symbol und kehrt zur Getränke-Hauptseite zurück. Vorzeitiges Schließen und Verbergen der App lösen die Rückkehr höchstens einmal aus.

## Ergänzung · Version 2026.10.09.11

- Der bisher dauerhaft angezeigte Danke-Hinweis in der Handyansicht verschwindet nach 3 Sekunden. Kontostand und Buchungen bleiben sichtbar. Aktualisieren desselben bezahlten Deckels startet den Hinweis nicht erneut; nach neuen offenen Beträgen und anschließender Begleichung erscheint er wieder kurz.
- Die iPad-Zahlungsansicht hat einen eigenen Abschlusstimer: Die Rückkehr zur Getränke-Hauptseite hängt nicht mehr vom Laden oder Ausführen der Animation ab. Das Verlassen der Zahlungsansicht entfernt den alten Timer und eine noch offene Animation; alte Abschlüsse schließen kein neues Mitgliedskonto.
- 193 automatisierte Prüfungen bestanden, einschließlich Zeitablauf, fehlender/fehlerhafter Animation, manueller Navigation, erneutem Bezahlen und Verbergen der Handyansicht. Keine neue Prüfung auf physischen Geräten.

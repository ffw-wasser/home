# Theatermodul · erste Umsetzung · 2026.10.16.31

## Bedienung

Am iPad: **Menü → Veranstaltung → Theater**. Die Kassenübersicht verwendet den bestehenden geschützten Verwaltungszugang und Kontodienst. Drei Ansichten: Kasseneingabe, Auswertung, Verwaltung.

Unter Verwaltung eine Veranstaltung anlegen, die XLSX- oder CSV-Preisliste auswählen und die Vorschau prüfen. Der Import sucht die Spalten Artikel und Preis auch innerhalb einer Checkliste. Größe wird dem Artikelnamen hinzugefügt. Rubrik/Kategorie ist optional; fehlende Rubriken müssen vor dem Speichern zugeordnet werden. Eine neue Rubrik entsteht durch Eingabe ihres Namens im Artikelfeld „Rubrik“. Artikel können ergänzt, bearbeitet, deaktiviert oder aus der aktuellen Liste entfernt werden. Bereits bestätigte Bestellungen behalten ihre ursprünglichen Artikel und Preise.

„Bestellungen am Handy erlauben“ aktivieren und speichern. Es kann eine Veranstaltung gleichzeitig geöffnet sein. Für Folgejahre kann die Artikelliste der ausgewählten Veranstaltung übernommen werden; die alten Bestellungen bleiben erhalten.

Am Handy: **Mehr → Theater · Bestellung aufnehmen** öffnet eine eigene Bestellseite ohne Portalnavigation und weitere Portalbereiche. Oben steht ein X. Erst nach Bestätigung der Rückfrage geht es zurück zu Mehr; Auswahl und ausstehende Übertragung bleiben erhalten. Artikel mit Plus/Minus auswählen, Summe prüfen und bestätigen. Die App verwendet den persönlichen Portalzugang. Erst die Serverbestätigung setzt die Mengen zurück. Bei unklarer Übertragung bleibt die Bestellung gesperrt und kann mit derselben Kennung erneut geprüft werden. Entwurf und ausstehende Übertragung bleiben innerhalb derselben Browsersitzung erhalten. Ohne Internet gibt es keine bestätigte Bestellung; dies ist keine vollständige Offline-Kasse.

Am iPad erscheint je aufnehmender Person eine Karte mit summierten Artikeln. „Für Kasse reservieren“ friert genau die angezeigten Bestellungen ein. Neu bestätigte Bestellungen erscheinen getrennt. Nach dem Abtippen „In Kasse erfasst“ wählen oder die Reservierung freigeben. Ein Paket umfasst höchstens 60 einzelne Bestellungen; bei mehr offenen Bestellungen weist die Karte auf die Aufteilung hin. Mengen pro Artikel werden weiterhin summiert. Die Übersicht aktualisiert sich im sichtbaren Fenster alle fünf Sekunden.

Auswertung: Bestellwert, Bestellungen, Kassenstand, Artikel, Rubriken, Personen und Stundenverlauf in Europe/Berlin. Excel-kompatibler CSV-Export enthält die einzelnen Positionen und ihren Status. „In Kasse erfasst“ ist eine manuelle Bestätigung, kein automatisch geprüfter Zahlungseingang. Bestätigte Bestellungen sind in dieser ersten Version unveränderlich; nachträgliche Stornos sind noch keine Bedienfunktion.

## Veröffentlichung

Website und bestehender Cloudflare-Worker müssen gemeinsam aktualisiert werden. Das gebaute Worker-Paket enthält TheaterModel und TheaterService. Die zusätzlichen Tabellen und Indizes werden beim ersten Theateraufruf automatisch angelegt. Vorhandene Konten, Kalender und OneDrive-Dateien werden nicht umgeschrieben. Bestellinhalte, Personennamen und Preislisten werden über die bestehende Verschlüsselung des Kontodienstes gespeichert. Die Theaterdaten liegen in D1 und sind nicht Bestandteil des lokalen App-/OneDrive-Backups; eine Auswertung kann separat exportiert werden.

Die lokale Implementierung allein schaltet das Modul noch nicht auf bereits installierten Geräten frei. Anschließend eine Veranstaltung einrichten und mit zwei echten Geräten eine vollständige Testbestellung einschließlich Reservierung und Abschluss prüfen.

## Prüfung

Zusätzlich stehen im Handyportal die Hinweise „Zuletzt aktualisiert“, „Datenstand“ und der allgemeine Verbindungsstatus unter den Inhalten. Die Browserprüfung kontrolliert bei 320, 390 und 768 Pixeln, dass unterschiedlich lange Statusmeldungen die Position der Karten beim Menüwechsel nicht verschieben.

- Gesamte Testsuite: `node --test tests/*.test.cjs` aus dem App-Verzeichnis: 499 Tests erfolgreich. Syntaxprüfungen aller geänderten JavaScript-Module erfolgreich.
- Theaterintegration: authentifizierte Workeraufrufe mit SQLite als D1-Testadapter, einschließlich 20 gleichzeitiger Bestellungen, wiederholter Übertragung, zwei konkurrierender Reservierungen, Rücknahme einer Reservierung, Transaktionsabbruch, Preiswechsel und Zugriffsschutz.
- Browserprüfung: `node scripts/check-theater.cjs` mit Playwright und Microsoft Edge. Optional `THEATER_XLSX` auf eine lokale Preisliste setzen. Alle Netzaufrufe werden durch lokale Testdaten ersetzt.
- Die genannte Kassenbestellung.xlsx wurde im Browser geprüft: 37 Artikel einschließlich Größen und Preisen erkannt; Rubrikzuordnung vor dem Speichern verlangt.
- Browseransichten bei 320/390 Pixeln sowie 768/1024 Pixeln geprüft. Separate Handyseite ohne Portalnavigation, X mit Abbrechen/Bestätigen sowie Auswahl nach Rückkehr erfolgreich geprüft. Ein Test mit 20 echten Geräten im Veranstaltungs-WLAN und ein echtes iOS-/iPadOS-Gerät sind noch ausstehend.

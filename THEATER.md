# Theatermodul · erste Umsetzung · 2026.10.16.31

## Bedienung

Am iPad: **Menü → Veranstaltung → Theater**. Die Kassenübersicht verwendet den bestehenden geschützten Verwaltungszugang und Kontodienst. Drei Ansichten: Kasseneingabe, Auswertung, Verwaltung.

Unter Verwaltung eine Veranstaltung anlegen, die XLSX- oder CSV-Preisliste auswählen und die Vorschau prüfen. Der Import sucht die Spalten Artikel und Preis auch innerhalb einer Checkliste. Größe wird dem Artikelnamen hinzugefügt. Rubrik/Kategorie ist optional; fehlende Rubriken müssen vor dem Speichern zugeordnet werden. Eine neue Rubrik entsteht durch Eingabe ihres Namens im Artikelfeld „Rubrik“. Artikel können ergänzt, bearbeitet, deaktiviert oder aus der aktuellen Liste entfernt werden. Bereits bestätigte Bestellungen behalten ihre ursprünglichen Artikel und Preise.

„Bestellungen am Handy erlauben“ aktivieren und speichern. Es kann eine Veranstaltung gleichzeitig geöffnet sein. Für Folgejahre kann die Artikelliste der ausgewählten Veranstaltung übernommen werden; die alten Bestellungen bleiben erhalten.

Am Handy: **Mehr → Theater · Bestellung aufnehmen** öffnet eine eigene Bestellseite ohne Portalnavigation und weitere Portalbereiche. Die dunkelblaue Bestellansicht zeigt oben nur den aktuellen Veranstaltungsnamen, den Storno-Schalter und ein X. Darunter folgen Suche, Rubriken und Artikel. Die Preisliste lädt beim Öffnen automatisch; bei Ladefehlern erscheint „Erneut laden“. Erst nach Bestätigung der Rückfrage geht es zurück zu Mehr; Auswahl und ausstehende Übertragung bleiben erhalten. Rubrik antippen oder Artikel suchen. Ein Tipp auf die große Artikelkachel fügt ein Stück hinzu; die kleinere Minustaste korrigiert die Auswahl bis null. Auswahl und Summe bleiben bei der Suche erhalten. Summe prüfen und Bestellung senden. Die App verwendet den persönlichen Portalzugang. Erst die Serverbestätigung setzt die Mengen zurück. Bei unklarer Übertragung bleibt die Bestellung gesperrt und kann mit derselben Kennung erneut geprüft werden. Entwurf und ausstehende Übertragung bleiben innerhalb derselben Browsersitzung erhalten. Ohne Internet gibt es keine bestätigte Bestellung; dies ist keine vollständige Offline-Kasse.

Am iPad erscheint je aufnehmender Person eine Karte mit summierten Artikeln. „Für Kasse reservieren“ friert genau die angezeigten Bestellungen ein. Neu bestätigte Bestellungen erscheinen getrennt. Nach dem Abtippen „In Kasse erfasst“ wählen oder die Reservierung freigeben. Ein Paket umfasst höchstens 60 einzelne Bestellungen; bei mehr offenen Bestellungen weist die Karte auf die Aufteilung hin. Mengen pro Artikel werden weiterhin summiert. Die Übersicht aktualisiert sich im sichtbaren Fenster alle fünf Sekunden.

Auswertung: Bestellwert, Bestellungen, Kassenstand, Artikel, Rubriken, Personen und Stundenverlauf in Europe/Berlin. Excel-kompatibler CSV-Export enthält die einzelnen Positionen und ihren Status. „In Kasse erfasst“ ist eine manuelle Bestätigung, kein automatisch geprüfter Zahlungseingang. Bestätigte Bestellungen bleiben unverändert. Stornos werden als separate negative Gegenbuchungen erfasst und im Bestellwert verrechnet. Unter „Bestellungen / Storno“ lassen sich ganze positive Bestellungen einmalig stornieren, auch nach der Kassenerfassung. Bereits reservierte Pakete bleiben unverändert; die Gegenbuchung muss separat in die Kasse übernommen werden. Am Handy sind Bestellungen von 1 bis 99 Stück möglich. Für Rückgaben zuerst bei leerer Auswahl den Storno-Modus aktivieren; Artikel antippen merkt negative Mengen bis −99 vor. Minus nimmt vorgemerkte Stücke wieder zurück. 0 wird nicht gesendet. Negative Mengen werden vor dem Senden bestätigt und verwenden den aktuell geladenen Preis. Der CSV-Export enthält Buchungsart und bei iPad-Stornos die ursprüngliche Bestellkennung.

## Veröffentlichung

Website und bestehender Cloudflare-Worker müssen gemeinsam aktualisiert werden. Das gebaute Worker-Paket enthält TheaterModel und TheaterService. Die zusätzlichen Tabellen und Indizes werden beim ersten Theateraufruf automatisch angelegt. Vorhandene Konten, Kalender und OneDrive-Dateien werden nicht umgeschrieben. Bestellinhalte, Personennamen und Preislisten werden über die bestehende Verschlüsselung des Kontodienstes gespeichert. Die Theaterdaten liegen in D1 und sind nicht Bestandteil des lokalen App-/OneDrive-Backups; eine Auswertung kann separat exportiert werden.

Die lokale Implementierung allein schaltet das Modul noch nicht auf bereits installierten Geräten frei. Anschließend eine Veranstaltung einrichten und mit zwei echten Geräten eine vollständige Testbestellung einschließlich Reservierung und Abschluss prüfen.

## Prüfung

### Artikelsortierung 2026.10.16.33

In der Verwaltung verschieben „Nach oben“ und „Nach unten“ einen Artikel innerhalb seiner Rubrik. Andere Rubriken behalten ihre Reihenfolge. Die neue Reihenfolge wird mit „Veranstaltung & Preisliste speichern“ übernommen und nach dem Laden der aktuellen Preisliste am Handy angezeigt. Erste und letzte Positionen sperren die jeweils nicht mögliche Richtung. Auch noch ungespeicherte Preisänderungen bleiben beim Verschieben erhalten.

Browserprüfung: zwei Getränke mit dazwischenliegendem Essen sortiert, Rubrikgrenzen und gesperrte Pfeile geprüft, gespeichert und anschließend die Reihenfolge in der Handyoberfläche geprüft. Bestehende Tests der Verwaltung bei verzögerten Antworten weiterhin erfolgreich.

### Bedienkorrektur 2026.10.16.32

Nachladen sperrt die Verwaltungsbuttons, die Eingabefelder und den Rückweg nicht mehr. Schreibvorgänge verhindern weiterhin doppelte Bestätigungen und verwerfen verspätete Antworten älterer Lesevorgänge. Änderungen im Editor bleiben beim Nachladen erhalten. Die Veranstaltungsauswahl wartet auf den laufenden Ladevorgang, damit keine falsche Veranstaltung geladen wird. Die Häkchen für Artikelaktivierung und Bestellfreigabe sind wieder sichtbar. Rückmeldungen stehen zusätzlich direkt vor den unteren Verwaltungsbuttons.

Regression mit künstlich verzögerter Serverantwort: Verwaltung öffnen, Artikel und Preis bearbeiten, Bestellfreigabe aktivieren, währenddessen Leseantwort empfangen, speichern und während eines weiteren Ladevorgangs zurückgehen. Native Checkboxdarstellung, Schutz vor doppeltem Speichern und Bestätigung unten geprüft. `node scripts/check-theater-controls.cjs` und der vollständige Theater-Browserablauf erfolgreich; weiterhin 499 automatisierte Tests erfolgreich.

Zusätzlich stehen im Handyportal die Hinweise „Zuletzt aktualisiert“, „Datenstand“ und der allgemeine Verbindungsstatus unter den Inhalten. Die Browserprüfung kontrolliert bei 320, 390 und 768 Pixeln, dass unterschiedlich lange Statusmeldungen die Position der Karten beim Menüwechsel nicht verschieben.

- Gesamte Testsuite: `node --test tests/*.test.cjs` aus dem App-Verzeichnis: 499 Tests erfolgreich. Syntaxprüfungen aller geänderten JavaScript-Module erfolgreich.
- Theaterintegration: authentifizierte Workeraufrufe mit SQLite als D1-Testadapter, einschließlich 20 gleichzeitiger Bestellungen, wiederholter Übertragung, zwei konkurrierender Reservierungen, Rücknahme einer Reservierung, Transaktionsabbruch, Preiswechsel und Zugriffsschutz.
- Browserprüfung: `node scripts/check-theater.cjs` mit Playwright und Microsoft Edge. Optional `THEATER_XLSX` auf eine lokale Preisliste setzen. Alle Netzaufrufe werden durch lokale Testdaten ersetzt.
- Die genannte Kassenbestellung.xlsx wurde im Browser geprüft: 37 Artikel einschließlich Größen und Preisen erkannt; Rubrikzuordnung vor dem Speichern verlangt.
- Browseransichten bei 320/390 Pixeln sowie 768/1024 Pixeln geprüft. Separate Handyseite ohne Portalnavigation, X mit Abbrechen/Bestätigen sowie Auswahl nach Rückkehr erfolgreich geprüft. Ein Test mit 20 echten Geräten im Veranstaltungs-WLAN und ein echtes iOS-/iPadOS-Gerät sind noch ausstehend.

## iPad-Kassenübersicht und sicheres Zurücksetzen (2026.10.16.35)

Unter **Veranstaltung → Theater → Kasseneingabe** wird eine aufgeräumte Kassenfläche angezeigt.
Jede Person mit offenen oder reservierten Bestellungen erhält eine eigene Karte im responsiven Raster.
Grüne Karten enthalten noch nicht übernommene Bestellungen; blaue Karten enthalten ein reserviertes Kassenpaket.
Ein Tipp auf die Karte öffnet eine eigene Detailansicht mit Artikeln, Summen und dem vorhandenen Ablauf:
**Für Kasse reservieren → In Kasse erfasst**. Neue Bestellungen während der Reservierung
erscheinen separat und können erst nach Abschluss oder Freigabe übernommen werden.
Die Personenkarte verschwindet aus der Übersicht, sobald alle ihre Bestellungen abgeschlossen sind.
Die iPad-Ansicht bietet keine Bestellungsstornierung mehr. Bestehende Storno-/Korrekturbuchungen
bleiben in den Auswertungen erhalten; die Handyfunktion für negative Mengen wird nicht verändert.

In **Verwaltung** kann die ausgewählte Theater-Veranstaltung zurückgesetzt werden.
Dies entfernt dauerhaft deren sämtliche Bestellungen einschließlich abgeschlossener und reservierter
Kassenpakete, schließt den Verkauf und erhöht die Versionsnummer. Veranstaltungsname und Preisliste
bleiben zur erneuten Verwendung erhalten. Vorher bei Bedarf eine CSV-Auswertung exportieren.
Die Verwaltung bestätigt die Löschung zuerst über einen Warndialog und dann durch die
Eingabe `ZURÜCKSETZEN`. Die Worker-Operation erfordert Admin-Zugriff, die aktuelle
Veranstaltungsversion und eine atomare Datenbanktransaktion. Parallel laufende
oder veraltete Anfragen dürfen nach einem Reset keine alten Bestellungen wieder aufnehmen.
Die Internetverbindung ist für die Kassenübertragung und das Zurücksetzen erforderlich.

## Signalton bei neuen Bestellungen (2026.10.16.36)

In der iPad-Ansicht **Veranstaltung → Theater → Kasseneingabe** befindet sich
die Schaltfläche **„🔔 Ton einschalten“**. Beim Antippen wird ein sechsfacher,
gut hörbarer Testsignalton über die iPad-Lautsprecher erzeugt. Danach
spielt die Anwendung die Melodie erneut, wenn beim automatischen
Fünf-Sekunden-Abgleich eine tatsächlich neue positive Bestellung eingeht.
Vorher bereits vorhandene Bestellungen, reine Korrekturen und wiederholte
Abfragen derselben Bestellung lösen keinen weiteren Ton aus.

Die Aktivierung gilt nur für die geöffnete Sitzung und lässt sich mit
**„Ton ausschalten“** zurücknehmen. Browser, insbesondere iPadOS/Safari,
erfordern eine Nutzerinteraktion, bevor Ton abgespielt werden darf.
Die Anwendung kann die physische Geräte-Lautstärke, Stummschaltung und
Audioausgabe nicht übersteuern. Das iPad muss deshalb laut gestellt sein,
und die App für diese Prüfung im Vordergrund bleiben. Bei gesperrtem
Bildschirm oder vollständig im Hintergrund gibt es keine zuverlässige
Browser-Signalton-Garantie. Die Funktion verwendet den vorhandenen
Browser-Audiogenerator: keine Sounddatei, keine zusätzlichen Dienste,
keine Kosten und keine Änderung der Handy-Bestell- oder Cloudflare-API.

## Rubrikfarben

Unter Verwaltung → Preisliste kann für jede Rubrik eine Farbe aus sechs gut lesbaren Farben gewählt werden. „Veranstaltung & Preisliste speichern“ übernimmt die Farben für alle Geräte. Auf dem Handy markieren sie Rubrikschaltflächen, Überschriften und Artikelkacheln; Namen und Mengen bleiben zusätzlich sichtbar. Website und Cloudflare-Worker müssen dafür aktuell sein.

## Schnellaufnahme und Artikelreihenfolge

Leere Artikelkarten zeigen weder eine Nullmenge noch eine Minustaste. Nach dem Antippen erscheinen Menge und Minus; die Karte leuchtet kurz auf (außer bei reduzierter Bewegung). Die Fußzeile zeigt die gesamte Stückzahl und den Betrag. „Auswahl leeren“ verwirft nach Rückfrage ausschließlich noch nicht gesendete Positionen; unbestätigte Übertragungen bleiben gesperrt und erneut prüfbar.

Die Verwaltung zeigt Artikel in Rubrikbereichen. „Artikel hinzufügen“ im jeweiligen Bereich übernimmt dessen Rubrik. „Nach oben“ und „Nach unten“ verändern die Reihenfolge innerhalb der Rubrik; diese Reihenfolge gilt nach „Veranstaltung & Preisliste speichern“ auch für die Handyansicht. Häufige Artikel können so zuerst stehen. Änderungen der Rubrik ordnen den Artikel dem passenden Bereich zu.

## Getränkeangaben auf den Karten

Getränkekarten zeigen den Artikelnamen und darunter Glas/Flasche/Tasse sowie die Gebindegröße. Vorhandene eindeutige Angaben im Namen (z. B. „Wasser · Flasche · 0,5 l“) werden aufgeteilt. Fehlende Angaben erscheinen als „Gefäß offen“ beziehungsweise „Größe offen“ und lassen sich in der Verwaltung je Artikel ergänzen. Bei Rubriken Essen, Speisen, Gerichte, Snacks, Kuchen, Desserts und Gebäck entfällt diese Zusatzzeile. Preise und Mengen bleiben sichtbar. Die Angaben werden kompatibel im vollständigen Artikelnamen gespeichert, sodass sie auch die Kasse erreichen; bestätigte Buchungen bleiben unverändert. Import unterstützt zusätzlich Gefäß/Glas-Flasche und Gebindegröße neben der bisherigen Größe.

## Bedienoberfläche ab Version 2026.10.18.1

Die Veranstaltungsseite öffnet Theater nun direkt über drei große Startkarten:
**Kasseneingabe**, **Auswertung** und **Verwaltung**. Der geschützte
Verwaltungszugang bleibt erforderlich. In der iPad-Kasseneingabe befinden sich
Signalton-Schalter und Tonstatus auch im Live-Kopfbereich; die bisherige
Tonkonfiguration in der Verwaltung bleibt nutzbar.

Während der automatischen Kassenabfrage bleiben bereits angezeigte Personenkarten
als DOM-Knoten an derselben Position stehen. Neue Personen erscheinen am Ende
der laufenden Kartenliste; die erste Darstellung sortiert weiterhin nach offenen
Bestellungen. Geänderte Daten werden innerhalb der vorhandenen Karte aktualisiert.
Auch die offene Detailansicht wird bei unveränderten Bestellungen nicht neu aufgebaut.
Reservierung, Bestätigung und Freigabe verwenden die bisherigen geschützten Aktionen.

Die Handy-Bestellaufnahme erhält im festen Summenbereich eine aufklappbare
Artikelauswahl. Dort können vorgemerkte Stückzahlen mit Plus und Minus korrigiert
werden, ohne die Rubrik erneut aufsuchen zu müssen. Während einer unbestätigten
Übertragung bleiben diese Bedienelemente gesperrt; die gesicherte Wiederholung
mit derselben Bestellkennung bleibt bestehen.

In der Verwaltung zeigt die bereits angeheftete Speichern-Leiste den Zustand
ungespeicherter Änderungen. Die Auswertung bietet drei kompakte Kennzahlen
vor den vorhandenen Tabellen und dem CSV-Export. Serverseitige Buchungsschemata,
Berechtigungen und produktive Kontodaten wurden nicht verändert.

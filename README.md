# Feuerwehr Wasser

Statische Web-App für Anwesenheit, Taktik, Einsatzberichte und Jahresstatistik.

## Getränke

Im Menü **Getränke** stehen große Namenskarten. Ein Klick auf den Namen
öffnet das persönliche Eingabemenü. **Zurück zu allen Mitgliedern** führt
zur Übersicht; offene Vormerkungen bleiben erhalten und werden dort farblich
markiert. Bier kostet 1,50 €,
Wein 3,00 €. Mehrere Getränke oder heutige, vollständig unbezahlte
Fehleingaben werden vorgemerkt und erst mit **OK · Änderungen speichern**
übertragen. Jede Karte besitzt dafür einen eigenen OK-Button; dieser speichert
nur diese Karte. Die Sammelbestätigung bleibt am Seitenende, ohne schwebendes
Popup. Nach Eingabe, Speicherung und Rückkehr aus dem Konto bleibt die
ausgewählte Karte im Fokus. Betrag und Eurozeichen bleiben zusammen.

Bezahlt, teilweise bezahlt, mit Vorauszahlung oder Treuepunkten
verrechnete Einträge können Mitglieder nicht zurücknehmen. Fünf Bier bzw.
Weingläser erscheinen als getrennte Fässer. Bereits gespeicherte Tagesmengen
werden auf den Karten nicht zusätzlich angezeigt.

Eine persönliche vierstellige PIN ist freiwillig und schützt den Zugang zum
persönlichen Eingabemenü. Nach 60 Sekunden ohne Bedienung, beim Verbergen
der App und beim Zurückgehen zur Namensübersicht wird die Freigabe gesperrt.
Mitglieder richten sie
unter **Konto → PIN einrichten/verwalten** selbst ein oder entfernen sie mit
der aktuellen PIN. Die Verwaltung kann sie unter **Einstellungen → Mitglieder**
setzen. Es gibt keine Standard-PIN. PINs schützen die Bedienung; Dateizugriffe
richten sich nach den OneDrive-Berechtigungen.

**Bezahlen** zeigt Gesamtschulden und eine direkte Barbestätigung. **Geld
einzahlen** erlaubt freie Beträge einschließlich Vorauszahlungen: Geld zuerst
in die Getränkekasse legen und danach bestätigen. Der Restbetrag bleibt als
**Eingezahlter Betrag** für spätere Getränke erhalten. PayPal öffnet einen
QR-Code zu `paypal.me/FeuerwehrWasser`; die Verwaltung prüft den Eingang und
verbucht ihn unter **Einstellungen → Getränkeverwaltung → Schulden, PayPal &
Erinnerungen**. Für bezahlte Konten dort „Auch bezahlte Konten für Einzahlungen
anzeigen“ wählen. PayPal wird nicht automatisch bestätigt.

**Treuepunkte** sind getrennt vom Geldbetrag. Standard: 30,00 € bestätigte
Einzahlungen vergeben 2 Punkte; 1 Punkt wird gegen 1 Bier oder 1 Glas Wein
eingelöst. Unter **Einstellungen → Getränkeverwaltung → Treuepunkte** lassen
sich Geldschwelle, vergebene Punkte und Punktebedarf für Bier/Wein unabhängig
festlegen. Nur Geldzahlungen zählen, einschließlich Teil- und Vorauszahlungen.
Getränke buchen und Punkte einlösen erzeugt keine neuen Punkte. Einlösungen
werden ausdrücklich auf der Karte gewählt und erst mit OK gespeichert.

Historische Bonuswerte bleiben erhalten: bisher noch verfügbare 1,50 €
Bonuswert entsprechen 1 Treuepunkt. Bereits automatisch verrechnete Getränke
und alte Buchungen werden nicht umgeschrieben. Neue Buchungen verwenden
Kontoschema 6. Historische Schemata 1–5 bleiben lesbar; ältere App-Clients vor
Nutzung neu laden. Geld- und Punktefortschritt bleiben ausschließlich in
OneDrive und im Arbeitsspeicher.

**Einstellungen → Getränkeverwaltung → Buchungen verwalten** erlaubt
Administratoren Einzel- und Mehrfachstornos auch alter und bezahlter Getränke
oder Zahlungen. Vorschau, Grund und Bestätigung sind erforderlich. Originale
bleiben als Nachweise erhalten. Eine gelöschte Zahlung nimmt ihre Treuepunkte
zurück; bereits eingelöste Punkte können einen negativen Punktestand ergeben,
der durch zukünftige Punkte ausgeglichen wird. Getränkestornos erstatten
gegebenenfalls Geld bzw. eingelöste Punkte. „Bereits gelöschte Einträge
ausblenden“ hält den Verlauf übersichtlich.

Die **Statistik** zeigt anonym die Mengen und nominalen Getränkewerte für
Bier/Wein je Jahr und Monat, einschließlich mit Punkten bezahlter Getränke.
Jahresbezogene offene Beträge, aktuelle Gesamtschulden aller Jahre und
vorausbezahlte Restbeträge sind getrennt. Geldzahlungen selbst sind kein
Getränkeverbrauch. Auch Konten früherer Mitglieder zählen mit; es werden keine
Mitgliedsnamen oder Einzelkonten angezeigt.

Getränkekonten und Einstellungen liegen privat im Unterordner **Getraenke**
der konfigurierten OneDrive-/SharePoint-Ablage. Browser und Service Worker
speichern diese Finanzdaten nicht dauerhaft. Dateiversionen schützen vor
parallelem Überschreiben; bei verlorenen Antworten werden dieselben
Buchungsnummern geprüft. Mehrfachstornos und Sammlungen sind pro Mitglied
atomar, mehrere Mitglieder werden nacheinander gespeichert. Es gibt keine
Offline-Buchungen. Das normale JSON-App-Backup enthält keine Getränkekonten:
den gesamten OneDrive-Ordner **Getraenke** separat sichern und bestehende
Mitgliederkennungen erhalten.

Mitgliederkarten werden beim Start bzw. nach erfolgreicher OneDrive-Verbindung
im Hintergrund vorbereitet. Ein aktueller vorbereiteter Stand öffnet ohne
erneutes Laden aller Konten. Schreiben, PIN-Prüfungen, Punktekosten und QR-Zugang
werden weiterhin frisch geprüft. Kontodaten bleiben dabei im Arbeitsspeicher.

QR-Bibliothek: qrcode-generator 2.0.4 von Kazuhiko Arase (MIT), lokal unter
`js/vendor/qrcode.js`; Lizenz unter `js/vendor/qrcode-LICENSE.txt`.

## Bedienung und Verwaltung

**Termin** öffnet den laufenden Termin und erhält Anmeldungen. Unter **Weitere
Aktionen → Termin verwerfen** wird er ausdrücklich verworfen. Der Status einer
gespeicherten Anmeldung kann direkt geändert werden. Historie und Statistik sind
im Menü; Mitglieder und Berichte haben eine Suche. Mitgliederdetails sowie lange
Einsatz- und Statistikabschnitte werden bei Bedarf geöffnet. Taktik lässt sich
auch durch Person und Zielplatz antippen bedienen, mit Rücknahme der letzten
Änderung durch Antippen.

Historienkorrekturen, Löschen, Sicherungswiederherstellung und OneDrive-Einrichtung
erfordern die Verwaltung. Lesen und Aktualisieren bleiben frei. Nach 15 Minuten
ohne Bedienung, beim Öffnen von Getränke und beim Verbergen der App wird die
Verwaltung automatisch gesperrt. Neue Admin-Passwörter brauchen acht Zeichen,
persönliche Getränke-PINs vier Ziffern.

Getränkekonten sperren sich auch mit offenen Strichen nach 60 Sekunden ohne
Bedienung oder beim Verbergen der App. Nach erneuter PIN-Eingabe bleiben die
Striche im Arbeitsspeicher verfügbar. Neuladen/Schließen kann sie verwerfen.
Unklare Buchungen werden weiterhin mit derselben Buchungsnummer geprüft.

**Einstellungen → Getränkeverwaltung → Schulden, PayPal & Erinnerungen** lädt aktuelle Beträge aus OneDrive
und bietet einzelne Erinnerungstexte zum Prüfen und Kopieren. Optional ist manueller Push-Versand nach Einrichtung des kostenlosen Versanddienstes und Zustimmung des Handy-Nutzers möglich (siehe cloudflare/push/README.md). Es gibt keine
E-Mail-Funktion, keinen automatischen Versand und keine zusätzlichen
Kontaktadressen im Browser oder Repository.

**App-Daten sichern** benennt den Umfang des bisherigen kompatiblen JSON-Backups.
Getränkedaten und Getränke-PINs werden separat durch Kopieren/Herunterladen des
ganzen OneDrive-Ordners **Getraenke** gesichert. Die Speicherortseite erklärt
beide Sicherungen. Der neue Service Worker aktualisiert die öffentlichen App-
Dateien zusammen; persönliche OneDrive-Antworten werden nicht gecacht.

## Start und Wiederherstellung

Den Inhalt dieses Projektordners in die Wurzel des GitHub-Repositorys
`ffw-wasser/home` übernehmen. GitHub Pages liefert die App unter
`https://ffw-wasser.github.io/home/` aus. Ein lokales Öffnen mit `file://` ersetzt
keinen Test über HTTPS; OneDrive/OAuth benötigt die registrierte Rücksprungadresse.

## Daten und Sicherung

Mitglieder und Teilnahmen liegen im Browser und in der konfigurierten OneDrive-
Datendatei. Die Statistik verwendet geladene abgeschlossene Berichte. Bei bestehender
Anmeldung lädt die App ZIP-Berichte beim Start, bei Wiederverbindung und Rückkehr.
Projektdateien sind keine vollständige Sicherung dieser persönlichen Nutzdaten.
Dafür die OneDrive-Datendatei und sämtliche Bericht-ZIPs separat sichern.
Die App bietet außerdem einen JSON-Komplettbackup-Export des aktuell geladenen Standes.

## Offline

Der Service Worker lädt die öffentlichen App-Dateien bei der ersten Installation.
OneDrive-Abfragen benötigen Internet; private Antworten werden nicht im Service Worker
abgelegt. Lokale Nutzdaten können weiterhin im Browser vorhanden sein.

## Prüfung

Mit Node.js aus diesem Ordner ausführen:

```sh
node --test tests/*.test.cjs
```

Die aktuelle Getränke-Umsetzung und Prüfung stehen in `GETRAENKE-PRUEFUNG.md`;
weitere Bedienverbesserungen in `UX-VERBESSERUNGEN.md`.
`PRUEFBERICHT-FINAL.txt` dokumentiert einen früheren Projektstand. Die umfangreichen aktiven
CSS-Schichten bleiben wegen ihrer Reihenfolge und dynamischen UI-Nutzung erhalten.
Die im Bericht beschriebenen offenen Punkte sind keine Freigabe aller Praxisabläufe.

## Schnelle Bedienung

Der Dankdialog endet nach vollständiger Zahlung nach 3 Sekunden, mit neuen
Treuepunkten nach 4,5 Sekunden. Erfassung erfolgt ausschließlich auf den
Mitgliederkarten; Konto enthält Verlauf, Punkte, PIN und Handyzugang.
Vorgemerkte Änderungen lassen sich filtern, prüfen und verwerfen. Bezahlen
oder Kontoöffnen überträgt keine Vormerkungen automatisch.

Die Anwesenheit hat Namenssuche und „Noch offen“ / „Alle Mitglieder“. Der Speicherhinweis unterscheidet Gerätespeicherung von bestätigter OneDrive-Synchronisierung. Änderungen während einer laufenden Synchronisierung werden nachgesendet; nach einem Fehlschlag bleibt der Stand unbestätigt. Dies ersetzt keine Konfliktauflösung für gleichzeitige Änderungen der allgemeinen Datendatei auf mehreren Geräten. Die Abschlussprüfung nennt die Personen, die im CSV als „Fehlt“ erscheinen, einschließlich unmarkierter Altersmitglieder. Nicht übernommene Statusauswahl muss vor dem Export gespeichert werden.

Historische Prüfung dieser Änderung: 100 Node-Tests und isolierte Browserabläufe mit OneDrive-Testdaten, inklusive QR-Decodierung, PIN-Sperre/Entwurf, Bonus/Teilzahlung, Suche/Filter, Abschlussabbruch und mehreren Bildschirmbreiten. Kein Schreiben in produktive Konten. Das reale iPad mit Safari und Microsoft-Anmeldung benötigt ergänzend eine Praxisprüfung.

## Persönlicher Handy-Deckel

Die Anwendung enthält eine verschlüsselte Handyansicht ohne Server und Microsoft-Anmeldung. Vor dem ersten QR-Zugang muss die Administration ein separates öffentliches Daten-Repository und einen darauf begrenzten GitHub-Schreibzugang unter Einstellungen → Getränkeverwaltung → Handy-Deckel verbinden. Anleitung, Datenumfang und Grenzen der Linkrotation: [README-HANDY-DECKEL.md](README-HANDY-DECKEL.md). Die PayPal-Schaltfläche öffnet eine Zahlung; die Administration trägt den geprüften Eingang am Gerätehaus-iPad unter Schulden, PayPal & Erinnerungen ein.

## Versionspflege

Der aktuelle Release steht in `app-release.json`. Nach einer Änderung der Version
`node scripts/update-release.cjs` ausführen: Alle geladenen CSS-/JS-Dateien und
der Offline-Cache erhalten gemeinsam denselben Build. Die Fußzeile zeigt die
App-Version. Daten-, Backup- und Buchungsschemata behalten ihre eigenen
Versionsnummern für die Wiederherstellung bestehender Daten.

QR-Generator: offizieller Release [js2.0.4](https://github.com/kazuhikoarase/qrcode-generator/releases/tag/js2.0.4); ZIP-Bibliothek: JSZip 3.10.2; PDF-Bibliothek: pdf-lib 1.17.1. Alte eigenständige Versionsanzeigen und doppelte Status-Overrides wurden entfernt. Benötigte Safari- und Daten-Kompatibilitätswege bleiben bestehen.

Prüfergebnisse und Grenzen beim Datenreset: [Getränkeprüfung](GETRAENKE-PRUEFUNG-2026-10-10.md).

Teilzahlungsstornos, die später vergebene Punkte ohne ausreichende Zahlung
stehen lassen würden, werden vor dem Speichern mit einer Erklärung abgewiesen.
Eine gemeinsame Bereinigung ist möglich, sofern auch die beteiligten späteren
Zahlungen tatsächlich fehlerhaft sind. Vorhandene Kontohistorien werden nicht
automatisch umgerechnet.

# Feuerwehr Wasser

Statische Web-App für Anwesenheit, Taktik, Einsatzberichte und Jahresstatistik.

## Getränke-Strichliste

Im Menü **Getränke** wählen Mitglieder ihren vorhandenen Namen und öffnen ihr
Konto mit einer persönlichen vierstelligen PIN. Diese wird in **Einstellungen →
Mitglieder** über **PIN in OneDrive speichern** eingerichtet oder geändert.
Es gibt keine voreingestellte Getränke-PIN. Im persönlichen Konto können Mitglieder ihre PIN unter **Meine PIN ändern** mit der aktuellen PIN und zweimaliger neuer Eingabe selbst ändern. PIN-Ableitungen und Buchungen bleiben in OneDrive; die Änderung erhält alle Buchungen.

Ein Strich kostet 1,50 €. Neue Striche lassen sich bis zum Speichern verringern
oder zurücksetzen; bereits gebuchte Striche und Zahlungen werden nicht gelöscht.
Fünf Biergläser werden als Comic-Bierfass angezeigt. Nach einer bestätigten vollständigen Zahlung explodiert das Fass kurz und bedankt sich auf dem iPad. Die Startansicht zeigt die
drei größten offenen Deckel. Die Oberfläche verwendet auf dem iPad im Querformat
zwei Spalten und große Tasten.

Barzahlungen werden nach **Geld in die Kasse gelegt** direkt eingetragen. Für
PayPal erzeugt die App den QR-Code auf dem Gerät zu
`https://paypal.me/FeuerwehrWasser/<Betrag>EUR`. Der Link enthält keine Namen.
Eine App auf dem eigenen Handy ist nicht erforderlich, aber PayPal kann eine
Anmeldung im Browser verlangen. **Zahlung durchgeführt** dokumentiert die
Bestätigung des Mitglieds; ein PayPal.Me-Link liefert keine automatische
Zahlungsbestätigung. Der tatsächlich gezahlte Betrag kann vor der Bestätigung über **Tatsächlich gezahlten Betrag ändern** angepasst werden. Ein weiterer Server ist nicht erforderlich.

PIN-Ableitungen und Getränkebuchungen liegen ausschließlich im Unterordner
**Getraenke** des bereits verbundenen OneDrive-Ordners. Im Browser bleiben sie
nur im Arbeitsspeicher. OneDrive-Verbindung, Internet und Bearbeitungszugriff
sind zum Buchen erforderlich. Jedes Mitglied hat eine Datei mit eindeutigen
Buchungsnummern; Änderungen verwenden die OneDrive-Dateiversion. Eine verlorene
Schreibantwort wird mit derselben Buchungsnummer nachgeprüft. Es gibt keine
Offline-Buchungen. Die persönliche PIN schützt die Bedienung am iPad; der
Zugriff auf die Dateien richtet sich nach den OneDrive-Berechtigungen.

Die bestehenden lokalen Mitglieder-/Teilnahme-Daten werden durch diese
Erweiterung nicht migriert. Das bisherige JSON-Anwendungsbackup enthält keine
Getränkekonten. Für deren Sicherung und Wiederherstellung den vollständigen
OneDrive-Unterordner **Getraenke** einschließlich aller Kontodateien sichern.
Bei einem Mitglieder-Import vorhandene Mitgliedskennungen beibehalten.

QR-Bibliothek: qrcode-generator 1.4.4 von Kazuhiko Arase (MIT), lokal unter
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
erfordern die Verwaltung. Lesen und Aktualisieren bleiben frei. Der sichtbare
Button **Verwaltung sperren** beendet die Freigabe; Getränke und das Verbergen
der App sperren sie ebenfalls. Neue Admin-Passwörter brauchen acht Zeichen,
persönliche Getränke-PINs vier Ziffern.

Getränkekonten sperren sich auch mit offenen Strichen nach 60 Sekunden ohne
Bedienung oder beim Verbergen der App. Nach erneuter PIN-Eingabe bleiben die
Striche im Arbeitsspeicher verfügbar. Neuladen/Schließen kann sie verwerfen.
Unklare Buchungen werden weiterhin mit derselben Buchungsnummer geprüft.

**Einstellungen → Offene Deckel erinnern** lädt aktuelle Beträge aus OneDrive
und bietet einzelne Erinnerungstexte zum Prüfen und Kopieren. Es gibt keine
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

Der aktuelle Prüfbericht liegt in `PRUEFBERICHT-FINAL.txt`. Die umfangreichen aktiven
CSS-Schichten bleiben wegen ihrer Reihenfolge und dynamischen UI-Nutzung erhalten.
Die im Bericht beschriebenen offenen Punkte sind keine Freigabe aller Praxisabläufe.

## Getränke-Treuebonus

Standard: Nach 20 regulär bezahlten Strichen (30 € bestätigten Zahlungen) gibt es 3 € Getränkeguthaben. Unter **Einstellungen → Getränke-Bonus** kann die Verwaltung Menge und Gutschrift ändern. Die gemeinsame Datei `Getraenke/bonus-einstellungen.json` wird beim ersten Bonusaufruf mit diesen Werten angelegt. Zahlungen vor diesem Start zählen nicht rückwirkend. Teilzahlungen zählen in Cent; Guthabenverbrauch zählt nicht als erneute Zahlung. Eine Gutschrift bezahlt automatisch weitere Striche, nicht bereits bestehende offene Beträge. Der Verbrauch und der Fortschritt bleiben auch bei Änderungen der Bonuswerte erhalten; neue Werte gelten ab der nächsten Zahlung.

Zahlung und verdiente Bonusbuchung werden zusammen mit derselben bedingten OneDrive-Schreiboperation gespeichert. Wiederholungen, verlorene Antworten und parallele Buchungen erzeugen keine doppelten Gutschriften. Konten werden beim ersten neuen Buchen auf Schema 2 erweitert; Buchungen und PIN bleiben erhalten. Alte Clients mit Schema 1 lehnen diese Konten ab, anstatt Gutschriften falsch als Zahlung zu verrechnen. Den gesamten OneDrive-Ordner **Getraenke** einschließlich Bonus-Einstellungen sichern. Im Browser werden weder Bonus-Fortschritt noch Guthaben oder Einstellungen dauerhaft gespeichert.

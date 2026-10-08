# Feuerwehr Wasser

Statische Web-App für Anwesenheit, Taktik, Einsatzberichte und Jahresstatistik.

## Getränke-Strichliste

Im Menü **Getränke** wählen Mitglieder ihren vorhandenen Namen und öffnen ihr
Konto mit einer persönlichen vierstelligen PIN. Diese wird in **Einstellungen →
Mitglieder** über **PIN in OneDrive speichern** eingerichtet oder geändert.
Es gibt keine voreingestellte Getränke-PIN.

Ein Strich kostet 1,50 €. Neue Striche lassen sich bis zum Speichern verringern
oder zurücksetzen; bereits gebuchte Striche und Zahlungen werden nicht gelöscht.
Fünf Biergläser werden als Comic-Bierfass angezeigt. Die Startansicht zeigt die
drei größten offenen Deckel. Die Oberfläche verwendet auf dem iPad im Querformat
zwei Spalten und große Tasten.

Barzahlungen werden nach **Geld in die Kasse gelegt** direkt eingetragen. Für
PayPal erzeugt die App den QR-Code auf dem Gerät zu
`https://paypal.me/FeuerwehrWasser/<Betrag>EUR`. Der Link enthält keine Namen.
Eine App auf dem eigenen Handy ist nicht erforderlich, aber PayPal kann eine
Anmeldung im Browser verlangen. **Zahlung durchgeführt** dokumentiert die
Bestätigung des Mitglieds; ein PayPal.Me-Link liefert keine automatische
Zahlungsbestätigung. Der tatsächlich gezahlte Betrag muss dem gewählten Betrag
entsprechen. Ein weiterer Server ist nicht erforderlich.

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

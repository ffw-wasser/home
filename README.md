# Feuerwehr Wasser

Statische Web-App für Anwesenheit, Taktik, Einsatzberichte und Jahresstatistik.

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

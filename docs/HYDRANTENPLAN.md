# Hydrantenplan

Das Original liegt in OneDrive unter
`Feuerwehr Share/Webseite/Hydrantenplan/Hydrantenplan-Wasser.pdf`.
Die bestehenden OneDrive-Freigaben bleiben auf ausdrücklichen Wunsch unverändert.
Der Plan und seine Inhalte gehören nicht ins öffentliche GitHub-Repository.

## Gemeinsame Ablage auf mehreren Gerätehaus-iPads

Hydrantenplan und Ansprechpartner werden über die geprüfte gemeinsame
OneDrive-/SharePoint-Bibliothek gelesen. Das persönliche Laufwerk des jeweils
angemeldeten Microsoft-Kontos wird dafür nicht verwendet.

Ist „Webseite“ direkt als gemeinsamer Ordner eingerichtet, werden die Unterordner
`Hydrantenplan` und `Feuerwehr-Kontakte-Privat` relativ dazu gelesen. Bei
„Feuerwehr Share“ wird zusätzlich `Webseite` verwendet. Liegt der konfigurierte
App-Datenordner an einer anderen Stelle, bleibt der bisherige Pfad
`Feuerwehr Share/Webseite` erhalten, wird aber in der geprüften gemeinsamen
Bibliothek aufgelöst. Es findet keine Suche in anderen Laufwerken statt.

Jedes iPad muss mit derselben gemeinsamen Ablage verbunden sein; das jeweilige
Microsoft-Konto braucht Leserechte auf die beiden Dateien. Bei 403 wird der Zugriff
abgebrochen, bei 404 werden Ablage und Dateiname verständlich genannt. Weder
Berechtigungen noch Dateien werden durch den Abruf geändert. Ein Wechsel der
Verbindung oder eine Abmeldung während des Downloads verwirft das Ergebnis.

## Bereitstellung

Nach Veröffentlichung des aktualisierten Workers und der App am Gerätehaus-iPad:

1. Mit dem bisherigen Microsoft-Konto verbinden und Verwaltung entsperren.
2. Unter Infos/Hilfe **Hydrantenplan abgleichen** wählen.
3. Erst nach vollständiger Übertragung und erfolgreicher PDF-/SHA-256-Prüfung wird
   die neue Fassung im Portal freigeschaltet. Bei Abbruch bleibt die vorherige Fassung.

Am Gerätehaus-Tablet öffnet **Hydrantenplan ansehen** unter Infos/Hilfe das
Original direkt aus OneDrive. Dafür ist die bestehende OneDrive-Verbindung, aber
keine zusätzliche Admin-Freigabe nötig. Schließen oder Microsoft-Abmeldung räumt
die temporäre PDF-Ansicht auf.

Nach Austausch des OneDrive-Originals erneut abgleichen. Smartphone-Mitglieder
benötigen keine Microsoft-Anmeldung. Die Kachel liegt standardmäßig unter Mehr
und nimmt an der vorhandenen individuellen Menüanordnung teil.

## Schutz und Grenzen

Die Portalbereitstellung speichert AES-GCM-verschlüsselte Abschnitte im bestehenden
D1-Kontodienst. Metadaten und Abschnitte verwenden getrennte zweckgebundene
Verschlüsselung. Jede Leseanfrage prüft die aktive Mitgliedschaft und die zentrale
Passkey-Sitzung. Adminaktionen erfordern den Admin-Token und die passende Quelle.
Die Bereitstellung ändert nicht die Berechtigungen des OneDrive-Originals.

Übertragung erfolgt über HTTPS. Im Portal entsteht nach vollständiger Prüfung
eine temporäre PDF-Blob-URL im Arbeitsspeicher; keine PDF in localStorage, IndexedDB
oder dem Service-Worker-Cache. Beim Verlassen der Ansicht und Abmelden wird die
URL widerrufen. Ein separat geöffnetes oder vom Benutzer gespeichertes PDF lässt
sich nachträglich nicht zurückholen. Das Verfahren ist keine Ende-zu-Ende-
Verschlüsselung gegenüber dem Kontodienst.

Maximal 8 MiB, Abschnitte mit 192 KiB; dadurch bleibt jeder verschlüsselte D1-Wert
unter dem Größenlimit. Unveröffentlichte Übertragungen werden beim nächsten
Abgleich nach einer Stunde bereinigt. Der veröffentlichte Plan bleibt erhalten.

## Vergrößern und Verschieben

Auf Smartphone und Gerätehaus-Tablet lässt sich der Plan direkt mit zwei Fingern
auseinanderziehen (bis zur 32-fachen Übersichtsgröße). Mit einem Finger wird der
Ausschnitt verschoben. Die Geste bleibt auf den Plan begrenzt und löst keinen
Seitenwechsel aus. Die Anzeige rendert nur eine Bildschirmfläche neu aus der PDF,
sodass hohe Zoomstufen keine riesigen Canvas-Flächen im Tablet-Speicher erzeugen.

PDF.js 5.4.624 liegt mit Apache-2.0-Lizenz lokal unter js/vendor/pdfjs. Es werden
keine PDF-Inhalte an externe Anzeigedienste gesendet. Der Import erfolgt erst beim
Öffnen eines Plans. Reproduzierbarer Bezug: npm ci --ignore-scripts und
node scripts/prepare-plan-pdf.cjs. Falls der Renderer auf einem älteren Browser
nicht geladen werden kann, bleibt die bisherige native PDF-Ansicht verfügbar.

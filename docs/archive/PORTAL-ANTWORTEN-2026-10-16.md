# H₂O Portal – Version 2026.10.16.26

## Änderungen

- Nur über der ersten Terminkarte steht mittig „Nächster Termin“. Alle Termine bleiben chronologisch sichtbar; weitere Karten folgen beim Scrollen.
- Neuer Button „?“ mit zugänglicher Beschriftung: gesehen, noch unsicher. Gespeicherte Antwort `maybe` erscheint als violette Karte mit „Gesehen · noch unsicher“. Zurücknehmen und spätere Zusage/Entschuldigung bleiben möglich.
- Gruppenführer und Verwaltung sehen unsichere Antworten separat. Diese Antworten werden nicht als Anwesenheit oder Entschuldigung vorgemerkt.
- Manuelle und automatische Erinnerungen berücksichtigen unsichere Mitglieder weiterhin zum eingestellten Vorlauf. Empfängerauswahl, Berechtigungen, Versionskonflikte und einmaliger Versand bleiben erhalten.
- Links/rechts wischen wechselt zwischen den fünf Portalmenüs in deren Reihenfolge, ohne Umlauf am Ende. Senkrechtes Scrollen, Bedienelemente, Eingabefelder, Mehrfinger- und Bildschirmrandgesten lösen keinen Menüwechsel aus. Menübuttons bleiben verfügbar.
- Portalhilfe und Versions-/Cachekennungen aktualisiert.

## Prüfung

- 481 automatisierte Tests bestanden, einschließlich Speicherung/Wiederholung/Konflikt, konfigurierte Erinnerungen, Anwesenheitsvormerkung und Navigation.
- Syntaxprüfung der geänderten JavaScript-Module und des neu erstellten Worker-Bundles.
- Lokaler Browser: Antwort speichern/zurücknehmen, violette Karte, Hinweis bei altem Worker sowie echte emulierte Touch-Eingaben für horizontales Wischen und vertikales Scrollen.
- Lesbarkeit: 72 Ansichten bei 320, 390, 768 und 1280 Pixeln; zusätzlich doppelte Schriftgröße. Keine erkannten Kontrastfehler oder horizontalen Überläufe. Kleine Portalansicht zusätzlich visuell geprüft.
- Ausschließlich künstliche Testdaten; keine produktiven Mitgliederdaten verändert.

## Cloudflare und offene Grenzen

`cloudflare/push/worker.bundle.js` wurde neu erstellt. Der neue Worker muss für „?“ veröffentlicht sein. Die Liste meldet die Fähigkeit durch `uncertainReplies: true`. Bei einem älteren Worker zeigt das Portal beim Antippen von „?“ einen Updatehinweis und behauptet keine erfolgreiche Speicherung.

Wenn Cloudflare Builds wie in `cloudflare/push/AUTO-DEPLOY.md` eingerichtet ist, den erfolgreichen Build und Deploy dieses Commits prüfen. Andernfalls im bestehenden Cloudflare Worker den vollständigen Inhalt von `worker.bundle.js` einsetzen und veröffentlichen. Vorhandene Variablen, Secrets, D1-Bindung und Cron-Konfiguration erhalten. Keine Datenbankmigration erforderlich.

Ein erfolgreicher produktiver Cloudflare-Deploy wurde in dieser Änderung nicht bestätigt. Anschließend mit einem Testzugang „?“ speichern, neu laden und den Status in der Rückmeldeübersicht kontrollieren. Die Geräteprüfung auf einem echten iPhone/Android-Gerät und iPad bleibt erforderlich; Browseremulation ersetzt insbesondere native Randgesten und Betriebssystem-Zoom nicht.

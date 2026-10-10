# Zentrale Getränkekonten – Betrieb im kostenlosen Tarif

Cloudflare D1 führt nach der einmaligen Übernahme die Getränkekonten. OneDrive
bleibt für Mitglieder, private Verwaltungsverbindungen und Sicherungen zuständig.
Persönliche Links funktionieren weiter; das Handy benötigt kein angemeldetes iPad.
Es werden keine kostenpflichtigen Dienste eingerichtet.

## Bereitstellung

1. In der bestehenden D1-Datenbank `central.sql` zusätzlich zu `schema.sql` ausführen.
   Die Befehle legen nur neue Tabellen an. Keine bestehenden Tabellen löschen.
2. `node cloudflare/push/build.cjs` ausführen und **worker.bundle.js** veröffentlichen.
   Wrangler verwendet diese Datei ebenfalls. Einzeln veröffentlichte `worker.js`
   enthält die zentrale Verarbeitung nicht.
3. Bestehende Secrets und DB-Bindung behalten. `INVITE_SECRET` wird auch zur
   Verschlüsselung der Kontodaten verwendet: nicht ersetzen oder löschen, bevor
   eine überprüfte Sicherung und ein geplanter Schlüsselwechsel vorliegen.
4. Die aktuelle App öffnen, OneDrive verbinden und Verwaltung entsperren.
   Unter **Getränkeverwaltung → Handy-Deckel → Zentrale Getränkekonten & Sicherungen**
   **Konten übernehmen / Übernahme fortsetzen** wählen.

Die Übernahme erstellt zuerst eine vollständige Sicherung und liest sie zur
Kontrolle nach. Danach werden Konten, Treuepunkte-Einstellungen und bestehende
Handyzugänge übernommen. Alte OneDrive-Kontodateien werden als unverändertes
Original in einer für alte Apps unlesbaren Archivhülle aufbewahrt. So können alte
Apps nicht weiter in den bisherigen Bestand buchen. Erst nach Prüfung wird die
Zentrale aktiviert. Bei Unterbrechung dieselbe Übernahme fortsetzen; die
Archivdateien oder `konten-zentrale.json` nicht manuell entfernen.

## Sicherungen und Testbuchungen

Sicherungen liegen im privaten OneDrive-Ordner **Getraenke** als
`sicherung-…json`. Sie enthalten vollständige Konten, Punkte-Einstellungen und
private Handyzugänge und dürfen nicht öffentlich geteilt werden.

- Automatisch bei der Übernahme und vor jedem Zurücksetzen.
- Zusätzlich jederzeit über **Jetzt in OneDrive sichern**.
- Keine zeitgesteuerte Sicherung bei geschlossenem iPad: der Dienst besitzt
  keinen eigenständigen OneDrive-Zugang.
- **Testbuchungen zurücksetzen** erlaubt ein einzelnes oder alle vorhandenen
  Konten. Nach bestätigter Sicherung wird der Umfang nochmals angezeigt.
  Guthaben, Schulden, Buchungen und Treuepunkte werden gemeinsam geleert;
  Mitglieder, PINs und Handyzugänge bleiben erhalten.
- Jede Buchung zwischen Sicherung und Reset verhindert den gesamten Reset.
  Erneut sichern und bestätigen. Unklare Antworten mit demselben Vorgang prüfen.
- Bereits erledigte Handyaufträge bleiben als Quittung erhalten. Alte wartende
  Eingaben werden nach einem Reset abgewiesen, statt wieder hinzugefügt zu werden.

Sicherungen sind vollständige JSON-Exporte. Eine automatische Wiederherstellung
ist in dieser Version nicht enthalten; zum Wiederherstellen ist ein geprüfter
administrativer Import mit gesperrten Schreibzugriffen erforderlich.

## Sicherheit und Grenzen

Kontoinhalte, PIN-Prüfwerte und Handyschlüssel liegen AES-GCM-verschlüsselt in D1.
Die Verwaltung authentifiziert sich mit dem vorhandenen privaten Admin-Zugang.
Handys besitzen nur ihren persönlichen Zugang. Antworten werden nicht gecacht.
Der Dienst verarbeitet die Konten im Arbeitsspeicher; die frühere Aussage einer
ausschließlich auf dem iPad möglichen Entschlüsselung gilt nach der Übernahme nicht.

D1-Transaktionen und Versionsprüfungen verhindern verlorene parallele Buchungen.
Das Zurücksetzen vieler Konten wird einzeln vorbereitet und in einer einzigen
Transaktion abgeschlossen, um innerhalb der Free-Abfragegrenzen zu bleiben.
Bei erschöpften Free-Kontingenten warten Vorgänge auf einen erneuten Versuch;
keinen kostenpflichtigen Tarif aktivieren. Stark gewachsene Kontohistorien müssen
bei Bedarf hinsichtlich Laufzeit und Datengröße erneut geprüft werden.

# H₂O Portal · Einrichtung und Prüfung

Release 2026.10.15.1 erweitert die bestehenden persönlichen Handy-Zugänge.
Die öffentlichen GitHub-Dateien enthalten nur Programmcode und Grafiken. Den
produktiven Kalender-Link ausschließlich in der geschützten Anwendung eingeben.

## Bestehenden Dienst aktualisieren

1. Den **bestehenden** Worker `feuerwehr-wasser-deckel-push` mit dem vollständigen
   Inhalt von `worker.bundle.js` aktualisieren und veröffentlichen. Keine neuen
   Secrets oder Datenbanken anlegen. Vorhandene Secrets und DB-Bindung beibehalten.
2. In Cloudflare unter **Settings → Trigger Events → Cron Triggers** den
   Ausdruck `* * * * *` hinzufügen (jede Minute). Bei einer CLI-Bereitstellung
   übernimmt `wrangler.jsonc` diesen Trigger. Nur Workers Free und D1 Free verwenden.
3. `/health` muss `portalVersion: 1` melden. Die Portal-Tabellen werden beim
   ersten Portalaufruf mit `CREATE TABLE IF NOT EXISTS` ergänzt. Alternativ
   `portal.sql` einmal in der bestehenden D1-Datenbank ausführen. Bestehende
   Konten, Schlüssel und Buchungen werden dadurch nicht geändert.
4. Auf dem iPad Website aktualisieren und OneDrive verbinden. Unter
   **Einstellungen → H₂O Portal** den öffentlichen Google-iCal-Link eintragen,
   Erinnerungszeit auswählen und speichern. Vorgabe: 24 Stunden; automatischen
   Versand ausdrücklich über den Schalter einschalten.
5. **Kalendereinträge laden:** Geburtstage (Geburtstag, Birthday, Geb. oder 🎂)
   werden bei eindeutig passendem vollständigem Mitgliedernamen automatisch
   zugeordnet. Reihenfolge, Groß-/Kleinschreibung und übliche Umlautschreibweisen
   dürfen abweichen. Teilnamen und doppelte Namen bleiben zur manuellen Prüfung
   offen. Ohne Zuordnung kein Bonus. Manuelle Zuordnungen haben Vorrang und
   gelten für die Geburtstagsserie. Sonstige Einträge werden als Probe erkannt,
   wenn der Titel Probe, Gesamtprobe, Hauptprobe oder Übungsprobe enthält;
   übrige Einträge als Sonderprobe. Die Freigabe für Anmeldung und Erinnerung
   bleibt ausdrücklich manuell. Einträge können auch von der Teilnahmefunktion
   ausgenommen werden. Bestehende manuelle Einordnungen bleiben erhalten.
6. Unter **Einstellungen → Getränkeverwaltung → Treuepunkte** stehen
   Einzahlungsbonus, Monats-Challenge und Geburtstagspunkte gemeinsam.
   Geburtstag: standardmäßig 1, einstellbar von 1 bis 100 ganzen Punkten.
   Bereits gebuchte Geburtstagsboni ändern sich nicht nachträglich.
7. In **Einstellungen → H₂O Portal** das Mitglied auswählen und dessen
   persönlichen QR-Code anzeigen. Vorhandene Links bleiben gültig. Die
   Verwaltung kann den Portalzugang damit unabhängig von der Getränkeansicht
   öffnen. Ein vorhandenes Home-Bildschirm-Symbol übernimmt Name/Icon je nach
   Betriebssystem erst nach erneutem Hinzufügen.
8. Mitglieder öffnen ihren persönlichen Link und aktivieren freiwillig
   **Erinnerungen erlauben**. iPhone/iPad: Portal zuerst zum Home-Bildschirm
   hinzufügen und dort öffnen. Keine App-Store-App, Google- oder Microsoft-
   Anmeldung auf dem Handy erforderlich.

## Verhalten

- Der Google-Kalender wird spätestens bei einem erfolgreichen Dienstabruf nach
  fünf Minuten neu geladen; offene Portale laden jede Minute nach. Google kann
  seine iCal-Ausgabe zusätzlich verzögern. Der angezeigte Abrufzeitpunkt ist
  daher keine Zusage einer sofortigen Google-Synchronisierung.
- Vorschau: ungefähr ein Jahr. UID und ursprüngliche Serieninstanz bestimmen
  die Termin-ID. Titel, endgültige Terminart und eine Verschiebung derselben
  Kalenderinstanz ändern die Rückmeldungszuordnung nicht. Löschen und als neuen
  Termin anlegen erzeugt eine neue Identität und benötigt eine neue Freigabe.
- Geburtstage erscheinen nicht als Probetermine. Das eigene Portal zeigt am
  Geburtstag eine Glückwunschnachricht. Die Gutschrift verwendet Europe/Berlin
  und wird atomar mit dem Jahresnachweis gespeichert. Mehrere Kalendereinträge,
  Wiederholungen, Gerätewechsel und Kontoresets erzeugen keinen zweiten Bonus
  für dasselbe Mitglied und Jahr. Ein Kontoreset entfernt die Punkte, hebt den
  Jahresnachweis aber nicht auf. Ausgefallene Geburtstage werden nicht an einem
  späteren Tag nachgebucht. Ein aktueller Kalender und korrekte Zuordnung sind
  nötig; Termine am 29. Februar folgen dem tatsächlich gelieferten Kalender.
- Die Terminart wird am iPad festgelegt. Zusagen sind keine Anwesenheiten.
  Entschuldigungen können ausdrücklich in der Personenliste vorgemerkt werden;
  bestehende Anwesenheiten/Markierungen werden nicht überschrieben.
- Gruppenführer sehen Zusagen, Entschuldigungen und offene Rückmeldungen mit
  Namen. Berechtigung ausschließlich aus der administrierten GF-Qualifikation,
  nicht aus einer selbst gewählten Ausbildungsstufe. Nach erfolgreichem
  OneDrive-Abgleich werden Namen und Rollen im Dienst aktualisiert. Änderungen
  können bis zum nächsten erfolgreichen Abgleich verzögert sein.
- Erinnerungen gehen an aktivierte Geräte für Zusagen und offene Antworten.
  Entschuldigte werden vor Versand nochmals geprüft. Ganztägige Einträge
  erhalten keine automatische Probe-Erinnerung. Der Cron versendet kleine
  Gruppen, üblicherweise innerhalb einiger Minuten um die eingestellte Zeit;
  nach einem Ausfall wird maximal eine Stunde nachgeholt. Bei mehreren zugleich
  fälligen Terminen wechseln sich diese ab. Manueller Versand kann mit derselben
  Versandkennung fortgesetzt werden, bis keine Empfänger mehr offen sind.
- Unklare/fehlgeschlagene Push-Zustellungen werden nicht automatisch ein zweites
  Mal gesendet. „Angenommen“ bestätigt die Annahme beim Push-Anbieter, nicht
  Anzeige oder Lesen. Bereits übergebene Pushs sind nicht zurückrufbar.
- Bei Kalenderfehlern bleibt der letzte Stand sichtbar und als veraltet markiert;
  Antworten, Bonusgutschriften und Erinnerungen werden dann nicht neu ausgeführt.

## Datenablage

- **GitHub:** Code, Icon und anonymisierte Tests; kein produktiver Kalender-Link,
  keine Namen, Geburtstage, Rückmeldungen oder persönlichen Zugangsschlüssel
  dieser Funktion. Auch das Manifest enthält keinen persönlichen Link.
- **OneDrive:** bestehende Mitglieder-/Qualifikationsdaten, private
  Dienstverbindung und persönliche Zugangsschlüssel.
- **Cloudflare D1:** zusätzlich verschlüsselte Kalenderdaten, Kalender-Link,
  Freigaben, Geburtstagszuordnungen, Namen/GF-Berechtigungen und Rückmeldungen.
  Leser erhalten nur die eigenen Rückmeldungen; GF erhalten die freigegebene
  Namensübersicht. Technische Kennungen/Jahresnachweise und Push-Endpunkte liegen
  ebenfalls dort. Das ist ein geschützter externer Datenspeicher, keine
  Anonymisierung der dort gespeicherten personenbezogenen Daten.
- **Handy:** der persönliche Link und eingeschränkte Push-Berechtigung werden nur
  nach Installation/Push-Zustimmung lokal gespeichert. Kalender und Namen werden
  nicht im Service Worker gecacht. Antworten werden ausschließlich online
  bestätigt. Der persönliche Link ist eine Zugangsberechtigung und muss privat
  bleiben; er ist kein zusätzliches Passwort.
- Versandnachweise werden nach 30 Tagen, Rückmeldungen nach 400 Tagen bereinigt.
  Kalendercache und Freigaben bleiben bis zur administrativen Bereinigung.
  Geburtstags-Jahresnachweise bleiben zur Verhinderung doppelter Boni erhalten.
  Die bisherige Getränke-OneDrive-Sicherung umfasst nicht die neuen
  Portal-Tabellen; für deren Wiederherstellung die vollständige D1-Datenbank
  einschließlich Jahresnachweisen sichern. Teilwiederherstellungen vermeiden.

## Technische Prüfung

`node cloudflare/push/build.cjs`, `node scripts/update-release.cjs` und
`node --test tests/*.test.cjs`. Kalenderverarbeitung mit lokalem ICAL.js 2.2.1
(MPL-2.0, unveränderte Distributionsdatei und Lizenz unter `js/vendor`).
Quellcode: https://github.com/kewisch/ical.js/tree/v2.2.1

Vor dem echten Einsatz: Google-Abruf im veröffentlichten Worker, Annahme und
Anzeige auf einem iPhone und Android, Abmeldung, GF-Rollenentzug und eine
Test-Rückmeldung am iPad prüfen. Node-/Chromium-Prüfungen ersetzen keine echten
Apple-/Google-Push- oder Microsoft-Sitzungen. Kostenloskontingente und das
10-ms-CPU-Limit müssen mit eurem echten Kalender kontrolliert werden; kein
kostenpflichtiges Upgrade automatisch aktivieren.

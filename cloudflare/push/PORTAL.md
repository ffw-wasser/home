# H₂O Portal · Einrichtung und Prüfung

Release 2026.10.15.1 erweitert die bestehenden persönlichen Handy-Zugänge.
Die öffentlichen GitHub-Dateien enthalten nur Programmcode und Grafiken. Den
produktiven Kalender-Link ausschließlich in der geschützten Anwendung eingeben.

## Kalender ohne OneDrive-Anmeldung am Gerätehaus-iPad (2026.10.15.10)

Nach Aktualisierung und Veröffentlichung des vorhandenen `worker.bundle.js` liefert
`GET /calendar/public` ausschließlich **ausdrücklich freigegebene** Probe-
und Sonderprobetermine. Titel werden aus Datenschutzgründen auf „Probe“ oder
„Sonderprobe“ reduziert. Geburtstage, Kalender-Originaladresse, Personendaten,
Rückmeldungen, Admin-Token und Verwaltungsfunktionen werden nicht ausgegeben.

Im Gerätehaus-iPad unter **Einstellungen → Kalenderverbindung → Kalenderadresse einrichten** die öffentliche Adresse des bestehenden Cloudflare-Workers
(`https://…workers.dev`) eintragen und speichern. **Kein Token eingeben.**
Die öffentliche Adresse bleibt in diesem Browser gespeichert. Sobald das iPad
mit OneDrive verbunden ist und der Kontodienst zur Verfügung steht, wird die
Adresse auch aus der vorhandenen Verbindung übernommen.

Nur die Leseansicht allgemein freigegebener Termine funktioniert ohne OneDrive.
Sonderproben mit ausgewählten Empfängern erscheinen aus Datenschutzgründen
nicht in dieser öffentlichen Ansicht. Persönliche Rückmeldungen,
Geburtstagszuordnungen, Freigaben, QR-Verwaltung und Push-Versand bleiben
durch die bisherigen Zugangskontrollen geschützt. Die Kalenderverwaltung
im H₂O Portal benötigt weiterhin eine bestätigte OneDrive-Anmeldung.

Die GitHub-Veröffentlichung aktualisiert den produktiven Cloudflare-Worker
**nicht automatisch**. Dessen vollständigen aktualisierten Bundle-Code
unverändert im bestehenden Worker bereitstellen. Wenn der neue Endpunkt
noch nicht ausgerollt wurde, ist ein 404 beim Abruf zu erwarten.

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

- Der Cron-Dienst prüft den Google-Kalender mit einem Cache von fünf Minuten.
  Listenabrufe lesen den gespeicherten D1-Stand; offene Portale laden diesen etwa
  jede Minute nach. Nach 15 Minuten ohne neuen Stand wird er als veraltet
  angezeigt. Schreibaktionen prüfen den Kalender gesondert. Google kann
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
- Unter **Einstellungen → H₂O Portal → Kalendereinträge** wird pro freigegebenem Termin die **Terminart für die iPad-Erfassung** gewählt. Am iPad wird sie bei der Terminauswahl vorausgewählt; vor Beginn kann die Auswahl manuell angepasst werden. Zusagen sind keine Anwesenheiten.
  Entschuldigungen können ausdrücklich in der Personenliste vorgemerkt werden;
  bestehende Anwesenheiten/Markierungen werden nicht überschrieben.
- Gruppenführer sehen Zusagen, Entschuldigungen und offene Rückmeldungen mit
  Namen. Berechtigung ausschließlich aus der administrierten GF-Qualifikation,
  nicht aus einer selbst gewählten Ausbildungsstufe. Nach erfolgreichem
  OneDrive-Abgleich werden Namen und Rollen im Dienst aktualisiert. Änderungen
  können bis zum nächsten erfolgreichen Abgleich verzögert sein.
- Automatische Terminerinnerungen sind dauerhaft aktiv, auch bei einer zuvor deaktivierten Einstellung. Der Vorlauf bleibt einstellbar. Erinnerungen gehen nur an aktivierte Geräte der für den Termin freigegebenen Personen mit Zusagen oder offenen Antworten.
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
  Abgelaufene Terminfreigaben und zugehörige Rückmeldungen werden nach der
  unten beschriebenen Sechs-Stunden-Regel bereinigt.
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

## Kalenderverwaltung und Bereinigung (Stand 16. Oktober 2026)

Die bebilderte Benutzerhilfe steht direkt in **Hilfe** der Haupt-App und unter
**Hilfe zum H₂O Portal** auf dem Handy. Sie verwendet die Originalgrafiken aus
`assets/drinks/` und die Fahrzeugbilder des Repositorys.

Bei jedem Probetermin **Terminart für die iPad-Erfassung** wählen: Allgemeine
Probe, Sonderprobe, Unterricht, Ausschusssitzung oder Einsatz. Diese Zuordnung
ist von der Portal-Einordnung Probe/Sonderprobe getrennt. Die iPad-Auswahl
übernimmt sie, solange noch keine laufende Erfassung geschützt werden muss.

Für Sonderproben entweder **Alle Mitglieder** oder ausgewählte Mitglieder
freigeben. Eine leere Auswahl ist nicht zulässig. Einzeln speichern und danach
die angezeigte Empfängerzahl kontrollieren. Die Sammelaktion **Automatische
Erkennung übernehmen** verarbeitet die erkannten Einträge des aktuellen Filters
und gibt Proben dabei frei; individuelle Empfänger vorher einzeln festlegen.

Abgelaufene Termine verschwinden beim Aktualisieren aus der aktiven Verwaltung
und dem Handy-Portal. Ohne laufende Erfassung wählt das iPad den nächsten Termin;
eine ausdrückliche spontane Auswahl wird beibehalten. Eine laufende Erfassung
wird nicht automatisch abgeschlossen.

Der aktuelle Worker bereinigt alte Terminfreigaben und zugehörige Rückmeldungen
frühestens sechs Stunden nach Ende, sofern der Kalender erfolgreich geprüft wurde.
Geburtstagsserien und Jahresnachweise bleiben erhalten. Google-Quellkalender und
separat gespeicherte Anwesenheits-/Terminprotokolle werden nicht gelöscht.
Die 400-Tage-Frist ist nur ein zusätzlicher Rückfall für verbliebene Rückmeldungen,
keine Aufbewahrungszusage für jeden abgelaufenen Termin.

Der bestehende Worker muss dafür mit dem aktuellen vollständigen Bundle manuell
veröffentlicht werden. Vorher D1 sichern, vorhandene Bindungen und Secrets
beibehalten. Keine neue Datenbank und keine Umstellung produktiver Konten nötig.

## Persönliche Nachweise

Im persönlichen Portal erscheint unter Termine „Meine Nachweise“. Es werden
ausschließlich die eigenen gespeicherten Fristen und Fahrzeugberechtigungen
angezeigt. `/portal/evidence` bestimmt die Person aus dem verifizierten Zugang;
eine mitgesendete Mitgliedskennung kann keine andere Person auswählen.
Öffentlicher Kalender und Gruppenführerübersicht enthalten keine Nachweise.

Unter Einstellungen → Mitglieder werden Geräteträger ausdrücklich gekennzeichnet.
Bestehende Atemschutzdaten werden bis zur ersten ausdrücklichen Auswahl weiterhin
als relevant erkannt. Die drei vorhandenen Atemschutznachweise sind G26.3, Unterweisung AGT
und FFI. Für alle anderen Mitglieder wird nach der Vorgabe der Verwaltung
mindestens G26.2 geprüft. Eine gültige G26.3 ersetzt die G26.2; eine G26.2
ersetzt umgekehrt nicht die G26.3 der Atemschutzgeräteträger. Fahrer werden über ihre LF-/TSF-Berechtigung erkannt. Das Kontrollintervall
ist pro Person von 1 bis 36 Monaten einstellbar, Standard zwölf Monate. Die
Vorwarnung beträgt wie bisher 60 Tage. Datumsanzeigen berechnen sich für Europe/Berlin.

Die Daten bleiben in OneDrive die Quelle; beim Mitgliederabgleich wird die auf
Gültigkeitsdaten und Fahrzeugberechtigungen begrenzte Projektion verschlüsselt
im vorhandenen Kontodienst gespeichert. Medizinische Befunde, Dokumentinhalte,
Führerscheinnummern und PINs sind nicht Teil dieser Projektion. Der Datenstand
wird pro Person bei bestätigter Übertragung gesetzt. Ältere Clients ohne diese
Felder überschreiben bestehende Nachweise nicht.

Nach Veröffentlichung des aktuellen worker.bundle.js und Neuladen der iPad-App
unter Einstellungen → Mitglieder „Nachweise fürs Handy aktualisieren“ wählen.
Das Portal benötigt für die Anzeige keine OneDrive-Anmeldung. Bei einem alten
Worker oder noch nicht übertragenen Nachweisen erscheint ein entsprechender
Hinweis. Es werden keine Nachweis-Erinnerungen automatisch verschickt.


## Bestehende Probe und andere Termine gezielt korrigieren (2026.10.18.5)

Unter **Einstellungen → Kalender** werden künftig auch bereits gespeicherte
Termine angezeigt. In jeder Terminübersicht sieht man direkt, ob **alle Mitglieder**
oder **nur eine Teilgruppe** betroffen sind. Mit **„Mitglieder ändern“** öffnet
sich die Bearbeitung des bestehenden Termins ohne Wechsel seiner Terminart.

Unter **„Wer ist betroffen?“** stehen zwei Möglichkeiten:
**Alle Mitglieder** oder **Nur ausgewählte Mitglieder**. Im zweiten Fall
können Mitglieder gesucht, einzeln gewählt und alle sichtbaren Ergebnisse
ausgewählt oder abgewählt werden. Der Zähler zeigt sofort die ausgewählten
Personen. Eine leere Teilgruppe lässt sich nicht speichern. Bei einer nicht
vollständigen Mitgliederliste wird verhindert, dass bisherige Empfänger
ungewollt verschwinden. Nach dem Speichern werden die bestätigten Empfänger
vom Worker neu gelesen und kontrolliert.

Diese Einschränkung gilt nicht nur für Sonderproben, sondern ebenso für
gewöhnliche Proben sowie für Termine mit einer anderen iPad-Terminart
(z. B. Unterricht oder Ausschusssitzung). Die Auswahl ändert **nicht**
die Terminart. Ausgewählte Mitglieder können sich am persönlichen Handyportal
anmelden; andere Mitglieder sehen den Termin dort nicht. Eingeschränkte
Termine fehlen weiterhin absichtlich in der öffentlichen, ohne Login
verfügbaren Kalenderliste.

Der Cloudflare-Worker meldet die allgemeine Teilnehmerauswahl mit
`recipientFeatureVersion: 2`. Bereits vorhandene Sonderproben mit
Empfängerauswahl der alten Version 1 bleiben während der Umstellung
bearbeitbar. Zum Eingrenzen einer **normalen Probe** ist die Worker-Version 2
erforderlich. Fehlt sie in der aktiven Cloudflare-Installation, zeigt die
Verwaltung einen konkreten Hinweis und sendet keine inkompatible
Änderung. Wird der bestehende Worker über die in `AUTO-DEPLOY.md`
dokumentierte GitHub-Build-Verbindung automatisch veröffentlicht,
kommt die Änderung mit einem erfolgreichen Cloudflare-Produktionsbuild
auf `main`; andernfalls muss `worker.bundle.js` im vorhandenen Worker
veröffentlicht werden. Es werden **keine** Datenbankmigrationen benötigt.

## Persönliche Eigenangaben zu Nachweisen

Unter „Status“ können Mitglieder mit der synchronisierten AGT-Zuordnung FFI,
G26.2/G26.3 und die Sicherheitsunterweisung selbst melden. Die Passkey-Sitzung
bestimmt das Mitglied; Rollen, Fahrzeuge und Kontrollintervalle werden niemals
vom Eingabeformular übernommen. Bei G26 wird die dokumentierte Gültigkeit als
Monat/Jahr erfasst. FFI und Unterweisung verwenden die bestehende jährliche
Frist. Es werden keine Befunde oder Dokumentkopien erhoben.

Fahrberechtigte können das tatsächliche Datum einer Führerscheinkontrolle und
optional eine Kontrollperson melden. Die Eigenangabe ersetzt die zuletzt
bestätigte Kontrolle erst nach Prüfung durch die Verwaltung unter
„Einstellungen → H₂O Portal → Mitglied auswählen → Persönliche Nachweise prüfen“.
Die Verwaltung kann Eigenangaben bestätigen, ablehnen oder korrigieren.

Die neuen Tabellen `portal_evidence_entries` und `portal_evidence_audit` werden
additiv angelegt. Angaben und Änderungsereignisse sind mit dem bestehenden
Kontodienst-Schlüssel verschlüsselt. Versionsprüfungen verhindern Übernahme
veralteter Formulare; dieselbe Speichernummer kann nach unklarer Übertragung
wiederholt werden. Der Verlauf ist für das jeweilige Mitglied und die Verwaltung
sichtbar; Gruppenführer erhalten nur die freigegebene AGT-Übersicht mit Herkunft
und Datum. Finanzdaten und Kontostände werden dabei nicht verändert.

OneDrive/SharePoint bleibt die Quelle für Mitgliedschaft und Berechtigungen.
Portal-Eigenangaben liegen als separate Ergänzung im Kontodienst: Ein unveränderter
Mitgliederabgleich erhält sie. Ändert die Verwaltung den ursprünglichen Nachweis
in den Mitgliederdaten gezielt, hat diese neue Basis Vorrang; alte Eigenangaben
werden nicht erneut aktiv, wenn das frühere Datum später wieder eingetragen wird.
Portalbestätigungen werden nicht automatisch in die lokalen Gerätehaus-Nachweise
zurückgeschrieben. Die konkrete Einsatzfreigabe ist gesondert zu prüfen.

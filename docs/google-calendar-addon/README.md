# H₂O-Auswahl direkt in Google Kalender am Computer

Stand: 28.10.2026. Die Erweiterung wird im eigenen Google-Konto als privates
Apps-Script-Add-on installiert. Die neue Funktion benötigt die aktualisierten
Skriptdateien und einmalig eine begrenzte Gruppenverbindung zu H₂O.

## Bedienung

1. Termin im gemeinsamen Feuerwehrkalender anlegen und **in Google speichern**.
2. Gespeicherten Termin öffnen und rechts das **H₂O-Symbol** wählen.
3. Terminart, Kleidung und **eine oder mehrere passende Gruppen** auswählen.
   Der zusätzliche Schlagwort-Modus entfällt. „Termin in H₂O anzeigen“ bestimmt
   die Sichtbarkeit; eine Erinnerung verschickt der GF anschließend selbst in H₂O.
4. Fehlt eine Gruppe: **Neue Gruppe**, Namen eingeben, Mitglieder auswählen und
   **Gruppe in H₂O anlegen** wählen. Die Gruppe wird zentral in H₂O gespeichert und in
   der Terminauswahl angehakt. Die bisherigen Eingaben bleiben erhalten.
5. **H₂O-Auswahl in Google speichern** übernimmt die Auswahl in den Termin.
   Das Anlegen einer Gruppe allein verändert den Google-Termin noch nicht.
6. Termin schließen und neu öffnen. Keine ältere, noch offene Google-Bearbeitung
   anschließend speichern. H₂O übernimmt die Angaben über den bestehenden ICS-Import;
   Google und H₂O können Änderungen verzögert anzeigen.

**Gruppenliste aktualisieren** lädt die aktuellen Gruppen. Verbundene Installationen
übernehmen neue Gruppen automatisch beim Öffnen. Bei gleichzeitigen Änderungen an
Gruppen oder Mitgliedern neu öffnen und die Auswahl prüfen. Bei einer unklaren
Antwort zum Anlegen denselben Vorgang erneut prüfen: seine Vorgangskennung verhindert
eine doppelte Gruppe. Nach dem Schließen zuerst die vorhandenen Gruppen prüfen.

Eigene H₂O-Einstellungen und persönliche Ausnahmen haben Vorrang. Soll ein lokal
bearbeiteter Termin wieder Google folgen, in H₂O ausdrücklich **Google-Angaben
übernehmen** wählen; dabei die bisherigen persönlichen Ausnahmen prüfen.
Die Seitenleiste ergänzt Googles ursprüngliches Terminformular. Kalender-Add-ons
stehen am Computer zur Verfügung; in der Google-Kalender-App für iPhone/Android
bleibt die Bearbeitung über H₂O möglich.

## Bestehende Installation aktualisieren und verbinden

Jede Verwaltungsperson verwendet ihr eigenes Projekt **H₂O Kalenderauswahl**.
Es werden keine gemeinsamen administrativen Zugangsdaten benötigt.

1. Am Computer das vorhandene Projekt in [Apps Script](https://script.google.com/)
   öffnen. **Code.gs**, **Model.gs** und **appsscript.json** vollständig durch
   [Code.gs](Code.gs), [Model.gs](Model.gs) und [appsscript.json](appsscript.json)
   aus diesem Ordner ersetzen und speichern. Die Manifestanzeige lässt sich in
   den Projekteinstellungen aktivieren.
2. In der Feuerwehr-Anwendung die Verwaltung entsperren, dann **Kalender →
   Verbindung → Gruppen direkt in Google Kalender anlegen** öffnen.
3. Eine Bezeichnung für das eigene Skript eingeben und **Google-Gruppenverbindung
   erstellen** wählen. Den angezeigten Verbindungsschlüssel kopieren.
4. Im eigenen Apps-Script-Projekt unter **Projekteinstellungen → Skripteigenschaften**:

   | Eigenschaft | Wert |
   | --- | --- |
   | `H2O_CALENDAR_ID` | ID des gemeinsamen Quellkalenders aus Google Kalender → Einstellungen → Kalender integrieren. Keine ICS-URL und nicht `primary`. |
   | `H2O_GROUPS_TOKEN` | Der gerade in H₂O erstellte Verbindungsschlüssel. |

   `H2O_GROUP_NAMES` wird bei verbundener Installation nicht mehr benötigt und
   kann entfernt werden. Alte Installationen ohne Gruppenverbindung können ihre
   statische Namensliste weiter lesen, aber keine neuen Gruppen anlegen.
5. Bestehende Testinstallation prüfen bzw. unter **Bereitstellen →
   Testbereitstellungen** als **Google Workspace Add-on** installieren.
   Google Kalender neu laden und die Erweiterung am gespeicherten Termin öffnen.
   Google kann für den Zugriff auf den zusätzlichen Dienst eine erneute
   Autorisierung verlangen.

Den Schlüssel nur im eigenen Skript speichern, niemals in einer Terminbeschreibung,
im Repository oder in Nachrichten. Die Anzeige in H₂O wird beim Schließen oder
Verlassen geleert. Unter demselben Menü lässt sich jede Verbindung einzeln
**trennen**; vorhandene Gruppen bleiben bestehen. Bis zu acht getrennte
Verbindungen sind möglich, beispielsweise je eine für die persönlichen Skripte.

## Erstinstallation

Ein eigenes Apps-Script-Projekt **H₂O Kalenderauswahl** anlegen, die drei Dateien
wie oben einsetzen und unter **Dienste → +** die **Google Calendar API** ergänzen.
Bei einem Standardprojekt wird die API dabei aktiviert. Bei einem eigenen
Cloud-Projekt dessen API-/OAuth-Einstellungen für das eigene Konto prüfen.
Anschließend die Gruppenverbindung einrichten und das Add-on als Testinstallation
installieren. Keine Web-App und keine allgemeine Marketplace-Veröffentlichung nötig.
Das ausführende Google-Konto benötigt weiterhin Bearbeitungsrechte am Quellkalender.

## Privater gemeinsamer Kalender

Die Seitenleiste benötigt keine öffentliche Freigabe. Alle Kalenderverwalter
behalten ihre persönlichen Google-Bearbeitungsrechte am bisherigen gemeinsamen
Kalender und sehen dort **alle Termine**, auch außerhalb ihrer eigenen Gruppen.
Martin und Markus benötigen dafür kein persönliches H₂O-Abo mit erweiterten
Rechten. Gruppen steuern die Teilnahme in H₂O, nicht die Google-Kalenderfreigabe.

H₂O unterstützt jetzt den privaten ICS-Import: Unter **Kalender → Verbindung →
Privaten Google-Kalender einrichten** die geheime iCal-Adresse desselben Kalenders
prüfen und speichern. Erst danach Googles öffentliche Kalenderfreigabe ausschalten
und den gespeicherten privaten Zugriff erneut prüfen. Die Adresse nicht hier oder
in Skripteigenschaften speichern; die Seitenleiste benötigt sie nicht. Für die
Umstellung dieses Imports müssen die Skriptdateien nicht geändert werden.

Die [Einrichtungs- und Datenschutzbeschreibung](../KALENDER-DATENSCHUTZ-ANALYSE.md)
erläutert den Datenweg, den Schutz des Leseschlüssels und die Prüfschritte.

Nach dieser Fehlerkorrektur genügt bei bereits eingerichteten Google-Projekten,
**Model.gs vollständig zu ersetzen und zu speichern** und Google Kalender neu zu
laden. Code.gs, Manifest, Kalender-ID und Gruppenverbindung bleiben unverändert.

## Speicherung und Datenschutz

Die Erweiterung liest über den begrenzten H₂O-Schlüssel aktive **Gruppennamen sowie
Mitglieder-ID und Name** für die Auswahl beim Anlegen einer Gruppe. Sie kann nur
Gruppen lesen und neue Gruppen mit vorhandenen Mitgliedern anlegen. Sie kann keine
Mitgliedskonten, Nachweise, ärztlichen Atteste oder Geburtstagsdaten lesen und keine Erinnerungen senden oder Rückmeldungen lesen.
Der Schlüssel ist an den eingerichteten Quellkalender und Mitgliederbestand gebunden.
Mitgliedernamen erscheinen in der berechtigten Seitenleiste, **nicht in der
öffentlichen Google-Terminbeschreibung**. Die Verbindung kann jederzeit getrennt werden.

**Solange der Quellkalender öffentlich freigegeben ist, sind Gruppennamen, Kleidung
und Beschreibungen öffentlich lesbar.** Im privaten Betrieb sehen sie die am
Google-Kalender berechtigten Personen. Nur unbedenkliche Gruppenbezeichnungen verwenden. Keine individuellen
Ausnahmen, Gesundheitsdaten oder anderen privaten Angaben eintragen.
Die Auswahl erzeugt die Steuerzeilen `Terminart`, `Kleidung`, `Gruppen` und `Freigabe`
automatisch; keine Steuerzeilen von Hand schreiben. Keine Google-Gäste hinzufügen.

Google-Aufrufe verwenden das eigene Google-Konto. Der Scope `calendar.events`
erlaubt technisch Ereigniszugriff auf dessen zugängliche Kalender; der Code grenzt
Aufrufe auf die konfigurierte Kalender-ID ein. Beschreibungen und die eigene
Eigenschaft `h2oDescriptionSuffixV1` werden geändert. Titel, Zeit, Ort, Farben und
fremde Eigenschaften bleiben erhalten. Die Eigenschaft merkt sich den erzeugten
Anhang, damit Freitext und vorhandene HTML-Formatierung erhalten bleiben.

ETags schützen vor gleichzeitigem Überschreiben. Bei unklarem Google-Schreibstatus
zuerst den aktuellen Termin prüfen. Doppelte oder unklare Steuerzeilen, abgesagte
Termine, ganze Serien und Termine mit Gästen sind gesperrt. Einzelne gespeicherte
Serienvorkommen ohne Gäste können bearbeitet werden. Bei manuell umformatierten
H₂O-Zeilen diese zuerst in Google entfernen, übrigen Text erhalten und neu öffnen.

## Prüfung im eigenen Google-Konto

Automatisierte Prüfungen verwenden künstliche Mitglieder und Ereignisse sowie den
echten Worker im lokalen Test. Die tatsächlichen Google-Installationsdialoge und
die Darstellung im persönlichen Konto müssen nach dem Einsetzen noch geprüft werden:

- Künstlichen Termin ohne Gäste speichern und die Seitenleiste öffnen.
- Gruppe mit künstlichen Testmitgliedern anlegen: genau einmal in H₂O vorhanden,
  am Termin ausgewählt, noch kein Google-Termin geändert.
- Auswahl ausdrücklich speichern, Google-Beschreibung und H₂O-Import prüfen.
- Im zweiten berechtigten Konto mit eigener Verbindung dieselbe Gruppe auswählen.
- Gleichzeitige Änderungen und das Trennen einer Testverbindung prüfen.
- Testgruppe und Testtermin anschließend entfernen.

Offizielle Grundlagen:
- [Kalender-Add-ons](https://developers.google.com/workspace/add-ons/calendar)
- [Testinstallation](https://developers.google.com/workspace/add-ons/how-tos/testing-workspace-addons)
- [Berechtigungen](https://developers.google.com/workspace/add-ons/concepts/workspace-scopes)
- [Google Events PATCH](https://developers.google.com/workspace/calendar/api/v3/reference/events/patch)

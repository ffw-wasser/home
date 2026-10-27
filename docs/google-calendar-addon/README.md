# H₂O-Auswahl direkt in Google Kalender am Computer

Version 1.0, 27.10.2026. Quellcode und automatisierte Abnahme sind vorbereitet.
Die Erweiterung ist noch in keinem echten Google-Konto installiert oder praktisch
abgenommen. Die laufende Safe-Browsing-Prüfung der Feuerwehrseite bleibt separat
offen; eine rote Browserwarnung nicht umgehen. Erst nach Klärung real abnehmen.

## Bedienung

1. In Google Kalender am Computer einen Termin im gemeinsamen Feuerwehrkalender
   anlegen, Titel, Datum, Uhrzeit und Ort eintragen und **in Google speichern**.
2. Den gespeicherten Termin öffnen und rechts das **H₂O-Symbol** wählen.
3. In der Seitenleiste auswählen:
   - Terminart: Probe, Sonderprobe, Unterricht, Ausschusssitzung, Veranstaltung
     oder Information. Geburtstage und ihre persönliche Zuordnung bleiben in H₂O.
   - Kleidung: Einsatzkleidung, Tagesdienst, Uniform, T-Shirt/Fest, Zivil oder Freitext.
   - Automatische Schlagwortzuordnung oder mehrere ausgewählte Gruppen.
   - Noch nicht freigeben oder Rückmeldung freigeben. Die Freigabe gilt für
     Probe, Sonderprobe, Unterricht und Ausschusssitzung; Informationen werden
     weiterhin in der H₂O-Informationsverwaltung sichtbar geschaltet.
4. **H₂O-Auswahl in Google speichern**. Danach den Termin schließen und neu öffnen.
   Nicht anschließend eine noch offene, ältere Google-Bearbeitung speichern:
   Sie könnte die zwischenzeitlich gespeicherte Beschreibung ersetzen.
5. H₂O übernimmt die Angaben über den vorhandenen Google-ICS-Import. Google und
   H₂O können zwischenspeichern; die Änderung muss nicht sofort sichtbar sein.

Die Seitenleiste ist eine zusätzliche Oberfläche innerhalb von Google Kalender;
sie fügt keine neuen Felder in Googles ursprüngliches Terminformular ein.
Google unterstützt Kalender-Add-ons nicht auf iPhone oder Android. Dafür bleibt
die bestehende H₂O-Bearbeitung nutzbar.

## Speicherung und Datenschutz

Die Auswahl erzeugt automatisch die bereits unterstützten Steuerzeilen
`Terminart`, `Kleidung`, `Gruppen` und `Freigabe` in der Google-Beschreibung.
Keine Steuerzeilen von Hand schreiben. Gruppen werden mit Semikolon getrennt.
**Beschreibung, Kleidungsangabe und Gruppennamen sind im öffentlichen Kalender
lesbar.** Nur unbedenkliche Gruppenbezeichnungen konfigurieren; keine Namen,
Nummern, individuellen Ausnahmen, Gesundheitsdaten oder anderen privaten Angaben.

Mitgliederlisten, individuelle Ein-/Ausschlüsse, Anwesenheit und Rückmeldungen
werden nicht an die Erweiterung übertragen. Sie besitzt keine H₂O-/Cloudflare-
Zugangsdaten und speichert keine Google-Tokens. Für API-Aufrufe nutzt sie jeweils
das ausführende Google-Konto und dessen Kalenderrechte. Der notwendige Google-Scope
`calendar.events` erlaubt technisch Ereigniszugriff auf die vom Konto zugänglichen
Kalender; der Code begrenzt Aufrufe zusätzlich auf die konfigurierte Kalender-ID.

Eigene H₂O-Einstellungen und persönliche Ausnahmen haben weiterhin Vorrang. Soll
ein bereits lokal bearbeiteter Termin künftig die Google-Angaben übernehmen, die
Auswahl zuerst in H₂O prüfen und dort ausdrücklich **Google-Angaben übernehmen**
wählen. Diese Aktion gibt die bisherige lokale Überschreibung auf. Bei Terminen
mit individuellen Ausnahmen die lokale Bearbeitung beibehalten.

Die Erweiterung ändert ausschließlich die Beschreibung und ihre eigene gemeinsame
Google-Eigenschaft `h2oDescriptionSuffixV1`. Titel, Zeit, Ort, Farben und fremde
Eigenschaften werden nicht verändert. Die Eigenschaft merkt sich nur den erzeugten
Beschreibungsanhang, damit Freitext und vorhandene HTML-Formatierung erhalten bleiben.
Unklare oder doppelte Steuerzeilen werden abgewiesen. Bei manuell umformatierten
H₂O-Steuerzeilen in HTML diese Zeilen erst in Google entfernen; den übrigen Text
beibehalten und die Erweiterung neu öffnen. Reine Textbeschreibungen mit bisherigen
Steuerzeilen werden beim expliziten Speichern übernommen.

Gleichzeitige Änderungen werden vor und beim PATCH mit Googles ETag geprüft.
Keine automatische Wiederholung eines Schreibversuchs. Bei unklarer Fehlermeldung
erst den aktuellen Google-Termin prüfen. Termine mit Google-Gästen, abgesagte
Termine und ganze Serien sind gesperrt; ein gespeichertes einzelnes Serienvorkommen
kann ohne Gäste bearbeitet werden. Diese Beschränkungen entsprechen der bisherigen
H₂O-Google-Bearbeitung.

## Einmalige Einrichtung – je Verwaltungsperson

Jede Person legt für die persönliche Nutzung ihr eigenes Apps-Script-Projekt an und
installiert es als unveröffentlichtes Add-on. Damit muss kein privates Add-on über
unterschiedliche Kontodomänen geteilt werden. Martin führt dieselben Schritte mit
seinem eigenen Konto aus. Es werden keine kostenpflichtigen Dienste eingerichtet.
Eine allgemeine Marketplace-Veröffentlichung ist nicht Bestandteil dieses Pakets.

1. Am Computer [Apps Script](https://script.google.com/) öffnen, **Neues Projekt**,
   Name **H₂O Kalenderauswahl**.
2. Den vollständigen Inhalt aus [Code.gs](Code.gs) in `Code.gs` einsetzen.
   Eine zweite Skriptdatei `Model` anlegen und [Model.gs](Model.gs) einsetzen.
3. Unter **Projekteinstellungen** die Anzeige von `appsscript.json` aktivieren.
   Das Manifest durch [appsscript.json](appsscript.json) ersetzen.
4. Unter **Dienste → +** die **Google Calendar API** hinzufügen. Bei einem normalen
   Apps-Script-Standardprojekt wird damit die API aktiviert. Wird bewusst ein
   eigenes Cloud-Projekt zugeordnet, dort die Calendar API aktivieren und die
   OAuth-Einrichtung/Testnutzer für das ausführende Konto prüfen. Keine vorhandene
   Farbanbindung ersetzen.
5. Unter **Projekteinstellungen → Skripteigenschaften** zwei Einträge setzen:

   | Eigenschaft | Wert |
   | --- | --- |
   | `H2O_CALENDAR_ID` | ID des gemeinsamen Feuerwehrkalenders aus Google Kalender → Einstellungen → Kalender integrieren → Kalender-ID. Keine ICS-URL und nicht `primary`. |
   | `H2O_GROUP_NAMES` | JSON-Liste mit den **exakten, aktivierten Gruppennamen aus H₂O**, ohne Mitgliederdaten. Beispiel siehe unten. |

   ```json
   ["Alle aktiven Mitglieder","Atemschutz","Gruppenführer","Ausschuss","Alterskameraden"]
   ```

   Das Beispiel an die tatsächlich gespeicherten H₂O-Gruppen anpassen. Änderungen
   der Gruppennamen/aktivierten Gruppen anschließend in beiden persönlichen
   Installationen nachführen. Maximal 30 Namen mit je 80 Zeichen, keine Semikolons.
   Neue H₂O-Gruppen werden nicht automatisch ins Apps-Script-Projekt übertragen.
   Unbekannte/deaktivierte Gruppen führen beim H₂O-Import zu einer gesperrten
   Freigabe statt zu einer Einladung aller Mitglieder.
6. **Bereitstellen → Testbereitstellungen**, falls nötig als Typ **Google Workspace
   Add-on** wählen, dann **Installieren**. Berechtigungen für das eigene Konto
   prüfen und autorisieren. Keine Web-App bereitstellen, keine Zugangsschlüssel
   aus dem Worker oder heruntergeladene OAuth-JSON-Dateien eintragen.
7. Google Kalender neu laden, einen gespeicherten Termin im gemeinsamen Kalender
   öffnen und rechts das H₂O-Symbol anklicken.

## Reale Abnahme vor regulärer Nutzung

- Erst einen künstlichen Testtermin ohne Gäste erstellen, H₂O-Auswahl speichern
  und die sichtbare Google-Beschreibung kontrollieren.
- Nach dem Import Terminart, Kleidung, Gruppen und Freigabe in H₂O prüfen; lokale
  Überschreibungen bewusst berücksichtigen. Keine Anwesenheit wird erzeugt.
- Mit Martins eigener Installation denselben Testtermin lesen/ändern. Beide
  Konten müssen selbst Bearbeitungsrechte am gemeinsamen Kalender haben.
- Einen konkurrierenden Bearbeitungsversuch prüfen: zweites Konto speichert zuerst,
  erstes Konto muss neu öffnen. Testtermin danach entfernen.

Automatisiert geprüft werden CardService-Aufrufe mit künstlichen Ereignissen,
Mehrfachauswahl, Validierung, Google-API-Parameter, ETag-Konflikte, verweigerte
Zugriffe und die Verarbeitung durch den echten Worker mit künstlichem ICS.
Die Darstellung in der echten Google-Seitenleiste und die persönlichen
Installations-/OAuth-Dialoge sind dadurch nicht praktisch nachgewiesen.

Offizielle Grundlagen:
- https://developers.google.com/workspace/add-ons/calendar
- https://developers.google.com/workspace/add-ons/how-tos/testing-workspace-addons
- https://developers.google.com/workspace/add-ons/concepts/workspace-scopes
- https://developers.google.com/workspace/calendar/api/v3/reference/events/patch

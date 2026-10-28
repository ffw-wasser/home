# Google-Kalender: Datenschutz und privater Betrieb

Stand: 28.10.2026. Quellcodeanalyse; keine produktiven Google-Freigaben oder
Mitgliederdaten geändert. Eine rechtliche Bewertung der konkreten Datenverarbeitung
ersetzt diese technische Analyse nicht.

## Ergebnis

Ein öffentlicher Google-Kalender ist **fachlich nicht erforderlich**. Die aktuelle
Implementierung benötigt ihn aber für den automatischen ICS-Import. Empfehlung:
den gemeinsamen Quellkalender künftig privat halten und über einen getrennt
berechtigten, nur lesenden Dienstzugriff importieren. Erst nach erfolgreicher
Umstellung die öffentliche Google-Freigabe abschalten.

## Was der aktuelle Code macht

| Verbindung | Zugriff und Inhalt | Bedeutung |
| --- | --- | --- |
| Google → H₂O-Hintergrundimport | `PortalService.calendarURL` akzeptiert nur `https://calendar.google.com/calendar/ical/<ID>/public/basic.ics`. Worker ruft diesen Feed ohne persönliche Google-Anmeldung ab. | Mit abgeschalteter öffentlicher Freigabe können neue Daten nicht mehr zuverlässig importiert werden. Alte Cache-Daten sind kein erfolgreicher Import. |
| Google-Seitenleiste | Eigenes Google-OAuth, konfigurierte Kalender-ID, Bearbeitungsrechte, ETag-Prüfung. | Funktioniert grundsätzlich auch an einem privat freigegebenen Kalender. Allein deshalb muss nichts öffentlich sein. |
| Google-Bearbeitung in H₂O | Persönliches Google-Konto; Access-Token nur im Arbeitsspeicher, keine gespeicherte Offline-Berechtigung. | Liefert keinen dauerhaften automatischen Import, sobald das Verwaltungsfenster geschlossen oder das Token abgelaufen ist. |
| Google-Farbanbindung | Separates Apps Script mit Nur-Lese-Google-Freigabe, fester Kalender-ID und Zugangsschlüssel; liefert nur Kennungen, Zeiten und Farben. | Kann grundsätzlich privat lesen, ersetzt den Terminimport gegenwärtig nicht. |
| H₂O-Gruppenschnittstelle | Benannter, widerrufbarer Schlüssel; Gruppennamen, Mitgliedernamen und technische Kennungen; Anlegen neuer Gruppen. | Kein Zugriff auf Atteste, Nachweisgültigkeiten, Geburtstage, Konten oder Rückmeldungen. Mitgliedernamen landen nicht durch diese Funktion in der Google-Beschreibung. |
| Öffentlicher H₂O-Kalender | `/calendar/public` gibt freigegebene Proben mit neutralem Titel, Beginn/Ende, Terminart, technischer Ereignis-ID und Kennzeichnung eingeschränkter Zielgruppe aus. | Keine Namen, Orte, Beschreibungen, Geburtstage oder Empfängerlisten. Zeiten und das Vorhandensein einer eingeschränkten Zielgruppe bleiben öffentlich. |
| Persönliches Kalenderabo | Individueller widerrufbarer Link, serverseitige Mitglieds-/Empfängerprüfung. Enthält eigene relevante Termine und den eigenen Geburtstag. | Link berechtigt zum Lesen: privat halten. Kein allgemeiner Mitgliederkalender. |

Quellen im Repository: `cloudflare/push/portal.js`, `google-calendar-api.js`,
`google-calendar-oauth.js`, `calendar-subscriptions.js`, `calendar-group-access.js`,
`docs/google-calendar-addon/Code.gs`, `docs/google-calendar-colors/Code.gs`.

## Tatsächliche Datenschutzlücke der öffentlichen Quelle

Bei öffentlicher Detailfreigabe können Google-Titel, Zeiten, Orte und
Beschreibungen einschließlich Gruppenbezeichnungen außerhalb von H₂O gelesen
werden. H₂O-Freigabe und Google-Öffentlichkeit sind verschiedene Einstellungen:
`Freigabe: Nein` schützt den Google-Eintrag nicht. Auch das Verbergen von
Geburtstagen in der Hauptanwendung ändert keine Freigabe bei Google. Enthält der
Quellkalender Namen/Geburtstagsdaten, können diese weiterhin über Google zugänglich
sein. Dafür war kein Abruf produktiver Daten nötig; dies folgt aus dem Datenweg.

Die geprüften Kalenderfunktionen übertragen keine medizinischen Nachweise aus der
Mitgliederverwaltung an Google. Eine pauschale Aussage „Es gehen nur Namen durch
alle Schnittstellen“ wäre trotzdem falsch: Der geschützte H₂O-Mitgliederabgleich
verarbeitet notwendige Nachweisgültigkeiten, und das persönliche Abo enthält wie
gewünscht den eigenen Geburtstag. Manuelle private Angaben in Google würden
unabhängig davon der Google-Freigabe unterliegen.

## Varianten für den privaten Betrieb

| Variante | Vorteil | Grenze / Aufwand |
| --- | --- | --- |
| Geschützter Lesezugriff über eigenen Google-Dienstzugang, z. B. Service Account mit Leserrecht genau dieses Kalenders | Kein öffentlicher Feed und keine persönliche Sitzung auf jedem iPad; Berechtigung separat entziehbar. | Google-Projekt und sichere serverseitige Schlüsselverwaltung nötig; neue API-Projektion und Tests für Serien/IDs/Jahresplan. Keine domänenweite Delegierung nötig, wenn der Kalender dem Dienstkonto ausdrücklich freigegeben wird. Organisationsrichtlinien vorher prüfen. |
| Separate lesende Apps-Script-Brücke mit festem Kalender und widerrufbarem H₂O-Schlüssel | Passt zum vorhandenen Skriptansatz; liest mit Berechtigung des installierenden Kontos. | Neue geprüfte Schnittstelle, Quoten, Ablauf-/Fehlerüberwachung und Schutz des Schlüssels nötig. Die bestehende Farbanbindung allein liefert zu wenige Daten. Das Bearbeitungs-Add-on nicht mit einem allgemeinen Adminschlüssel ausstatten. |
| Geheime iCal-Adresse nur im geschützten Worker | Kleinster Umbau, vorhandener ICS-Parser verwendbar. | Der Link gewährt jedem Besitzer Lesezugriff auf den ganzen Kalender, keine individuelle Authentifizierung. Wie ein Passwort behandeln, nie öffentlich ausliefern/loggen, bei Verlust zurücksetzen. Google warnt ausdrücklich vor Weitergabe. Schwächer als gezielt entziehbare Dienstberechtigung. |

Bevorzugt wird ein eigener, nur lesender Dienstzugriff auf genau den Quellkalender.
Die Skriptbrücke ist eine mögliche Alternative für die bestehende kleine
Installation. Normale Portalmitglieder brauchen auch dann kein Google-Konto.
Ein neuer öffentlicher Kalender ist für interne Termine nicht nötig. Falls die
Feuerwehr bewusst öffentliche Veranstaltungshinweise wünscht, dafür eine gesonderte
Auswahl ohne interne Gruppen, Mitgliedernamen oder Geburtstage verwenden.

## Wichtig: vorhandene Rückmeldungen erhalten

Die heutigen Ereignis- und Serienkennungen werden aus **der vollständigen
Kalender-URL und der ICS-Termin-/Serienkennung** abgeleitet
(`projection` in `cloudflare/push/portal.js`). Ein bloßer Wechsel von `public` zu
einer privaten Adresse erzeugte andere Kennungen. Der Konfigurationsweg sperrt
Kalenderwechsel derzeit ausdrücklich.

Vor einer Umstellung muss die technische Kalenderidentität vom Zugang getrennt
werden. Bestehende Ereignis- und Serienkennungen bleiben stabil; Zugriffsschlüssel
oder private URL dürfen sich ändern, ohne neue Termine entstehen zu lassen.
Dabei insbesondere Rückmeldungen, individuelle Ausnahmen, Gruppenregeln,
Erinnerungsmarker, persönliche Abos, Serienausnahmen und Gerätehaus-Zuordnungen
prüfen. Geburtstage und jährliche Treuepunktmarker müssen ebenfalls gleich bleiben.
Einfach nur private URLs zuzulassen wäre deshalb keine vollständige Korrektur.

## Sichere Reihenfolge einer späteren Umstellung

1. Privaten Import und feste Kalenderidentität implementieren; Berechtigungen eng
   begrenzen. Keine Zugangsdaten im Repository oder in ausgeliefertem JavaScript.
2. Mit künstlichen Daten Zugriffsschutz, Serien, Jahresgrenzen, Ausfälle,
   Zurücksetzen/Entzug des Zugangs und unveränderte IDs prüfen.
3. Am vorhandenen Kalender berechtigten Zugriff einrichten und denselben Datenstand
   abgleichen. Geburtstags-/Treuepunktverarbeitung und bestehende Rückmeldungen
   prüfen, ohne neue Testbuchungen im Produktivbestand anzulegen.
4. Erst dann öffentliche Google-Freigabe abschalten; direkte öffentliche ICS-/Web-
   Zugriffe nach Ablauf der Google-Umstellungszeit erneut prüfen.
5. Öffentlichen H₂O-Endpunkt getrennt bewerten: Wenn auch neutrale Probenzeiten
   intern sein sollen, diesen Zugriff ebenfalls auf berechtigte Geräte beschränken.
6. Persönliches Abo, iPad-Kalender, Google-Seitenleiste und beide Verwaltungszugänge
   praktisch prüfen. Datenschutzerklärung anschließend an den tatsächlich aktiven
   Import anpassen. Bisherige öffentliche Daten werden durch Umstellung nicht
   rückwirkend aus fremden Kopien entfernt.

Dieser Arbeitsauftrag setzt die vier Fehlerkorrekturen um und dokumentiert die
Analyse. Er stellt den produktiven Kalender **noch nicht auf privat um**.

## Offizielle Grundlagen

- [Google: Öffentliche Kalender und Freigabe beenden](https://support.google.com/calendar/answer/37083?hl=de)
- [Google: Freigabe für bestimmte Personen und Gruppen](https://support.google.com/calendar/answer/37082?hl=de)
- [Google: Geheime iCal-Adresse und Zurücksetzen](https://support.google.com/calendar/answer/37648?hl=de)
- [Google: Zugangsdaten, OAuth und Service Accounts](https://developers.google.com/workspace/guides/create-credentials)
- [Google: Kalenderberechtigungen und OAuth-Scopes](https://developers.google.com/workspace/calendar/api/auth)

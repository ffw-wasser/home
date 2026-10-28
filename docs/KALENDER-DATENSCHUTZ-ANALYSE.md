# Privater Google-Kalender: Einrichtung und Datenschutz

Stand: 28.10.2026 · Oberfläche ab Version 2026.10.28.13.
Die Anwendung bietet ausschließlich die private Kalenderverbindung an.
Eine bereits eingerichtete Verbindung muss nicht erneut angelegt werden.

## Bestehende Verbindung verwenden

Unter **Kalender → Verbindung → Privater Google-Kalender** zeigt die Verwaltung
den Verbindungsstatus. **Gespeicherten privaten Zugriff prüfen** liest den
bestehenden Kalender erneut und bestätigt den Zugriff mit der gelesenen
Terminanzahl. Google-Änderungen erscheinen beim nächsten Kalenderabruf; ein
vorhandener berechtigter Stand kann während der Aktualisierung angezeigt werden.

Der Gerätehauskalender benötigt die bestehende bestätigte OneDrive-/Kontodienst-
Verbindung. Die Dienstadresse und der Verbindungszugang kommen aus dieser
Verbindung; eine separate Kalender-Dienstadresse muss nicht eingegeben werden.
Die Startseite verwendet ausschließlich diesen geschützten Leseweg. Schlägt der
Abruf vorübergehend fehl, erscheint die Fehlermeldung. Eine Abmeldung entfernt
bereits geladene Kalenderdaten und Rückmeldungen aus dieser Ansicht.

## Ersteinrichtung oder Leseschlüssel ersetzen

1. In Google Kalender am Computer die Einstellungen des bisherigen gemeinsamen
   Feuerwehrkalenders öffnen. Unter **Kalender integrieren → Geheime Adresse im
   iCal-Format** beziehungsweise **Privatadresse im iCal-Format** den Link kopieren.
2. In der geschützten Hauptanwendung unter **Kalender → Verbindung → Privaten
   Google-Kalender einrichten** einfügen und **Privaten Import prüfen und speichern**
   wählen. Keinen neuen Google-Kalender anlegen.
3. H₂O liest tatsächlich die private Quelle, prüft die Kalender-ID und speichert
   erst nach erfolgreichem Abruf. Eine Adresse für einen anderen Kalender wird
   abgewiesen. Die zentrale Einrichtung gilt für Geräte mit derselben Datenquelle.
4. **Gespeicherten privaten Zugriff prüfen** bestätigt den gespeicherten Zugang.
   Die Adresse wird nicht erneut angezeigt. Bei einem fehlgeschlagenen ersten
   Verbindungsabruf bleibt der Speicherbutton nutzbar; er lädt zuerst den aktuellen
   Verbindungsstand. Während eines laufenden Speichervorgangs ist er gesperrt.
5. Bei Verlust des Leseschlüssels in Google die geheime Adresse zurücksetzen und
   anschließend in H₂O die neue Adresse desselben Kalenders speichern.

Der vorhandene Worker benötigt `privateCalendarVersion: 1` unter `/health`.
Ein zusätzlicher Google-Cloud-Dienst, ein neues Skript oder ein neues persönliches
Kalenderabo ist für diesen Leseweg nicht nötig. Die bisherigen Google-Skripte und
persönlichen H₂O-Abos bleiben bestehen. Google kann bei Organisationskonten die
Anzeige der geheimen Adresse einschränken; gegebenenfalls muss der Eigentümer
oder die zuständige Google-Verwaltung die Einrichtung prüfen.

## Schutz der geheimen Adresse

Die geheime iCal-Adresse ist ein **Leseschlüssel für den gesamten Quellkalender**.
Jeder Besitzer dieses Links kann den Feed lesen. In H₂O wird sie verschlüsselt in
der bestehenden Dienstkonfiguration gespeichert. Sie wird weder an Mitglieder
noch an andere Verwaltungsgeräte zurückgegeben und erscheint nicht in Logs,
Fehlermeldungen oder dem Repository. Die Eingabe wird beim Absenden, Schließen,
Ansichtswechsel, Verbergen der Seite und Sperren geleert. H₂O speichert sie nicht
im Browserspeicher. Nur in das geschützte Eingabefeld eintragen, nicht in den Chat,
in Google-Termine oder in die Skripteigenschaften.

## Kalenderverwalter und Mitglieder

Martin, Markus und alle weiteren Kalenderverwalter behalten ihre persönlichen
Google-Berechtigungen am gemeinsamen privaten Kalender. Dort sehen sie **sämtliche
Termine**, auch außerhalb ihrer eigenen H₂O-Gruppen. Die H₂O-Gruppenauswahl
steuert Teilnahme, Rückmeldungen und persönliche Mitgliedsansichten. Sie verändert
keine Google-Kalenderberechtigungen.

Das persönliche Abo **H₂O – Meine Feuerwehrtermine** bleibt auf die eigenen
relevanten Termine begrenzt. Für die Verwaltungsübersicht den gemeinsamen
Google-Kalender verwenden. Die Google-Seitenleiste arbeitet weiterhin mit dem
eigenen Google-Konto und der bisherigen `H2O_CALENDAR_ID`; der geheime ICS-Link
wird dort nicht benötigt. Auch die Farbanbindung bleibt unabhängig.

## Datenwege

| Verbindung | Inhalt und Zugriff |
| --- | --- |
| Hintergrundimport | Gespeicherte geheime iCal-Adresse; bei einem Fehler kein Ersatz durch einen anderen Datenweg. Ein alter Stand wird als veraltet gekennzeichnet. |
| Gerätehauskalender, Verwaltung und Jahresplan | Geschützte Lesewege über die bestätigte Gerätehaus-Verbindung. |
| Persönliches Portal | Persönlicher Passkey-/Passwortzugang mit serverseitiger Empfängerprüfung. |
| Persönliches Kalenderabo | Individueller, widerrufbarer Nur-Lese-Link; eigene relevante Termine und eigener Geburtstag. |
| Google-Gruppenschnittstelle | Gruppennamen, Mitgliedernamen und technische Kennungen für die Gruppenauswahl; keine Konten, Rückmeldungen, Atteste oder Geburtstage. |
| Google-Terminbearbeitung | Titel, Zeiten, Ort und Beschreibung des gemeinsamen privaten Google-Kalenders; mit persönlicher Google-Berechtigung. |

Der Google-Import verarbeitet im Quellkalender vorhandene Termine und
Geburtstage. Geburtstagseinträge bleiben in der Hauptanwendung ausgeblendet;
der eigene Geburtstag und die Treuepunkte bleiben im persönlichen Bereich
erhalten. Die Google-Kalenderfunktionen übertragen keine medizinischen Nachweise
aus der Mitgliederverwaltung. Der geschützte H₂O-Mitgliederabgleich benötigt
Nachweisgültigkeiten für die Nachweisfunktion. Eine pauschale Aussage, alle
Schnittstellen übertrügen nur Namen, wäre falsch.

## Kompatibilität und Prüfrahmen

Kalenderidentität und Lesegeheimnis sind getrennt. Die bisherige Kalenderkennung
bleibt intern erhalten; Ereignis-/Serien-IDs sowie Zuordnungen ändern sich durch
die bereinigte Oberfläche nicht. Rückmeldungen, Gruppen-/Einzelregeln,
Erinnerungsmarker, persönliche Abos, Gerätehaus-Zuordnungen und Geburtstagspunkte
bleiben erhalten. Alte gespeicherte Verbindungsdaten werden nicht gelöscht.

Versionsprüfung und bedingte Datenbankschreibvorgänge schützen gleichzeitige
Änderungen. Eine Zugriffsrevision trennt alte Quellcaches beim Schlüsseltausch.
Einrichtung und Darstellung nutzen nur künstliche Daten in automatisierten
Prüfungen. Der Browsertest prüft den echten Dialog, fehlende alte Bedienelemente,
Geheimnisschutz, Navigation, Sperren und Handy-/Tabletbreiten. Gerätehaus-Lesewege
werden ohne anonymen Ersatzabruf und mit Datenbereinigung nach Abmeldung geprüft.

Die alten Einrichtungsfelder, die zusätzliche Kalender-Dienstadresse sowie
zugehörige Hinweise sind aus den Oberflächen und Hilfen entfernt. Historische
serverseitige Formate bleiben für gespeicherte Zuordnungen kompatibel. Im privaten
Betrieb werden keine Kalendertermine an anonyme Aufrufer ausgegeben.

Zuständige Dateien: `cloudflare/push/portal.js`,
`js/features/portal/portal-admin.js`, `calendar-private-source.js`,
`tests/calendar-private-source.test.cjs`, `calendar-private-source-browser.cjs`,
`calendar-attendance.test.cjs` und `calendar-settings.test.cjs`.

## Offizielle Grundlagen

- [Google: Geheime iCal-Adresse und Zurücksetzen](https://support.google.com/calendar/answer/37648?hl=de)
- [Google: Kalender für bestimmte Personen freigeben](https://support.google.com/calendar/answer/37082?hl=de)

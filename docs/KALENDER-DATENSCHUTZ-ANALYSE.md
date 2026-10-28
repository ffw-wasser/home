# Privater Google-Kalender: Einrichtung und Datenschutz

Stand: 28.10.2026 · Implementierung ab Version 2026.10.28.11.
Die Veröffentlichung allein schaltet Googles öffentliche Freigabe nicht aus.
Die bestehende Kalenderverbindung muss einmal geschützt umgestellt werden.

## Ergebnis und gewählter Datenweg

H₂O unterstützt den privaten gemeinsamen Google-Kalender über dessen **geheime
Adresse im iCal-Format**. Für die vorhandene Einrichtung wurde diese Variante
gewählt, weil der bewährte ICS-Parser Serien, Ausnahmen, Ganztagstermine und
Geburtstage unverändert verarbeitet. Es ist kein zusätzliches Google-Cloud-Projekt,
Dienstkonto oder kostenpflichtiger Dienst nötig. Die bisherigen Google-Skripte
und persönlichen H₂O-Abos können bestehen bleiben.

Die geheime Adresse ist ein **Leseschlüssel für den gesamten Quellkalender**,
keine persönliche Anmeldung und keine Verschlüsselung der Google-Kalenderfreigabe.
Jeder Besitzer dieses Links kann den Feed lesen. Im H₂O-Dienst wird sie verschlüsselt
in der bestehenden Kalenderkonfiguration gespeichert. Sie wird weder an
Mitglieder noch an andere Verwaltungsgeräte zurückgegeben und erscheint nicht in
Logs, Fehlermeldungen, öffentlichen Antworten oder dem Repository. Die Eingabe
wird beim Absenden, Schließen, Ansichtswechsel, Verbergen der Seite und Sperren
geleert; H₂O speichert sie nicht im Browserspeicher. Ein verlorener Link muss in
Google zurückgesetzt und anschließend in H₂O ersetzt werden.

Ein eigener Google-Dienstzugang mit einem ausschließlich für diesen Kalender
vergebenen Leserrecht bleibt eine mögliche spätere Alternative mit getrennt
entziehbarer Identität. Er ist für die jetzt umgesetzte Verbindung nicht nötig.

## Einmalige Umstellung des bestehenden Kalenders

1. Hauptanwendung und vorhandenen Cloudflare-Worker auf den neuen Stand bringen.
   `/health` meldet `privateCalendarVersion: 1`. Keine neuen Datenbanken,
   allgemeinen Adminschlüssel oder Google-Skripte anlegen.
2. In Google Kalender **am Computer** die Einstellungen des bisherigen
   Feuerwehrkalenders öffnen. Unter **Kalender integrieren → Geheime Adresse im
   iCal-Format** den Link kopieren. Keinen neuen Kalender anlegen.
3. Im Gerätehaus unter **Kalender → Verbindung → Privaten Google-Kalender
   einrichten** den Link in das Passwortfeld einfügen und **Privaten Import prüfen
   und speichern** wählen. Den Link nur hier eingeben, nicht im Chat, in einem
   Google-Termin, in Skripteigenschaften oder auf der Homepage.
4. Wenn der erste Verbindungsabruf fehlschlägt, bleibt der Speicherbutton nutzbar.
   Beim erneuten Speichern lädt H₂O zuerst den aktuellen Verbindungsstand. Es
   speichert nichts ohne bestätigte Versionsprüfung. H₂O liest tatsächlich die private Quelle, prüft ihre Kalender-ID und speichert
   erst nach einem erfolgreichen Abruf. Ein fremder Kalender wird abgewiesen.
   Die Bestätigung erscheint ohne den Link. Die zentrale Einrichtung gilt für
   Geräte mit derselben Gerätehaus-/Kontodienst-Verbindung.
5. **Erst danach** in Google unter **Zugriffsberechtigungen für Termine** die
   öffentliche Freigabe ausschalten. Die persönlichen Zugriffe der Verwaltung
   beibehalten. Auch organisationsweite oder einzelne zusätzliche Freigaben
   prüfen, falls vorhanden.
6. Zurück in H₂O **Gespeicherten privaten Zugriff prüfen** wählen. Der Dienst
   prüft erneut die private Quelle und zusätzlich die alte öffentliche iCal-Adresse.
   Eine lesbare öffentliche Adresse wird ausdrücklich gemeldet. Eine eindeutige
   Zugriffssperre wird getrennt von Netzwerkfehlern und unbekannten Antworten
   dargestellt. Ein Netzwerkfehler ist kein Beweis, dass der Kalender privat ist.
7. Google kann die Änderung der öffentlichen Freigabe verzögert anwenden.
   Die Google-Einstellungen und den Zugriff ohne Google-Anmeldung zusätzlich prüfen.
   Google nennt für die Umstellung bis zu vier Stunden. Alte fremde Kopien werden
   dadurch nicht rückwirkend entfernt.

Falls die geheime Adresse im Google-Konto fehlt, können Organisationsrichtlinien
diese Funktion sperren. Dann ist ein gezielt freigegebener Dienstzugang oder eine
separat geschützte Lese-Brücke nötig; die öffentliche Freigabe nicht vor einem
funktionierenden Ersatz abschalten.

## Alle Kalenderverwalter sehen alle Termine

**Martin, Markus und alle weiteren Kalenderverwalter behalten den gemeinsamen
Google-Kalender in ihrem Google-Konto.** Martin bleibt gegebenenfalls Eigentümer;
die anderen persönlichen Google-Konten benötigen mindestens die Freigabe
**Änderungen an Terminen vornehmen**. Eine öffentliche Freigabe ist dafür nicht nötig.

Diese Konten sehen im gemeinsamen Google-Kalender **sämtliche Termine**, auch
wenn die jeweilige Person nicht zur Zielgruppe gehört. Die H₂O-Gruppenauswahl
steuert Teilnahme, Rückmeldungen und persönliche Mitgliedsansichten. Sie verändert
weder Google-Freigaben noch die vollständige Sicht der Kalenderverwalter.

Das persönliche **H₂O – Meine Feuerwehrtermine**-Abo bleibt auf die eigenen
relevanten Termine begrenzt. Für die Verwaltungsübersicht den gemeinsamen
privaten Google-Kalender verwenden, kein erweitertes Mitgliederabo oder fremden
Aboschlüssel weitergeben. Die Google-Seitenleiste arbeitet weiterhin mit dem
eigenen Google-Konto und der bisherigen `H2O_CALENDAR_ID`; der geheime ICS-Link
wird dort nicht benötigt. Auch die bestehende Farbanbindung bleibt unabhängig.

## Öffentliche und geschützte Ansichten

| Verbindung | Verhalten nach Umstellung |
| --- | --- |
| Google-Hintergrundimport | Liest ausschließlich die gespeicherte geheime Google-iCal-Adresse. Bei Fehler kein Rückfall auf die öffentliche Quelle. Ein alter Cache wird als veraltet behandelt. |
| Öffentlicher H₂O-Endpunkt `/calendar/public`, auch mit Jahr | Liefert keine Termine, Zeiten, Ereigniskennungen oder Gruppenhinweise mehr. Die Antwort enthält nur den Hinweis auf den privaten Betrieb. Auch bestehende Jahrescaches werden nicht öffentlich ausgegeben. |
| Gerätehaus-iPad | Benötigt die bestehende OneDrive-/Kontodienst-Verbindung. Kalender, Verwaltung und Jahresplan verwenden weiterhin die geschützten Lesewege. Die öffentliche Dienstadresse allein gewährt keinen Kalenderzugriff. |
| Persönliches H₂O-Portal | Weiterhin Anmeldung mit persönlichem Passkey oder Passwort; serverseitige Empfängerprüfung. |
| Persönliches Kalenderabo | Bisheriger individueller, widerrufbarer Nur-Lese-Link; enthält eigene relevante Termine und den eigenen Geburtstag. Link privat halten. |
| Google-Gruppenschnittstelle | Unverändert begrenzter Zugriff auf Gruppen, Namen und technische Mitgliederkennungen; keine Konten, Rückmeldungen, Atteste oder Geburtstage. |
| Noch nicht umgestellter öffentlicher Modus | Bisheriges Verhalten bleibt kompatibel. Google kann Titel, Beschreibungen und Orte weiterhin öffentlich ausliefern; H₂O-Blenden oder `Freigabe: Nein` verhindern das nicht. |

Der Google-Import verarbeitet die im Quellkalender eingetragenen Daten,
einschließlich dort hinterlegter Geburtstage. Das Ausblenden in der Hauptanwendung
ist davon getrennt. Die geprüften Google-Kalenderfunktionen übertragen keine
medizinischen Nachweise aus der Mitgliederverwaltung an Google. Der geschützte
H₂O-Mitgliederabgleich verarbeitet notwendige Nachweisgültigkeiten für die
Nachweisfunktion; das persönliche Abo enthält weiterhin den eigenen Geburtstag.
Eine pauschale Aussage „Alle Schnittstellen übertragen nur Namen“ wäre falsch.

## Technischer Erhalt der Zuordnungen

Die bisherige öffentliche `calendarUrl` bleibt intern als **nicht berechtigende
Identität** erhalten. Sie ist kein aktiver öffentlicher Ersatzabruf im privaten
Betrieb. Die private Adresse wird getrennt als `privateCalendarUrl` verschlüsselt
abgelegt. Die ICS-Projektion bildet Ereignis-/Serien-IDs weiterhin aus der
bisherigen Identität plus UID/ursprünglichem Serienvorkommen.

Damit bleiben Rückmeldungen, Gruppen-/Einzelregeln, Erinnerungsmarker, persönliche
Abos, Gerätehaus-Zuordnungen sowie Geburtstag-/Treuepunktmarker an denselben
Terminen. Ein bloßer Tokenwechsel erzeugt keine neuen Kalendertermine.
Eine eigene Zugriffsrevision invalidiert Quellcaches, ohne Termin-IDs zu ändern.
Versionsprüfung und bedingte Datenbankschreibvorgänge verhindern, dass gleichzeitig
laufende alte Importe eine neue Verbindung überschreiben. Fehlgeschlagene
Einrichtung lässt die bisherige Verbindung unverändert.

## Prüfrahmen und praktische Abnahme

Automatisierte Prüfungen verwenden ausschließlich künstliche Kalender und Personen:
Identitätserhalt, Rückmeldungen und Abos, Serien/Jahresplan/Geburtstagsmarker,
verschlüsselte Speicherung, fehlende Geheimnisse in Ausgaben, fremde Kalender,
ungültige URLs, Weiterleitungen, Ausfälle, parallele Einrichtung, Schlüsselwechsel,
alte laufende Importe sowie öffentliche Sperren. Der Browsertest prüft das echte
Formular einschließlich Navigation, Sperren und Handy-/Tabletbreiten.

Die persönliche Google-Freigabe und geheime Adresse werden nicht automatisch
verändert oder aus einem Konto ausgelesen. Die letzte praktische Einrichtung muss
im berechtigten Google-Konto und der geschützten H₂O-Verwaltung erfolgen. Danach
auf den tatsächlichen iPads das Laden und auf beiden Google-Konten die vollständige
Verwaltungssicht prüfen. Die technische Beschreibung ersetzt keine rechtliche
Bewertung der konkreten Datenverarbeitung.

## Zuständige Dateien und offizielle Grundlagen

- `cloudflare/push/portal.js`: Identität, privater Import, Versionsschutz,
  Cachewechsel, öffentliche Sperre und Zugriffsprüfung.
- `js/features/portal/calendar-private-source.js`: geschützte Eingabe ohne Rückgabe
  oder Browserablage; `portal-admin.js`: Einbindung und Leeren beim Sperren/Wechsel.
- `tests/calendar-private-source.test.cjs`, `tests/calendar-private-source-browser.cjs`.
- [Google: Geheime iCal-Adresse und Zurücksetzen](https://support.google.com/calendar/answer/37648?hl=de)
- [Google: Öffentliche Kalenderfreigabe beenden](https://support.google.com/calendar/answer/37083?hl=de)
- [Google: Freigabe für bestimmte Personen](https://support.google.com/calendar/answer/37082?hl=de)

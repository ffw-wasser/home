# Prüfung von Sicherung und öffentlichen Dateien

Stand: 23.10.2026, Anwendung 2026.10.23.33.

## Ergebnis und Korrekturen

Die Prüfung des aktuellen ausgelieferten Quellstands ergab keine produktiven
Mitgliederlisten, Kontobestände, Microsoft-Token oder privaten Dienstschlüssel in
den statischen Dateien. Öffentlich bereitgestellter Code ist kein geschützter
Speicher. Kontaktdaten werden über die angemeldete OneDrive-Verbindung geladen;
der öffentliche Kalender gibt ausschließlich reduzierte Probentermine aus, keine
Mitgliedernamen, Geburtstage, Empfängerlisten oder Rückmeldungen.

Die Wordvorlage enthielt persönliche Autorenmetadaten und fest eingetragene Namen
bei Behördenfunktionen. Diese wurden in der Vorlagendatei und ihrer eingebetteten
Kopie entfernt beziehungsweise durch Funktionsbezeichnungen ersetzt. Historische
Git-Versionen sind dadurch nicht gelöscht. Die Prüfung umfasst den aktuellen
Dateibestand und den Code der Zugriffswege, keine vollständige Prüfung aller
historischen Commits oder der Microsoft-/Cloudflare-Kontoberechtigungen.

Die App-Sicherung enthält jetzt auch gespeicherte laufende Termin- und
Einsatzentwürfe. Vor der Ausgabe wird die OneDrive-Historie geladen. Schlägt das
Laden fehl oder fehlt eine angekündigte Bericht-PDF, wird keine erfolgreiche
Sicherung ausgegeben. Gespeicherte Dokumentberichte müssen ebenfalls ihre PDF
enthalten. Ältere App-Sicherungen bleiben lesbar. Entwürfe behalten ihre Bindung an
den ursprünglichen Datenordner und werden nach dem Wiederherstellen neu geladen.

## Welche Sicherungen zusammen benötigt werden

| Daten | Sicherungsweg | Grenze |
| --- | --- | --- |
| Mitglieder, Nachweise der Hauptanwendung, Ziele, Tagesdaten, Historie, gespeicherte Bericht-PDFs und Dokumentberichte, gespeicherte laufende Entwürfe | App-Datensicherung | JSON ist unverschlüsselt; nur geschützt ablegen. Nicht übernommene Dokumentfotos im Arbeitsspeicher sind kein gespeicherter Dokumentbericht. |
| Zentrale Getränkekonten, Buchungen, Punkte-Einstellungen und private Handyzugänge | Getränkeverwaltung: Jetzt in OneDrive sichern | Separater Export; Sicherung bei Übernahme und vor Zurücksetzen, keine automatische Sicherung bei geschlossenem iPad. Administrativer Wiederherstellungsimport ist nicht implementiert. |
| Portal, Rückmeldungen, Portalnachweise, Challenge, Theater, Passkeys und Dienstzustände | Gesonderte Sicherung der vollständigen Cloudflare-D1-Datenbank | Weder App- noch Getränkesicherung ist ein vollständiger D1-Export. Tatsächliche Sicherungen und Wiederherstellbarkeit wurden ohne Kontozugriff nicht verifiziert. |
| Kontaktverzeichnis, Hydrantenplan, Original-Terminpakete und private Verwaltungsverbindungen | Gesonderte geschützte Sicherung der betreffenden OneDrive-Ordner | Synchronisierung und Versionshistorie allein belegen keine unabhängige vollständige Sicherung. Ordnerfreigaben wurden nicht live geprüft. |
| Cloudflare-Dienstschlüssel, insbesondere der bestehende Verschlüsselungsschlüssel INVITE_SECRET, sowie weitere Anbieter-Konfiguration | Getrennte geschützte Schlüssel- und Konfigurationssicherung | Keine Veröffentlichung und kein Export in App-Dateien. Verschlüsselte D1-Inhalte sind ohne ursprünglichen Schlüssel nicht wiederherstellbar. |

Eine vollständige Betriebssicherung ist erst bestätigt, wenn alle genannten
Bestände vorliegen und eine Wiederherstellung geprüft wurde. Diese Veröffentlichung
führt keine produktive Datensicherung aus und löscht keine Nutzerdaten.

## Validierung

Regressionsprüfungen decken die Wiederherstellung laufender Entwürfe, den Ausschluss
von Anmeldedaten aus dem App-Export, Abbruch bei fehlenden PDFs oder unvollständiger
Historie und bereinigte, identische Wordvorlagen ab. Zusätzlich wurden die gesamte
Unit-Testsuite, Syntax, die Hilfe im Browser und das Wiederaufnehmen von Entwürfen
im Browser geprüft. Reale Microsoft-Anmeldungen, iOS-Abläufe und eine produktive
Wiederherstellung sind damit nicht nachgewiesen.

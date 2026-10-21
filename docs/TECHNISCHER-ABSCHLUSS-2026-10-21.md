# Technischer Prüfstand – H2O Portal

Stand: 21.10.2026. Ausgangspunkt: main `d722dc91fb2e1f036439a3fde11961f4719d8389`, App 2026.10.21.6. Geprüfte Änderung: 2026.10.21.7.

## Ergebnis und Grenze der Freigabe

Der Code wurde geprüft und mit synthetischen Daten getestet. Eine uneingeschränkte Betriebs-/Sicherheitsabnahme ist damit **nicht** erklärt. Externe Speicherfreigaben benötigen eine gesonderte Klärung; Cloudflare/D1 und echte Geräte wurden nicht produktiv verändert oder als erfolgreich abgenommen dargestellt. Sensible Konfigurationsdetails stehen ausschließlich im privaten Abschlussbericht.

## Berücksichtigter Stand

PRs #20–#25 und #29 sind in main integriert. Die Nummern #26–#28 sind offene Issues, keine Pull Requests. Die dort verlangten praktischen Endabnahmen bleiben offen, soweit sie echte Geräte oder Dienste voraussetzen. Der unabhängige Design-PR #30 ist nicht Bestandteil dieser technischen Prüfung.

## Bestätigte Fehler und Korrekturen

- Mitgliederaustritt: alle verknüpften Aliase statt ausschließlich Browserfreigaben sperren. Die Mitgliederänderung, der Widerruf von Browser-, Push-, Deckel- und Buchungszugängen und die Ablehnung offener Buchungen erfolgen in einer D1-Transaktion. Ersetzte Revisionen bleiben gesperrt. Finanzkonten und bestehende Buchungen werden erhalten.
- Mitgliedsprüfung: Portal, Browserverbindung, zentrale Deckelabfragen, Buchungen und Challenge prüfen die serverseitige Mitgliederfreigabe. Fehlt die Freigabe im zentralen Betriebsmodus, wird der Zugriff abgewiesen. Der ältere Erinnerungsbetrieb vor der zentralen Kontenaktivierung bleibt erhalten.
- Parallelität: eine D1-Sequenzprüfung verhindert, dass ein veralteter Mitgliederabgleich konkurrierende Kontenänderungen überschreibt. Sammelsperrungen verwenden eine feste Zahl von SQL-Anfragen statt einer Anfragefolge pro Alias.
- OneDrive-Zustand: konsistentes Lesen mit Versionsprüfung, bedingtes Schreiben, keine automatische Wiederholung ungewisser Schreibvorgänge. Konflikte zwischen lokaler und externer Änderung erhalten die lokalen Daten; eine gespeicherte Vergleichsbasis übersteht den App-Neustart. Identischer Inhalt bestätigt einen erfolgreichen PUT trotz verlorener Antwort.
- ZIP-Korrektur/Löschung: die beim Laden bekannte Dateiversion wird berücksichtigt. Neuere Berichte werden nicht durch einen älteren Bearbeitungsstand überschrieben oder gelöscht. Fehlende Dateiversionen blockieren ungeschützte Änderungen.
- Probeabschluss: parallele Abschlussaufrufe während Vorschau/Teilen blockieren; Abbruch gibt den Abschluss wieder frei. Einsatzabschluss ignoriert einen erneuten Aufruf während der Verarbeitung.
- Tests: die gezielte Sicherheits-/Cloudflare-Testauswahl enthält nun auch die zentrale Portal-Testsuite.
- Worker: reproduzierbaren SHA-256-Fingerabdruck des vollständigen Quellstands in `/health` ergänzen. Bundle wird aus den Fachmodulen erzeugt und gegen diese geprüft.

## Datenzuständigkeit und Identitäten

| Daten | Verbindlicher Speicher / Identität |
| --- | --- |
| Mitglieder, laufende Erfassung, Rollen-/App-Einstellungen | gemeinsame OneDrive-Datei; Mitglieder-ID, sessionId bzw. operationId |
| Abgeschlossene Proben/Einsätze | ZIP im gemeinsamen Ordner; `onedrive-zip:<Datei-ID>`; Originalname bei Korrektur erhalten |
| Historie/Statistik | Ableitung aus geladenen ZIP-Paketen; flüchtiger Cache nach Dateiversion |
| Kalender | Google-ICS-Projektion; UID/Serientermin, Freigaben und versionierte Rückmeldungen in D1 |
| Mein Deckel / Challenge im zentralen Modus | verschlüsselte D1-Konten; Mitglieds-ID, Alias/Revision, eindeutige Buchungs-/Spielkennungen |
| Browserkopplung / Push | D1: Token-Hash bzw. Gerätekennung; Alias/Revision und Ablauf/Sperre |
| Lokale Eingaben | Gerät: Entwürfe und Vormerkungen; kein Ersatz für bestätigtes Cloud-Speichern |

Neue Terminpakete werden weiterhin über den vorhandenen iOS-Teilen-/Desktop-Download-Ablauf abgelegt. Eine erfolgreiche Übergabe beweist keine tatsächliche Ablage in OneDrive. Das wurde nicht auf einen automatischen Upload umgebaut. Zwei eigenständig gespeicherte Dateien mit gleichem fachlichem Inhalt können weiterhin doppelte Berichte darstellen; keine produktiven Dateien wurden automatisch dedupliziert oder entfernt.

## Automatisierte Nachweise

- Ausgangsstand: 646 Tests bestanden.
- Abschlussstand: 663 Tests bestanden, keine fehlgeschlagenen/übersprungenen Tests.
- 177 JavaScript-Dateien ohne Syntaxfehler geprüft.
- `node scripts/prepare-worker.cjs`: Bundle-Erstellung, Worker-Syntax und gesamte Suite erfolgreich.
- Release-/PWA-Konsistenz, Dateiverweise, private Cache-Ausschlüsse, Berechtigungen, WhatsApp-Navigation, Kalender-Rückmeldungen, Probe-/Einsatzkorrekturen, Statistik, PDF-Ausgabe, Deckel und Theater sind Gegenstand der vorhandenen Suite.
- Zusätzliche Regressionen: mehrere Aliase je ausgeschiedenem Mitglied, fehlende Freigabe, atomarer Rollback, konkurrierender Abgleich, 125 gesperrte Aliase unter dem D1-Free-Abfragelimit, veraltete ZIP-Version, OneDrive-Konflikt, verlorene PUT-Antwort, erneuter Abschluss.
- Quell-/Bundle-Abgleich und Releasegenerator erzeugen nach dem Build keine weiteren Änderungen. PR #31 wurde nach erfolgreichem PR-Testlauf integriert (main `e7e1d96c2be9b480c6fc2d23ceb3aa17b530ab37`). Auch der main-Testlauf und GitHub Pages waren erfolgreich; die öffentliche `app-release.json` bestätigt 2026.10.21.7.

## Nicht praktisch verifiziert / weiter offen

1. Tatsächliche Cloudflare-Version, Secrets, Kontorechte, DB-Bindung und Cron-Ausführung. Ein Repository-Merge ist kein Deploymentnachweis. Der Health-Abruf war mit Browser-User-Agent erfolgreich (HTTP 200); die bestehende Antwort bestätigt die Dienstmodule, enthält aber noch keinen neuen Quellfingerabdruck. Die Bereitstellung des geprüften Workerstands ist deshalb nicht belegt.
2. Realer Microsoft-PUT/DELETE, Freigabewechsel, abgelaufene Anmeldung, iPad-Teilen-Dialog und vollständige Testkette Handy → iPad → ZIP → Korrektur → Löschen. Produktive Datensätze wurden nicht als Testmaterial verändert.
3. Installierte iOS-/Android-PWA, WhatsApp-In-App-Browser, Tastatur, Safari-Dateiablage, Push-Empfang auf gesperrten Geräten und Betriebssystem-Installationswarnungen. Automatisierte Modell-/DOM-Tests sind keine Geräteabnahme.
4. Vollständige fachliche Deduplizierung bestehender ZIPs und automatische Konfliktzusammenführung. Konflikte werden bewahrt und gemeldet; nicht automatisch durch Überschreiben aufgelöst.
5. Eine formelle Penetrationsprüfung und vollständige externe Abhängigkeits-/CVE-Bewertung sind nicht erfolgt. Bestehende Migrationen/Vendor-Dateien wurden nicht pauschal entfernt.

## Betrieb und Rückfall

Website: nur geprüften PR integrieren und erfolgreichen GitHub-Pages-Lauf kontrollieren. Worker: vorhandener Cloudflare-Git-Build muss `node ../../scripts/prepare-worker.cjs` erfolgreich ausführen, bevor Wrangler veröffentlicht. Danach `/health.sourceFingerprint` mit dem frisch erzeugten Bundle vergleichen. Keine Testzugänge oder produktiven Datensätze für diesen Versionsvergleich nötig.

Rückfall per Revert des integrierten PRs und erneutem geprüften Build; keine neue D1-Schemamigration. Bereits widerrufene Zugänge bleiben widerrufen. Niemals durch Rückspielen alter Kontenzugänge oder Mitgliederlisten eine Sperre rückgängig machen. Ein Rollback auf den Ausgangscode nimmt auch dessen behobene Sicherheitslücken wieder in Kauf und sollte nur gezielt erfolgen.

## Nachtrag: OneDrive-Verbindung nach Freigabewiderruf (2026.10.21.8)

Nach dem Entfernen einer anonymen Ordnerfreigabe wurde ein 404 beim Historienabruf gemeldet. Der bisherige Resolver löste den gespeicherten Freigabelink nach jedem Neustart erneut ein. Eine weiterhin bestehende persönliche Berechtigung allein reichte damit nicht aus. Der Datenordner und die zentrale Datendatei wurden über die angemeldete Microsoft-Verbindung weiterhin gefunden; eine Datenlöschung wurde daraus nicht abgeleitet.

Der Resolver prüft jetzt einen zuvor bestätigten Ordner direkt mit dem angemeldeten Microsoft-Konto. Der gespeicherte Bezug gilt nur für dieselbe Client-ID, Kontoidentität und Ordnerkonfiguration. Ein 403/404 beim direkten Ordnerzugriff bleibt ein Fehler; der Code löst dann keinen Freigabelink erneut ein und legt keine Ersatzdaten an. Konto-/Konfigurationswechsel und Abmeldung während eines Abrufs verwerfen dessen Ergebnis.

Für die Neueinrichtung werden auch normale persönliche OneDrive-Ordneradressen mit `cid` und `id` bzw. `resid` unterstützt. Der Zugriff erfolgt ausschließlich authentifiziert über Microsoft Graph; eine anonyme Freigabe wird nicht benötigt. Die Verwaltung kann die Adresse nun auch bei bestehender Anmeldung speichern. Ungültige Ordnerlinks erhalten eine passende Fehlermeldung statt einer Behauptung über gelöschte Berichte; die letzte Historie bleibt erhalten.

Die erneute Berechtigungsabfrage des App-Ordners, der zentralen Datendatei und der Dienstkonfiguration enthielt nur noch Eigentümer-/benannte Bearbeitungsrechte, keine anonymen Links. Dies ersetzt weder eine Prüfung sämtlicher OneDrive-Dateien noch die weiterhin offene Erneuerung des Dienstzugangs. Produktive Daten wurden für diese Korrektur nicht verändert.

Regressionen prüfen Neustart nach Freigabewiderruf, erneute serverseitige Autorisierung, Konto-/Client-/Linkwechsel, fehlerhafte gespeicherte Bezüge, direkte Ordneradressen, 403/404, verwechslungsfreie Ordnerantworten, Abmeldung während des Abrufs, Erhalt der Historie und die Speichermöglichkeit in der Verwaltung. Die tatsächliche iPad-Verbindung nach dem Update muss am Gerät bestätigt werden; die Cloudflare-Abnahme bleibt separat offen.

Validierung dieses Nachtrags: 684 Tests bestanden, 178 JavaScript-Dateien ohne Syntaxfehler; Worker-Bundle unverändert und konsistent. Die Release-/PWA-Prüfungen sind Bestandteil der bestandenen Gesamtsuite.

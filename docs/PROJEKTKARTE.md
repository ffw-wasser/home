# Projektkarte – Feuerwehr Wasser / H2O Portal

Stand der Bestandsaufnahme: `main`, Version `2026.10.21.6` (21.10.2026).
Diese Karte ist eine **Navigation für gezielte Änderungen**, kein vollständig verifiziertes
Architektur- oder Sicherheitsgutachten. Vor dem Ändern betroffene Aufrufstellen prüfen.

## Einstieg, UI und gemeinsame Infrastruktur

| Anliegen | Zuerst ansehen | Häufige Abhängigkeiten |
| --- | --- | --- |
| Start, Navigation, Oberflächen-Zustände | `index.html`, `js/app/app.js`; H₂O: `deckel.html`, `js/features/drinks/deckel-startup.js`, `deckel-view.js`, `js/features/portal/portal-onboarding.js` | `js/core/ui.js`, `css/layout/mobile.css` |
| Infos: getrennte Kontakte und kurze Hilfe | `scripts/build-help-guide.cjs`, `css/features/help-guide.css` | `scripts/capture-help-screens.cjs`, `assets/help/guide/`, `tests/help-guide-browser.cjs`; Kontakte in `contactsView` / `more-contacts`; Hilfe in `privacyHelpView` / `more-help` gemeinsam erzeugen |
| Gerätehaus-Erfassung, Teilnehmer, Schritte | `js/features/attendance/attendance-controller.js` | `action-dock.js`, `js/core/keyboard.js`, `js/features/tactics/` |
| Einsatz und Fahrzeugbesetzung | `js/features/operations/operations.js`, `js/features/tactics/` | Anwesenheit, Berichte, Qualitätsprüfungen |
| Kalender, Rückmeldungen, Terminansichten | `js/features/portal/portal-admin.js`, `portal-member.js`, `calendar-model.js` | `portal-whatsapp.js`, `calendar-google-admin.js`, Cloudflare `portal.js`, `google-calendar-api.js`, `google-calendar-oauth.js`, `calendar-invitations.js`, `calendar-subscriptions.js`, `calendar-group-access.js` (Worker und Verwaltungsoberfläche), `docs/google-calendar-addon/`, ICS-Bibliothek |
| Ausbildung / Funk / Wettkampf / Atemschutz | `deckel.html`, `assets/training/README.md` | Atemschutz-Lernseiten mit Grundlagen und Mayday (öffentlich/offline, getrennt von geschützter GF-Nachweisübersicht); bebilderter MXP600-Alltagscheck mit sechs Handgriffen und zwei Gerätebildern, deutsche Originalanleitung als PDF-Link (alte allgemeine Taschenkarte entfernt), kompakte BW-Status und Übungsdialoge; Wettkampf → Bronze/Silber/Gold mit direkten offiziellen LFS-Unterlagen (2026 und klar getrennte auslaufende Fassung) |
| Dienstvorschriften / FwDV | `js/features/portal/portal-regulations.js`, `regulations-model.js` | `deckel-mobile.js`, `cloudflare/push/portal.js`; zentrale Auswahl, offizielle PDF-Links, Buchansicht mit `plan-zoom.js` und authentifiziertem PDF-Transport |
| Nachweise, Eignung, Mitgliederdaten | `js/features/portal/member-evidence.js`, `js/features/settings/admin.js`, `portal-evidence-admin.js` (Mitglieder → Nachweise prüfen) | `js/core/database.js`, Cloudflare `portal.js` |
| Historie, Korrektur, Löschen | `js/features/history/archive.js`, `onedrive-history-live.js` | `js/core/onedrive-sync.js`, Berichtsdateien |
| Statistik | `js/features/statistics/statistics.js`, PDF-Datei: `js/features/statistics/statistics-pdf.js` | Historie, Anwesenheit, Nachweise, Getränke, lokale PDF-Bibliothek |
| PDF, DOCX, CSV und ZIP | `js/features/reports/` | Einsatz, Korrektur- und Speicherabläufe |
| Mein Deckel, Zahlungen; Punkte/Challenge im Backlog | `js/features/drinks/`, `deckel.html`; Sicherungen: `drinks-central.js` / `settingsFilesView`, gemeinsame H₂O-Verbindung: Einstellungen → H₂O-Dienst, `drinks-push.js` / `settingsPushView` | Cloudflare `central.js`, `challenge.js`, `js/core/privacy.js`; Auslieferungsrichtlinie `js/core/optional-features.js`, Merkliste `docs/BACKLOG.md` / Verwaltung → Backlog |
| Theater / Veranstaltungen | `js/features/theater/` | Cloudflare `theater.js`, `css/features/` |
| Synchronisierung, Microsoft-Zugriff | `js/core/onedrive-sync.js`, `database.js` | Cloudflare-Schnittstellen, geschützte Zustände |
| Native iPhone-Mitgliederpilot / Widget | `docs/H2O-MEMBER-PILOT.md`, `native/ios/`, `native/shared/ios-entry.js` | Produktionsportal und isolierte Apple-Demo getrennt; persönliche Portalantwort in `portal-member.js`, Widgetablauf in `native/ios/Shared/WidgetSnapshot.swift`, Darstellung in `H2OWidgetView.swift`; Swift-Tests und Simulator-Bilder in `h2o-ios-widget.yml`; manuelle Signierung in `h2o-ios-member-pilot.yml`; Apple-Domainzuordnung im getrennten Root-Repository. Android: `docs/H2O-ANDROID-PILOT.md`, `native/android/`, Android-Widget und Firebase-Push; Emulatorprüfung in `h2o-android-pilot.yml`. |
| PWA, Offline/Cache, Installationsicons | `js/core/app-release.js` (gemeinsame automatische Startprüfung), `service-worker.js`, `js/core/connection-status.js`, `manifest.webmanifest`, `deckel*.webmanifest` | `scripts/update-release.cjs`, `app-release.json`; öffentliche Unterlagen in separatem Cache, private Serverantworten bleiben ausgeschlossen; `tests/portal-offline-browser.cjs` prüft echten Offline-Neustart |
| Cloudflare Worker, Push, D1 | `cloudflare/push/worker.js` und die Fachmodule im gleichen Ordner | `build.cjs`, `wrangler.jsonc`, `*.sql` |
| Standardisierte Prüfungen | `tests/`, `scripts/check-syntax.cjs` | `.github/workflows/application-tests.yml` |

## Datenflüsse und sensible Übergänge

- GitHub Pages liefert den öffentlich einsehbaren Anwendungscode. Zugangsdaten, private
  Tokens und personenbezogene Datensätze gehören nicht ins Repository.
- OneDrive/SharePoint und Cloudflare/D1 erfüllen verschiedene Speicher- und Dienstrollen.
  Vor Änderungen zuerst den **tatsächlich aktiven Betriebsmodus** der betroffenen Funktion
  anhand ihrer Datenzugriffe ermitteln; ältere README-Abschnitte können andere Modi beschreiben.
- Kalender-/Terminrückmeldungen, iPad-Anwesenheit, Historie und Statistik bilden eine
  fachlich verbundene Kette. Eingriffe an IDs, Korrekturen und Statusübergängen sind
  stets bereichsübergreifend zu prüfen.
- Der Worker wird aus mehreren Quelldateien mit `node cloudflare/push/build.cjs`
  zu `cloudflare/push/worker.bundle.js` erzeugt. Nicht nur das Bundle isoliert ändern.
  Auf GitHub vorhandener Quellstand ist **kein Beleg** für die laufende Cloudflare-Version.
- `app-release.json` steuert Versions-/Cache-Konsistenz; bei echter Anwendungsauslieferung
  `node scripts/update-release.cjs` und Cache-Liste beachten.
- Browser-Sichtbarkeit und lokale PINs sind kein Ersatz für serverseitige Rechteprüfung.
  Mitgliedsaustritt muss Zugriff auf Geräte, Links und serverseitige Berechtigungen betreffen.

## Bereinigung früherer Kalendereinladungen

`cloudflare/push/calendar-invitations.js` enthält nur noch den alten eigenen Profil-Löschweg und
die geschützte Bereinigung eigener alter Testeinladungen. Neue Einladungen,
Kalenderadress-Einwilligungen, Kalenderantwortimporte und zusätzliche Abfragefreigaben sind entfernt.
Jeder hinterlegte GF kann für sichtbare kommende Termine direkt erinnern;
`portal_event_reminders` dient ausschließlich der Markierung offener Antworten nach einer Erinnerung.
`docs/google-calendar-invitations/Code.gs` ist eine optionale Bereinigungsvorlage
für das bestehende Skript, ohne Mailversand und ohne Kalenderneuanlage.

## Typische Tests für die erste Schleife

- Termin / Kalender: `node scripts/run-focused-tests.cjs kalender`
- Einsatz / Fahrzeug: `node scripts/run-focused-tests.cjs einsatz`
- Gerätehaus: `node scripts/run-focused-tests.cjs geraetehaus`
- Historie / Korrektur: `node scripts/run-focused-tests.cjs historie`
- Mein Deckel / Challenge: `node scripts/run-focused-tests.cjs deckel`
- Theater: `node scripts/run-focused-tests.cjs theater`
- Cloudflare / Zugriff: `node scripts/run-focused-tests.cjs cloudflare sicherheit`

Mehrere Bereiche dürfen kombiniert werden. Die Zuordnung ist eine **Startauswahl**,
keine vollständige Abhängigkeitsanalyse. Bei Änderungen an gemeinsamen Modellen,
Datenhaltung, Zugriffsrechten oder Schemata zusätzlich passende Quertests ausführen.
Die gesamte Suite läuft auf Pull Requests durch GitHub Actions; reale iOS-/Android-,
Microsoft-Login-, Worker- und D1-Tests benötigen gegebenenfalls gesonderte Prüfungen.

## Regeln zum Weiterlesen

1. `AGENTS.md`: verbindliche Projektregeln.
2. `docs/WORK-LEITFADEN.md`: kleine und große Work-Aufträge.
3. `docs/VERBESSERUNGSPLAN.md`: geplante, noch nicht automatisch umgesetzte Verbesserungen.
4. `cloudflare/push/PORTAL.md`, `CENTRAL.md` und `AUTO-DEPLOY.md`: detailspezifische Dokumentation.

Diese Karte bei einer Modulverschiebung mit aktualisieren, nicht bei jeder kleinen
Oberflächenkorrektur neu schreiben.

## Aktueller Kalenderablauf

Mitglieder abonnieren unter Daten und Sicherheit ein persönliches H₂O-Abo, niemals den Hauptkalender.
`cloudflare/push/calendar-subscriptions.js` verwaltet zufällige zurücksetzbare Nur-Lese-Kennungen,
verschlüsselte Tokens und den serverseitig nach aktueller Mitgliedschaft gefilterten ICS-Feed.
Jeder Eintrag enthält automatisch den öffentlichen, nicht berechtigenden H₂O-Antwortlink.
Zu- und Absage sind für sichtbare kommende Termine sofort möglich. Jeder hinterlegte GF
kann direkt erinnern. Die zusätzliche Abfragefreigabe und ihre Statuskarte sind entfernt.
Die technische Bereinigung alter Testkopien bleibt kompatibel; keine neue Einrichtung.

## Privater Kalenderimport

`portal.js` behält `calendarUrl` als bisherige, nicht berechtigende Identität.
`privateCalendarUrl` ist ein verschlüsseltes, nie ausgegebenes Lesegeheimnis.
`privateCalendarRevision` trennt Caches bei Wechsel des Zugangs; Ereignis-/Serien-IDs
bleiben identisch. `/admin/portal/private-calendar` prüft denselben Kalender,
verwendet Versionsschutz und schützt die Kalenderdaten vor anonymen Zugriffen.
Die Gerätehaus-Oberfläche lädt ausschließlich über die bestätigte Gerätehaus-Verbindung.
Einrichtung und Oberfläche für den früheren anonymen Kalender sind entfernt.
`js/features/portal/calendar-private-source.js` stellt die geschützte Einrichtung
mit leerbarem Passwortfeld und erneuter Zugriffsprüfung bereit.
Prüfungen: `tests/calendar-private-source.test.cjs`, `tests/calendar-private-source-browser.cjs`.

## Geschützte Aboübersicht

Unter Verwaltung → H₂O Portal lädt `portal-subscription-admin.js` die Namen aus OneDrive
und `/admin/portal/subscriptions` nur mit dem bestehenden Verwaltungszugang und Datenquellenschutz.
`calendar-subscriptions.js` zählt aktuelle Push-Geräteregistrierungen und liest den letzten
erfolgreichen persönlichen ICS-GET aus `portal_calendar_usage` (verschlüsselter Einzelstand,
kein Verlauf). HEAD, Linkerstellung und fehlgeschlagene Abrufe bestätigen kein Abo.
Ein Kalenderabruf ist kein Nachweis eines weiterhin eingerichteten Abos. Linkreset,
Zugangswiederherstellung und Mitgliederaustritt entwerten beziehungsweise entfernen den Status.
Namen und Status werden nicht in öffentlichen Dateien oder zusätzlichen Browserablagen gespeichert.
Prüfungen: `tests/member-subscriptions.test.cjs`, `tests/member-subscriptions-browser.cjs`.

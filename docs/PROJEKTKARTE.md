# Projektkarte – Feuerwehr Wasser / H2O Portal

Stand der Bestandsaufnahme: `main`, Version `2026.10.21.6` (21.10.2026).
Diese Karte ist eine **Navigation für gezielte Änderungen**, kein vollständig verifiziertes
Architektur- oder Sicherheitsgutachten. Vor dem Ändern betroffene Aufrufstellen prüfen.

## Einstieg, UI und gemeinsame Infrastruktur

| Anliegen | Zuerst ansehen | Häufige Abhängigkeiten |
| --- | --- | --- |
| Start, Navigation, Oberflächen-Zustände | `index.html`, `js/app/app.js`; H₂O: `deckel.html`, `js/features/drinks/deckel-startup.js`, `deckel-view.js` | `js/core/ui.js`, `css/layout/mobile.css` |
| Datenschutz und bebilderte Hilfe unter den Kontakten | `scripts/build-help-guide.cjs`, `css/features/help-guide.css` | `scripts/capture-help-screens.cjs`, `assets/help/guide/`, `tests/help-guide-browser.cjs`; beide Ansichten gemeinsam erzeugen |
| Gerätehaus-Erfassung, Teilnehmer, Schritte | `js/features/attendance/attendance-controller.js` | `action-dock.js`, `js/core/keyboard.js`, `js/features/tactics/` |
| Einsatz und Fahrzeugbesetzung | `js/features/operations/operations.js`, `js/features/tactics/` | Anwesenheit, Berichte, Qualitätsprüfungen |
| Kalender, Rückmeldungen, Terminansichten | `js/features/portal/portal-admin.js`, `portal-member.js`, `calendar-model.js` | `portal-whatsapp.js`, Cloudflare `portal.js`, ICS-Bibliothek |
| Ausbildung / Funk | `deckel.html`, `js/features/portal/portal-training.js`, `assets/training/` | Lokale Motorola-Taschenkarte, gemeinsame `plan-zoom.js`-Ansicht, kompakte BW-Status und Übungsdialoge |
| Dienstvorschriften / FwDV | `js/features/portal/portal-regulations.js`, `regulations-model.js` | `deckel-mobile.js`, `cloudflare/push/portal.js`; zentrale Auswahl, offizielle PDF-Links, Buchansicht mit `plan-zoom.js` und authentifiziertem PDF-Transport |
| Nachweise, Eignung, Mitgliederdaten | `js/features/portal/member-evidence.js`, `js/features/settings/admin.js` | `js/core/database.js`, Cloudflare `portal.js` |
| Historie, Korrektur, Löschen | `js/features/history/archive.js`, `onedrive-history-live.js` | `js/core/onedrive-sync.js`, Berichtsdateien |
| Statistik | `js/features/statistics/statistics.js`, PDF-Datei: `js/features/statistics/statistics-pdf.js` | Historie, Anwesenheit, Nachweise, Getränke, lokale PDF-Bibliothek |
| PDF, DOCX, CSV und ZIP | `js/features/reports/` | Einsatz, Korrektur- und Speicherabläufe |
| Mein Deckel, Zahlungen, Punkte, Challenge | `js/features/drinks/`, `deckel.html` | Cloudflare `central.js`, `challenge.js`, `js/core/privacy.js` |
| Theater / Veranstaltungen | `js/features/theater/` | Cloudflare `theater.js`, `css/features/` |
| Synchronisierung, Microsoft-Zugriff | `js/core/onedrive-sync.js`, `database.js` | Cloudflare-Schnittstellen, geschützte Zustände |
| Native Mitglieder-App (archiviert; nicht weitergeführt) | `native/README.md`, `native/ios/`, `native/android/` | `scripts/prepare-native-association.cjs`, Cloudflare `passkeys.js`, Build-/TestFlight-Workflows entfernt; aktive Lösung ist die bestehende Web-App. Archivierte Signatur-/Link-Tests bleiben für die Nachvollziehbarkeit erhalten |
| PWA, Offline/Cache, Installationsicons | `service-worker.js`, `js/core/connection-status.js`, `manifest.webmanifest`, `deckel*.webmanifest` | `scripts/update-release.cjs`, `app-release.json`; öffentliche Unterlagen in separatem Cache, private Serverantworten bleiben ausgeschlossen; `tests/portal-offline-browser.cjs` prüft echten Offline-Neustart |
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

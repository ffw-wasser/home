# Projektregeln

Die konsolidierte Ausgangsversion ist 2026.10.14.21. Funktionierende Abläufe
werden in ihren zuständigen Modulen weiterentwickelt.

- Korrekturen direkt in der verantwortlichen Funktion umsetzen. Keine neuen
  `*-fix.js`-Dateien, nachträglichen Funktionsersetzungen oder konkurrierenden
  Listener für dieselbe Aktion hinzufügen.
- Anwesenheitsaktionen für iPhone und iPad gehören in
  `js/features/attendance/action-dock.js`; Eingaben und Bildschirmtastatur in
  `js/core/keyboard.js`.
- Paketnamen beim Erstellen in `js/features/reports/zip-terminpakete.js`
  festlegen. Korrekturen behalten die Kennung und Namen des Originals.
- Abschluss- und Verwaltungsprüfungen direkt aus der jeweiligen Aktion
  aufrufen. Die gemeinsamen Prüfungen liegen in `quality-engine.js`.
- CSS-Reihenfolge und Spezifität berücksichtigen. `css/core/application.css`
  enthält zusammenhängende Basisregeln, `css/layout/mobile.css` die Regeln für
  Mobilgeräte. CSS-Blöcke nicht über Dateigrenzen aufteilen.
- Kompatibilität für gespeicherte Daten und Buchungsschemata beibehalten.
  Datenmigrationen nicht allein wegen ihres Alters entfernen.
- Persönliche Daten, PINs, Zugangstoken und produktive Konten gehören nicht in
  das Repository oder die Tests. Nur künstliche Testdaten verwenden.
- Bei Änderungen an Bedienabläufen, sichtbaren Schaltflächen, Navigation,
  Datenschutz oder Schutzmaßnahmen die betroffenen Anleitungen und Bilder im
  selben Pull Request aktualisieren. Das gilt für Hauptanwendung und H₂O Portal.
  Die gemeinsame Hilfe wird in `scripts/build-help-guide.cjs` gepflegt und mit
  `node scripts/build-help-guide.cjs` unter den vorhandenen Kontakten erzeugt.
  Die H₂O-Infokachel enthält ausschließlich portalrelevanten Datenschutz und
  Bedienungsanleitungen; Anleitungen zur Hauptanwendung dort nicht einfügen.
  Betroffene Originalbilder mit `scripts/capture-help-screens.cjs` erneuern;
  ausschließlich künstliche Beispieldaten und gesperrte produktive Dienste nutzen.
  Bilder und Texte anschließend visuell sowie mit `tests/help-guide-browser.cjs`
  prüfen. Bestehende Bilder bei bloßen Textkorrekturen nicht unnötig neu erzeugen.
- `app-release.json` ist die Quelle für die Version. Anschließend
  `node scripts/update-release.cjs` ausführen und neue oder entfernte Dateien
  in `service-worker.js` berücksichtigen.
- Nach Funktionsänderungen zuerst die fachlich passenden Tests und Syntaxprüfungen
  ausführen (`node scripts/run-focused-tests.cjs <bereich>`); den vollständigen
  Testlauf, Bundle- und Release-Konsistenz auf dem Pull Request durch GitHub
  Actions prüfen lassen. Bei sicherheits- und datenrelevanten Eingriffen oder
  fehlender CI die vollständige Testsuite selbst ausführen. Reale iOS- und
  Microsoft-Abläufe werden durch automatisierte Prüfungen nicht vollständig abgedeckt.
- Zusätzliche Sicherungsdateien nur erstellen, wenn sie zum ausdrücklich
  beauftragten Umfang gehören. OneDrive-Nutzerdaten bei Codepflege nicht ändern.

## Effizienter Entwicklungsablauf (ChatGPT Work / Codex)

- Vor der Implementierung den Auftrag auf konkrete betroffene Funktionen, Akzeptanzkriterien
  und Risiken eingrenzen. Zusammengehörige Änderungen in einem Arbeitsauftrag bündeln;
  unabhängige große Umbauten getrennt behandeln.
- Zuerst `docs/PROJEKTKARTE.md` lesen. Nur zuständige Module, direkte Abhängigkeiten und
  zugehörige Tests gezielt öffnen. Keine Vollanalyse des Repositories bei kleinen Änderungen.
  Die Suche ausweiten, sobald Abhängigkeiten, Sicherheitsfragen oder Testergebnisse es erfordern.
- Bestehende Logik und Tests weiterverwenden. Keine pauschale Bereinigung, Schemaänderung,
  Umstrukturierung oder Wiederholung bereits bestandener Prüfungen ohne konkreten Anlass.
- Für lokale schnelle Tests `node scripts/run-focused-tests.cjs --list` und
  `node scripts/run-focused-tests.cjs <bereich>` verwenden. Testauswahl ersetzt nie die
  vollständige CI-Prüfung vor dem Merge; neue Fehler mit gezielten Regressionstests absichern.
- Änderungen zunächst auf einem `feature/**`- oder `fix/**`-Branch vorbereiten und per
  Pull Request prüfen. Ein bestandener Testlauf ist keine Veröffentlichung und kein
  Nachweis eines erfolgreichen Cloudflare-Deployments. In `main` oder produktiven Diensten
  nur nach entsprechendem Auftrag ändern.
- Bei Benutzerkonten, Rollen, Token, PINs, personenbezogenen Daten, Korrekturen/Löschungen,
  D1/OneDrive-Synchronisation oder Migrationen den Prüfrahmen gezielt erweitern.
  Browser-PIN und UI-Sichtbarkeit allein ersetzen keine serverseitige Autorisierung.
- Bei rein redaktionellen oder Test-/Workflow-Änderungen ohne Änderung des ausgelieferten
  Programms keine neue App-Release-Version erzeugen.
- Abschlussbericht knapp und überprüfbar: geänderte Dateien, durchgeführte Prüfungen,
  CI-Status, nicht geprüfte reale Abläufe sowie Branch/PR oder tatsächlich veröffentlichte
  Version. Ein nicht getesteter Ablauf wird niemals als erfolgreich geprüft dargestellt.

Details und wiederverwendbare Arbeitsaufträge: `docs/WORK-LEITFADEN.md`.
Geplante strukturelle Verbesserungen: `docs/VERBESSERUNGSPLAN.md`.

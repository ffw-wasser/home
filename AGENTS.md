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
- `app-release.json` ist die Quelle für die Version. Anschließend
  `node scripts/update-release.cjs` ausführen und neue oder entfernte Dateien
  in `service-worker.js` berücksichtigen.
- Nach Funktionsänderungen `node --test tests/*.test.cjs` sowie Syntaxprüfungen
  der geänderten JavaScript-Dateien durchführen. Reale iOS- und Microsoft-
  Abläufe werden durch diese Prüfungen nicht vollständig abgedeckt.
- Zusätzliche Sicherungsdateien nur erstellen, wenn sie zum ausdrücklich
  beauftragten Umfang gehören. OneDrive-Nutzerdaten bei Codepflege nicht ändern.

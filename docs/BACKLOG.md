# Backlog – zurückgestellte Funktionen

Stand: 29.10.2026. Sichtbare Merkliste: Verwaltung → Backlog.

## Treuepunkte

Vorläufig pausiert: Vergabe aus bestätigten Zahlungen und Geburtstagen, Punktedarstellung und Einlösung. Bestehende Buchungen, Punkte und Einstellungen bleiben vollständig erhalten. Getränke, Zahlungen, Vorauszahlungen, Korrekturen und finanzielle Historie bleiben aktiv. Historische Punktbuchungen werden nicht aus der Buchungshistorie gelöscht oder umgerechnet.

Vor Einführung: Regeln beschließen; Umgang mit alten Punkten und Zahlungen während der Pause festlegen. Keine rückwirkende Vergabe ohne gesonderte Entscheidung. Hierfür bei Wiederaufnahme insbesondere die Zeit-/Fortschrittsregel im Modell prüfen.

## Monats-Challenge

Vorläufig pausiert: Spielstart, Fortsetzung, Fragenverwaltung und Bonusvergabe. Fragenpool, Spielstände und Konfiguration bleiben erhalten. Vor Einführung Fragen/Quellen, Ausbildungsstufen und Bonusregeln prüfen.

## Technische Wiederaufnahme

Die gemeinsame Auslieferungsrichtlinie liegt in `js/core/optional-features.js` und wird vor den Fachmodulen in beiden HTML-Einstiegen sowie im Worker-Bundle geladen. Browsernavigation, Buchungsmodell und serverseitige Schreib-/Spieldienste beachten diese Richtlinie. Kein lokaler oder mitgliederbezogener Aktivierungsschalter ist eingebaut. Eine spätere freiwillige Pilotgruppe benötigt serverseitige Freigaben und Tests, keinen reinen UI-Schalter.

Relevante Module: `drinks-model.js`, `drinks-rewards.js`, `deckel-challenge.js`, `drinks-birthday-settings.js`, `drinks-challenge-settings.js`, `drinks-quiz-questions.js`, `cloudflare/push/challenge.js`, Geburtstagsvergabe in `portal.js`. Bestehende Funktionsprüfungen bleiben als Tests der späteren Funktionen erhalten. Produktionsprüfungen prüfen zusätzlich die Pause.

Vor Veröffentlichung beide Oberflächen und Navigation, Zahlungen ohne Bonus, normale Vorauszahlung, gesperrte Punkte-/Challenge-Aufrufe und historische Daten prüfen. Wiederaufnahme erfordert eine neue bewusste Veröffentlichung von Webseite und Worker.

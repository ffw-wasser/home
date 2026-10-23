# Kalenderverwaltung: Analyse und Umsetzung

Stand: 23.10.2026. Untersucht: Release 2026.10.22.26, Quellstand von `origin/main` (`ed7f1d2`).

Status: **Auf `feature/calendar-ui` umgesetzt; Release 2026.10.23.1 vorbereitet, noch nicht produktiv veröffentlicht.**
Die Browserprüfung verwendet ausschließlich erfundene Termine und Personen.

## Ziel und verbindlicher Umfang

Die bestehende Kalenderverwaltung unter **Einstellungen → Kalender** wird übersichtlicher und passt optisch zur FFW-App. Keine zusätzliche Portal-Kachel.

- Nur kommende und laufende Termine; vergangene Termine entfallen aus dieser Verwaltung.
- Gruppen und Schlagwörter sind unmittelbar erreichbar.
- Die tatsächlich zugeordneten Personen sind auch bei automatischen Gruppen sichtbar.
- Automatische Auswahl, manuelle Korrektur und ausdrückliche Terminfreigabe bleiben unterscheidbar.
- Der Umbau betrifft die Verwaltungsoberfläche. Historie, Protokolle, Statistik, laufende Anwesenheit und bestehende Zugriffsrechte bleiben erhalten.

## Befunde und Folgerungen

| Befund im aktuellen Code | Wirkung | Geplante Änderung |
| --- | --- | --- |
| `reviewCalendar()` behält Einträge bis 30 Tage nach Ende. | Abgelaufene Termine verlängern die Liste und beeinflussen Zähler. | Gemeinsame Sichtbarkeitsprüfung für Liste, Suche, Zähler und Sammelaktionen. |
| Gruppen stehen als geschlossener Abschnitt hinter der gesamten Terminliste. | Die neue Funktion wird leicht übersehen. | Drei ständig erreichbare Bereiche: **Termine**, **Gruppen**, **Verbindung**. |
| Bei Gruppen wird die Personenliste mit `people.hidden=group.source!=='manual'` ausgeblendet. | Automatische Zuordnung ist nur anhand einer Anzahl überprüfbar. | Namen direkt in der Gruppenübersicht anzeigen, unabhängig von der Zuordnungsquelle. |
| Terminüberschriften verbinden Datum und Thema; Karten haben mehrere gleichwertige Bearbeitungsaktionen. | Inhalt und nächster Schritt sind schwer zu erfassen. | Thema als Überschrift, Datum/Uhrzeit darunter, eine Aktion **Bearbeiten**. |
| „Gespeichert“, „erkannt“ und „freigegeben“ beschreiben verschiedene Sachverhalte nebeneinander. | Speichern kann mit Sichtbarkeit für Mitglieder verwechselt werden. | Freigabestatus auf der Karte; Zuordnungsquelle in der Personenzeile; Speicherstatus nur während Bearbeitung. |
| Offene Einträge werden anhand einer gespeicherten Regel gefiltert. | Ein gespeicherter, aber nicht freigegebener Termin kann aus der Prüfliste fallen. | „Zu prüfen“ nach fachlichem Handlungsbedarf definieren, nicht nach Vorhandensein einer Regel. |
| Sammelübernahme berücksichtigt den Suchtext nicht und mischt Freigaben, Geburtstagszuordnung und sonstige Einordnungen. | Aktion kann mehr oder andere Einträge betreffen als sichtbar. | Explizite Auswahl mit genauer Vorschau; getrennte Aktionen nach Zweck. |
| Kalenderverbindung erscheint oben und technische Konfiguration nochmals unten. | Einrichtung verdrängt die tägliche Arbeit und ist doppelt verteilt. | Verbindung in einem eigenen Bereich zusammenführen. |
| Blaue, grüne und orange Kartenflächen konkurrieren mit den Farben der übrigen FFW-App. | Zu viele Signale bei geringer Hierarchie. | Neutrale Karten, kleine beschriftete Statusmarkierungen, vorhandenes FFW-Rot für Hauptaktionen. |
| Gruppen-Neuladen kann einen Entwurf ersetzen; Bearbeitungsschließen hat keine klare Verwerfen-Semantik. | Unsicherheit über den Speicherstand. | Einheitliche Speichern-/Abbrechen- und Wechselregeln; Bestätigung vor Verlust geänderter Eingaben. |

Quellen: `index.html` (`settingsCalendarView`), `js/features/portal/portal-admin.js` (`paintGroups`, `reviewCalendar`, `reviewControls`, `automaticCandidates`, Karteneditor), `css/features/portal.css`, `css/core/base.css`, `js/features/portal/calendar-model.js`, `cloudflare/push/portal.js`.

## Bedienung und Gestaltung

### Gemeinsamer Rahmen

- Bestehende App-Navigation und Rückweg zu Einstellungen erhalten.
- Nach erfolgreicher Verwaltungsfreigabe direkt mit **Termine** beginnen. Einrichtung ohne bestätigte Verbindung bleibt erreichbar, private Inhalte werden erst nach vorhandener Rechteprüfung geladen.
- Kurze Bereichsnamen passen auch auf 320 px. „Gruppen“ trägt im Inhalt die Überschrift **Schlagwörter & Gruppen**.
- Weiß bzw. bestehende neutrale App-Flächen, dunkle Schrift, graue Trennlinien, vorhandenes Rot `#c80000`. Grün für bestätigte Freigabe, Orange für Handlungsbedarf, jeweils mit Text. Keine flächigen Ampelkarten.
- Bestehende Arial/Helvetica-Typografie. Hauptüberschrift 28–32 px, Kartenthema 19–21 px, Inhalt/Eingaben 16–17 px. Sekundärtext mindestens 14 px. Einheitliches Abstandsraster 8/12/16/24 px.
- Touch-Ziele mindestens 44 px, sichtbarer Tastaturfokus, beschriftete Felder, Statusmeldungen zugänglich. Farbe allein vermittelt keine Bedeutung.
- Auf dem Handy eine Spalte; auf dem iPad breitere Karten mit ruhig angeordneten Metadaten. Chronologische Liste bleibt eine Liste. Personenlisten fließen im Dokument, ohne verschachtelte Scrollfenster.

### Termine

Oben stehen **Alle** und **Zu prüfen**, danach Suche; Terminartfilter bei Bedarf kompakt. Keine zusätzliche Reihe großer Statistik-Kacheln.

Jede Karte zeigt in dieser Reihenfolge:

1. Thema, klarer Freigabestatus.
2. Datum, Uhrzeit bzw. ganztägig; laufende Termine mit „Läuft gerade“.
3. Fachliche Terminart, Ort, Kleidung, sofern relevant.
4. **Eingeladene Personen (Anzahl)** mit Zuordnung „Automatisch · Atemschutz“, „Manuell angepasst“ oder „Bisherige Auswahl · geschützt“.
5. Aufklappbare Namensliste am Termin; eine sichtbare Schaltfläche **Bearbeiten**.

„Eingeladen“ bedeutet Berechtigung zur Rückmeldung, nicht Zusage und nicht erfasste Anwesenheit. Die Namensliste muss den **effektiven** `recipientIds` entsprechen, nicht einer möglicherweise abweichenden automatischen Empfehlung.

Ein Termin wird inline bearbeitet: Terminart, Ort, Kleidung, Personen und ausdrückliche Freigabe. Datum und Titel bleiben kalendergeführt, solange keine vorhandene API ihre Bearbeitung unterstützt. **Speichern** ist die einzige Hauptaktion, daneben **Abbrechen**. Erfolg, Konflikt und Wiederholung stehen direkt am bearbeiteten Termin.

Es ist höchstens ein Bearbeitungsformular gleichzeitig offen. Beim Wechsel mit Änderungen: **Weiter bearbeiten** oder **Änderungen verwerfen**. Kein automatisches Speichern und kein Verwerfen durch Hintergrundabruf. Während eines Schreibvorgangs bleibt der Editor geöffnet und der Wechsel gesperrt.

Für „Zu prüfen“ gelten konkrete Gründe: noch nicht eingeordnet, Anmeldung noch nicht freigegeben, Geburtstag ohne eindeutige Person oder automatische Gruppe ohne Empfänger. Ein ausdrücklich als sonstiger Eintrag gespeicherter Termin ist nicht dauerhaft prüfpflichtig. Veraltete/unverfügbare Daten erzeugen eine Verbindungswarnung, keine erfundene leere Gruppe. Ein manuell geschlossener Termin bleibt unter „Zu prüfen“ nachvollziehbar mit „Anmeldung noch nicht freigegeben“; die Liste suggeriert keine Pflicht zur Freigabe.

Sammelaktionen werden erst nach Auswahl eingeblendet. Eine Vorschau nennt alle betroffenen Termine und die beabsichtigte Freigabe. Sie arbeitet ausschließlich mit der sichtbaren, noch gültigen Auswahl. Geburtstagszuordnung und sonstige Einordnung erfolgen einzeln im Editor. Der bestehende Server schreibt einzelne Regeln; bei Teilfehlern bestätigte Erfolge und offene Einträge separat zeigen, keine Atomarität behaupten.

### Schlagwörter & Gruppen mit sichtbaren Personen

**Neue Gruppe** steht oben. Jede Gruppe zeigt ohne Öffnen eines Bearbeitungsformulars:

- Namen, aktiv/deaktiviert, Schlagwörter und Anzahl.
- Herkunft der Personen: etwa **Automatisch aus dem Kennzeichen Atemschutz** oder **Manuell ausgewählt**.
- **Alle zugeordneten Namen**, alphabetisch sortiert. Kein bloßes „+12“ als einzige Möglichkeit, die restlichen Personen zu erkennen.
- Bei langen Listen eine Namenssuche innerhalb der Gruppe; vor Eingabe sind alle Namen sichtbar. Der Gesamtzähler bleibt vom Suchtrefferzähler getrennt.
- Eine Aktion **Gruppe bearbeiten**.

Automatische Listen sind lesbar, aber ohne irreführende abwählbare Kontrollkästchen. Änderungen erfolgen am zugrunde liegenden Mitgliederkennzeichen oder durch ausdrücklich gewählte manuelle Auswahl. Deaktivierte Gruppen zeigen ihre Zuordnung weiter, mit „Wird nicht automatisch verwendet“. Eine leere bestätigte Gruppe zeigt „Keine Personen zugeordnet“ und öffnet niemals den Zugriff für alle.

Die Namen werden aus derselben bestätigten Mitgliederprojektion berechnet wie die Anzahl: `PortalGroups.members(group, roster)`, anschließend IDs auf Namen abbilden. Änderungen an Kennzeichen und Mitgliederaustritte werden nach bestätigtem Abgleich berücksichtigt. Namensgleiche Personen nicht zusammenfassen; Mitglieds-IDs bleiben maßgeblich. Unbekannte IDs oder ein fehlender Stand werden als Problem gemeldet, nicht still als gültige Nullauswahl dargestellt.

Bei einem automatisch zugeordneten Termin zeigt die Personenansicht zusätzlich die auslösenden Gruppen. Deren Schlagwörter sind in der Gruppenübersicht sichtbar. Treffen mehrere Gruppen zu, erscheint jede Person einmal. Bei manueller/bisheriger Auswahl tatsächliche Empfänger und automatische Empfehlung klar trennen. `recipientIds:null` bedeutet weiterhin den vorhandenen „Alle“-Vertrag und darf nicht still in eine neue Liste aktiver Mitglieder umgewandelt werden.

Im Gruppeneditor sind Name, Schlagwörter, Herkunft und Sonderfälle angeordnet. **Speichern** nutzt weiterhin die vorhandene versionierte Gesamt-Konfiguration; maximal ein Gruppenentwurf verhindert versteckte parallele Änderungen. **Abbrechen** stellt die gespeicherte Fassung wieder her. Konflikte erhalten Eingaben und verlangen einen bewussten Abgleich.

Ein kompakter **Zuordnung testen**-Bereich nimmt einen Termintitel entgegen und zeigt passende Gruppen **und konkrete Personen**. Er verwendet ausschließlich den vorhandenen gemeinsamen Resolver. Gespeicherte Regeln und Entwurfsprüfung werden sichtbar unterschieden; eine Vorschau speichert nichts und gibt keine Termine frei. Die Wirkung spezifischer vor allgemeinen Regeln wird damit unmittelbar verständlich.

### Verbindung

Ein kompakter Status zeigt Erreichbarkeit, Datenstand und gegebenenfalls einen verständlichen Fehler samt **Erneut laden**. **Verbindung bearbeiten** öffnet vorhandene Dienstadresse, Kalenderadresse und Erinnerungseinstellung. Technische Adressen stehen nicht zwischen den Terminen. Die öffentliche Einrichtung bleibt vom privaten Verwaltungszugriff getrennt.

## Zeitgrenzen und Datenregeln

- Sichtbar ist ein Termin mit gültigem Endzeitpunkt `end > now`; laufende Termine bleiben bis zum Ende sichtbar. Nur nach Startdatum zu filtern wäre falsch.
- Darstellung in `Europe/Berlin`; ganztägige Termine beachten das bestehende exklusive Kalenderende und Zeitumstellungen.
- Dieselbe Prüfung gilt für Suche, Filter, Anzahl und Auswahl einer Sammelaktion. Vor dem Speichern/Freigeben Ablauf erneut prüfen.
- Beim Öffnen, Rückkehr in die sichtbare App und spätestens am nächsten Terminende aktualisieren. Keine zusätzlichen konkurrierenden Listener; vorhandenen Kalender-Lebenszyklus erweitern.
- Endet ein Termin während offener Bearbeitung: Entwurf nicht still entfernen. „Termin beendet“ anzeigen, weitere Freigabe sperren, nach bewusster Beendigung des Editors ausblenden.
- Keine Löschung von OneDrive-Berichten, Anwesenheiten oder Statistiken. Serverseitige Aufbewahrung und Bereinigung von Regeln/Rückmeldungen bleiben unberührt.
- Private Namen nur nach bestehender serverseitiger Administration und bestätigter Verbindung. Beim Sperren, Abmelden oder Quellenwechsel auch Gruppen-Namenslisten und Testergebnisse entfernen; verspätete Antworten verwerfen.
- Automatische Gruppen, manuelle Auswahl und Legacy-Auswahl bleiben kompatibel. Vorhandene `expectedVersion`-/`expectedGroupsVersion`-Prüfungen und Schutz vor Zugriffserweiterung bleiben erhalten.
- Keine neue Datenbanktabelle oder Änderung der Buchungs-/Rückmeldungsschemata erforderlich. Ob zusätzliche reine UI-Felder nötig sind, beim Umbau am bestehenden API-Vertrag prüfen.

## Umsetzungsreihenfolge und betroffene Dateien

1. **Struktur und Zustände:** `index.html` und `portal-admin.js`: drei Bereiche, gemeinsame sichtbare Terminmenge, ein Editor, saubere Wechsel-/Verwerfen-Regeln, lokale Statusmeldungen. Bestehende Autorisierung vor das Laden privater Daten stellen.
2. **Personenprojektion:** `portal-admin.js`: Gruppen-Mitgliedsnamen und effektive Terminempfänger aus vorhandenen APIs abbilden; Quellen-/Versionswechsel behandeln. `calendar-model.js` weiterverwenden, keine zweite Erkennungslogik erfinden.
3. **Karten und Gruppeneditor:** Ein klarer Bearbeitungseinstieg, ausklappbare Terminpersonen, ständig sichtbare Gruppenpersonen, Zuordnungstest; Sammelaktionen mit konkreter Auswahl.
4. **Optik und responsive Darstellung:** bestehende Kalenderregeln in `css/features/portal.css` konsolidieren, auf `#settingsCalendarView` begrenzen; gegebenenfalls bestehende Mobilregeln gezielt anpassen. Keine nachträglich angehängten widersprüchlichen CSS-Korrekturblöcke. H₂O-Mitgliederansichten nicht versehentlich umgestalten.
5. **Validierung und Releasevorbereitung:** gezielte Fachtests und Browserprüfung, dann vollständige PR-CI. Erst bei tatsächlicher Auslieferung Version aus `app-release.json` aktualisieren und `scripts/update-release.cjs` ausführen.

## Abnahmekriterien und Testplan

- Termine und Gruppen sind auf 320, 390, 412, 768 und 1024 px ohne horizontales Scrollen erreichbar. Zusätzlich große Schrift, Tastatur und längste Namen prüfen.
- Vergangene Termine fehlen in Liste, Suche, Zählern und Sammelaktionen; laufende bleiben. Tests für Ende exakt jetzt, Ganztag, Berliner Mitternacht und Zeitumstellung.
- Der bisherige Test „Herbstfest Sonderschule vom Vortag bleibt ... korrigierbar“ in `tests/calendar-attendance.test.cjs` wird gezielt auf die neue Verwaltungsanforderung geändert. Archivkorrekturtests bleiben erhalten.
- `tests/calendar-settings.test.cjs`: Verwaltungssperre, fehlendes OneDrive, Entfernen privater Namen/Testergebnisse beim Sperren und keine Freigabe durch bloße Sichtbarkeit.
- `tests/calendar-groups.test.cjs` und Browserprüfung: automatische Namen sichtbar für alle Quellen; Namen/Anzahl aus identischen IDs; Mehrfachtreffer ohne Duplikate; leere Gruppe, deaktivierte Gruppe, entfernte Person, doppelte Namen und veralteter Stand.
- Effektive Terminempfänger stimmen bei automatisch/manuell/legacy sowie `recipientIds:null` mit dem Server überein. Wechsel zu manuell und Rückkehr zur Automatik erzeugen keine implizite Freigabe.
- `tests/calendar-groups-browser.cjs`: Bereiche mit Tastatur bedienen, Namen lesen/suchen, Gruppe bearbeiten, speichern/abbrechen, Termin bearbeiten und Empfänger prüfen. Synthetische Daten; keine produktiven Schreibzugriffe.
- Entwürfe überstehen Hintergrundlesen, Konflikte und fehlgeschlagene Schreibantworten; Wechsel fragt vor Verwerfen. Ablauf während Bearbeitung oder Sammelvorschau wird abgefangen.
- Erst `node scripts/run-focused-tests.cjs kalender` und Syntaxprüfung; bei Änderungen an gemeinsamer Projektion oder Zugriffssteuerung zusätzlich `cloudflare sicherheit`. Vollständige CI vor Merge.
- Reale iPhone/iPad-Bedienung und Microsoft-Rückkehr separat prüfen. Automatisierte Browserprüfungen ersetzen diese Abnahme nicht.

## Stand dieser Vorbereitung

Der Umbau ist in den bestehenden Modulen umgesetzt. Kalender-Fachtests und die Browserprüfung mit synthetischen Daten decken die neuen Bereiche, sichtbare automatische Namen, Änderungen der Auswahl, Entwurfsabbruch, Zeitgrenzen und private Inhalte beim Sperren ab. Bildschirmbreiten: 320, 390, 412, 768 und 1024 px. Die produktive Anwendung wird erst durch einen gesonderten Merge-/Veröffentlichungsschritt aktualisiert. Reale iPhone-/iPad- und Microsoft-Anmeldung wurden dabei nicht ausgeführt.

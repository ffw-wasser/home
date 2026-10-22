# Schlagwörter & Gruppen in der FFW-Wasser-Terminverwaltung

Einbauort: Einstellungen → Kalender → Termine verwalten → Schlagwörter & Gruppen.
Keine zusätzliche Portal-Kachel. Terminarten, iPad-Erfassung und Terminfreigaben
bleiben eigenständig.

## Mitgliederauswahl

Neue Kalendertermine erhalten ohne zusätzliche Bestätigung eine automatische
Auswahl. Die Terminfreigabe für Anmeldung und Erinnerungen wird dabei nicht gesetzt.
Spezifische Gruppen verdrängen allgemeine Regeln; mehrere spezifische Gruppen
werden vereinigt. Doppelte Mitglieder werden entfernt. Ohne Treffer werden aktive
Mitglieder ausgewählt (Mitglieder ohne Kennzeichen Altersabteilung).

Standardgruppen verwenden die vorhandenen Kennzeichen:

| Gruppe | Schlagwörter | Mitgliederquelle |
| --- | --- | --- |
| Alle aktiven Mitglieder | Probe | `ageDepartment !== true` |
| Atemschutz | Atemschutz, AGT, AS-Probe | `breathingQualified` / bestehende Atemschutzprojektion → `agt` |
| Gruppenführer | Gruppenführer, GF | Rolle `GF` → `leader` |
| Ausschuss | Ausschuss, Ausschusssitzung | `committeeMember` |
| Alterskameraden | Alterskameraden, Altersabteilung | `ageDepartment` |

Eigene Gruppen können manuell über stabile Mitglieder-IDs gepflegt werden. Beim
Wechsel von einem Kennzeichen zu manueller Zuordnung wird die aktuelle Auswahl
übernommen. Gruppen lassen sich umbenennen, deaktivieren und löschen. Die Legende
zeigt die gespeicherten Regeln und aktuellen Mitgliederzahlen; Entwürfe werden
klar als ungespeichert angezeigt. Änderungen nur am Gruppennamen ändern keine IDs.

Erkennung ignoriert Groß-/Kleinschreibung und vereinheitlicht Umlaute einschließlich
`ue`/`ü`/`u` und `ß`/`ss`. Ganze Wörter, Mehrwortbegriffe und begrenzte sinnvolle
Probe-/Übung-/Ausbildungskomposita werden erkannt. Kurze Kürzel wie GF werden
nicht in beliebigen Wortteilen erkannt. Doppelte normalisierte Schlagwörter und
Gruppennamen werden beim Speichern abgewiesen.

## Schutz bestehender Daten

- Regeln ohne `recipientMode` sind `legacy`: Vorhandene Listen einschließlich
  `recipientIds: null` (alle Mitglieder) werden nicht automatisch umgestellt.
- `manual` schützt gespeicherte Einzelkorrekturen dauerhaft vor Kalender- und
  Gruppenaktualisierungen.
- `automatic` berechnet die Auswahl aus aktuellen Regeln und Mitgliederkennzeichen.
  Die Aktion „Automatische Gruppenauswahl erneut übernehmen“ ermöglicht den
  ausdrücklichen Wechsel zurück zur Automatik.
- Leere spezifische Gruppen ergeben eine leere Empfängerliste. Sie öffnen keinen
  allgemeinen Zugriff. Defekte Gruppendaten führen zum Fehler, nicht zum Rückfall
  auf alle Mitglieder. Fehlt eine zuvor gespeicherte Konfiguration, werden betroffene
  automatische Regeln mit bekannter Konfigurationsversion gesperrt.
- Löschen oder Deaktivieren von Regeln ist eine bewusste Regeländerung und kann
  automatische Zielgruppen verändern. Manuelle und bisherige Auswahlen bleiben
  geschützt. Vor Änderungen die Legende und betroffene automatische Termine prüfen.
- Rückmeldungen, Verbindungen, Protokolle, Historie und Statistik werden nicht migriert.

## Speicherung und Berechtigungen

Die additive Tabelle `portal_groups` wird durch das bestehende Worker-Setup angelegt.
Verschlüsselung verwendet `CentralLedger.seal/open`, Zweck `portal-groups`.
Kein separater Dienst, keine neue Anmeldung, keine persönlichen Repository-Daten.
Lesen und Ändern der Gruppen erfordern den vorhandenen serverseitig geprüften
Admin-Zugang plus Datenquellenprüfung. D1-Versionsvergleiche verhindern verlorene
Gruppenänderungen. Terminänderungen prüfen zusätzlich die Gruppenversion atomar.
Aktuelle Mitgliederkennzeichen werden über die bestehende bestätigte
OneDrive-/SharePoint-Synchronisierung in das verschlüsselte Portal-Roster übertragen.

Die bestehende Empfängerprüfung wird für Terminlinks, Rückmeldungen, Übersichten
und WhatsApp weiterverwendet. Persönliche WhatsApp-Erinnerungen berücksichtigen
nur offene/unsichere Rückmeldungen, schließen den Abfragenden aus und prüfen vor
Öffnung der Nachricht erneut. Es wird keine WhatsApp-Nachricht automatisch gesendet.
Die getrennte bisherige Push-Erinnerungslogik bleibt bestehen.

## Prüfungen und Betriebsgrenzen

`tests/calendar-groups.test.cjs` prüft Modell, echte Worker-Routen mit verschlüsseltem
SQLite/D1-Testadapter, Versionskonflikte, Migration, Empfängerrechte, WhatsApp und
fehlende/defekte Daten. `tests/calendar-groups-browser.cjs` prüft die echte Oberfläche
mit synthetischen Mitgliedern und dem Worker auf 320/390/412/768/1024 Pixeln.
Die bestehende vollständige Testsuite und der PR-Workflow prüfen Querverbindungen.

Ein Index pro Projektion und ein Cache je Terminbezeichnung vermeiden eine Suche
über jede Regel für jeden Termin. Ein zusätzlicher D1-Lesezugriff auf Gruppendaten
pro Projektion; keine Abfrage pro Termin. Eingabegrenzen schützen den Free-Tarif
(100 Gruppen, 200 Begriffe je Gruppe, insgesamt 2000 Begriffe).
Reale iOS-/Android-Geräte, Microsoft-Anmeldung und produktive Worker-CPU-Metriken
werden durch lokale Chromium- und SQLite-Tests nicht vollständig abgedeckt.

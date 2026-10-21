# Gemeinsamer Verbesserungsplan – FFW Wasser / H2O Portal

Stand: 21.10.2026. Diese Punkte sind **Vorhaben, keine bereits implementierten
oder bestätigten Fehlerkorrekturen**. Zuerst separat prüfen und dann nach
Priorität gemeinsam freigeben. Betrieb `main` und Cloudflare unangetastet lassen,
solange nur vorbereitet wird.

## Verifizierter Umsetzungsstand (21.10.2026)

Die folgende Bestandsaufnahme trennt **implementierte Teilmaßnahmen** von der
**vollständigen fachlichen Abnahme**. Ein grüner GitHub-Test ersetzt keine
OneDrive-/D1- oder Gerätetests mit Testdaten.

- **PR #20 (main):** Projektkarte, Leitfaden, fokussierte Tests und CI integriert.
- **PR #21 (main):** OneDrive-Speicherfehler werden als Fehler statt als bloß
  ausstehende lokale Synchronisation dargestellt.
- **PR #22 (main):** Korrekturen verlangen eine eindeutig gekennzeichnete
  OneDrive-Original-ZIP-ID; keine vollständige Ende-zu-Ende-Korrekturabnahme.
- **PR #23 (main):** Automatischer Folgeabgleich nach Fehlern verzögert und bei
  erforderlicher Neuanmeldung unterdrückt; keine garantierte Konfliktfreiheit.
- **PR #24 (main):** Probeabschluss blockiert ungültige Status, fehlende Namen
  und doppelte Einträge; weitere Fachprüfungen bleiben offen.
- **CI:** Die beiden main-Läufe für Commit
  `ff8137d9a21bc67a47d0ae23a7c5cb3993a5565d` waren erfolgreich.

**Noch offen:** P0.1 (idempotente Schreib-/Löschvorgänge und reale
Unterbrechungsfälle), P0.2, P0.3 und P0.4 (Zeitkonflikte, Einsatz und
Sonderfälle) sowie P1.1–P1.4 und P2.1–P2.2. Die unten stehende Tabelle ist
weiterhin die Zielplanung, keine Liste bereits erledigter Arbeiten.

**Abnahme mit Testdaten erforderlich:** Mitglied entfernen und alte Links
prüfen; Termin am Handy melden, am iPad abschließen, Originalbericht korrigieren
und löschen, Historie/Statistik prüfen; Offline-/Wiederverbindungsfälle; iOS,
Android und Gerätehaus-iPad; Cloudflare-Worker-Version und Berechtigungen.
Produktive Berichte und Mitgliederdaten dabei nicht für Tests verwenden.

## Leitidee

Einmal erfassen, an einem Ort verbindlich speichern, anderen Ansichten denselben
gültigen Stand zeigen. Drei verständliche Nutzungskontexte: **Mitglied (H2O)**,
**Gerätehaus (iPad)** und **Verwaltung**. Dieselbe zugrundeliegende Fachlogik
verwenden, statt separate Doppelimplementierungen aufzubauen.

## Priorisierte Arbeitspakete

| Nr. / Rang | Bereich | Konkretes Ergebnis | Abnahme |
| --- | --- | --- | --- |
| P0.1 Kritisch | Schreibvorgänge & Synchronisation | Speichern, Wiederholen, Korrigieren und Löschen erhalten nachvollziehbare, eindeutige Zustände | Netzunterbrechung und Wiederholung erzeugen keine stillen Duplikate; UI zeigt gespeichert/ausstehend/Fehler |
| P0.2 Kritisch | Mitgliederaustritt & Rollen | Alle relevanten Geräte-, Link-, Gruppenführer-, Admin- und Worker-Rechte nachvollziehbar sperren | Entfernter Account kann über alten Link oder gespeicherten Zugang keine neuen geschützten Änderungen ausführen |
| P0.3 Kritisch | Datenfluss Termin → Historie → Statistik | IDs und fachliche Zustände kartieren, Inkonsistenzen lokalisieren und ein einheitliches Modell **planen** | Korrektur ändert nachvollziehbar den gültigen Datensatz; keine Doppelzählung |
| P0.4 Kritisch | Plausibilitätsprüfung vor Abschluss | Vor dem endgültigen Abschluss von Einsatz, Probe und Sonderprobe fachlich relevante Pflichtfelder, Teilnehmerzuordnung, Zeiten und widersprüchliche Zustände prüfen; Fehler blockieren, Hinweise bewusst bestätigbar machen | Testfälle für fehlende Angaben, Zeitkonflikte, doppelte Personen, Korrektur und erneuten Abschluss; kein stiller Datenverlust |
| P1.1 Hoch | Gerätehaus-Workflow | Proben, Einsätze und Sonderfälle in konsistenten Schritten mit eindeutigem Abschluss | Schrittwechsel, Abbruch, Korrektur und Wiederaufnahme auf iPad nachvollziehbar |
| P1.2 Hoch | Handy-Navigation | Termine und Rückmeldung zuerst; Nachweise und Mein Deckel ohne unnötige Umwege | iPhone/Android: wichtigste Aktion ohne Suche erreichbar; kein verdeckter Button |
| P1.3 Hoch | Admin-Systemzustand | Verbindungszustände für OneDrive/SharePoint, Cloudflare, Kalender und Push getrennt anzeigen | Störungen klar zuordnen; keine Geheimnisse in Diagnoseausgaben |
| P1.4 Hoch | Code-Konsolidierung | Startseitige nachträgliche DOM-Umbauten und unklare Zuständigkeiten gezielt auflösen | Verhalten und Oberflächen bleiben funktional gleich, Regressionstests bestehen |
| P2.1 Mittel | Persönlicher Überblick | „Mein nächster Termin“, Rückmeldungen und fällige Nachweise zusammenfassen | Rollen- und datenschutzgerechte Darstellung |
| P2.2 Mittel | Dokumentation / Betrieb | Aktiven Datenmodus, Rechte, Deploy-/Rollback-Schritte einmalig dokumentieren | Neue Änderungen können ohne Gesamtrecherche eingeordnet werden |

## Abhängigkeiten und sichere Reihenfolge

1. **Jetzt (reine Vorbereitung):** `AGENTS.md`, Projektkarte, Work-Leitfaden,
   fokussierter Testbefehl und GitHub-PR-Workflow. Keine fachlichen Daten ändern.
2. **Bestandsaufnahme der kritischen Datenflüsse:** eine konkrete Beispielkette
   Termin erstellen → antworten → am iPad übernehmen → abschließen → korrigieren
   → Historie/Statistik prüfen. Parallel Rechte-/Austrittsfälle kartieren.
3. **Kernfunktionen stabilisieren (P0):** einschließlich Abschluss-Plausibilitätsprüfung, isolierte PRs, Regressionstests,
   Versionierung/Migration bei Bedarf mit sicherem Rückfallplan.
4. **Bedienung verschlanken (P1):** drei Nutzungskontexte, Startansichten,
   Korrekturwege und zentralen Status verbessern, ohne unnötige Datenumbauten.
5. **Langfristig (P2):** persönlichen Überblick und Dokumentation konsolidieren.

## Entscheidungsfragen vor P0-Arbeit

- Welche Datensätze sind derzeit in OneDrive/SharePoint verbindlich,
  welche in D1, welche lokal nur vorgemerkt? In jedem Modul explizit prüfen.
- Welche stabilen Identifikatoren existieren für Termin, Teilnehmermeldung,
  Erfassung, Bericht und Korrektur? Keine Migration ohne vollständige Inventur.
- Wie werden alte Links, Browser-Sitzungen, Push-Geräte und Rechte beim
  Mitgliederaustritt tatsächlich widerrufen?
- Was passiert bei verloren gegangener Serverantwort, paralleler Buchung und
  Offline-/Cache-Zustand?
- Welche kritischen Vorgänge können mit künstlichen Daten und getrennten
  Testkonten praktisch geprüft werden?

## Vorgehensweise für jedes Paket

Ein Paket = ein Feature-Branch + präzise Akzeptanzkriterien + passende lokale
Tests + vollständige Pull-Request-CI + erforderliche echte Gerätetests.
Vor Produktiv-Merge und vor Worker-Deploy konkrete Freigabe einholen.
Nach Produktivänderungen App-Release und Cloudflare-Deployment unabhängig
verifizieren und die Rückfallmöglichkeit dokumentieren.

Nicht eigenmächtig Datenmengen migrieren, bestehende alte Datenschemata löschen,
PINs/Secrets verschieben oder Korrekturdateien überschreiben.

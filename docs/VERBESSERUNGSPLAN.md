# Gemeinsamer Verbesserungsplan – FFW Wasser / H2O Portal

Stand: 21.10.2026. Diese Punkte sind **Vorhaben, keine bereits implementierten
oder bestätigten Fehlerkorrekturen**. Zuerst separat prüfen und dann nach
Priorität gemeinsam freigeben. Betrieb `main` und Cloudflare unangetastet lassen,
solange nur vorbereitet wird.

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

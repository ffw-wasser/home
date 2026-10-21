# Gemeinsamer Entwicklungsablauf – Work-Kontingent bewusst einsetzen

Ziel: weniger wiederholte Recherche durch ChatGPT Work, **ohne** Sicherheits-,
Datenqualitäts- oder Produktivprüfungen pauschal zu streichen.
Es gibt keine garantierte prozentuale Kontingenteinsparung.

## 1. Gemeinsam planen, einmal umsetzen

- Anforderungen zunächst im normalen Chat sammeln und priorisieren:
  Was soll sich für welches Gerät / welche Rolle ändern?
- Ein Arbeitspaket enthält idealerweise Änderungen aus **einem** Fachbereich
  mit 3–6 überprüfbaren Akzeptanzkriterien.
- Vor Work-Auftrag festhalten: Ausgangsversion, betroffene Bildschirme/Funktionen,
  erwartetes Ergebnis, explizite Nicht-Ziele, Risiko und Freigabe zum Deploy.
- Größere Umstrukturierungen oder Datenmigrationen als eigenen Auftrag behandeln.
  Unabhängige Änderungen nicht blind zusammenwerfen, nur um einen Aufruf zu sparen.
- Work liest zuerst `AGENTS.md` und `docs/PROJEKTKARTE.md`, dann nur die
  relevanten Dateien. Bei unbekannter Ursache darf Work die Suche gezielt erweitern.

## 2. Aufgaben nach Risiko

| Stufe | Beispiele | Prüfweg |
| --- | --- | --- |
| Klein | Farbe, Beschriftung, Abstand, einzelne Ansicht | Betroffene Dateien + relevante Tests; vollständige CI vor Merge |
| Mittel | Termininteraktionen, Korrekturschritte, lokales Speichern | Fachmodule + Abhängigkeiten + Regressionstests; vollständige CI vor Merge; passende Gerätetests |
| Kritisch | Mitgliederrechte, WhatsApp-Linkberechtigungen, Authentifizierung, D1/OneDrive, Zahlungen, Migration | Datenfluss/Bedrohungen untersuchen, Cross-Modul-Tests, vollständige CI, echte Integrations-/Rückfalltests; Freigabe vor Deploy |

Die Einteilung optimiert die **Reihenfolge** der Prüfungen, nicht die Pflicht zu
sicheren Änderungen. Schlägt ein Test fehl, zuerst den Fehler untersuchen.

## 3. Lokale Befehle und GitHub Actions

```bash
# Verfügbare fachliche Testgruppen und Anzahl anzeigen:
node scripts/run-focused-tests.cjs --list

# Nur einschlägige Tests in der ersten Schleife:
node scripts/run-focused-tests.cjs kalender
node scripts/run-focused-tests.cjs einsatz historie

# Vor/bei kritischen Änderungen oder CI-Ausfall zusätzlich:
node scripts/check-syntax.cjs
node --test tests/*.test.cjs

# Bei Worker-Änderungen Quellmodule bündeln:
node cloudflare/push/build.cjs

# Bei echter Auslieferung Release-/Cache-Referenzen aktualisieren:
node scripts/update-release.cjs
```

Der GitHub-Workflow `.github/workflows/application-tests.yml` prüft nach
Pull-Request-Eröffnung den vollständigen Teststand, Syntax, Worker-Bundle sowie
Release-Konsistenz. Er nutzt GitHub Actions statt Work-Rechenzeit.
**Wichtig:** CI startet zwar auf Pull Requests, blockiert einen Merge aber nur
dann technisch, wenn eine passende Branch-Schutzregel / Ruleset aktiviert ist.
`main`-Push und erfolgreicher CI-Lauf beweisen **kein** erfolgreiches Cloudflare-Deployment.

## 4. Freigabe und Veröffentlichung

1. Feature-/Fix-Branch aus dem aktuellen `main` anlegen.
2. Gezielte Anpassungen inklusive Regressionstests vornehmen.
3. Relevante Tests ausführen und Draft-PR anlegen.
4. Vollständige GitHub-CI abwarten, Prüflücken nennen und bei Bedarf reale
   iPhone-/Android-/iPad- sowie Microsoft/Cloudflare-Abläufe testen.
5. Erst nach expliziter Freigabe in `main` übernehmen und notwendige
   Deployments durchführen. Tatsächlichen Release- und Worker-Stand getrennt bestätigen.
6. Änderungen in einem kurzen Abschlussbericht zusammenfassen.

Für rein dokumentarische Arbeiten wird keine produktive App-Version erhöht.

## 5. Wiederverwendbare Work-Aufträge

### Kleiner bis mittlerer Auftrag

> Arbeite in `ffw-wasser/home` auf einem Feature-/Fix-Branch.
> Lies `AGENTS.md` und `docs/PROJEKTKARTE.md`; untersuche zunächst nur
> die relevanten Module und direkten Abhängigkeiten. Ziel: [konkrete Änderung].
> Fertig, wenn: [1–3 überprüfbare Kriterien]. Nicht ändern: [Nicht-Ziele].
> Verwende bestehende Logik und füge passende Regressionstests hinzu.
> Starte relevante Testgruppen mit `scripts/run-focused-tests.cjs`,
> erstelle einen Draft-PR und nutze die vollständige GitHub-CI.
> Keine Veröffentlichung in `main` und kein produktiver Worker-Deploy
> ohne ausdrücklichen Auftrag. Antworte knapp mit PR, Tests, offenen Risiken.

### Kritischer Auftrag

> Untersuche die Änderung [Thema] in `ffw-wasser/home` ausdrücklich inklusive
> der Grenzen zwischen Browser, OneDrive/SharePoint, Cloudflare/D1 und
> Berechtigungen. Dokumentiere die betroffenen Datenflüsse, Fehlermodi,
> Sperrung/Rechte und Rückfallplan. Schreibe Regressionstests, führe
> Fach-/Quertests und vollständige CI aus. Prüfe reale Integrationen nur
> mit autorisierten Testkonten/-daten. Bereite einen Draft-PR vor; kein
> produktiver Deploy ohne Freigabe. Liste nicht verifizierte Punkte auf.

### Sammelauftrag für mehrere kleinere Verbesserungen

> Setze die folgenden aufeinander abgestimmten Anpassungen in einem Branch um:
> [Änderungen mit Kriterien]. Belasse unabhängige Module unverändert,
> außer direkte Abhängigkeiten erfordern es. Keine neue Vollanalyse ohne
> konkreten Anlass. Nach passenden Tests Draft-PR und CI. Melde nur
> blockierende Fragen; dokumentiere Entscheidungen und Restprüfungen.

## 6. Kurze Übergabe statt wiederholter Projektanalyse

Am Ende jedes Work-Auftrags:
- Ausgangs-/Ziel-Branch, Commit oder PR;
- geänderte Module, knapp zusammengefasst;
- lokal ausgeführte Tests und **tatsächlich beobachteter** CI-Status;
- ungeprüfte Geräte-/Cloud-Abläufe, Datenrisiken und Rückfallmöglichkeit;
- ob `main` und produktive Worker **unverändert** oder veröffentlicht sind.

So kann die nächste Arbeit an klaren Dateipfaden und einem überprüfbaren
Status anknüpfen. Wer einen offenen PR weiterbearbeitet, liest zuerst dessen Diff
und CI-Bericht, statt die gesamte Anwendung neu zu inventarisieren.

# Hintergrundlauf: Ressourcen und D1-Fehler

Die gemeldeten Vorfälle vom 22.10.2026 um 14:11 und 14:18 Uhr deutscher Zeit
betreffen `scheduled`, also den automatischen Kalender-/Push-/Geburtstagslauf.
Sie stammen aus der Zeit vor Veröffentlichung von PR #68. Manuelle
WhatsApp-Nachrichten werden von diesem Hintergrundlauf nicht verschickt.

`exceededCpu` beendet den betroffenen Lauf wegen der CPU-Grenze. Im Workers-Free-Tarif
beträgt sie laut Cloudflare 10 ms pro Cron-Aufruf. Netzwerk- und Datenbankwartezeit
zählen nicht als CPU-Zeit. Das Protokoll allein identifiziert keine einzelne teure
Funktion und beweist weder einen dauerhaften Ausfall noch Datenverlust.

Diese gezielte Entlastung verändert weder den Minutentakt noch Versandregeln:

- Die bereits gelesene Konfiguration wird im selben Lauf an den Kalenderabruf
  übergeben. Bei einem neuen Google-Abruf bleibt die erneute Prüfung auf einen
  zwischenzeitlichen Kalenderwechsel erhalten.
- Ein Berlin-Datumsformatierer wird je Isolate wiederverwendet statt für jeden
  Geburtstag neu erzeugt.
- Ohne zugeordneten Geburtstag am heutigen Berliner Tag entfallen vier D1-Leseabfragen
  und die zugehörige Entschlüsselung. Bestehende Transaktions-/Dublettensicherungen
  für echte Geburtstagsgutschriften bleiben unverändert.

Der separate `D1_ERROR: internal error` entstand beim Lesen von `portal_config`.
Seine genaue Ursache ist anhand der Cloudflare-Referenz nicht bestimmbar. Keine
Datenbanklöschung, keine Tokenänderung, kein kostenpflichtiges Upgrade und keine
blinde Wiederholung des gesamten Hintergrundlaufs werden vorgenommen. Letzteres
könnte insbesondere einen unklar ausgegangenen Push-Versand doppelt ausführen.
Fehler bleiben sichtbar; der nächste reguläre Cron-Aufruf versucht die Arbeit mit
den bestehenden Wiederholungs- und Buchungssicherungen erneut.

## Prüfen nach Veröffentlichung

Produktions-Build und `/health`-Quellfingerabdruck kontrollieren. Anschließend in
Cloudflare neue `scheduled`-Aufrufe nach der Veröffentlichung prüfen: CPU-Verbrauch,
Ergebnis und gegebenenfalls D1-Fehlerreferenz. Insbesondere einen frischen
Kalenderabruf und einen anstehenden Push-/Geburtstagslauf beobachten. Lokale Tests
belegen die eingesparten Operationen und unveränderte Fachregeln, aber nicht die
Einhaltung des produktiven CPU-Limits bei jeder Kalendergröße. Bleiben CPU-Abbrüche,
sind Messdaten und eine weitergehende Aufteilung der Arbeit erforderlich.

Quellen:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/observability/debug-d1/

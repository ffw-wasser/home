# Persönliche Monats-Challenge aktivieren

Gegeneinander ist durch Einzelrunden ersetzt. Jede Person wählt eine Kategorie
und beantwortet sieben zufällige Themen passend zu ihrer Ausbildungsstufe.
Ab fünf richtigen Antworten gibt es den im Adminbereich festgelegten Monatsbonus.

## Update des bestehenden Dienstes

1. Cloudflare → Workers & Pages → feuerwehr-wasser-deckel-push → Edit code.
2. Den vollständigen Inhalt der aktuellen **worker.bundle.js** einsetzen und
   **Deploy** wählen. DB-Bindung und Secrets beibehalten.
3. /health muss zusätzlich **challengeSoloVersion: 1** anzeigen.
   Für dieses Update sind keine neuen Tabellen oder SQL-Befehle erforderlich.
   Die bereits eingerichteten challenge_pool und challenge_games werden verwendet.
4. App neu laden → Getränke → Verwaltung → Fragen & Antworten.
5. Die gewünschte Anzahl ganzer Treuepunkte (1–100) unter **Monatsbonus** speichern.
   Ohne diese Einstellung startet keine gewertete Runde.
6. **Geprüfte Fragen in den Spieldienst übertragen** wählen. Die Verwaltung
   zeigt an, wenn der veröffentlichte Fragenstand von OneDrive abweicht.
   Die Freigabe in OneDrive allein aktualisiert den Spieldienst noch nicht.

## Bedienung

Im persönlichen Handy-Deckel steht die Challenge direkt nach den Treuepunkten:
Kategorie wählen → Meine 7 Fragen starten → Antworten antippen.
Die Stufe wird automatisch aus dem Mitgliederprofil übernommen:
GF → Gruppenführer; ATF/WTF/STF → Truppführer; ATM/WTM/STM → Truppmann.
Ohne übertragene passende Profilstufe muss die Person ihre Stufe auswählen.

Für eine Kategorie werden sieben verschiedene freigegebene Themen benötigt.
GF-Fragen haben für GF Vorrang vor allgemeinen Grundlagen (ALL). Fragen anderer
Stufen werden nicht verwendet. Fragen, Lösungen und Bonus werden beim Start
festgehalten; spätere Änderungen gelten für neu gestartete Monatsrunden.

## Monat und Buchung

Ein gewerteter Versuch je Mitglied und Kalendermonat in Europe/Berlin, unabhängig
von Kategorie, Gerät oder Handyzugang. Ein begonnenes Spiel läuft 30 Minuten.
Es lässt sich auf einem anderen berechtigten Handy fortsetzen. Abbruch/Ablauf,
weniger als fünf richtige Antworten und Kontoreset bringen keine Treuepunkte.
Ein neuer gewerteter Versuch ist im nächsten Kalendermonat möglich.

Der Dienst vergibt den Bonus beim siebten gespeicherten Ergebnis. Ergebnis und
Treuepunkte werden gemeinsam mit Versionsprüfung in einer D1-Transaktion
bestätigt. Dieselbe Antwort-ID wird bei Verbindungsfehlern erneut geprüft.
Die monatliche Runde bleibt auch nach einem Kontoreset gespeichert und
verhindert einen zusätzlichen Monatsversuch. Ein alter Startauftrag erzeugt
nach dem Monatswechsel keine neue Runde ohne erneuten bewussten Start.

Neue Einträge haben type challenge-reward und Kontoschema 9. Das Feld cents
enthält bei dieser Art **Unterpunkte**, keine Euro: 150 Einheiten = 1 Treuepunkt.
Die Einträge werden ausdrücklich als Treuepunkte dargestellt und ändern weder
Schulden noch Vorauszahlung, Getränkestatistik oder Zahlungsfortschritt.
Treuepunkte können über die vorhandene Getränke-Einlösung genutzt werden.

Neue Duelle und weitere Antworten in früheren Duellen sind gesperrt. Noch nicht
abgerechnete alte Duelle werden beim Abruf beendet, ohne Schuldenübertragung.
Bereits bestätigte frühere Duellbuchungen bleiben als historische Einträge
unverändert lesbar und werden nicht rückwirkend storniert.

Fragen und Lösungen bleiben privat in OneDrive und verschlüsselt im Spieldienst.
Das Update veröffentlicht keine persönlichen Fragen oder Kontodaten in GitHub.

# Getränkeprüfung · 10. Oktober 2026

## Änderungen

- Die Hauptansicht zeigt große Namenskarten mit Suche. Erst ein Klick öffnet das persönliche Eingabemenü. Die Übersicht enthält keine Getränke- oder Bezahlbuttons.
- Zurück zu allen Mitgliedern erhält offene Vormerkungen und markiert das Mitglied; eine freiwillige PIN wird beim erneuten Öffnen wieder geprüft.

- Bier und Wein werden weiterhin vorgemerkt. OK direkt auf der Karte speichert nur dieses Mitglied.
- Die Sammelbestätigung liegt im normalen Seitenfluss am Ende der Karten. Kein schwebendes Fenster nach dem Antippen.
- Nach Eingabe, Speicherung, PIN-Rückkehr und abgeschlossener Zahlung wird dieselbe Karte fokussiert. Die feste Navigation wird beim Scrollen berücksichtigt.
- Preis und €-Zeichen bleiben gemeinsam in einer Zeile. Bei wenig Platz darf der gesamte Preis unter den Getränkenamen umbrechen.
- Admin-Stornos werden bereits am Eingang der Mitglieder-Sammelbuchung abgewiesen, unabhängig vom Datum.

## Treuepunkte: Ergebnis und abgesicherte Einschränkung

Die normalen Abläufe sind konsistent: bestätigte Geldzahlungen einschließlich Teil- und Vorauszahlungen zählen. Getränkekäufe und Punkteeinlösungen erzeugen keine Punkte. Einlösen reduziert Punkte, nicht vorhandenes Geld. Wiederholungen nach verlorenen Speicherantworten buchen nicht doppelt. Stornos direkt punktgebender Zahlungen nehmen die zugeordneten Punkte zurück; bereits ausgegebene Punkte können dadurch negativ werden.

**Bestehender Rechenfehler bei Storno einer früheren Teilzahlung.** Im Modell reproduziert mit dem Standardprogramm:

1. 15 € einzahlen: keine Punkte.
2. Weitere 15 € einzahlen: 2 Punkte.
3. Die erste Einzahlung stornieren: aktuell bleiben 2 Punkte erhalten, obwohl nur 15 € Zahlung bestehen.

Außerdem zeigt der Fortschritt dann „noch 30 €“ an. Wirtschaftlich wären nach der Neuberechnung 0 Punkte und noch 15 € bis zum nächsten Ziel plausibel. Ursache: Punkte sind ausschließlich der Zahlung zugeordnet, die die Schwelle überschritten hat. Frühere Teilzahlungen werden bei deren Storno nicht in die Rücknahme der späteren Punktzuteilung einbezogen.

Neue Stornos, die diese Finanzierungslücke vergrößern, werden jetzt vor dem Schreiben abgewiesen und erklärt. Es wird nichts gespeichert; der Dialog kann geschlossen werden. Wenn beide Zahlungen tatsächlich fehlerhaft sind, funktioniert ihre gemeinsame Bereinigung weiterhin atomar und wiederholungssicher. Einzelstornos dieses Sonderfalls bleiben eine funktionale Einschränkung. Bestehende Historien werden nicht umgerechnet. Eine Korrektur muss auch bestehende Einlösungen und frühere Programmänderungen berücksichtigen; ein bloßes nachträgliches Ändern der Berechnungsfunktion kann vorhandene Kontohistorien unlesbar machen. Vor einer vollständigen Freigabe der Stornologik ist eine kompatible Korrekturbuchung bzw. Migration erforderlich.

## Daten zurücksetzen / OneDrive

Die App verwendet OneDrive bereits als gemeinsame Ablage:

- `feuerwehr-wasser-daten.json`: allgemeine App-Daten.
- `Getraenke`: Konten, Buchungen, Punkteinstellungen und Handy-Zugangsdaten.
- `Berichte`: historische Berichte, die erneut in Historie und Statistik geladen werden können.

Eine vollständige Sicherung muss den gesamten konfigurierten Datenordner enthalten. Das normale JSON-App-Backup enthält keine Getränkekonten.

Nur Getränke zurückzusetzen und die gesamte Anwendung zurückzusetzen sind unterschiedliche Vorgänge. Für einen Getränkeneustart müssen Mitgliedskennungen erhalten bleiben; für einen vollständigen Neustart sind auch App-Daten und Berichte zu berücksichtigen. Neue leere OneDrive-Ordner allein reichen nicht: die Synchronisierung kann vorhandene lokale App-Daten wieder hineinschreiben. Vor einem Reset müssen sämtliche aktiven Clients geschlossen bzw. abgemeldet, laufende Schreibvorgänge beendet und lokale Daten kontrolliert geleert werden. Alte veröffentlichte Handy-Deckel können ebenfalls noch einen vorherigen Stand zeigen und benötigen eine gesonderte Aktualisierung bzw. Sperrung.

Ein sicherer Admin-Ablauf sollte zuerst eine überprüfte Sicherung erstellen, dann den Umfang anzeigen und erst nach ausdrücklicher Bestätigung zurücksetzen. Ein solcher vollständiger Reset-Assistent ist derzeit nicht vorhanden. Es wurden keine produktiven Daten gelöscht oder verschoben.

## Bedienbarkeit

Der häufigste Ablauf ist jetzt räumlich zusammenhängend: Mitglied suchen → Namen wählen → Bier/Wein antippen → Vormerkung prüfen → OK. Große Schaltflächen und die sichtbare Rückmeldung „Gespeichert ✓“ helfen auf dem gemeinsam genutzten Tablet. Die getrennten Anzeigen für Schulden, eingezahlten Betrag und Treuepunkte vermeiden eine Vermischung.

Weiterhin verbesserungswürdig:

- Die Namensübersicht ist deutlich kompakter. Nur das geöffnete Eingabemenü zeigt alle Optionen. Die zusätzliche Auswahl kostet einen Klick, verhindert aber versehentliche Buchungen bei anderen Mitgliedern.
- Vormerkungen sperren Bezahlen und Kontoöffnen nur noch beim betroffenen Mitglied. Andere Mitglieder können ihre eigenen Vorgänge fortsetzen.
- Die globale Sammelbestätigung ist am Seitenende weniger schnell erreichbar. Für normale Einzelbuchungen übernimmt das neue Karten-OK diese Aufgabe.
- Die Rücknahme ist jetzt eindeutig beschriftet: „Letzte Vormerkung entfernen“ oder „Gespeicherten Eintrag zurücknehmen“.

## Prüfung

246 automatisierte Prüfungen bestanden. Lokale Browserprüfung mit synthetischen Mitgliedern in Edge bei 320, 375, 390, 430, 768 und 1280 Pixeln: Preis bleibt zusammen, kein horizontaler Seitenüberlauf, Fokus nach Speicherung korrekt, keine schwebende Sammelbestätigung. Kein Test auf einem echten iPhone und keine produktiven OneDrive-Buchungen.

## Ladeverhalten

Die Namensübersicht und deren Vorladen benötigen keinen Sammelabruf der Getränkekonten mehr. Das ausgewählte Konto wird frisch gelesen. Die Top-3-Liste liest die Konten erst beim Aufklappen; die gleichzeitigen OneDrive-Abrufe bleiben auf vier begrenzt. Eine Dateinamen-Tabelle ersetzt die wiederholte lineare Suche beim Sammelabruf. Die erneute Handy-Gesamtsynchronisierung bei jedem Öffnen entfällt; Buchungen stoßen weiterhin die Aktualisierung des betroffenen Kontos an.

Das Verhalten ist mit automatisierten Abrufzählungen geprüft. Absolute Ladezeiten über die produktive OneDrive-Verbindung wurden nicht gemessen und hängen weiterhin von Verbindung, Kontoanzahl und Historienumfang ab. Die freiwillige PIN schützt das persönliche Menü auch nach 60 Sekunden Inaktivität und beim Hintergrundwechsel; diese Fälle sind getestet.

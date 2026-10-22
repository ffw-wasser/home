# Halbautomatische WhatsApp-Terminerinnerungen

Vorbereitet auf `feature/whatsapp-term-reminders`, Basis main `114dcab`,
Release-Kandidat `2026.10.22.19`. Kein Merge und kein Deployment durch diesen Auftrag.

## Bedienung

- Gruppenführer: Termine → Rückmeldungen ansehen → Erinnern.
- Verwaltung: Rückmeldungen des ausgewählten Termins → Erinnern · WhatsApp.
- „Einzeln erinnern“ wählt nur eingeladene Mitglieder mit offenem oder unsicherem
  Status und freigegebenem WhatsApp-Kontakt vor. Zusagen und Entschuldigungen sind
  gesperrt. Kontakte ohne Freigabe/Nummer stehen in einer eigenen Gruppe.
- Nachricht bearbeiten, „Prüfen & WhatsApp öffnen“, in WhatsApp selbst senden,
  zurückkehren und manuell als bearbeitet markieren. Anschließend den nächsten
  offenen Empfänger vorbereiten. Öffnen, Kopieren und Teilen belegen keinen Versand.
- Ohne Nummer: Nachricht bearbeiten und nach erneuter Statusprüfung kopieren.
- „Gruppeninfo“ bietet kommende freigegebene Termine zur Mehrfachauswahl an.
  Eingeschränkte Termine sind abgewählt und erfordern eine ausdrückliche Warnbestätigung.
  Der generierte Text enthält keine Teilnehmerlisten oder Rückmeldestatus.
  Bearbeiten und über das native Teilen-Menü selbst an die gewünschte Gruppe senden.

## Kontakte, Berechtigungen und Datenschutz

In der bestehenden Mitgliederverwaltung wurde kein persönliches Telefonnummernfeld
gefunden. Die Verwaltung kann daher im Erinnerungsbereich beim Mitglied „Kontakt“
öffnen, eine internationale Nummer eintragen und die dokumentierte Einwilligung oder
sonstige zulässige Grundlage bestätigen. Das Häkchen ersetzt keine Einwilligungserhebung.
Eine leere Nummer löscht die Zuordnung; eine entfernte Freigabe sperrt die direkte Chatöffnung.
Die Prüfung ist syntaktisch; ob eine Nummer bei WhatsApp registriert ist, wird nicht abgefragt.

Die Zuordnung liegt ausschließlich im bestehenden verschlüsselten D1-Roster.
Der Mitgliederabgleich erhält sie; eine Mitgliederentfernung entfernt auch den Kontakt.
Konkurrierende Kontakt- und Rosteränderungen sind durch Snapshot- und Sequenzprüfung
geschützt. Keine neuen Datenbanktabellen, kein neuer Messaging-Dienst.
Vorname kommt aus dem bestehenden Mitgliederabgleich, alternativ lautet die Anrede „Hallo“.

Die neuen Endpunkte verwenden den vorhandenen Adminzugriff bzw. die Passkey-Sitzung
und prüfen die hinterlegte GF-Rolle sowie den Teilnehmerkreis serverseitig.
Vor jeder einzelnen Chatöffnung oder Textkopie werden Status und Berechtigung erneut
geprüft. Kalenderfreigaben werden aus der bestehenden Kalenderprojektion gelesen;
deren bisherige Cachefrist von bis zu fünf Minuten bleibt bestehen. Bei veraltetem
oder nicht verfügbarem Kalender wird die Vorbereitung gesperrt.
GF erhalten Telefonnummern nur für noch offene, zum Termin eingeladene Mitglieder
mit freigegebenem Kontakt. Persönliche Zugangsschlüssel werden nicht in Texte übernommen;
Links führen auf den bestehenden öffentlichen `termin.html?event=…`-Ablauf.

Fortschritt enthält nur Mitgliedskennungen und die Zustände geöffnet, abgewählt und
manuell bearbeitet, keine Namen, Nummern oder Nachrichtentexte. Er bleibt bis zu
24 Stunden im selben Browser-Tab (`sessionStorage`) erhalten. Geschlossene Tabs,
Browserbereinigung oder ein Gerätewechsel können ihn verlieren. „Neuen Durchgang
starten“ setzt ihn nach Warnung zurück. Geöffnete Nachrichten werden nicht automatisch
erneut angeboten; erneutes Öffnen verlangt eine Bestätigung. Es gibt keinen globalen
Versandschutz zwischen mehreren Bedienern/Geräten und keine Zustellbestätigung.
Textentwürfe werden nicht dauerhaft gespeichert.

## Umsetzung

- `portal-member.js` / `portal-admin.js`: Einstieg in vorhandenen Rückmeldungsansichten.
- `portal-reminders.js`: gemeinsamer Ablauf für beide Oberflächen, kein paralleler Kalender.
- `cloudflare/push/portal.js`: Kontaktzuordnung, Empfängerauswahl und aktuelle Prüfungen.
- HTML/CSS, Service Worker und Release-Dateien: Einbindung und mobile Darstellung.
- Worker-Bundle neu aus den festgelegten Abhängigkeiten erstellt.
- Bestehender `portal-whatsapp.js`-Anmelde-/Antwortablauf und Push-Versand bleiben unverändert.

## Prüfungen

- Fachtests Kalender, Cloudflare und Sicherheit: **295/295 bestanden**.
- JavaScript-Syntax: **211 Dateien, keine Fehler**.
- Neuer Browsertest: Auswahl, Statuswechsel vor Öffnen/Kopieren, Wiederaufnahme,
  manuelles Bearbeiten, Rollenfehler, Mehrfachtermine, Warnhinweis und editierter
  Gruppentext bei **320, 390, 412 und 768 Pixeln** bestanden.
- Bestehender Passkey-Browsertest: Anmeldung, WhatsApp mit/ohne bestehende Sitzung,
  Rückmeldung, spätere Korrektur, Reload und Wiederherstellung bestanden.
- Worker- und Passkey-Bundle stimmen mit dem reproduzierten Build überein.
- Vollständige lokale Suite: **742/746 bestanden**. Vier Bestandsprüfungen für
  Assets/Icons/Release scheitern ausschließlich an lokal nicht verfügbaren binären
  Repository-Dateien. Diese Dateien werden im PR nicht verändert oder gelöscht.
  Die vollständige Suite und Release-Konsistenz werden zusätzlich in GitHub Actions geprüft.
- Neue Servertests decken außerdem Rollenentzug, Terminabwahl, Nummernprüfung,
  verschlüsselte Speicherung, Kontaktlöschung, Erhalt beim Mitgliederabgleich,
  entfernte Mitglieder und fehlgeschlagene Speichertransaktionen ab.

Nicht praktisch geprüft: installierte WhatsApp-App auf realem iPhone/Android,
Betriebssystemwechsel zurück in die PWA, tatsächlicher Versand, produktive D1-Instanz
und Microsoft-/OneDrive-Synchronisierung mit echten Mitgliedern. Browserprüfungen
verwenden ausschließlich künstliche Daten und senden keine Nachrichten.

## Veröffentlichung nach Freigabe

1. PR und aktuellen GitHub-Actions-Status prüfen; nur bei grünen Pflichtprüfungen mergen.
2. Aktualisierten Cloudflare-Worker bereitstellen und dessen Fingerprint prüfen;
   anschließend die passende Portal-Version ausliefern/aktualisieren.
3. Mitgliederabgleich für Vornamen ausführen und freigegebene Kontakte hinterlegen.
4. Mit einem berechtigten Testmitglied auf iPhone und Android Chatöffnung,
   Rückkehr, manuelles Bearbeiten sowie Gruppeninfo prüfen.

Es wurde keine WhatsApp-Business-API eingerichtet und kein kostenpflichtiger Dienst
hinzugefügt. Alle Nachrichten werden weiterhin ausschließlich manuell versandt.

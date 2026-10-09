# Bedienungsverbesserungen vom 9. Oktober 2026

Die folgenden Änderungen setzen die priorisierte Durchsicht der Anwendung um. Die Geschäftsregeln für Striche, Barzahlung, manuelle PayPal-Eingänge, Bonus und private OneDrive-Ablage bleiben erhalten.

| Bereich | Umsetzung |
|---|---|
| Hilfetexte | Aktuelle PayPal-Prüfung durch die Verwaltung, Einstellungswege und neue Speicheraktionen beschrieben. |
| Speicherstatus | „Noch nicht gespeichert“, Geräte-/Sitzungsspeicherung und bestätigte OneDrive-Speicherung unterschieden; passende Verbindungsaktion angeboten. |
| Tastatur | Textfelder und editierbare Textbereiche in Dialogen und auf Seiten berücksichtigen den sichtbaren Viewport und dessen Versatz. |
| Laufender Termin | Terminart, Datum, übernommene Personen und ausstehende Markierungen zusammengefasst; fortsetzen direkt möglich. |
| Anwesenheit | Anzahl am Übernehmen-Button; Rücknahme der letzten ungespeicherten Markierung. Übernommene Datensätze werden dadurch nicht zurückgenommen. |
| Abschluss | Dokumentseiten in der Übersicht; direkte Rückkehr zu Datum, Thema, Anwesenheit und Einsatzangaben. |
| Paketablage | Erstellt / an Teilen übergeben / Download gestartet ausdrücklich getrennt von der durch den Benutzer geprüften Ablage; zuletzt erstelltes Paket im Arbeitsspeicher erneut ausgebbar. |
| Getränkekonto | PIN und Handyzugang unter „Mein Konto“; gebuchter Deckel und neue Striche getrennt bezeichnet. |
| PayPal | Mitglied bestätigt keinen Zahlungseingang. Offener Betrag sinkt nach administrativer Buchung; kein künstlicher Status „Zahlung ausstehend“. |
| Getränkeverwaltung | Offene Gesamtsumme, Anzahl, Namenssuche, Betrag-/Namenssortierung und letzte bestätigte Zahlungen. |
| Verbindung | Direkte OneDrive-Aktion; erneute Veröffentlichung des Handy-Deckels nach entsprechendem Veröffentlichungsfehler. |
| Handy-Deckel | Veröffentlichungsstand direkt am Betrag; Prüfung, neuer Stand, unveränderter Stand und Abruffehler unterschieden. |
| Erinnerungen | Neutrale Vorschau; Geräte- und letzter Versandstatus nach expliziter Prüfung auch in der Mitgliederzeile. Annahme durch Push-Dienst bleibt von Zustellung unterschieden. |
| Mitglieder | Gemeinsame Speicheraktion mit vorheriger PIN-Validierung und getrennten Ergebnissen; Einzelspeicherung bleibt möglich. |
| Historie | Terminart und Zeitraum ergänzen Suche; aufgeklappte Gruppen und Rückkehrposition bei Vorschau/Korrektur erhalten. |
| Taktik | Geeignete Zielplätze einschließlich Gegenprüfung beim Tausch markiert; konkrete Rückmeldung. Abgelehnte ATÜ-Wechsel verändern die bestehende Besetzung nicht. |
| Statistik | Mehrere Detailauswertungen als verständliche Fragen bezeichnet; zentrale Kennzahlen bleiben zuerst sichtbar. |
| Einstellungen / Backup | Verbindungsstatus aktualisiert; Einrichtungsassistent führt direkt zu den Bereichen, beginnend mit OneDrive. Backup-Bestätigung wird nicht mehr aus einer Synchronisierung abgeleitet. Sicherungsumfang und zusätzliche Getränke-Sicherung bleiben sichtbar. |

## Prüfung

- 120 automatisierte Tests bestanden, einschließlich zusätzlicher Prüfungen für abgelehnte und zulässige ATÜ-Wechsel.
- Browserprüfung mit simulierten OneDrive-, GitHub- und Push-Diensten: PIN-Validierung, kombinierte Speicherung samt Teilfehler, Anwesenheitsrücknahme, echte ZIP-Erstellung, Abschlusskorrektur, Filter, Sicherung und Navigation.
- Bar-/PayPal-Buchungen, Dublettenschutz, Teil- und Vollzahlung, verschlüsselte Handyansicht und QR-Rotation geprüft; ausschließlich Testkonten.
- Tastatur-Viewport bei unterschiedlichen Höhen und Versätzen geprüft; Verwaltungsansichten auf iPhone-/iPad-Breiten geprüft.
- Keine echten Zahlungen, Nachrichten oder privaten OneDrive-Dateien im Test verändert. Keine kostenpflichtige Infrastruktur eingerichtet.

## Betriebsgrenzen

Die tatsächliche Bildschirmtastatur und Benachrichtigungsanzeige sind auf einem echten iPad beziehungsweise iPhone zusätzlich zu prüfen. Der Browser kann nach Teilen oder Download keine tatsächliche OneDrive-Ablage beweisen; die App zeigt dies ausdrücklich an. Das erneut ausgebbare Terminpaket bleibt nur bis zum Neuladen im Arbeitsspeicher und wird beim OneDrive-Abmelden verworfen. Eine echte Push-Erinnerung benötigt weiterhin einen eingerichteten Versanddienst und freiwillig angemeldete Geräte; diese Änderung richtet keinen Cloud-Dienst ein.

## Versionsbereinigung

Release 2026.10.09.1: gemeinsame Versionsquelle in `app-release.json`, einheitliche Build-URLs und Offline-Cache. Die Versionskonsistenz wird automatisch geprüft. QR-Generator vom offiziellen Release js2.0.4 übernommen; lokale Lizenz aktualisiert. Überholte DOM-Suche nach Versionsbezeichnungen, widersprüchlicher Service-Worker-Kommentar und doppelte Status-Overrides entfernt. Hilfetexte und README auf administrative PayPal-Buchung und aktuelle Einstellungswege angepasst. Daten- und Backup-Schemata bleiben unabhängig vom App-Release kompatibel.

## Korrektur des Termin-Rückwegs

Release 2026.10.09.2: Der Kopfbutton „Termin“ öffnet wieder Schritt 1 (Terminart auswählen). Eine reine Terminartauswahl erzeugt keine sichtbare Fortsetzen-Karte. Bereits übernommene Anmeldungen, ungespeicherte Markierungen und Berichtsentwürfe bleiben erhalten und können über „Termin fortsetzen“ wieder geöffnet werden. 123 automatisierte Tests bestanden; alle fünf Terminarten im Browser bei 390 und 1024 Pixeln geprüft, einschließlich Auswahlabbruch, Rückweg und Fortsetzen ohne Verlust des Entwurfs.

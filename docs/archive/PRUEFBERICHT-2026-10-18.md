# Plausibilitätsprüfung und Bereinigung

Prüfstand: 2026.10.18.12, auf Basis der veröffentlichten Version 2026.10.18.11.

## Behobene Befunde

- Der dynamische Handy-Manifest-Lader verwendete eine alte Buildkennung. Er wird jetzt durch die zentrale Release-Aktualisierung und die CI-Konsistenzprüfung erfasst. Ein Verhaltenstest prüft iPhone und das bestehende Android-Verhalten.
- Die Rückkehr nach Microsoft-Neuanmeldung kannte die drei Theaterziele nicht. Kasse, Auswertung und Verwaltung bleiben nun als Ziel erhalten. Aktuelle Kalender-, Historien- und Statistikansichten sind ebenfalls zugelassen; veraltete Ansichtskennungen wurden entfernt. Die bestehenden Prüfungen für Konto, Ordner und Ablaufzeit bleiben erhalten.
- Eine veraltete Kopplung zwischen Anwesenheitsaktionen und dem früheren Historien-Korrekturmodus wurde entfernt. Korrekturen verwenden bereits ihre eigene Ansicht.
- Zwei lokale Theater-Browserprüfungen wurden an die aktuellen Hauptansichts-Karten, Verwaltungsabschnitte, Artikelkarten und den ausdrücklichen Stornomodus angepasst. Sie verwenden ausschließlich künstliche Daten und abgefangene lokale Anfragen. Der Browserkanal kann mit QA_BROWSER gewählt werden; standardmäßig wird Playwright Chromium verwendet.
- Die CI-Syntaxprüfung erfasst jetzt alle JavaScript-Dateien in Anwendung, Worker, Tests und Wartungsskripten statt einer manuell ausgewählten Teilmenge.

## Ausgeführte Prüfungen

- Gesamte Testsuite: 589 Tests bestanden, keine fehlgeschlagenen oder übersprungenen Tests. Die Suite umfasst unter anderem Historienkorrekturen, Anwesenheit, Administration, Anmeldung und Rückkehrziele, Theaterverwaltung, Handybestellungen, Reservierungen, Wiederholungen, Buchungen und Datenkompatibilität.
- Syntax: 168 JavaScript-Dateien geprüft, keine Fehler.
- Lokale HTML-, CSS-, Manifest- und Dokumentverweise: bestehende Integritätstests bestanden.
- HTML-Kennungen: keine doppelten IDs in index.html oder deckel.html.
- Release-Aktualisierung erneut ausgeführt: unverändert und reproduzierbar.
- Cloudflare-Worker neu gebaut: Bundle unverändert gegenüber dem eingecheckten Stand.
- Git-Diff auf Whitespace-Fehler geprüft: keine Fehler.

## Prüfgrenzen

Die Browserprüfung konnte nicht starten: Die Playwright-Browserdatei fehlt in dieser Umgebung. Die aktualisierten Browserprüfungen sind daher nur syntaktisch geprüft, nicht erfolgreich im Browser ausgeführt. Layout, Touchbedienung, Bildschirmtastatur und reale iOS-/iPadOS-Installation sind dadurch nicht abschließend bestätigt.

Es wurden keine produktiven OneDrive-Daten oder Bestellungen verändert. Reale Microsoft-Anmeldung, Push-Zustellung und Zahlungsanbieter wurden nicht mit produktiven Konten durchlaufen. Die automatischen Prüfungen ersetzen diese Integrations- und Gerätetests nicht und sind kein Nachweis vollständiger Fehlerfreiheit.

Dieser Prüfstand ist lokal vorbereitet; seine Veröffentlichung ist nicht Bestandteil dieses Prüfnachweises.

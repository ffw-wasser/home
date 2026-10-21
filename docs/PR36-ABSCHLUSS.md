# PR #36 – WhatsApp-Passkeys und GF-Atemschutz

Release: 2026.10.21.12. Veröffentlichung vom Nutzer am 21.10.2026 beauftragt.

## Umsetzung

- Mehr → Push & WhatsApp: „WhatsApp-Zugang einrichten“ registriert einen persönlichen Passkey. Allgemeine H₂O-Anmeldung und Push bleiben unverändert. Browserverbindung ohne Passkey bleibt als Alternative erhalten.
- Gemeinsamer Terminlink: „Mit Passkey anmelden“, Name zur Kontrolle, ursprünglicher Termin bleibt ausgewählt. Rückmeldungen nutzen unverändert die vorhandene versionierte und idempotente Speicherung.
- SimpleWebAuthn Server 14.0.3 / Browser 13.3.0, esbuild 0.28.2; feste Versionen und Lockfile. Bibliotheken werden lokal gebündelt, ohne CDN zur Laufzeit. Lizenztexte liegen bei.
- RP-ID ffw-wasser.github.io; exakt erwartete HTTPS-Origin; verpflichtende Benutzerprüfung; kurzlebige, atomar verbrauchte Challenges; gespeicherter öffentlicher Schlüssel und geprüfte Signaturen; IP-begrenzte Anmeldeversuche ohne Klartext-IP-Speicherung.
- Registrierung ausschließlich mit dem bestehenden persönlichen H₂O-Kommandoberechtigungsnachweis und aktiver Mitgliedszuordnung. Dieser vorhandene Zugang bleibt der Vertrauensanker: Wer ihn besitzt, kann auch einen WhatsApp-Passkey registrieren. Kein bloßer Name, GF-Flag oder Gruppenterminlink reicht aus.
- Passkey-Sitzungen verwenden den bereits vorhandenen, auf Terminliste/Antwort und Sitzungsverlängerung beschränkten Browserzugang. Kein Zugriff auf Getränke, Nachweise, GF-Übersicht oder Administration.
- Zurücksetzen löscht alle WhatsApp-Schlüssel, offenen Registrierungen und Browser-Sitzungen atomar. Mitgliederaustritt entfernt Schlüssel und Sitzungen beim Abgleich; Änderung des Hauptzugangs blockiert die alte Revision bei jeder Anfrage.
- GF-Kachel Atemschutz: vorhandene geschützte Implementierung bleibt erhalten; Nachweise sind keine Einsatzfreigabe, veraltete Daten werden kenntlich gemacht.

## Daten und Betrieb

Neue D1-Tabellen werden additiv per CREATE TABLE IF NOT EXISTS eingerichtet: portal_passkeys, portal_passkey_state, portal_passkey_challenges, portal_passkey_limits. Keine bestehenden Buchungs-/Rückmeldungsdaten werden migriert. Keine produktiven Testdaten.

Öffentliche Schlüssel sind keine privaten Schlüssel. Biometrische Daten werden weder übertragen noch gespeichert. Die Mitgliedszuordnung bleibt über Alias/Revision an die geschützten bestehenden Daten gebunden. Alte Schlüsselrevisionen sind unwirksam; Zurücksetzen oder Mitgliederentfernung löscht sie.

Build: npm ci --ignore-scripts, dann node cloudflare/push/build.cjs. Cloudflare führt dies über scripts/prepare-worker.cjs aus. Node 24 ist für CI und Worker-Build vorgegeben. Bundle und Browserdatei werden reproduzierbar geprüft. Der Health-Endpunkt meldet passkeyVersion:1 sowie den Quellfingerabdruck. Ein erfolgreicher GitHub-Check allein bestätigt kein Cloudflare-Deployment.

Rückrollweg: Vorherigen Git-Stand/Worker deployen. Neue Tabellen bleiben dabei bestehen, alte APIs und bestehende Browserverbindungen sind kompatibel. Vollständiger Widerruf bleibt über den aktuellen WhatsApp-Reset möglich.

## Prüfung

- 692 automatisierte Tests erfolgreich, einschließlich echter RSA-WebAuthn-Signaturverifikation, falscher Origin/RP-ID, fehlender Benutzerprüfung, manipulierten Signaturen, Replay, Ablauf, Mitgliederaustritt, Zugangsrotation und Berechtigungsmatrix.
- JavaScript-Syntax: 184 Dateien, keine Fehler.
- Zusätzlicher Chromium-Test mit virtuellem Authenticator lokal erfolgreich; auch in GitHub CI eingerichtet: Registrierung, Anmeldung, Terminantwort, erneutes Öffnen, Widerruf und 320px Breite. Ausschließlich künstliche Daten in temporärer SQLite-Datenbank.
- Reale iPhone-/Android-/WhatsApp-Webview-Bedienung und biometrische Geräteabfragen sind hier nicht als geprüft bestätigt. Safari-/Chrome-Hinweise und die bestehende alternative Verbindung bleiben verfügbar.
- Keine eigenständige Datenschutzfreigabe durch diesen technischen Test. Der Zugriff ist auf serverseitig bestätigte GF und die vorhandenen minimalen Nachweise beschränkt.

Live-Veröffentlichung und CI-Ergebnis werden separat anhand des Commitstands und des laufenden Workers bestätigt.

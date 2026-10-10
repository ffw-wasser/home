# Manuelle Handy-Erinnerungen – kostenlose Einrichtung

Die App ist vorbereitet. Ohne eingerichteten Dienst findet kein Push-Versand statt.
**Nur Workers Free und D1 Free verwenden. Kein Paid-Upgrade aktivieren.**
Keine eigenen Domains, Cron-Jobs, Queues, kostenpflichtigen Add-ons oder Render-Ressourcen nötig.

## Einmalig durch den Administrator

1. Kostenloses Cloudflare-Konto erstellen/anmelden: https://dash.cloudflare.com/
2. Unter **Workers & Pages** einen Worker namens `feuerwehr-wasser-deckel-push` erstellen.
   Den vollständigen Inhalt von `worker.js` im Code-Editor übernehmen. Noch nicht mit realen Mitgliedern verwenden.
3. Unter **Storage & Databases → D1** eine Datenbank `deckel-push` erstellen.
   In deren SQL-Konsole den Inhalt von `schema.sql` ausführen.
4. Im Worker unter **Bindings** eine D1-Bindung namens **DB** auf diese Datenbank setzen.
5. Auf einem vertrauenswürdigen Computer mit Node.js ausführen:
   `node cloudflare/push/generate-secrets.cjs`
   Die Ausgabe enthält vier individuelle Werte. Niemals in Chat, GitHub oder öffentliche Dateien kopieren.
6. Unter **Settings → Variables and Secrets** diese vier Namen als Secrets hinterlegen:
   `ADMIN_TOKEN`, `INVITE_SECRET`, `VAPID_PRIVATE_JWK`, `VAPID_PUBLIC_KEY`.
   Worker veröffentlichen. Observability/Request-Logging deaktiviert lassen. Schlüssel danach sicher aufbewahren.
7. Im Browser `https://DEIN-WORKER.DEIN-KONTO.workers.dev/health` öffnen.
   Die Antwort muss `version: 1` und `publicKey` enthalten. Sonst zuerst Dienst/DB/Secrets prüfen.
8. Am Gerätehaus-iPad OneDrive verbinden und unter
   **Einstellungen → Getränkeverwaltung → Handy-Erinnerungen** die Worker-Adresse und den `ADMIN_TOKEN` eingeben.
   Nur am iPad eingeben, nicht hier im Chat. Die App prüft den Admin-Zugang und speichert ihn privat in OneDrive.
9. Erst einen echten Test mit einem eigenen offenen Testdeckel durchführen (iPhone und Android).
   Cloudflare-CPU-Verbrauch prüfen: Workers Free erlaubt aktuell 10 ms CPU pro Aufruf.
   Bei einer Überschreitung den Code optimieren; keinesfalls automatisch einen kostenpflichtigen Tarif wählen.

Alternativ CLI: Datenbank mit Wrangler erstellen, die erhaltene ID in `wrangler.jsonc` eintragen,
Schema mit `wrangler d1 execute deckel-push --remote --file=schema.sql` anlegen,
Secrets mit `wrangler secret put NAME` setzen und `wrangler deploy` ausführen.
Der Platzhalter für die Datenbank-ID muss vorher ersetzt werden.

## Mitglied

- Nach Freischaltung den persönlichen QR-Code am iPad noch einmal scannen. Der Kontostand-Zugang bleibt bestehen;
  der Link erhält zusätzlich eine zufällige Berechtigung ausschließlich für die Geräte-Anmeldung.
- Auf dem iPhone (iOS 16.4 oder neuer): **Teilen → Zum Home-Bildschirm** und dann das neue Symbol öffnen.
- **Erinnerungen erlauben** antippen und die Handy-Abfrage bestätigen.
- Durch diese freiwillige Aktivierung wird der persönliche Deckel-Link auf diesem Handy in IndexedDB gespeichert,
  damit Benachrichtigungen den richtigen Deckel öffnen können. Nicht auf einem fremden/geteilten Handy aktivieren.
- **Erinnerungen deaktivieren** meldet das Gerät ab und entfernt den lokal gespeicherten Link.
  Der Zugriff über ein vorhandenes Lesezeichen bleibt möglich. Gerätespeicher löschen entfernt ebenfalls den lokalen Zugang.
- Die Desktop/iPad-Anwendung wird durch diese Funktion nicht automatisch für Erinnerungen angemeldet.

## Manuell senden

**Offene Deckel & PayPal → Erinnerung vorbereiten → Handy-Erinnerung senden**.
Vor jedem Versand liest das iPad den offenen Betrag frisch aus OneDrive und veröffentlicht den aktuellen Deckel.
Ist der Betrag bezahlt, wird nicht versendet. Die Kontrolle ist kein atomarer Vorgang mit einer zeitgleichen Zahlung;
eine bereits an den Push-Dienst übergebene Meldung kann nach Zahlungseingang trotzdem eintreffen.
Kein automatischer Versand, keine Erinnerungsplanung.
Die Rückmeldung „angenommen“ ist keine Bestätigung, dass das Handy die Nachricht bereits angezeigt oder gelesen hat.
Bei unklarem Netzwerkstatus „Versandstatus erneut prüfen“ verwenden, keine neue Erinnerung starten.
Maximal fünf Geräte je Deckel, mindestens eine Minute zwischen manuellen Versandversuchen.
Abgelaufene Endpunkte werden bei Antwort 404/410 entfernt. Geräte lassen sich selbst abmelden.

## Daten und Sicherheit

- OneDrive behält Mitglieder, Namen, PINs, Buchungen, Beträge, Deckel-Schlüssel und den Admin-Versandzugang.
- Cloudflare D1 speichert zufällige Kontokennungen/Versionen, Push-Endpunkte, den letzten Versandzeitpunkt
  und technische Versandkennungen (30 Tage). Geräte-/Kontoeinträge bleiben bis Abmeldung/Rotation oder Admin-Löschung.
  Diese technischen Daten können personenbezogen sein; sie liegen zusätzlich außerhalb OneDrive.
- Browser-Push-Anbieter (Apple/Google/Mozilla) verarbeiten die Zustellung. Es werden **leere Push-Nachrichten** versendet;
  der neutrale Text steht im lokalen Service Worker. Weder Betrag noch Name noch geheimer Deckel-Link im Push-Payload.
- Der vollständige Deckel-Link wird nur lokal am Handy abgelegt. Eine Anmeldung an Cloudflare sendet ausschließlich
  zufällige Kennung, eingeschränkte Anmeldeberechtigung und Geräte-Endpunkt. Der AES-Schlüssel wird nie übertragen.
- Admin-Secret und VAPID-Privatschlüssel gehören in Worker-Secrets. Keine Geheimnisse im Repository.
- Der Versand-API-Zugang benötigt das separate Admin-Secret. Öffentliche Client-Skripte enthalten dieses Secret nicht.
- Anmeldeberechtigungen werden serverseitig mit HMAC geprüft. Die Kontokennung allein reicht nicht zur Geräte-Anmeldung.
- Endpunkte werden auf Apple-/Google-/Mozilla-Push-Hosts begrenzt; HTTP, andere Hosts und Redirects werden abgewiesen.
- Ein neu erzeugter persönlicher QR-Link entfernt beim nächsten Öffnen der Link-Erstellung die alten Push-Geräte.
  Bereits übergebene Benachrichtigungen/alte Deckel-Dateien werden dadurch nicht zurückgerufen.
- Einmal eingerichtete VAPID-Schlüssel nicht einfach ersetzen; sonst müssen alle Geräte neu angemeldet werden.
- Die bestehende iPad-Anwendung schützt die Administration in der Oberfläche. Personen mit vollem Zugriff auf das
  angemeldete iPad/Entwicklerwerkzeuge können dessen OneDrive-Zugriff verwenden; das bleibt unverändert.

## Kosten und Grenzen

Stand 09.10.2026: Workers Free 100.000 Aufrufe/Tag, D1 Free 5 Mio. gelesene und 100.000 geschriebene Zeilen/Tag,
5 GB Daten, 10 ms CPU pro Worker-Aufruf. Nur Einzelversand mit maximal fünf Geräten, kein periodisches Polling.
Kostenlose Kontingente sind begrenzt; ein Anbieter kann Tarife ändern. Keine Zusage „für immer kostenlos“.
https://developers.cloudflare.com/workers/platform/pricing/
https://developers.cloudflare.com/d1/platform/pricing/
https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers

Vor Nutzung: echten Empfang auf iPhone/Android, Öffnen des korrekten Deckels, Abmeldung und Sperrbildschirm prüfen.
Fokusmodus, Handy-Einstellungen und Browser dürfen Push unterdrücken. Gerätetest ist durch Node-/Browser-Mocks nicht ersetzbar.

## Versanddiagnose

Wenn ein Gerät angemeldet bleibt, aber der Versand nicht angenommen wird, den aktuellen Worker-Code veröffentlichen und in Cloudflare unter Observability die Worker-Logs für einen eigenen manuellen Test öffnen. Der Worker protokolliert ausschließlich `Deckel-Push abgelehnt` mit HTTP-Status und bekannten Protokollgründen oder `Deckel-Push Netzwerkfehler` mit `timeout`/`network`, einem bekannten Fehlernamen und einer festen Fehlerkategorie. Rohe Fehlermeldungen, Geräte-Endpunkte, zufällige Kontokennungen, Namen, Beträge und Schlüssel werden nicht in diese Diagnoseausgaben aufgenommen. Nach Abschluss der Diagnose Workers Logs wieder deaktivieren.

404/410 entfernt abgelaufene Geräte; das eigene Handy dann über „Erinnerungen deaktivieren“ und „Erinnerungen erlauben“ neu anmelden. Bei 401/403 den protokollierten Grund prüfen, bevor Schlüssel verändert werden. Einen unbekannten oder fehlgeschlagenen Versand über „Versandstatus erneut prüfen“ prüfen; neue Test-Erinnerungen frühestens nach einer Minute starten. Annahme durch den Push-Dienst ist noch keine Empfangsbestätigung auf dem Handy.

### Cloudflare-Kompatibilität beim Versand

Der Versand verwendet `redirect: "manual"`. Die Cloudflare-Laufzeit unterstützt `redirect: "error"` nicht und wirft damit bereits vor der Netzwerkanfrage einen TypeError. Weiterleitungen (HTTP 3xx) zählen weiterhin als fehlgeschlagener Versand; Zugangsdaten werden nicht an andere Ziele weitergereicht. Nach manueller Aktualisierung des Workers mit Deploy einen neuen Versandversuch starten.

## Hinweis am Home-Bildschirm-Symbol

Eine neue Erinnerung setzt auf Geräten mit Badging API die Zahl **1**. Mehrere Erinnerungen ersetzen denselben Hinweis; die Zahl zeigt einen ungelesenen Hinweis, keine offenen Striche oder Beträge. Beim Antippen der Nachricht wird die Zahl entfernt. Beim Öffnen über das App-Symbol wird sie nach erfolgreichem Laden des sichtbaren Deckels entfernt; die zugehörige Deckel-Benachrichtigung wird dabei ebenfalls geschlossen. Ein fehlgeschlagener Datenabruf quittiert den Hinweis nicht.

Auf iPhone/iPad ab iOS/iPadOS 16.4 benötigt dies eine zum Home-Bildschirm hinzugefügte Web-App und erlaubte Mitteilungen. Unter Einstellungen → Mitteilungen → Mein Deckel müssen Kennzeichen erlaubt sein. Chrome auf Android unterstützt die Badging API nicht; installierte Web-Apps erhalten den vom System angezeigten Benachrichtigungspunkt. Eine numerische Anzeige kann dort nicht durch unsere Web-App vorgegeben werden. Ohne Badge-Unterstützung bleiben Push-Erinnerungen verfügbar.

Die Symbolanzeige ist lokal und benötigt keine Änderung am Cloudflare-Worker oder an seinen Schlüsseln. Nach einem Website-Update den Handy-Deckel mit Internetverbindung öffnen, schließen und erneut öffnen, damit der neue Service Worker aktiv wird. Anschließend eine echte Erinnerung senden und prüfen, ob Zahl/Punkt erscheint und beim Öffnen verschwindet.

https://webkit.org/blog/14112/badging-for-home-screen-web-apps/
https://developer.chrome.com/docs/capabilities/web-apis/badging-api

## Update: Eingaben vom persönlichen Handy (2026.10.10.2)

1. In der vorhandenen D1-Konsole die beiden `CREATE ... IF NOT EXISTS commands`-Anweisungen am Ende von `schema.sql` ausführen. Bestehende Tabellen und Buchungen bleiben erhalten.
2. Den bestehenden Worker mit dem aktuellen `worker.js` aktualisieren. Bestehende Secrets, Domain und DB-Bindung beibehalten. Keine neuen Zugangsdaten nötig.
3. `/health` muss `commandsVersion: 1` melden; dabei wird auch die neue Tabelle geprüft.
4. Die Gerätehaus-App aktualisieren, OneDrive verbinden und unter Getränkeverwaltung → Handy-Deckel **Alle Handyansichten aktualisieren** wählen. Danach auf dem persönlichen Handy aktualisieren. Der bisherige Link bleibt gültig.

Bier, Wein, Punkteeinlösung, Bar-Einzahlung und Rücknahme werden mit dem persönlichen AES-Schlüssel verschlüsselt. Cloudflare erhält weder Klartextbeträge noch den Schlüssel. Die Buchungsberechtigung ist unabhängig von der Push-Berechtigung und liegt nur innerhalb des verschlüsselten Kontostands. Jeder Vorgang erhält eine feste ID. Die App speichert den verschlüsselten Auftrag vor dem ersten Senden im lokalen Gerätespeicher. Nach erfolgreicher Übernahme bleiben serverseitig ID, Hash und Status als Wiederholungsschutz erhalten; der verschlüsselte Inhalt wird entfernt. Ausstehende Aufträge bleiben bis zur Verarbeitung gespeichert. Ein neuer persönlicher Zugang sperrt alte Aufträge.

Das iPad gleicht bei geöffnetem, sichtbarem Fenster etwa jede Minute ab. Es muss online und bei OneDrive angemeldet sein. Kontostand und Treuepunkte werden dort erneut geprüft und mit der normalen Versionskontrolle geschrieben. Erst nach erfolgreicher Kontoveröffentlichung erhält das Handy die Bestätigung. Bei fehlgeschlagener Veröffentlichung wird derselbe Vorgang wiederholt, ohne doppelte Buchung. Eine Browser-App kann bei gesperrtem iPad keine dauerhafte Hintergrundverarbeitung garantieren.

Die Handyansicht zeigt bis dahin ausdrücklich „Wartet auf Synchronisierung“. Bereits übertragene Vorgänge nicht nochmals am iPad manuell buchen. Nach Ersetzen eines Links kann eine alte Vormerkung auf dem Handy erst nach ausdrücklicher Kontrolle am iPad entfernt werden. PayPal bleibt eine externe Zahlung, deren Eingang die Verwaltung bestätigt.

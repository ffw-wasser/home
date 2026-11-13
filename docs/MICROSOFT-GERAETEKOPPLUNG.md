# Microsoft-Anmeldung für Verwaltungsgeräte

Die neue Anmeldung prüft ausschließlich den Zugriff auf die bereits aktivierte
OneDrive-Quelle. Die Quelle stammt serverseitig aus `ledger_meta`; weder der
Browser noch ein Link können einen anderen Ordner als Berechtigungsnachweis wählen.
Es werden keine Dateien importiert, keine Konten geändert und keine Microsoft-
Zugangstoken oder Refresh-Tokens dauerhaft gespeichert. Ein bestätigter Zugriff
richtet einen eigenen sperrbaren Cloudflare-Verwaltungsgerätezugang ein.

## Bereitstellung

1. `cloudflare/push/storage-runtime.sql` auf derselben D1-Datenbank ausführen.
   Die neue Tabelle `storage_microsoft` wird ohne Änderung vorhandener Daten angelegt.
2. Worker mit `node cloudflare/push/build.cjs` erzeugen und bereitstellen.
3. Anwendung Version 2026.11.13.12 bereitstellen.
4. Auf einem bereits verbundenen Gerät die Cloudflare-Verbindung öffnen:
   „Microsoft-Anmeldung für weitere Geräte einrichten“. Die bisherige Entra-
   Anwendungs-ID wird aus der alten lokalen Konfiguration vorausgefüllt, sofern
   vorhanden. Sonst die bestehende ID aus Entra eintragen, aktivieren.
5. Die bestehende Entra-App muss persönliche Microsoft-Konten und die
   SPA-Rücksprungadresse `https://ffw-wasser.github.io/home/` unterstützen.
   Verwendet werden Authorization Code + PKCE und delegiertes `Files.Read`.
   Keine geheimen Clientschlüssel im Browser eintragen.
6. Neues Gerät: „Mit Microsoft anmelden“ → berechtigtes Konto bestätigen.
   Zurück in der Anwendung wird der eigene Cloudflare-Zugang eingerichtet.

Die administrative Konfiguration ist an den aktiven Lauf und dessen Datenquelle
gebunden. Ohne Einrichtung wird kein Microsoft-Zugang erteilt. Das bestehende
Limit von zehn Geräten und die ausdrückliche Gerätesperre bleiben wirksam.
Die Anmeldung verwendet weiterhin den bestehenden Consumers-Endpunkt, da der
bisherige OneDrive-Zugang persönliche Microsoft-Konten nutzt.

## Grenzen

Ein früher eingerichteter Cloudflare-Zugang bleibt auch nach Entfernung der
OneDrive-Freigabe bestehen und muss separat gesperrt werden. Bereits gekoppelte
Geräte benötigen Microsoft nicht bei jedem Start. Leseberechtigung auf genau
„Webseite“ genügt für die gewünschte Ersteinrichtung als Verwaltungsgerät.

Synthetische Tests prüfen verweigerte Rechte, falsche Quelle, abgelaufene Tokens,
PKCE/State, Wiederholungen, Netzwerkfehler und fehlende Konfiguration. Reale
Entra-Einwilligung, Freigaben und iPhone-/iPad-Rückkehr in die installierte App
müssen vor der Freigabe mit den tatsächlichen Konten geprüft werden.

Referenzen:
- https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
- https://learn.microsoft.com/en-us/graph/api/driveitem-get?view=graph-rest-1.0

Die serverseitige Graph-Anfrage verwendet Workers-kompatibles `redirect: manual`.
Weiterleitungen werden abgelehnt; Microsoft-Tokens werden keinem weiteren Ziel übermittelt.
Referenz: https://developers.cloudflare.com/workers/runtime-apis/request/

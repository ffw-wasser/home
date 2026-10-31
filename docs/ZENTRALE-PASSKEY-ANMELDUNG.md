# Finaler Betrieb – verbindliche Passkey-Anmeldung

Version 2026.10.21.24, aufbauend auf PR #47. Der Nutzer hat bestätigt, dass bislang
nur Testnutzer die Alt-Zugänge verwenden, und die finale Umstellung beauftragt.
**Die unten dokumentierte Übergangsfreigabe von 2026.10.21.23 ist damit beendet.**

- Alle geschützten persönlichen Portal-APIs verlangen jetzt eine gültige zentrale
  Passkey-Sitzung, unabhängig vom bisherigen Mitglieds-Migrationsmarker.
- Alte persönliche Lese-/Command-Capabilities und alte WhatsApp-Kalendersitzungen
  werden zurückgewiesen. Die früheren Browser-Pairing-/Erneuerungs- und separaten
  WhatsApp-Passkey-Endpunkte sind abgeschaltet. Keine Aufwertung alter Sitzungen.
- Die aktuelle Portaloberfläche liest keine alten verschlüsselten GitHub-Snapshots
  mehr und stellt keine gespeicherten privaten Alt-Links wieder her. Alte URL-
  Zugangsdaten werden aus der Adresszeile entfernt. Ohne Anmeldung bleiben die
  persönlichen Seiten und Navigation verborgen; Konto → Sicherheit bietet den Einstieg.
- Verwaltung: Einstellungen → H₂O Portal → Mitglied → „Passkey-Einrichtung freigeben“.
  Ein einziger Einrichtungsknopf ersetzt die bisherige zusätzliche Dauerlink-Ausgabe.
  Persönlich geprüfte Einmalfreigabe, Registrierung und frische Anmeldung bleiben
  erforderlich. Bestehende gültige zentrale Passkey-Sitzungen bleiben nutzbar.
- Im Mehr-Bereich gibt es keine separate WhatsApp-Einrichtung mehr. Push bleibt
  ein unabhängiges Opt-in. Der gemeinsame Gerätehaus-/Microsoft-/Admin-Modus bleibt.
- Keine Konten, PINs, Buchungen, Punkte oder Rückmeldungen werden gelöscht, keine
  destruktive D1-Migration. Vorhandene Passkeys benötigen bei fehlender Portal-
  Freigabe die einmalige Freigabe der Verwaltung. Testnutzer müssen sich neu verbinden.

Prüfung: 702 Unit-Tests (davon 223 im Fokus Cloudflare/Sicherheit), 189 JavaScript-
Dateien ohne Syntaxfehler, Bundle-/Release-Konsistenz und virtueller
Chromium-Authenticator. Browser-Regression umfasst alten Link ohne Sitzung,
Einrichtung, gemeinsamen WhatsApp-Zugang, Antwortkorrektur und Abmeldung.
Die bisherigen realen iOS-/Android-/WhatsApp-Webview-/Gerätehaus-iPad- und isolierten
Cloudflare-D1-Testlücken bleiben ausdrücklich offen. Produktive Health-/Version-
und nicht authentifizierte 401-Prüfungen ersetzen diese Tests nicht.

Historische Kopien im separaten Datenrepository/Git-Verlauf lassen sich durch diese
Umstellung nicht zurückholen. Da laut Auftrag ausschließlich Testnutzer betroffen
sind, wird dieses Repository weder gelöscht noch verändert. Local-Storage-/XSS-
und synchronisierte-Geräte-Risiken gelten unverändert. Die Rollback-Regel ist jetzt
für ALLE Mitglieder verbindlich: keinen alten Worker mit Legacy-Freigabe aktivieren;
Autorisierungsschutz behalten, vorwärts korrigieren oder geschützte APIs sperren.
Ein bereits heruntergeladener alter Client wird bei aktuellen persönlichen APIs
serverseitig abgewiesen; historische Offline-/Git-Kopien bleiben davon unberührt.

---

# Zentrale Passkey-Anmeldung – Implementierung und Freigabe

Basis: `main` 066dc12, Version 2026.10.21.22. Kandidat: 2026.10.21.23.
Branch: `feature/central-passkey-login`. Nur Draft-PR; kein Merge/Produktivdeploy.
Die frühere Beschränkung auf WhatsApp ist durch diesen Auftrag ersetzt.

## Verhalten

- Ein freigegebener Passkey identifiziert das Mitglied sowohl im persönlichen Portal
  als auch bei gemeinsamen `termin.html?event=…`-Links. Kein separater WhatsApp-Passkey.
- Sitzung: zufälliges 256-Bit-Bearer-Token, nur der Hash in D1; fest 30 Tage gültig.
  Kachelwechsel benötigen keine Benutzerprüfung. Erneute Anmeldung rotiert die aktuelle
  Sitzung; andere eigene Browser bleiben verbunden. Höchstens 20 Sitzungen je Alias.
- Konto → Sicherheit: Passkey hinzufügen (maximal fünf), andere Passkeys sperren,
  andere Geräte abmelden, aktuelle Sitzung abmelden. Sicherheitsänderungen verlangen
  eine höchstens fünf Minuten alte Passkey-Anmeldung; die Oberfläche fordert sie explizit an.
- Synchronisierte Passkeys können auf mehreren eigenen Geräten genutzt werden.
  Browser/PWA/Webviews teilen ihren Speicher nicht verlässlich: dieselbe Identität,
  gegebenenfalls eine weitere Anmeldung, keine erneute Registrierung.
- Bei verlorenem Passkey prüft die Verwaltung die Identität persönlich, sperrt alle
  bisherigen Schlüssel/Sitzungen und erstellt eine neue einmalige Freigabe.
- Gruppenlinks enthalten weiterhin nur die Termin-ID; spätere Antwortänderungen,
  Versionsprüfung und Idempotenz bleiben erhalten. Bei gültiger gemeinsamer Sitzung
  wird der vorgesehene Termin ohne zusätzliche Anmeldung geladen.
- Gemeinsames Gerätehaus-iPad/`index.html` behält Microsoft-/Administrationszugang und
  Mitglieder-PIN-Abläufe. Portal-Passkeys ersetzen weder Admin-Token noch Microsoft-Anmeldung.
  Eine GF-Rolle wird niemals zur Administratorrolle angehoben.
- Push bleibt eine unabhängige Einwilligung; bestehende Abonnements werden durch
  die Passkey-Einrichtung nicht gelöscht. Neue Aktivierung bleibt freiwillig.

## Vertrauensgrenzen und Autorisierung

| Zugang | Zulässiger Umfang |
| --- | --- |
| Öffentlich | expliziter öffentlicher Kalender und statischer Programmcode |
| Bisherige WhatsApp-Sitzung | Terminliste, Rückmeldung, bisherige Verlängerung |
| Bisheriger Passkey ohne Portal-Freigabe | kann weiterhin nur eingeschränkte Termin-Sitzung ausstellen |
| Persönlicher Alt-Link/Command-Capability | unverändert nur bis zur erfolgreichen Mitgliedsumstellung |
| Freigegebener Passkey + frische Signatur | separate Portal-Sitzung für aktives Mitglied / aktuelle Zugangsrevision |
| Portal-Sitzung | eigenes Konto, eigene Nachweise, Termine, Challenge, bestehende Theaterrechte |
| Portal-Sitzung + aktuelle GF-Rolle | vorhandene GF-Rückmeldungen und minimale Atemschutzübersicht |
| Admin-/Gerätehaus-Zugang | bestehende privilegierte APIs und abgesicherte Verwaltungsoberfläche |

`passkeys.js` bleibt der gemeinsame WebAuthn-Verifikationsweg; es gibt keine zweite
Kryptografie-Implementierung. Die bestehenden SimpleWebAuthn-Versionen bleiben unverändert.
Quelle der API-Anforderungen: https://simplewebauthn.dev/docs/packages/server

Exakte Origin `https://ffw-wasser.github.io`, RP-ID `ffw-wasser.github.io`, verpflichtende
User Verification, zufällige fünfminütige Challenges, atomarer Einmalverbrauch,
Signatur-/Counter-Prüfung und getrennte Challenge-Zwecke für Kalender, Portal und Registrierung.
Rate Limit: 30 WebAuthn-Ceremony-Anfragen pro fünf Minuten und IP-Bucket, ohne Klartext-IP
in D1. Normale authentifizierte Sitzungsprüfung fällt nicht unter dieses gemeinsame Limit.
Registrierung bindet Challenge an Alias, Revision, Widerrufsgeneration und Freigabe/Sitzung.

Jede Portal-Sitzung wird gegen den weiterhin vorhandenen freigegebenen Passkey, aktuelle
Kontorevision und aktive Mitgliederprojektion geprüft. Die GF-Rolle wird bei jeder GF-Abfrage
neu aus dem Roster gelesen, nicht aus dem Browser oder einem dauerhaft gespeicherten Claim.
Berechtigungsentscheidungen für Kontostand, Buchungen und Quiz sind an denselben Prüfweg
angebunden. Personalisierte Daten werden nicht im Service-Worker-Cache abgelegt.

## Sichere initiale Zuordnung und Migration

1. Verantwortliche Verwaltung entsperrt im Gerätehaus die bestehende Administration,
   wählt unter Portalzugänge das Mitglied und prüft seine Identität persönlich.
2. „Passkey-Einrichtung freigeben“ erstellt einen zufälligen, einmaligen 256-Bit-Code,
   an Alias, Zugangsrevision und Widerrufsgeneration gebunden; 30 Minuten gültig.
   QR-Link trägt den Code ausschließlich im Fragment, das der Client sofort entfernt.
   Alternativ Eingabe unter Konto → Sicherheit. Nicht in Gruppen teilen.
3. Mit vorhandenem WhatsApp-Passkey: Code + frische Passkey-Anmeldung bestätigen.
   Ohne Passkey: mit Code registrieren, danach bewusst „Mit Passkey anmelden“ wählen.
4. Erst eine erfolgreiche Portal-Assertion stellt in EINER D1-Transaktion Sitzung,
   Portal-Freigabe und Mitglieds-Migrationsmarker aus. Der persönliche Alt-Zugang
   bleibt bis dahin funktionsfähig. Ein bloßer Alt-Link oder eine alte Termin-Sitzung
   kann diesen Übergang nicht auslösen.
5. Ab diesem Marker werden die alten Lese- und Command-Capabilities für geschützte
   zentrale Daten serverseitig zurückgewiesen. Auch das erneute Anfordern eines
   alten QR-Links oder PIN-Login am iPad reaktiviert sie nicht.
6. Noch nicht umgestellte Mitglieder bleiben kompatibel. Bestehende eng beschränkte
   Termin-Sitzungen bleiben während des Übergangs nutzbar; sie erhalten keine zusätzlichen
   Rechte. Neue Oberfläche führt zur zentralen Einrichtung, Legacy-Browser-Verbindung
   ist nur für noch nicht umgestellte Konten als Übergangshilfe sichtbar.
7. Kein Umbau der Konten, Buchungs-IDs, verschlüsselten Auftragsformate, Punkte, PINs,
   Terminrückmeldungen oder privaten OneDrive-Dateien. Offene Aufträge können nach
   Portal-Anmeldung mit gleicher Revision/Schlüssel idempotent weitergeprüft werden.

Die bisherige Admin-Berechtigung bleibt Vertrauensanker für neue Freigaben. Die
Oberfläche benötigt entsperrte Administration und ausdrückliche personenbezogene
Bestätigung; der Worker verlangt das bestehende Admin-Token und korrekte Datenquelle.
Eine lokale PIN allein reicht für keine neue Portal-Freigabe.

## D1, Widerruf und Rollback

Additive `CREATE TABLE IF NOT EXISTS` in `passkeys.js`, ausgeführt über den bestehenden
`PortalService.ready()`-Pfad:

- `portal_identity_members`: dauerhaftes Mitgliedskennzeichen für deaktivierte Alt-Zugänge.
- `portal_identity_grants`: separat freigegebene Credential-IDs.
- `portal_identity_tickets`: gehashte Einmalfreigaben, Revision/Generation/Ablauf.
- `portal_identity_sessions`: gehashte Token, Credential-Bindung, Revision, Erteilung/Ablauf.

Bestehende `portal_passkeys`, Challenges, Generationen und Browser-Sitzungen werden
weiterverwendet. Keine destruktive Datenmigration und keine neuen Infrastrukturkosten.
Mitgliederentfernung bereinigt neue und alte Sitzungen/Schlüssel/Tickets im bestehenden
Roster-Transaktionsablauf. Rollenänderungen greifen nach bestätigter Synchronisation.
Zugangsrotation macht alte Revisionen bei jeder Anfrage ungültig.

„Verlorenen Zugang sperren und wiederherstellen“ widerruft Schlüssel, offene Challenges,
Tickets und Sitzungen. Der Migrationsmarker bleibt erhalten: Wiederherstellung ist kein
Rückweg zum unsicheren Alt-Link. Schlägt die anschließende Ticket-Ausstellung fehl,
bleibt der Widerruf wirksam; die Verwaltung kann eine neue Freigabe ausstellen.

**Rollback:** Vor der ersten Mitgliedsumstellung können Worker und Frontend auf die Basis
zurückgerollt werden; additive Tabellen bleiben bestehen. Nach der ersten Umstellung
DARF der alte Worker nicht einfach wiederhergestellt werden, weil er Migrationsmarker
nicht kennt und Alt-Capabilities erneut akzeptieren würde. Dann aktuellen Autorisierungsschutz
beibehalten und Fehler vorwärts korrigieren oder geschützte APIs vorübergehend sperren.
Keine Migrationsmarker löschen. Kein automatischer Legacy-Fallback für einen bereits
auf Portal-Sitzungen umgestellten Browser.

## Prüfungen und verbleibende Grenzen

Lokal erfolgreich (Kandidat dieses Branches):
- `node scripts/run-focused-tests.cjs cloudflare sicherheit`: 232 Tests.
- `node scripts/check-syntax.cjs`: 188 JavaScript-Dateien, keine Fehler.
- `node --test tests/*.test.cjs`: 711 Tests, keine Fehler/übersprungenen Tests.
- `node tests/passkey-browser.cjs`: Chromium-Integration mit virtuellem Authenticator.
- Bundle-/Release-Konsistenz und `git diff --check` erfolgreich.
- GitHub-CI wird zusätzlich im Draft-PR geführt; kein Beleg für einen Live-Deploy.

Automatisierte Prüfungen verwenden ausschließlich künstliche Konten und SQLite als
D1-kompatiblen Testadapter. Neue Tests prüfen echte RSA-WebAuthn-Signaturen, alte
Scope-Grenzen, Einmalfreigabe, Fremdzuordnung, atomare Aktivierung, Origin/RP-ID/UV,
Replay/Ablauf, Sitzungsrotation, Widerruf, Wiederherstellung, Mitgliederentfernung,
GF-Rollenentzug sowie unveränderte, idempotente Getränke-/Cash-Buchungen.

Chromium mit virtuellem resident Authenticator prüft die echte Oberfläche: QR-Onboarding,
Registrierung, Portal-Anmeldung, gemeinsamer WhatsApp-Terminaufruf ohne zweite Anmeldung,
Rückmeldung und spätere Korrektur, erneute Anmeldung ohne gespeicherte Browser-Sitzung, erneutes Öffnen, Wiederherstellungssperre und 320px ohne Horizontalüberlauf.
Der Test belegt keine echte Biometrie oder Betriebssystem-Synchronisierung.

Vor Produktivfreigabe offen:

- Echtes iPhone: Safari, installierte PWA, Face ID/Geräte-PIN, Rückkehr aus WhatsApp.
- Echtes Android: Chrome, installierte PWA, Fingerabdruck/Geräte-PIN, WhatsApp-Webview.
- WhatsApp-Webview ohne WebAuthn: derselbe Terminlink muss über das WhatsApp-Menü
  in Safari/Chrome geöffnet werden. Eine Webseite kann diesen Wechsel nicht erzwingen.
- Gerätehaus-iPad mit realer Microsoft-Verbindung: PIN-Eingabe, Codefreigabe,
  Rollen-/Mitgliedersynchronisierung und bestehende Erfassungsabläufe.
- Echte Cloudflare/D1-Stagingintegration; Produktivzugang und bereitgestellte Worker-Version
  wurden in diesem Auftrag nicht verändert oder als verifiziert bestätigt.
- Browser-Bearer in Local Storage ist gegenüber XSS auf derselben Origin angreifbar.
  Bestehende CSP ohne Inline-/Fremdskripte, Textausgabe statt dynamischem HTML und
  kein Service-Worker-Datencache reduzieren das Risiko, beseitigen es aber nicht.
  GitHub-Pages-Pfade derselben Origin sind keine getrennten Sicherheitsgrenzen.
- Ein synchronisierter Passkey ist kein einzelnes physisches Gerät. Bei Geräteverlust
  zusätzlich Apple-/Google-Konto absichern, gegebenenfalls gesamten Passkey widerrufen.
- IP-Limit kann bei vielen gleichzeitigen Einrichtungen hinter demselben Anschluss greifen;
  Einrichtung dann zeitlich staffeln. Keine bloße PIN-/Link-Ausnahme anbieten.
- Widerruf kann bereits früher heruntergeladene Daten nicht zurückholen. Früher veröffentlichte
  verschlüsselte Deckel-Snapshots im separaten Daten-Repository einschließlich Git-Historie
  sind mit dem damaligen Schlüssel weiterhin entschlüsselbar. Dieses Repository wurde nicht
  verändert. Vor Freigabe Bestand/Veröffentlichung prüfen und die Alt-Veröffentlichung nach
  erfolgreicher Ablösung organisatorisch beenden. Passkeys schützen die aktuellen APIs,
  sie verschlüsseln historische Kopien nicht nachträglich neu.

## Konkrete Freigabeschritte

1. Draft-Diff/Sicherheitsgrenzen prüfen; vollständige CI einschließlich Browserlauf grün.
2. Isolierte Test-D1/Worker mit synthetischen Daten bereitstellen, additive Tabellen und
   Ausfälle/Wiederherstellung dort prüfen. RP-ID/Origin nicht für Produktion aufweichen.
3. Obige reale Geräte-/Microsoft-/WhatsApp-Matrix mit autorisierten Testkonten absolvieren.
4. Verantwortliche bestätigen Migration, Alt-Snapshot-Umgang und eingeschränkten Rollback.
5. Erst explizit Merge und Produktiv-Worker-Deploy freigeben. Worker zuerst, dann Frontend;
   Quellfingerabdruck und `portalIdentityVersion:1` am echten Worker prüfen.
6. Ein Pilotmitglied vollständig umstellen, Alt-Link/API-Zurückweisung und unveränderte
   Kontobewegungen prüfen; anschließend übrige Mitglieder schrittweise freigeben.

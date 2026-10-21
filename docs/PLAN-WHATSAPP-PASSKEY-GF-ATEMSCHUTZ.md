# Umsetzungsplanung: WhatsApp-Passkey und GF-Kachel „Atemschutz“

**Status:** Nur Planung für später. Dieser Draft-Pull-Request enthält **keine produktiven Codeänderungen** und darf nicht als bereits implementiert oder getestet beschrieben werden.  
**Repository:** `ffw-wasser/home`, Basis `main`, 21.10.2026.  
**Verbindliche Nutzerentscheidung:** **Passkeys ausschließlich für die WhatsApp-Terminrückmeldung einrichten**, **keine** generelle Face-ID-/Fingerabdruck-Pflicht oder Passkey-Umstellung für das gesamte H₂O-Portal.  
**Weitere Anforderung:** Unter **Mehr** eine nur für Gruppenführer sichtbare und serverseitig geschützte Kachel mit dem **kurzen Namen „Atemschutz“**.

## 1. Ergebnis für Mitglieder

### WhatsApp: ein gemeinsamer Terminlink, keine manuelle Browser-Codefreischaltung

1. Das Mitglied öffnet das bereits angemeldete persönliche H₂O-Portal und unter **Mehr → Push & WhatsApp** die **WhatsApp-Einrichtung**.
2. Dort erscheint **„WhatsApp-Zugang einrichten“**. Nach bewusster Bestätigung wird ein persönlicher Passkey für **Termin-Rückmeldungen aus WhatsApp** registriert. Die bestehende H₂O-Mitgliederzuordnung muss bei der Registrierung serverseitig überprüft werden.
3. Der Gruppenführer teilt weiterhin **einen gemeinsamen Terminlink** zur freigegebenen Probe/Sonderprobe, ohne persönliche Schlüssel im WhatsApp-Gruppenchat.
4. Der Link öffnet `termin.html?event=<id>`. Ein Mitglied mit gültiger Termin-Sitzung sieht direkt die Terminkarte; ohne Sitzung meldet es sich mit seinem **bereits registrierten WhatsApp-Passkey** an und gelangt zurück zum konkreten Termin.
5. Antworten („Bin dabei“, „Entschuldigt“, „Noch unsicher“) bleiben änderbar bis zum Terminbeginn. Die bestehenden Schutzmaßnahmen für Versionen, doppelte Aufträge und bestätigte Speicherungen bleiben erhalten.
6. **Kein eigener Browser-Code, kein Link-Kopieren für den normalen Ablauf.** Bei WebAuthn-unfähigem WhatsApp-In-App-Browser verständlicher Wechsel zu Safari/Chrome; eine Webseite kann diesen Wechsel nicht auf allen Geräten erzwingen. Derselbe Passkey kann in unterstützten Browsern genutzt werden, aber eine geteilte Browser-Sitzung wird nicht vorausgesetzt.

### H₂O allgemein ausdrücklich unverändert

- H₂O-Start, Mein Deckel, Treuepunkte, persönliche Nachweise, Mitgliederverwaltung, Admin und Gerätehaus-iPad **werden nicht** auf Passkeys umgestellt.
- Die bestehende persönliche H₂O-Authentifizierung wird durch diese WhatsApp-Erweiterung weder ersetzt noch umgangen.
- Push bleibt separat konfigurierbar; Passkey-Einrichtung nicht zur Voraussetzung für normale Push-Mitteilungen machen.
- Ein WhatsApp-Passkey bekommt **nur** Termin-**Lesen/Antworten**-Rechte für das betreffende aktive Mitglied; **keinen** Zugriff auf Getränke, Zahlungen, Mitgliederdaten, GF-Atemschutz, Admin oder sonstige H₂O-Funktionen.
- Das persönliche H₂O-Portal dient bei der initialen Passkey-Registrierung nur als **berechtigter Ausgangspunkt**; bestehende persönliche Links/Capabilities sind kein Identitätsnachweis für einen gemeinsam geteilten WhatsApp-Link.

## 2. Umsetzung A: technisch sichere, eng begrenzte WhatsApp-Passkeys

### Prüfungen vor dem Programmieren

- Bei der aktuellen Web-Origin `https://ffw-wasser.github.io/home/` WebAuthn/Passkey-Support auf iPhone (Home-Bildschirm-PWA, Safari, WhatsApp-Webview) und Android (PWA, Chrome, WhatsApp-Webview) gezielt testen. GitHub Pages ist die aufrufende Origin; die serverseitige Prüfung kann im Cloudflare-Worker erfolgen, muss aber die richtige RP-ID und Origin genau validieren.
- Geeignete gepflegte WebAuthn-/FIDO2-Verifikation für Workers evaluieren, keine selbst gestrickte kryptografische Signaturvalidierung. Passkey-Geheimschlüssel/biometrische Daten bleiben beim Betriebssystem/Passkey-Provider, nicht im Worker, nicht im Repository.
- Bestehende `/portal/browser/start`, `redeem`, `renew`, `revoke` sowie `portal_browser_sessions` und `portal_browser_pairs` inspizieren; Legacy-Aktivierung erst nach getesteter Umstellung abschalten. Bestehende Bestandskonten und Termine nicht beschädigen.
- Passkey-Registrierung muss durch den **aktuellen persönlichen H₂O-Zugang** autorisiert sein; zur Vermeidung von Registrierung allein durch fremden/geleakten Privatlink je nach Bedrohungsmodell zusätzliche Bestätigung/autorisierten privaten Bootstrap berücksichtigen.
- Registration/Assertion: pro Sitzung serverseitig generierte zufällige kurzlebige Challenge, One-Time-Use, erwartete RP-ID/Origin, User Verification, Ablauf- und Replay-Schutz, atomare Bindung an aktive Mitgliedskennung, Rate Limits und strikte Antwort-CORS.
- Termin-Session nach Passkey-Prüfung **separat von bestehenden H₂O-Kommandorechten** ausstellen und auf `/portal/list`, `/portal/reply` begrenzen. Keine Cookies über `github.io` ↔ `workers.dev` voraussetzen; Speicherung, Ablauf, Rotation und Widerruf der eingeschränkten Session begründen und testen.
- Mehrere persönliche Geräte/Passkeys je Mitglied; unter **Mehr → Push & WhatsApp** Passkey-Status und **„WhatsApp-Zugang zurücksetzen“**; Status in natürlicher Sprache, keine unnötigen technischen Textblöcke.
- Bei Mitgliederentfernung, Zurücksetzen oder Änderung des Hauptzugangs WhatsApp-Sitzungen und Registrierungen serverseitig ungültig machen. Rollen-/Mitgliederabgleich und alte Browser-Tokens prüfen. Keine „Offline-Erfolg“-Meldungen und keine gespeicherten persönlichen Daten im Service Worker.
- Alternative bei Passkey-unfähigen oder verlorenen Geräten nur über **privat und sicher autorisierte Wiederherstellung**, nicht über frei erratbare Namen, WhatsApp-Anzeigename, gemeinsame Gruppenlinks oder dauerhaft gültige Zugangslinks.

### Akzeptanzkriterien A

- [ ] Einrichtung der WhatsApp-Passkeys nur unter **Mehr → Push & WhatsApp**, nicht appweit.
- [ ] WhatsApp-Gruppenlink ohne personalisierte Geheimnisse; nach Passkey-Anmeldung das richtige Mitglied/den richtigen Termin anzeigen.
- [ ] iPhone und Android: unterstützte Browser funktionieren, In-App-Webviews mit verständlichem getesteten Rückfallweg.
- [ ] „Ja/Entschuldigt/Unsicher“, späteres Ändern, Idempotenz und Versionskonflikte funktionieren wie vorher.
- [ ] WhatsApp-Passkey kann **keine** anderen APIs (Mein Deckel, personenbezogene GF-Daten, Admin) nutzen.
- [ ] Sperrung bei entferntem Mitglied, ausgelaufenem Termin, verlorener Session und widerrufenem Passkey geprüft.
- [ ] Bestehende H₂O-App und Push ohne WhatsApp-Passkey unverändert bedienbar.

## 3. Umsetzung B: GF-Kachel „Atemschutz“ unter Mehr

### Ansicht

- Neue kurze Kachel **„Atemschutz“**, Unterzeile z. B. „AGT-Status & Nachweise“.
- **Nur für aktive Gruppenführer** (bereits aus administrierter GF-Rolle abgeleitet) nach erfolgreichem Rollenabgleich sichtbar. Falls Rollenstatus nicht sicher festgestellt werden kann, **nicht anzeigen**; keine sensiblen Antworten liefern.
- Mobilansicht: kompaktes Dashboard mit Anzahl **„Nachweise vollständig“**, **„Bald fällig“**, **„Nicht vollständig / prüfen“** und durchsuchbarer Mitgliederliste. Farben zusätzlich mit klar lesbaren Text- und Symbolstatus; Detailansicht bei Antippen.
- Für jede als Atemschutzgeräteträger geführte Person **G26.3**, AGT-Unterweisung und **FFI** zusammen aus vorhandenen Mitgliedsdaten prüfen; fällige/fehlende/abgelaufene Nachweise einzeln nennen (Datumsstand/Quelle/Synchronisationszeit). „Vollständig“ nur bei **allen** aktuell gültigen, nachgewiesenen Voraussetzungen. Ablaufwarnung (z. B. 60 Tage) getrennt von bereits fehlend/abgelaufen. Nachweisstatus ist **keine automatische Einsatzfreigabe**; Ausbildung, Tätigkeit, Tagesform und Einsatzentscheidung gehören zur verantwortlichen Führung.
- Personen ohne Atemschutzqualifikation nicht fälschlich als Atemschutz-tauglich einstufen; G26.3 allein genügt ausdrücklich nicht. Keine ärztlichen Diagnosen/Befunde oder PDF-Untersuchungsunterlagen anzeigen.
- Bei veralteter/fehlgeschlagener Synchronisierung nicht „alles grün“ zeigen: **„Datenstand nicht aktuell – keine verlässliche Freigabe“** mit letztem Synchronisationszeitpunkt. Kein dauerhaftes oder unberechtigtes Zwischenspeichern fremder Nachweise auf Geräten.

### Sicherheit/Datenschutz

- Der **bestehende persönliche H₂O-Zugang** bleibt für die GF-Ansicht maßgeblich. **WhatsApp-Passkeys berechtigen ausdrücklich nicht zur GF-Ansicht.**
- Cloudflare-API mit rollenbasierter Prüfung **auf jedem Abruf** (nicht nur Kachel verstecken); nur erforderliche Namen, Status und Gültigkeitsdaten des eigenen Feuerwehr-Mitgliederbestands zurückgeben. Zugriff nach GF-Rollenentzug/Entfernung ablehnen.
- Bereits vorhandene verschlüsselte `portal_roster`-Projektion/MemberEvidence-Bewertung wiederverwenden, statt Parallelregister aufzubauen; prüfen, ob Rollenstand und Sync aktualisiert sind. Rechtsgrundlage/Zugriffskreis/Speicherort und ggf. Datenschutz-Folgenabschätzung mit Verantwortlichen prüfen, da medizinische Eignungsdaten besonders geschützt sein können.

### Akzeptanzkriterien B

- [ ] Kachel heißt **„Atemschutz“** und erscheint ausschließlich für aktive GF.
- [ ] Direkter API-Aufruf durch Nicht-GF einschließlich WhatsApp-Passkey wird mit 403 zurückgewiesen.
- [ ] G26.3 + AGT-Unterweisung + FFI vollständig, bald fällig, fehlt oder abgelaufen korrekt berechnet.
- [ ] Datenfehlstand, deaktivierter Kamerad und GF-Rollenentzug lecken keine Informationen.
- [ ] Kachel läuft auf kleinen iPhones/Android ohne horizontales Scrollen; Rückweg zu **Mehr** funktioniert.
- [ ] Keine doppelten Mitgliedsdaten, Diagnosen oder personenbezogenen Nachweise auf GitHub.

## 4. Bestandsdateien zur gezielten Bearbeitung

| Bereich | Pfade |
| --- | --- |
| WhatsApp-Kachel/Status | `deckel.html`, `js/features/drinks/deckel-push.js`, `css/features/portal-whatsapp.css` |
| Termin-Rückmeldung | `termin.html`, `js/features/portal/portal-whatsapp.js`, `js/features/portal/portal-member.js` |
| GF-Kachel/Navigation | `deckel.html`, `js/features/drinks/deckel-mobile.js`, `css/features/portal.css`, neues enges Fachmodul bei Bedarf |
| Berechtigungen/Daten | `cloudflare/push/portal.js`, `js/features/portal/member-evidence.js`, `js/features/portal/portal-admin.js` |
| Worker | `cloudflare/push/worker.js`, `cloudflare/push/build.cjs` → **`worker.bundle.js`** |
| Tests | `tests/whatsapp-navigation.test.cjs`, `tests/portal-reply-flow.test.cjs`, `tests/portal.test.cjs`, neue Sicherheits-/GF-Tests |
| Regeln | `AGENTS.md`, `docs/PROJEKTKARTE.md`, `docs/WORK-LEITFADEN.md` |

## 5. Sicherheit, Teststrategie und Freigabe

1. In späterer Umsetzung zunächst ein **Bedrohungsmodell** für persönliche Links, WhatsApp-Webview, Browser/PWA-Sitzungen, Worker-API, D1, OneDrive-Sync, GF-Rollen und Widerruf erstellen.
2. A und B als getrennte, testbare Commits/Änderungspakete entwickeln; keine unaufgeforderten Strukturumbauten. Bei kritischen Daten-/Rechte-Änderungen nach Möglichkeit kleine separat reviewbare PRs aus diesem Plan ableiten.
3. Automatische Unit-/Integrationstests: Passkey-WebAuthn-Registrierung/Verifikation, Origin/RP-ID, Challenge-Replay/Timeout, Rechte-Matrix, ehemalige Mitglieder, Session-Widerruf, GF-Rollenentzug und Nachweiszustände, alle bisherigen Rückmeldetests.
4. `node scripts/run-focused-tests.cjs kalender cloudflare sicherheit`, `node scripts/check-syntax.cjs`, `node --test tests/*.test.cjs`; Worker mit `node cloudflare/push/build.cjs` bauen, Release/Service-Worker-Cache konsistent aktualisieren. GitHub-Actions-CI prüfen.
5. Praxisprüfung mit autorisierten Testkonten und künstlichen Nachweisen auf **realen iPhones** (installierte PWA, Safari, WhatsApp), **Android** (PWA, Chrome, WhatsApp) sowie **Gerätehaus-iPad**; speichern, ummelden, zurück, widerrufen, entziehen und Sperrung nach Sync testen.
6. **Keine Veröffentlichung nach `main` und kein Cloudflare-Deploy**, bis explizit freigegeben und separate Bestätigung der tatsächlich bereitgestellten Worker-Version vorliegt. Legacy-Wege erst nach nachgewiesenem Ersatz abschalten.
7. Nach Umsetzung dokumentieren: Dateien/Commit, Tests/CI, nicht geprüfte reale Flows, D1-Migration (falls nötig), Rückrollstrategie sowie Anwendung-/Worker-Version getrennt.

## 6. Übergabe für die spätere Weiterarbeit

> Implementiere die Planung in `docs/PLAN-WHATSAPP-PASSKEY-GF-ATEMSCHUTZ.md` nach `AGENTS.md`, `docs/PROJEKTKARTE.md` und `docs/WORK-LEITFADEN.md`. **Nicht die gesamte H₂O-App auf Passkeys umstellen:** Passkey ausschließlich in der WhatsApp-Einrichtung unter **Mehr → Push & WhatsApp**. Die GF-Kachel **„Atemschutz“** verwendet weiterhin normale H₂O-Berechtigungen und wird serverseitig auf GF beschränkt. Zuerst Architektur/Sicherheitsprüfungen und gezielte Tests, danach separat reviewbare Implementierung; kein produktiver Deploy ohne Freigabe.

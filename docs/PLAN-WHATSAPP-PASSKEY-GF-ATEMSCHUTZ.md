# Umsetzungsplanung: WhatsApp-Passkey und GF-Kachel „Atemschutz“

> Fortentwicklung: Der Auftrag „Zentrale Passkey-Anmeldung“ ersetzt die frühere
> Beschränkung auf WhatsApp. Umsetzung und verbindliche Migrations-/Freigabegrenzen:
> [ZENTRALE-PASSKEY-ANMELDUNG.md](ZENTRALE-PASSKEY-ANMELDUNG.md).
> Die folgenden Angaben beschreiben den bisherigen Stand, keine automatische Rechteerweiterung.

**Status 21.10.2026:** Beide Funktionen für Release `2026.10.21.12` implementiert. Die folgende Planung bleibt als fachliche Referenz erhalten. Aktueller Implementierungs- und Prüfstand: `docs/PR36-ABSCHLUSS.md`. Der Nutzer hat Fertigstellung und Veröffentlichung ausdrücklich beauftragt.

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

### Leitgedanke: Eine GF-Antwort in drei Sekunden

Die Kachel heißt **„Atemschutz“**, die Unterzeile **„AGT-Status & Nachweise“**. Nur **aktive, serverseitig bestätigte Gruppenführer** sehen sie unter **Mehr**. Keine zusätzliche WhatsApp-/Passkey-Anmeldung. Nach dem Öffnen soll der GF ohne Fachcode-Rätsel sofort beantworten können:

1. **Wer hat alle erforderlichen Atemschutz-Nachweise?**
2. **Was wird demnächst fällig?**
3. **Bei wem fehlt ein konkreter Nachweis oder ist bereits abgelaufen?**

Wichtig: **Nachweise vollständig ≠ heute einsatzbereit / ärztlich uneingeschränkt tauglich.** Die Ansicht ist eine Entscheidungshilfe für die Führungskraft und ersetzt keine einsatzbezogene Eignungsbeurteilung, Ausbildungsvoraussetzungen, Geräteeinweisung oder Prüfung der Tagesform. Im Portal deshalb **nicht** als Gesamtstatus „Atemschutztauglich / einsatzfähig“ beschriften.

### Übersicht im Handy – kompakt und selbsterklärend

Oben **„Atemschutz“**, darunter klein **„Stand der hinterlegten Nachweise: [Datum, Uhrzeit]“**.

Drei **einander ausschließende, antippbare Statusfilter** in einer kompakten Zeile (Zahlen beziehen sich nur auf als AGT zugeordnete Mitglieder und bilden zusammen die Gesamtzahl):

| Anzeige | Bedeutung | Aussehen |
| --- | --- | --- |
| **Vollständig** | Alle drei erforderlichen Nachweise sind aktuell gültig, **keiner** wird innerhalb der Warnfrist fällig. | Haken + Grün |
| **Bald fällig** | Alle drei Nachweise sind **noch gültig**, mindestens einer läuft innerhalb der nächsten **60 Tage** ab. | Uhr + Gelb |
| **Prüfen** | Mindestens ein erforderlicher Nachweis **fehlt, ist abgelaufen oder ist nicht eindeutig zugeordnet**. | Ausrufezeichen + Rot/neutraler Prüfhinweis |

Beispiel (rein fiktiv, keine Mitgliederdaten): **8 Vollständig · 2 Bald fällig · 3 Prüfen**.

- Die drei Kacheln sind **Filter**, keine bloßen dekorativen Statistiken. Wahl einer Kachel zeigt sofort die zugehörigen Personen. Auswahl **„Alle (13)“** setzt den Filter zurück. Standardansicht: **„Alle“**, darin **„Prüfen“ zuerst**, danach „Bald fällig“, danach „Vollständig“, weil Handlungsbedarf hervorgehoben werden soll. Innerhalb jeder Gruppe alphabetisch sortieren.
- Direkt darunter ein schmales **Suchfeld „Mitglied suchen“** und eine übersichtliche Liste. Keine verschachtelten Tabellen, keine horizontalen Scrollflächen, kein permanenter Langtext.
- Pro Person **nur Name + kurzer Status + ggf. ein konkreter Grund**; höchstens zwei Zeilen in der eingeklappten Ansicht, z. B. **„FFI fehlt“**, **„AGT-Unterweisung abgelaufen“** oder **„G26.3 endet 11/2026 (noch gültig)“**. Bei mehreren Problemen **„2 Nachweise prüfen“** und nach Öffnen die vollständige Liste.
- Bei Antippen einer Person **aufklappbare Details direkt in der Liste**, wieder antippen schließt. Keine zusätzliche komplexe Navigation, kein Dialogzwang. Bei mehreren geöffneten Details darf die Ansicht übersichtlich bleiben; bevorzugt nur eine aufgeklappte Person gleichzeitig.
- Auf dem Handy ausreichende Button-/Zeilenhöhe, Schriftgröße und Kontrast; Status immer **Text + Symbol**, nicht allein Farbe. Auf kleinen iPhones ohne horizontales Scrollen, mit „← Zurück zu Mehr“.
- Keine automatische Benachrichtigung, Download-/WhatsApp-Versand der Nachweisliste oder Bearbeitung von Mitgliederdaten innerhalb dieser GF-Ansicht. Sie ist **nur lesend**.

### Aufgeklappte Details je Mitglied

Immer **dieselben drei Nachweise in derselben Reihenfolge**, auch wenn sie gültig sind:

| Verständliche Beschriftung | Ursprung im Datenmodell | Beispielstatus |
| --- | --- | --- |
| **G26.3 – ärztliche Eignung** | `breathing.g263` / vorhandenes G26.3-Gültigkeitsdatum | **Gültig bis 04/2027** |
| **AGT-Unterweisung** | `breathing.instruction` (bisher `agtInstructionValidUntil`) | **Läuft bald ab · 11/2026** |
| **FFI – Atemschutznachweis** | `breathing.ffi` (bisher `ffiValidUntil`) | **Fehlt** |

- Sichtbar direkt je Nachweis: **Gültig bis MM/JJJJ**, **Bald fällig · MM/JJJJ**, **Abgelaufen seit MM/JJJJ** oder **Kein Nachweis hinterlegt**. Für den fachlichen Vergleich das **gespeicherte volle Datum** auswerten, auch wenn im UI nur Monat/Jahr gezeigt wird. Ist eine exakte Datumsgrenze wichtig (z. B. Ablauf am heutigen Tag), auf Detailansicht erforderlichenfalls TT.MM.JJJJ anbieten.
- Hilfetext im Detail, sparsam: **„Alle drei Nachweise müssen hinterlegt und gültig sein. Diese Übersicht ersetzt keine Einsatzfreigabe.“** Nicht bei jedem Mitglied wiederholen.
- **G26.2 ersetzt G26.3 nicht.** Die Anzeige für Nicht-AGT und deren G26.2-Nachweise gehört weiterhin in **„Meine Nachweise“**, nicht in die GF-Atemschutzübersicht.
- Kein Einblick in ärztliche Diagnosen, Untersuchungsergebnisse, medizinische Dokumente oder PDF-Befunde.

### Fachliche Grenzfälle explizit regeln

1. **AGT-Zuordnung:** Nicht allein aus dem Vorhandensein einer G26.3 oder historischer Nachweisdaten auf „Atemschutzgeräteträger“ schließen. Primär das **explizite AGT-/breathingQualified-Kennzeichen** verwenden, soweit vorhanden, mit sinnvoller und dokumentierter Behandlung der bisherigen `ATM`/`ATG`-Rollen. Bei nur indirekt erkennbaren oder widersprüchlichen Legacy-Daten: **„Zuordnung prüfen“** anzeigen, **nicht** automatisch als voll qualifiziert markieren. Diese Fälle getrennt von den drei Statuszählern führen, bis ihre AGT-Zugehörigkeit geklärt ist.
2. **Ablaufregeln:** Heute noch gültige Nachweise bleiben gültig; **„Bald fällig“ blockiert die Vollständigkeit nicht**. Sind gleichzeitig ein bald fälliger und ein fehlender/abgelaufener Nachweis vorhanden, **„Prüfen“ hat Vorrang**. Fehlend und abgelaufen nicht miteinander verwechseln; alle konkreten Ursachen im Detail benennen.
3. **Fehlende Gesamtdaten/Serverfehler:** Kein scheinbar beruhigendes **„0 offen / alles vollständig“**. Stattdessen **„Nachweisübersicht derzeit nicht zuverlässig verfügbar“** mit „Erneut prüfen“. Keine lokal zwischengespeicherten fremden Nachweisdaten als aktuell ausgeben.
4. **Veraltete Synchronisierung:** Stand und Datenquelle klar anzeigen. Wenn der letzte erfolgreiche Mitglieder-/Nachweisabgleich älter als eine **fachlich noch festzulegende, getestete Frischegrenze** ist, Übersicht sichtbar als **„Datenstand veraltet – vor Einsatz prüfen“** kennzeichnen; kein grüner Gesamteindruck ohne Warnung. Die Frischegrenze **nicht** mit der separaten Kalender-Frischegrenze verwechseln.
5. **Kein AGT erfasst:** Freundlicher Leerzustand **„Derzeit keine Atemschutzgeräteträger zugeordnet“** plus Synchronisationshinweis statt leerer Tabelle.
6. **Mitglied entfernt / GF-Rolle entzogen:** Person darf nicht mehr im aktiven Datensatz erscheinen; entzogenem GF darf der Worker keinerlei personenbezogene Nachweisübersicht mehr ausgeben. Auch bestehende Sitzungen nach serverseitiger Neuauswertung ablehnen.

### Sicherheit/Datenschutz und vorhandener Code

- Für die GF-Ansicht gilt **weiterhin die bisherige persönliche H₂O-Anmeldung**, **nicht** der WhatsApp-Passkey. Zwingend serverseitige Rollenprüfung in einer **separaten GF-Nachweis-API** bei jedem Abruf. **Nicht-GF, entfernte Mitglieder und WhatsApp-Passkey-only-Zugänge erhalten 403**, unabhängig vom versteckten Menüeintrag.
- Das vorhandene `js/features/portal/member-evidence.js` kennt bereits `breathing` mit **G26.3, Unterweisung AGT und FFI**, die Statuswerte `valid / soon / expired / missing` und ein Warnfenster von **60 Tagen**. **Diesen gemeinsamen Bewertungsweg wiederverwenden**, statt widersprüchliche neue Berechnungen für GF einzubauen. Derzeit nutzt das Modell außerdem Legacy-Fallbacks für AGT-Zuordnung; diese für die GF-Liste fachlich abgesichert auflösen.
- `cloudflare/push/portal.js` gibt über `/portal/evidence` bisher bewusst nur die **eigenen** Nachweise zurück und bietet `/portal/overview` bereits eine **serverseitig überprüfte GF-Rolle** für Terminrückmeldungen. Für AGT **keinesfalls** `/portal/evidence` pauschal für fremde Daten öffnen, sondern einen separaten, eng begrenzten Endpunkt mit minimalen Namen, Nachweisstatus und Gültigkeitsdaten einrichten.
- Quelle soll die vorhandene verschlüsselte `portal_roster`-Projektion aus Mitgliederabgleich sein, keine doppelte Stammdatenverwaltung. Server liefert nur nötige Felder, Daten-/Rollen-Synchronisationszeitpunkte und bestätigten GF-Status, mit `no-store`. Keine zusätzlichen personenbezogenen Daten auf GitHub oder im PWA-Service-Worker.
- Zugriffsberechtigung, Erforderlichkeit der Anzeige medizinischer Eignungsdaten, Aufbewahrung und Zugriffskreis mit der verantwortlichen Feuerwehr-/Datenschutzstelle prüfen, **bevor** die Funktion produktiv für GF freigegeben wird.

### Abnahmekriterien B – nachvollziehbar testbar

- [ ] Unter **Mehr** für berechtigte GF eine Kachel mit dem **kurzen Titel „Atemschutz“** und der Unterzeile **„AGT-Status & Nachweise“**; für Nicht-GF keine Kachel.
- [ ] Überschrift, **drei klare Filter mit exklusiven Zählern**, Filter **Alle**, Suche und nachvollziehbare Sortierung auf iPhone und Android. Summe der drei Zähler = Anzahl eindeutig zugeordneter AGT; unklare Zuordnungen separat.
- [ ] Jede eingeklappte Zeile zeigt **Name, eindeutigen Status und konkreten Grund**; nach Antippen genau die drei Nachweise G26.3, AGT-Unterweisung und FFI mit Gültigkeit und verständlichen Kurztexten.
- [ ] Prüfe Beispiele: alle gültig; genau ein Ablauf in 60 Tagen; Ablaufdatum heute; bereits abgelaufen; fehlend; zugleich bald fällig und fehlend; widersprüchliche AGT-Zuordnung; nicht zugeordnete Person mit G26.3.
- [ ] Keine Behauptung **„einsatzbereit“ / „atemschutztauglich“** allein durch Nachweisstatus; Warnung zur fachlichen Einsatzprüfung vorhanden.
- [ ] Frischer vs. veralteter Datenstand, fehlende Daten, 403, 5xx und Offlinezustand zeigen **keine falschen grünen Gesamtwerte** und keine unberechtigten personenbezogenen Offline-Listen.
- [ ] Direkter Worker-Endpunkt: Nicht-GF, entfernter GF, WhatsApp-Passkey, fremder oder widerrufener Zugang **403**; GF sieht nur die freigegebenen nötigen Felder, keine Diagnosen.
- [ ] Kein horizontaler Überlauf bei 320px Bildschirmbreite oder vergrößerter Systemschrift; bedienbare Filter und klare Zurück-Navigation.
- [ ] Bestehende **„Meine Nachweise“**, Terminrückmeldungen und Push behalten ihre Funktion; es entstehen keine doppelt gepflegten personenbezogenen Nachweisdaten.

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

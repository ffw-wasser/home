> Historischer Arbeitsstand. Aktuelle Kalenderbedienung: [Kalender und Jahresplan](KALENDER-BEDIENUNG.md).
> Persönliche Einladungen und die zusätzliche Abfragefreigabe sind entfernt; jeder hinterlegte GF kann direkt erinnern.

# H₂O – Plattform, Kalender und Sicherheit

Stand: 27.10.2026. **Aktueller Einladungs-/Antwortstand: siehe Aktualisierung am Ende. Die nachfolgenden früheren Arbeitspakete dokumentieren den jeweiligen damaligen Lieferumfang.**
Ausgangscommit: `58558d32e5a19b6ccbd7e3ef34eac5058750796e`.
Branch: `feature/h2o-platform-calendar-security`. [PR #191](https://github.com/ffw-wasser/home/pull/191). App-Version des aktualisierten Hilfestands: `2026.10.27.7` (Veröffentlichung nach vollständiger CI).

## Ergebnis je Arbeitspaket

| Bereich | Ergebnis / verbleibende Grenze |
| --- | --- |
| Eine PWA | Android-Manifest mit festem, öffentlichem Start; Browser-Installationsdialog nach Antippen, Menü-Anleitung als Rückfall. iPhone mit schematischer Bildanleitung. Bestehende automatische Versionsprüfung beibehalten; sie verhindert Neuladen bei offenen Eingaben. Native Vorbereitungen archiviert, keine neuen nativen Apps. |
| Ersteinrichtung | Geführter Einstieg, Freigabe, Wahl der Anmeldeart, bestehende Passkey-/Passwortformulare, freiwillige Installation und Mitteilungen, Abschluss zu Terminen. Zurück/Überspringen, Fortschritt, Wiederherstellung über Verwaltung. Gültige Sitzungen starten direkt. Öffentliche Hilfe ohne Anmeldung bleibt erreichbar. Optionale persönliche Kalendereinladungen werden als noch nicht verfügbar erklärt. |
| Kalenderquelle | Bestehender ICS-Import und Terminidentitäten unverändert. Google-API-Transport vorbereitet und ohne OAuth-Konfiguration gesperrt. **Google-OAuth-Anbindung ist integriert; der Anwender hat Konfiguration und erfolgreiche Verbindung mit Bearbeitungsrechten bestätigt. Die gemeinsame Praxisprüfung beider Konten und automatische Synchronisation bleiben offen.** |
| Direkter Bearbeitungslink | In der Kalenderverwaltung Link kopieren und manuell in die Google-Beschreibung eintragen. `index.html?editEvent=<H2O-ID>` öffnet nach bestehender Verwaltungsanmeldung den Editor des Termins. Keine Zugangsrechte im Link. Rückkehr zum Google Kalender, ohne Garantie der ursprünglichen Terminansicht. Beim Speichern im neuen Google-Editor kann der Link direkt in die Beschreibung aufgenommen werden. |
| Zwei Administratoren | H₂O behält die bestehende serverseitige Verwaltungsautorisierung. Google-API verlangt zusätzlich einen gültigen Google-Token für den eingerichteten OAuth-Client und ausreichend Rechte am konfigurierten Kalender. Die Kalenderfreigabe an das zweite Google-Konto ist durch den Anwender bestätigt; H₂O meldet für dieses Konto „Bearbeitung erlaubt“. Kein Eigentümerwechsel. GF erhält durch diesen PR keine neuen Google-Rechte. |
| Teilnehmer | Mehrere anklickbare Gruppen plus individuelle Ergänzungen und Ausschlüsse; serverseitige Neuberechnung bei späteren Gruppenänderungen. Versionsprüfung, keine Ausweitung bei ungültigen/verlorenen Gruppen. Schlagwörter und bisherige manuelle Listen bleiben erhalten. |
| Persönliche Einladungen / Antworten | **Nicht aktiviert und nicht fertig implementiert.** Kein Versand, kein E-Mail-Profil, kein Hintergrundimport. Getesteter technischer Modellnachweis der vier Status und Schutz vor veralteten Beobachtungen. Keine bidirektionale Synchronisation zugesagt. |
| Datenschutz | Unter Infos Anbieteraufgaben, offizielle Informations-/Nachweislinks und Geltungsgrenzen. Keine Übernahme von Prüfsiegeln, keine Zertifizierung des Portals behauptet. Private Google-Kalender, privates OneDrive und kostenlose GitHub Pages werden nicht durch pauschale Workspace-/Enterprise-Zertifikate als zertifiziert ausgegeben. |
| Bestand | Bestehende Fachmodule erhalten. Neue Gruppenfelder ergänzen verschlüsselte Kalenderregeln; keine D1-Tabellenmigration und keine produktiven Datenänderungen. |
| Veröffentlichung | Der Auftrag vom 27.10.2026 gibt den implementierten Web-App-Stand zur Finalisierung frei; Merge und automatische Veröffentlichung folgen erst nach erfolgreicher vollständiger CI. Die tatsächliche Web-/Worker-Auslieferung wird anschließend separat geprüft. Die gemeinsame PWA aus PR #190 ist bereits in `main` (Version 2026.10.27.4). Google Kalender, OneDrive und produktiver Worker wurden durch diese Fortsetzung nicht geändert. Die gesondert beauftragte Apple-Rücknahme ist über Root-PR #2 übernommen. |

## Google-API: tatsächlich vorbereiteter Umfang

`cloudflare/push/google-calendar-api.js`, über die vorhandene serverseitig autorisierte
Route `/admin/portal/google-api/<aktion>`:

- `configuration`, `status`, `list`, `read`, `create`, `update`, `delete`.
- Aus `portal_config.calendarUrl` wird ausschließlich der bereits verbundene Kalender
  bestimmt. Kein frei übergebbarer Zielserver/Kalender; Weiterleitungen abgewiesen.
- Ohne `GOOGLE_CALENDAR_CLIENT_ID` bleiben alle Zugriffe außer Konfigurationsstatus gesperrt.
- Der Aufrufer muss zusätzlich zur H₂O-Verwaltungsautorisierung einen kurzlebigen
  `googleAccessToken` liefern. Audience, Ablauf, Scope und Google-`accessRole` werden
  unabhängig geprüft. Keine Tokenablage in D1, keine Protokollierung oder Tokenrückgabe aus API-Terminergebnissen. Der OAuth-Austausch liefert das kurzlebige Token ausschließlich an den autorisierten Verwaltungsbrowser.
- Leseberechtigung: `calendar.events.readonly` oder `calendar.events`;
  Änderungen: `calendar.events` und `writer`/`owner`. Keine ACL-Änderung.
- Lesen auf maximal 31 Tage/250 Einträge begrenzt; unvollständige Ergebnisse werden markiert.
- Anlegen verwendet eine stabile Vorgangs-ID. Änderungen/Löschen brauchen aktuelles ETag
  und `If-Match`; Konflikte werden abgewiesen. Vorhandene Gäste verhindern Änderungen.
  Änderungen an Serien-Mastern bleiben bis zum Integrationstest in Google Kalender.
- Keine Einladungen/Benachrichtigungen über diese Vorbereitung (`sendUpdates=none`).
  Teilnehmerfelder werden weder als Bearbeitungseingabe akzeptiert noch ausgelesen zurückgegeben.

**Der Google-Anmeldeablauf für die Verwaltung ist jetzt integriert und mit künstlichen
Konten im Browser geprüft.** Authorization Code mit PKCE, feste Redirect-URI,
verschlüsselter zeitbegrenzter Zustand und zufälliger Rückkanal statt eines Implicit Flow.
Die kurzlebige Google-Berechtigung liegt nur im Arbeitsspeicher des Verwaltungsbrowsers;
Sperren/Verlassen entfernt sie. Keine Refresh-Token oder Offline-Freigabe.
Der Anwender hat die reale Client-/Redirect-Konfiguration und die erfolgreiche Anmeldung mit Kalender-Bearbeitungsrechten bestätigt. Die gemeinsame Praxisprüfung echter Terminänderungen mit beiden Google-Konten bleibt offen. Die Google-Terminbearbeitungsoberfläche ist vollständig für einzelne Termine umgesetzt
(Anlegen, Ändern, Löschen mit Bestätigung, ETag-Konflikte, Datum/Zeitzonenprüfung und optionaler
Bearbeitungslink in der Beschreibung). Ganze Serien und Termine mit Gästen bleiben gesperrt.
Die Hintergrund-Synchronisation bleibt offen. Keine manuell eingefügten Tokens, keine
Google-Anmeldung für normale Mitglieder. Anleitung: `GOOGLE-KALENDER-EINRICHTUNG.md`.

## Warum Kalenderantworten noch gesperrt sind

Google liefert `attendees[].responseStatus`, aber keinen verlässlichen separaten
Zeitstempel je Teilnehmerantwort. `event.updated` beweist nicht die zeitliche Reihenfolge
einer individuellen Antwort gegenüber H₂O. Ein bloßer Vergleich dieses Zeitstempels wäre falsch.

Der isoliert getestete Vorschlag `replyProposal` bildet accepted/declined/tentative/
needsAction auf yes/excused/maybe/open ab. Er verwirft überholte Versionsbeobachtungen
und schützt vorhandene H₂O- sowie ältere Antworten ohne Herkunftskennzeichen vollständig.
Er schreibt **keine** Antworten in D1 und beweist keinen fertigen Abgleich.
Für die tatsächliche Integration fehlen insbesondere:

1. Freiwillige, eindeutig zugeordnete Kalenderadresse und Einwilligung; E-Mail-Zuordnung
   vor Nutzung prüfen, Entfernung/Widerruf und Mitgliedersperrung durchgängig behandeln.
2. Persistente Zuordnung von Google-ID, iCalUID, Serieninstanz und H₂O-ID ohne Änderung
   bisheriger IDs; Verschiebungen, Ausnahmen und Absagen testen.
3. Einladungen nur an tatsächliche Empfänger, ohne Offenlegung der übrigen Mitgliedsadressen.
   Öffentliche ICS-Quelle ausdrücklich auf sichtbare Teilnehmerfelder/Privatdaten prüfen.
4. Serverabgleich mit Delta-/Sync-Token, Wiederholung, atomarem Versionsvergleich,
   Fehlerbehandlung, Quoten und nachvollziehbarem Änderungsverlauf.
5. Konfliktanzeige oder explizite Priorität, wenn ein Mitglied nach einer H₂O-Antwort später
   im Kalender antwortet. Der konservative Modellvorschlag schützt H₂O und importiert dann nicht automatisch.
6. Google-, Apple- und Outlook-Testeinladungen; Unterschiede zwischen ICS-Abonnement,
   manuellem Export und echter Einladung dokumentieren. Bei Nutzung persönlicher
   Einladungen das zusätzliche ICS-Abonnement derselben Termine vermeiden.
7. Rückübertragung: Organizer-Zugriff darf nicht als persönliche Teilnehmerantwort
   missverstanden werden; eigene Teilnehmerberechtigung und Anbieterunterstützung prüfen.

## Sicherheitsprüfung und Befunde

Kostenlose lokale Quell-/Regressionsprüfung mit ausschließlich künstlichen Konten und
blockierten produktiven Diensten; **kein externes Pentest-Zertifikat**.

- 942 verbleibende Unit-/Regressionstests nach Entfernung der überholten nativen Tests erfolgreich, darunter Anmeldung, Rollenverlust, Sperrung,
  Wiederherstellung, Versionskonflikte, verschlüsselte D1-Daten, OneDrive und öffentliche Ressourcen.
- Google-spezifische Tests prüfen zusätzliche OAuth-Client-/Scope-/Kalendergrenzen,
  ETag-Konflikte und gesperrte Gästeänderungen gegen simulierte Antworten.
- Gruppen-Tests: Mehrfachauswahl, individuelle Ausnahmen, dynamischer Mitgliedsstatus,
  veraltete Gruppenversionen, unbekannte Gruppen, keine privaten Auswahlfelder im Mitgliederportal.
- Passwörter werden auf Nutzerwunsch ohne Mindestlänge, Komplexitätsvorgaben oder
  Trivialpasswort-Sperre akzeptiert; leer bleibt unzulässig. Die technische Obergrenze
  von 128 Zeichen/512 UTF-8-Bytes verhindert übergroße Eingaben. Bestehende Hashes,
  Pepper, Versuchslimits und Verwaltungsfreigabe bleiben erhalten.
- `npm audit --json`: 0 bekannte Schwachstellen (27.10.2026); dies beweist keine Fehlerfreiheit.
- Die bestehende ICS-Adresse ist öffentlich. Keine persönlichen Einladungs-/Mitgliederdaten,
  Zugangsdaten oder geschützten Informationen in Titel/Beschreibung/Ort veröffentlichen.
- Verwaltungs-PIN und H₂O-Link sind keine Google-Berechtigung. Der bestehende Worker
  verlangt für Verwaltungsrouten Dienstautorisierung und passende Datenquelle.
- Kein Zugriff auf laufende D1-/OneDrive-Instanzen, keine Einsicht in produktive
  Provider-Verträge, Freigabelisten oder Zertifikats-Scope-Dokumente. Daher keine Aussage,
  dass die konkrete Produktivkonfiguration vollständig sicher oder zertifiziert sei.

## Lokale Prüfung und offene Abnahme

Erfolgreich ausgeführt: vollständige Unit-Suite, Syntax, Bundle-/Release-Erzeugung,
Passkey- und Passwort-Browserabläufe, Kalendergruppen-Browserablauf einschließlich neuer
Mehrfachauswahl. Gemeinsame Hilfe und Originalbild des neuen Einstiegs aktualisiert.
Auch `tests/help-guide-browser.cjs`, `tests/deckel-startup-browser.cjs` und
`tests/portal-offline-browser.cjs` sind erfolgreich. Syntaxprüfung nach Testbereinigung: 271 JavaScript-Dateien,
0 Fehler. Hilfe-, Bundle- und Release-Konsistenz lokal erfolgreich. CI-Status siehe PR.

Chromium-Ansichten: Anmeldung/Passkey bei 320 px, Passwort bei 390 px und Layout 320/390/768 px;
Kalenderverwaltung 320/390/412/768/1024 px. Neuer Einrichtungsdialog zusätzlich
bei 320/390/768 px mit 100 % und 200 % Schriftgröße ohne seitlichen Überlauf geprüft. Browseremulation ersetzt **keine echten Geräte**.
Nicht geprüft: reale Android-WebAPK-Installation/Play Protect, iOS Home-Bildschirm und
Passkey-Synchronisation, echte Push-Zustellung, reale Microsoft-Konten, die gemeinsame Bearbeitung mit beiden Google-Konten, persönliche Einladungen und Kalenderantworten. Google-Anmeldung und Kalenderberechtigung für das eigene Konto sind inzwischen durch den Anwender bestätigt; die übrige Abnahme bleibt offen.

Der bisherige GitHub-Lauf bestand Unit-/Konsistenzprüfungen, lief aber bei der Browserinstallation
in das 5-Minuten-Limit. Das Limit wurde auf 12 Minuten erhöht; die Browserprüfungen
werden weiterhin vollständig ausgeführt. Vor Merge muss die gesamte GitHub-Action erfolgreich sein. Eine erfolgreiche CI ersetzt die ausstehende echte Google-Konfiguration und Integration nicht. Die inzwischen erteilte Freigabe zur Finalisierung betrifft den implementierten Web-App-Stand, nicht die fehlenden Einladungs-/Antwortfunktionen.
Rückfall: Den Release-Commit über einen geprüften Revert zurücknehmen. Bestehende ICS-/Anmeldepfade bleiben erhalten.

## Kosten

Keine kostenpflichtigen Dienste, Abonnements, Zertifizierungen oder Lizenzen aktiviert.
Zusätzliche laufende Plattformkosten durch diesen vorbereiteten Stand: **0 €**.
Google-API- und Worker-/D1-Kontingente vor echter Synchronisation anhand des Abfrageintervalls
prüfen. Bei Quotenende keine kostenpflichtige Hochstufung ohne Zustimmung.
Externe Zertifizierung bleibt eine eigene spätere Entscheidung; aktuell kein Auftrag/Preis.

## Offizielle Quellen (geprüft am 27.10.2026)

- [Google: OAuth für Browseranwendungen; Empfehlung Authorization Code mit PKCE](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)
- [Google: Event-Felder und Teilnehmerantworten](https://developers.google.com/workspace/calendar/api/v3/reference/events)
- [Cloudflare: Compliance-Nachweise](https://www.cloudflare.com/trust-hub/compliance-resources/)
- [Google: Sicherheitsinformationen](https://safety.google/)
- [Microsoft: Compliance nach Produkt/Geltungsbereich](https://learn.microsoft.com/en-us/compliance/regulatory/offering-home)
- [GitHub: Compliance-Berichte, insbesondere Enterprise-Geltungsbereich](https://docs.github.com/en/enterprise-cloud@latest/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/accessing-compliance-reports-for-your-organization)

## Fortsetzung am 27.10.2026

- Konflikte mit dem veröffentlichten PWA-Stand aus PR #190 aufgelöst. Moderne
  Mitgliedersitzungen speichern bei der Android-Installation keinen abgewiesenen Altlink.
  Der Browserdialog bleibt nach aktivem Antippen nutzbar; Installation bleibt freiwillig.
- Native Build-/TestFlight-Workflows bleiben entfernt. Root-PR #2 wurde übernommen;
  die öffentliche Apple-Zuordnungsdatei liefert HTTP 200 mit leeren applinks- und
  webcredentials-Listen. Apple-/Geräte-Caches können noch alte Zuordnungen enthalten.
- Google-Editor samt Bildern/Hilfe ergänzt. Zeiten werden unabhängig von der Gerätezone
  in Europe/Berlin interpretiert. Nicht existierende/mehrdeutige neue Uhrzeiten werden
  abgewiesen. Unveränderte Zeitpunkte behalten Sekunden und Zeitzonenbezug.
- Konflikte bewahren Eingaben; Wiederladen verlangt bei Änderungen eine Bestätigung.
  Verlassen/Sperren entfernt Dialog und Token; laufende Schreibvorgänge blockieren
  normale Navigation. Späte Antworten öffnen keine geschlossene Verwaltung neu.
- Direktlinks für reine Kalenderinformationen behoben (kein Zugriff auf noch nicht
  initialisierte Editierfunktionen); Kopieren zeigt eine eigene Rückmeldung.
- Der Diagnoseanker wird im gemeinsamen Hilfe-Generator gepflegt, damit er beim
  nächsten Hilfebau nicht wieder verschwindet.
- 950 Unit-/Regressionstests lokal erfolgreich. Browser: Google-PKCE, CRUD, Konflikte,
  verworfenes Abbrechen, Sommerzeitfehler, Ganztag und 320/390/768 px bei 100/200 %;
  Passkey, Passwort, Kalenderinformationen/Direktlink, Hilfe, Offline-Neustart,
  Start/Wiederaufnahme und Mitteilungen erfolgreich. Alle Konten künstlich.
- **Weiter offen und nicht als fertig ausgewiesen:** gemeinsamer Praxistest echter Änderungen mit beiden Google-Konten; freiwilliges E-Mail-Profil und dessen Verifizierung,
  privater Einladungsversand, dauerhafte Zuordnung und automatischer Antwortabgleich.
  Diese Funktionen sind nicht allein durch das Eintragen der OAuth-Schlüssel erledigt.
  Keine persönlichen Einladungen oder Rückmeldungen in den öffentlichen Kalender schreiben.
- Version 2026.10.27.5 ist zur Finalisierung freigegeben. Vor dem Merge den vollständigen CI-Abschluss am aktuellen PR-Commit prüfen und danach die tatsächliche Web-/Worker-Auslieferung verifizieren.
- Die vier überholten aktiven nativen Testdateien sind entfernt. Der Jahresplan-Test prüft jetzt echte Browser-PDF-Downloads; 942 verbleibende Unit-/Regressionstests sind erfolgreich. iPhone-Web-App, Web-Passkeys und Offline-Nutzung bleiben geprüft.

## Aktualisierte Bedienhilfe nach der Google-Einrichtung

Der Anwender hat die erfolgreiche Google-Verbindung mit Bearbeitungsrechten bestätigt.
„Google-Kalender pflegen“ erklärt nun vorrangig die persönliche Verbindung, neue und
bestehende Google-Termine in H₂O, separate Gruppenauswahl und individuelle Ausnahmen,
Speicherung/Konflikte sowie Bearbeitungslinks. Das direkte Google-Beispiel und die
Schlagwortreferenz bleiben aufklappbar. Die bestehende Farbanbindung wird als getrennter
Zugriff erklärt. Hilfe und Originalbild sind mit künstlichen Daten aktualisiert.
Die Bestätigung ersetzt keinen gemeinsamen Praxistest realer Terminänderungen mit
beiden Konten; persönliche Einladungen/Antwortabgleich bleiben unimplementiert.

## Kalender-Arbeitsansicht und Push-Geräte, 27.10.2026

Neue Kalendertermine werden ausschließlich in Google angelegt. Die Anlegen-Funktion
und API-Aktion `create` in H₂O sind entfernt. Bestehende Google-Termine sind weiter
in der Anwendung bearbeitbar; dafür bleibt der Web-OAuth-Client nötig. Calendar API,
Google-Seitenleiste und Farbanbindung werden weiter verwendet. Terminart, Kleidung,
Ort und Gruppen lassen sich aus importierten Vorgaben lokal nachbearbeiten. Die
manuelle Farbpalette und lange Google-Beispiele stehen nicht mehr in der Arbeitsansicht.

Unter Konto & Sicherheit stehen Push und Aktualisieren direkt sichtbar, Anmelde-/
Geräteaktionen und WhatsApp-Einstellungen aufklappbar. Der Push-Dienst bestätigt
eigene Registrierungen und zählt maximal fünf pro Zugang. Bestehende Endpunkte
können auch am Limit erneuert werden. Ein ausdrücklich bestätigtes Zurücksetzen
löscht atomar nur die Push-Verbindungen des angemeldeten Zugangs, ohne Sitzungen,
Anwesenheiten oder Buchungen zu verändern. Andere Mitglieder bleiben unberührt.
Echte iPhone-Zustellung bleibt gesondert zu prüfen.


## Aktualisierung: persönliche Einladungen, Antworten und bereinigtes H₂O-Konto

Implementierter Umfang für Version 2026.10.28.1. Quelltermine bleiben im bisherigen öffentlichen
Google-Kalender. Ein eigenständiger Apps-Script-Trigger liefert persönliche Einladungen
in einen zusätzlich erstellten privaten Kalender. Pro Mitglied und Termin genau ein
Gast; Gastweitergabe, Gastbearbeitung und Sichtbarkeit anderer Gäste sind deaktiviert.
Vor jedem Lauf werden die privaten Kalenderfreigaben geprüft. Öffentliches Add-on,
Farbbrücke und Quellkalender enthalten keine Mitgliedsadressen.

Mitglieder geben ihre Kalenderadresse selbst frei und bestätigen einen einmaligen,
24 Stunden gültigen E-Mail-Link nach persönlicher H₂O-Anmeldung. Pro Konto maximal
3 Anfragen pro Tag mit zehn Minuten Abstand. Die eindeutige Adresse wird mit HMAC
indiziert; E-Mail, Bestätigungstoken und Einladungszuordnung liegen verschlüsselt in D1.
Der Apps-Script-Verbindungsschlüssel wird in H₂O nur gehasht gespeichert; keine Google-
Zugangs- oder Refresh-Token in H₂O. Das Skript fordert zum Ändern von Kalenderereignissen
nur den Scope für selbst angelegte Kalender an. ACL-Lesezugriff dient der Privatsphäre-
Prüfung; E-Mail-Versand dient ausschließlich der angeforderten Adressbestätigung.

Wirksame Empfänger, Freigaben, aktuelle Mitgliedschaft, Kalenderstand und Versionen
werden vor Versand und Antwortübernahme erneut geprüft. Begrenzte Läufe und atomare
D1-Versionsprüfungen verhindern überholte Übernahmen. Antworten und Beobachtungsstand
werden gemeinsam gesichert. Google-Sync-Token werden erst nach bestätigter Übernahme
fortgeschrieben; 410 führt zu erneutem Lesen. Bestehende H₂O-Antworten werden durch
needsAction nicht gelöscht. Während aktiver Einladung ist der Kalender die Antwortquelle.
Nach Widerruf ist die direkte H₂O-Antwort wieder möglich; entfernte Einladungen werden
beim nächsten erfolgreichen Abgleich abgesagt. Abgelaufene Einladungen werden automatisch entfernt und bei den Mitgliedern
zurückgezogen; der Anbieter kann dies als Absage anzeigen. Die lokale Zuordnung wird
ohne E-Mail oder Beschreibung archiviert. Gespeicherte H₂O-Antworten bleiben erhalten. Antworten nach Terminbeginn werden
nicht übernommen. Erneute Freigaben nach Absage erhalten eine neue Google-Kennung;
alte Antworten können die neue Einladung nicht verändern. Abgeschlossene Absagen entfernen die
private E-Mail und Beschreibung aus der lokalen Zustellzuordnung.

WhatsApp-Einstellungen, Versandoberfläche, Teilen-/Rückkehraktionen und die zugehörigen
veralteten Tests sind entfernt. Alte API-Routen geben 410 ohne Kontaktdaten zurück.
Frühere persönliche H₂O-Terminlinks bleiben mit bestehender Anmeldung verwendbar.
Ausschließlich für WhatsApp gehaltene Portal-Kontaktattribute entfallen beim nächsten
Mitgliederabgleich. Konto & Sicherheit verwendet einheitliche einzelne Karten ohne
verschachtelte Umrandungen; verbundene Kalenderdaten stehen kompakt mit aufklappbaren
Einstellungen. Aktive persönliche Einladungen bieten keine zusätzliche ICS-Übernahme.

Automatisierte Prüfungen verwenden künstliche Identitäten und simulierte Google-/E-Mail-
Dienste. Ein echter Google-/Apple-/Outlook-Versand und dessen Rückantwort werden dadurch
nicht bestätigt. Die Google-Einrichtung und die providerübergreifende praktische Abnahme
bleiben nach Veröffentlichung durchzuführen. [Einrichtung](google-calendar-invitations/README.md).

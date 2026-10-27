# H₂O – Plattform, Kalender und Sicherheit

Stand: 27.10.2026. **Teilumsetzung und technische Vorbereitung; keine Freigabe für Produktion.**
Ausgangscommit: `58558d32e5a19b6ccbd7e3ef34eac5058750796e`.
Branch: `feature/h2o-platform-calendar-security`. Vorbereitete App-Version: `2026.10.27.4`.

## Ergebnis je Arbeitspaket

| Bereich | Ergebnis / verbleibende Grenze |
| --- | --- |
| Eine PWA | Android-Manifest mit festem, öffentlichem Start; Browser-Installationsdialog nach Antippen, Menü-Anleitung als Rückfall. iPhone mit schematischer Bildanleitung. Bestehende automatische Versionsprüfung beibehalten; sie verhindert Neuladen bei offenen Eingaben. Native Vorbereitungen archiviert, keine neuen nativen Apps. |
| Ersteinrichtung | Geführter Einstieg, Freigabe, Wahl der Anmeldeart, bestehende Passkey-/Passwortformulare, freiwillige Installation und Mitteilungen, Abschluss zu Terminen. Zurück/Überspringen, Fortschritt, Wiederherstellung über Verwaltung. Gültige Sitzungen starten direkt. Öffentliche Hilfe ohne Anmeldung bleibt erreichbar. Optionale persönliche Kalendereinladungen werden als noch nicht verfügbar erklärt. |
| Kalenderquelle | Bestehender ICS-Import und Terminidentitäten unverändert. Google-API-Transport vorbereitet, standardmäßig gesperrt. **Google-OAuth-Anbindung in der Oberfläche und automatische Synchronisation fehlen noch.** |
| Direkter Bearbeitungslink | In der Kalenderverwaltung Link kopieren und manuell in die Google-Beschreibung eintragen. `index.html?editEvent=<H2O-ID>` öffnet nach bestehender Verwaltungsanmeldung den Editor des Termins. Keine Zugangsrechte im Link. Rückkehr zum Google Kalender, ohne Garantie der ursprünglichen Terminansicht. Automatisches Eintragen in Google noch offen. |
| Zwei Administratoren | H₂O behält die bestehende serverseitige Verwaltungsautorisierung. Google-API verlangt zusätzlich einen gültigen Google-Token für den eingerichteten OAuth-Client und ausreichend Rechte am konfigurierten Kalender. Martins Freigabe an das zweite Google-Konto ist **nicht vorgenommen oder geprüft**. Kein Eigentümerwechsel. GF erhält durch diesen PR keine neuen Google-Rechte. |
| Teilnehmer | Mehrere anklickbare Gruppen plus individuelle Ergänzungen und Ausschlüsse; serverseitige Neuberechnung bei späteren Gruppenänderungen. Versionsprüfung, keine Ausweitung bei ungültigen/verlorenen Gruppen. Schlagwörter und bisherige manuelle Listen bleiben erhalten. |
| Persönliche Einladungen / Antworten | **Nicht aktiviert und nicht fertig implementiert.** Kein Versand, kein E-Mail-Profil, kein Hintergrundimport. Getesteter technischer Modellnachweis der vier Status und Schutz vor veralteten Beobachtungen. Keine bidirektionale Synchronisation zugesagt. |
| Datenschutz | Unter Infos Anbieteraufgaben, offizielle Informations-/Nachweislinks und Geltungsgrenzen. Keine Übernahme von Prüfsiegeln, keine Zertifizierung des Portals behauptet. Private Google-Kalender, privates OneDrive und kostenlose GitHub Pages werden nicht durch pauschale Workspace-/Enterprise-Zertifikate als zertifiziert ausgegeben. |
| Bestand | Bestehende Fachmodule erhalten. Neue Gruppenfelder ergänzen verschlüsselte Kalenderregeln; keine D1-Tabellenmigration und keine produktiven Datenänderungen. |
| Veröffentlichung | Ausschließlich Feature-Branch und Draft-PR. `main`, Google Kalender, OneDrive und produktiver Worker nicht geändert. |

## Google-API: tatsächlich vorbereiteter Umfang

`cloudflare/push/google-calendar-api.js`, über die vorhandene serverseitig autorisierte
Route `/admin/portal/google-api/<aktion>`:

- `configuration`, `status`, `list`, `read`, `create`, `update`, `delete`.
- Aus `portal_config.calendarUrl` wird ausschließlich der bereits verbundene Kalender
  bestimmt. Kein frei übergebbarer Zielserver/Kalender; Weiterleitungen abgewiesen.
- Ohne `GOOGLE_CALENDAR_CLIENT_ID` bleiben alle Zugriffe außer Konfigurationsstatus gesperrt.
- Der Aufrufer muss zusätzlich zur H₂O-Verwaltungsautorisierung einen kurzlebigen
  `googleAccessToken` liefern. Audience, Ablauf, Scope und Google-`accessRole` werden
  unabhängig geprüft. Keine Tokenablage in D1, keine Rückgabe/Protokollierung.
- Leseberechtigung: `calendar.events.readonly` oder `calendar.events`;
  Änderungen: `calendar.events` und `writer`/`owner`. Keine ACL-Änderung.
- Lesen auf maximal 31 Tage/250 Einträge begrenzt; unvollständige Ergebnisse werden markiert.
- Anlegen verwendet eine stabile Vorgangs-ID. Änderungen/Löschen brauchen aktuelles ETag
  und `If-Match`; Konflikte werden abgewiesen. Vorhandene Gäste verhindern Änderungen.
  Änderungen an Serien-Mastern bleiben bis zum Integrationstest in Google Kalender.
- Keine Einladungen/Benachrichtigungen über diese Vorbereitung (`sendUpdates=none`).
  Teilnehmerfelder werden weder als Bearbeitungseingabe akzeptiert noch ausgelesen zurückgegeben.

**Das ist noch kein verwendbarer Google-Anmeldeablauf.** Keine Tokens manuell in eine
Benutzeroberfläche kopieren. Vor Erweiterung OAuth Authorization Code mit PKCE,
Client-/Redirect-Konfiguration, Zustimmungsbildschirm, individuelle Bindung an den
berechtigten H₂O-Administrator sowie Ablauf/Widerruf sicher implementieren und testen.
Google rät von einer selbst implementierten Implicit-Flow-Lösung ab.
Ein Google-Login darf für normale Portalmitglieder nicht Voraussetzung werden.

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

- 944 Unit-/Regressionstests erfolgreich, darunter Anmeldung, Rollenverlust, Sperrung,
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
`tests/portal-offline-browser.cjs` sind erfolgreich. Syntaxprüfung: 269 JavaScript-Dateien,
0 Fehler. Hilfe-, Bundle- und Release-Konsistenz lokal erfolgreich. CI-Status siehe PR.

Chromium-Ansichten: Anmeldung/Passkey bei 320 px, Passwort bei 390 px und Layout 320/390/768 px;
Kalenderverwaltung 320/390/412/768/1024 px. Browseremulation ersetzt **keine echten Geräte**.
Nicht geprüft: reale Android-WebAPK-Installation/Play Protect, iOS Home-Bildschirm und
Passkey-Synchronisation, echte Push-Zustellung, reale Microsoft-Konten, Google OAuth,
Kalenderfreigaben, persönliche Einladungen und Kalenderantworten. Diese Abnahme fehlt.

Vor Merge muss die vollständige GitHub-Action erfolgreich sein. Eine erfolgreiche CI
ersetzt weder die ausstehende Integration noch eine ausdrückliche Veröffentlichungsfreigabe.
Rückfall: Draft-PR nicht übernehmen; nach einem später freigegebenen Release kann der
Commit zurückgenommen werden. Bestehende ICS-/Anmeldepfade bleiben erhalten.

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

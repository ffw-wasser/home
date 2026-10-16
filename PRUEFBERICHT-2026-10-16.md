# Plausibilitätsprüfung Feuerwehr Wasser – 16. Oktober 2026

Ausgangsstand: `329c48b`, Version **2026.10.15.25**.
Ergebnisstand: **2026.10.16.1**. Bearbeitet wurde `ffw-wasser/home`, Branch `main`.
Produktive OneDrive-Dateien, Mitgliedskonten und Cloudflare-Daten wurden nicht verändert.

## Zuerst fertiggestellte Anleitungen

Vorhandene Anleitungen identifiziert: Hilfe in `index.html`, Hilfetexte und
Installationsbereich in `deckel.html`, `README.md`, `README-HANDY-DECKEL.md` sowie
`cloudflare/push/PORTAL.md`, `CENTRAL.md`, `README.md` und `CHALLENGE.md`.

- Haupt-App: bebilderte Hilfe zu Kalenderverwaltung, Terminarten, Sonderproben,
  öffentlicher Kalenderansicht, abgelaufenen Terminen, Rückmeldungen und Anwesenheit.
  Getränkeablauf auf die persönliche Namenskarte korrigiert; zentrale Speicherung
  und zusätzliche D1-Sicherung erklärt.
- Handy: aufklappbare Hilfe zu allen vier Bereichen, Speicherrückmeldungen,
  Installation, Erinnerungen und persönlichem Zugang.
- Alte Anleitung „Handy-Deckel ohne Server“ durch die aktuelle Portal-Anleitung
  ersetzt; den älteren Synchronisationsmodus ausdrücklich abgegrenzt.
- Ausschließlich vorhandene Originalbilder verwendet:
  `assets/drinks/h2o-portal-white.png`, `assets/drinks/bierfass.webp`,
  `assets/drinks/bierglas.svg`, `assets/drinks/weinglas.svg`, `taktik-lf10.webp`.
  Keine generierten Bilder. Alle neuen Bildpfade existieren; Browserdekodierung geprüft.
- Kalenderdokumentation um Empfänger, iPad-Terminart, Cron-Snapshots,
  Sechs-Stunden-Bereinigung und Grenzen der öffentlichen Ansicht ergänzt.

## Behobene Fehler

| Befund | Korrektur und Nachweis |
| --- | --- |
| Neuere Kalenderfunktionen existierten nur im fertigen Worker-Bundle. Ein Neubau hätte öffentliche Kalenderansicht, Empfängerbeschränkung, iPad-Terminart und Bereinigung entfernt. | Die bereits vorhandene Implementierung nach `portal.js` und `worker.js` zurückgeführt. Bundle daraus gebaut. Neuer Test vergleicht sämtliche Build-Quellen mit dem ausgelieferten Bundle. |
| Verschobene Termine konnten wegen der ursprünglich gespeicherten Ablaufzeit vorzeitig bereinigt werden. | Aktuelles Kalenderende hat Vorrang vor der gespeicherten Ablaufzeit. Regressionstest erhält Freigabe und Rückmeldung bei gleicher Termin-ID. |
| Kalenderverwaltung betrachtete bis zu 24 Stunden alte Snapshots als aktuell; Freigaben nutzten diesen Stand. | Listen sind nach 15 Minuten veraltet; Freigaben nutzen die reguläre Kalenderprüfung. Bei Kalenderausfall keine neue Freigabe und keine Bereinigung. |
| Nicht-Empfänger einer Sonderprobe erschienen am iPad als „ohne Rückmeldung“. | Rückmeldungsanzeige und Übernahme von Entschuldigungen auf die freigegebene Empfängerliste begrenzt. Im Browser mit zwei künstlichen Mitgliedern geprüft. |
| Beim manuellen Kalenderwechsel wurde das Browser-Ereignis als Flag für automatische Auswahl interpretiert. | Expliziter Aufruf des Auswahlhandlers. „Ohne Kalendertermin / spontan“ bleibt nach Aktualisierung erhalten. Browser-Regressionstest. |
| Laufender Einsatz war beim manuellen Kalenderwechsel nicht im selben Schutz wie die Anwesenheitserfassung enthalten. | Wechsel bei laufendem Einsatz blockiert; Terminart wird dann nicht automatisch verändert. Browser-Regressionstest. |
| „Neueste Ansicht laden“ schützte offene Getränkebuchungen, aber keine unbestätigten Terminantworten. | Offene Portalantwort wird in die Neuladesperre einbezogen. Unit-Test und simulierter 503-Fehler im Browser. |
| Tests nutzten vor der Cron-Umstellung einen direkten Kalenderabruf beim Listenlesen; Update-Test kannte die neue URL-Navigation nicht. | Fixtures an tatsächlichen Cron-Ablauf und Browser-URL-Verhalten angepasst. Versions-, Fragment- und Datenschutzprüfungen bleiben erhalten. |

## Menü und Einstellungen

Die tatsächlich sichtbare Hauptnavigation wurde geprüft; alte verborgene HTML-
Schaltflächen sind nicht mit sichtbaren Menüpunkten gleichzusetzen. Das Menü hat
**Getränke, Historie, Statistik, Einstellungen, Hilfe**. Termin und Getränke bleiben
als schnelle Hauptaktionen erreichbar. Der zusätzliche Getränke-Menüeintrag bleibt
als vertrauter Zugang erhalten.

Umgesetzt:

- „Sicherheit“ in der Einstellungsübersicht heißt eindeutig **Admin-Passwort**.
- „Qualität und Sicherheit“ heißt **Sicherungspunkte**; der Unterschied zur
  vollständigen Datensicherung wird erklärt.
- Gruppen heißen **Mitglieder, Termine und Verwaltung** sowie
  **Berichte, Statistik und Sicherung**.
- **Treuepunkte** sind direkt in der Getränkeverwaltung sichtbar und nennen auch
  Geburtstagsbonus und Challenge. Die technische Einrichtung bleibt eingeklappt
  unter **Verbindungen & Getränke-PINs**.
- „Handy-Deckel“ erläutert seinen technischen Zweck und verweist für persönliche
  QR-Zugänge und Kalender auf **H₂O Portal**.
- Neue Hilfe „Wo finde ich was?“ erklärt die Navigation.

Keine Funktionen oder bestehenden Zugänge entfernt. Menüziele, Rückweg aus der
Getränkeverwaltung und Schutz der Mitgliederverwaltung ohne OneDrive bzw. ohne
Admin-Freigabe wurden im Browser geprüft. Die vier Handybereiche wechseln korrekt
und erhalten eine noch unbestätigte Terminantwort.

Mögliche spätere Vereinfachung: technische Handy-Einrichtung und Kontodienst unter
„Verbindungen“ zusammenführen. Das erfordert eine gesonderte Prüfung der älteren
GitHub-/OneDrive-Zugänge und wurde deshalb nicht als beiläufiger Umbau umgesetzt.

## Ausgeführte Prüfungen

**410 von 410 automatisierten Tests erfolgreich**, keine übersprungenen Tests.
Der Ausgangslauf hatte 391 erfolgreiche und 9 fehlgeschlagene Tests.
**132 JavaScript-/CJS-Dateien** mit `node --check` geprüft, keine Syntaxfehler.
`git diff --check` ohne Fehler.

| Bereich | Nachweis / Ergebnis |
| --- | --- |
| Kalender | UID-Stabilität, Absagen, Serienausnahmen, Winterzeit, Jahreswechsel, automatische Erkennung und explizite Freigabe getestet. |
| Terminarten | Alle fünf iPad-Terminarten serverseitig gespeichert und zurückgelesen; falsche Werte abgewiesen; Vorauswahl im Browser geprüft. |
| Sonderproben | Empfängerbeschränkung in Liste, Antwort, GF-Übersicht und Versand getestet; leere, doppelte und fremde Empfänger abgewiesen. |
| Abgelaufene Termine | Nächste Auswahl im Browser; sechs Stunden Schonfrist, verschobener Termin, Kalenderausfall und konkurrierende Regeländerung im Worker getestet. |
| Anmeldungen / Anwesenheit | Versionierte und idempotente Antworten; Zusage bleibt von Anwesenheit getrennt. Bestehende Tests für Terminfortsetzung, Abbruch, Statusänderungen und Abschluss erfolgreich. |
| Protokolle / Historie | Bestehende Export-, CSV-, Berichts-, Einsatzkorrektur-, Reservezeit-, Sicherungs- und Historientests erfolgreich. Keine produktiven Berichte erzeugt. |
| OneDrive | Bestehende Tests für Anfragen, Sitzung, Rückkehr nach Anmeldung, Konflikte, private Administration und Sicherungsintegrität erfolgreich. |
| Worker / Cloudflare | Verschlüsselung, zentrale Buchungen, Rollen, Bonus, Push-Empfänger und Bereinigung mit lokaler SQLite-Datenbank und simulierten Netzantworten getestet. Reproduzierbares Bundle. |
| Version / Service Worker | Gemeinsame Release-Version und Cache-Version aktualisiert; bestehende Release- und Privatcache-Tests erfolgreich. |
| Rechte / Datenschutz | Admin-Token erforderlich; falsche Mitgliedszugänge und selbst behauptete GF-Rolle abgewiesen. Öffentlicher Kalender enthält weder Namen, Rückmeldungen, Kalenderadresse noch beschränkte Sonderproben. |
| Layout / Navigation | Isolierter Edge/Chromium-Browser, 320/390/768/1024/1280 Pixel: Hilfeseiten und Einstellungen ohne horizontalen Überlauf; Handy-Kalender zusätzlich bis 1024 Pixel. Originalbilder laden. Keine JavaScript-Laufzeitfehler oder fehlenden angefragten lokalen Ressourcen. |
| Links / Assets | Lokale HTML-, CSS-, Manifest- und Markdown-Dateiverweise geprüft, keine fehlenden Ziele. Externe URLs und sämtliche dynamischen Laufzeitpfade sind dadurch nicht vollständig geprüft. |

Reproduktion aus dem Repository-Verzeichnis:

```text
node cloudflare/push/build.cjs
node scripts/update-release.cjs
node --test tests/*.test.cjs
node scripts/check-browser.cjs
```

Der Browsercheck benötigt Playwright und standardmäßig Microsoft Edge; alternativ
`QA_BROWSER` auf einen installierten unterstützten Browserkanal setzen. Playwright
kann über `NODE_PATH` bereitgestellt werden. Alle externen Anfragen werden blockiert
oder mit ausdrücklich künstlichen Antworten simuliert. Er benötigt keine echten
Mitgliedsdaten, Zugangstoken oder Produktivkonten.

## Noch erforderlich: Cloudflare-Veröffentlichung und reale Geräteprüfung

Die Website-Veröffentlichung aktualisiert den bestehenden Worker **nicht**.
Cloudflare wurde in dieser Bearbeitung nicht deployed und dessen aktueller
Produktionsstand nicht behauptet oder verifiziert.

1. Vollständige bestehende D1-Datenbank sichern; bestehende Secrets und Bindung
   `DB` erhalten. Keine neue Datenbank anlegen und keine Kontenübernahme wiederholen.
2. Vollständigen aktuellen Inhalt von `cloudflare/push/worker.bundle.js` im
   vorhandenen Worker **feuerwehr-wasser-deckel-push** veröffentlichen. Alternativ
   den vorhandenen Wrangler-Ablauf mit dessen geprüfter Konfiguration verwenden.
3. Cron **jede Minute** prüfen (`* * * * *` steht bereits in `wrangler.jsonc`).
   Ohne funktionierenden Cron können Listen veralten; Neuladen des Portals allein
   ersetzt die Google-Synchronisierung nicht.
4. `/health` prüfen (`portalVersion: 1`), dann in der geschützten Verwaltung
   „Kalendereinträge laden“ und einen Testtermin prüfen. Die Listenantwort muss
   `recipientFeatureVersion: 1` und `attendanceTypeVersion: 1` liefern.
   `/health` allein bestätigt diese Funktionen noch nicht.
5. Mit einem eigenen freigegebenen Testzugang Zusage, Entschuldigung, Empfängerwechsel,
   Terminart und Rückmeldung am iPad prüfen. Öffentlich keine Namen oder
   beschränkten Sonderproben sichtbar machen. Keine echten Zahlungen zum Test buchen.
6. Auf echtem iPad/iPhone und Android Installation, Push-Annahme/Anzeige,
   OneDrive-Anmelderückkehr sowie Speichern/Ersetzen eines Test-Terminpakets prüfen.
   Nach Website-Update Versionsanzeige **2026.10.16.1** kontrollieren.
7. Cron-Fehler, D1-/Worker-Limits und tatsächlichen Kalenderabruf nach Deployment
   kontrollieren. Eine angenommene Push-Nachricht ist kein Zustell-/Lesebeleg.

## Grenzen und offene Risiken

- Browserprüfung mit emulierten Breiten ersetzt keine echte iPadOS-/Safari-Prüfung.
  Microsoft-Login, Google-Kalender, produktive D1-Bindung und echte Push-Geräte
  wurden nicht live verwendet.
- Statische Analyse und Tests sind keine vollständige Sicherheits- oder rechtliche
  Datenschutzprüfung. Persönliche Links bleiben Zugangsberechtigungen. Rollenentzug
  wirkt im Worker erst nach erfolgreichem Mitgliederabgleich.
- Öffentliche Kalenderansicht zeigt nur allgemein freigegebene Termine mit neutralen
  Titeln. Beschränkte Sonderproben benötigen die geschützte Verbindung.
- Die Sechs-Stunden-Bereinigung prüft nicht, ob jemand das separate Terminprotokoll
  bereits gespeichert hat. Abschluss und tatsächliche Ablage bleiben nötig.
  Bei Ausfällen kann die Bereinigung später stattfinden; alte nicht mehr zuordenbare
  Rückmeldungen unterliegen zusätzlich der 400-Tage-Bereinigung.
- Gebühren-/Kontingentfragen, extern erreichbare Links und Wiederherstellung aus
  echten Backups wurden nicht live geprüft. Ein OneDrive-Backup allein sichert im
  zentralen Betrieb nicht alle aktuellen D1-Daten.

## Nachprüfung und redaktionelle Korrekturen – Version 2026.10.16.2

Nach der ursprünglichen Prüfung wurden die GitHub-Dateien **erneut unabhängig
ausgelesen**. Die eingebauten Hilfen sind auf den 16.10.2026 datiert; die
Portal-Dokumentation beschreibt die Auswahl der iPad-Terminart jetzt korrekt
unter **Einstellungen → H₂O Portal → Kalendereinträge**. Beide App-Versionen
und der Service-Worker-Cache wurden gemeinsam auf `2026.10.16.2` angehoben.

Zusätzliche Kontrollen direkt gegen den GitHub-Stand:

- **131 lokale Referenzen** in Haupt-/Handy-HTML, Manifesten und sechs Markdown-
  Dateien mit dem GitHub-Dateibaum verglichen: **keine fehlenden Ziele**.
  Einschließlich der Originalgrafiken unter `assets/drinks/` und
  `taktik-lf10.webp`.
- **Neun besonders relevante JavaScript-Dateien** (Portal, Worker-Quellen und
  Bundle, Update- und Erfassungscode) im V8-Parser geprüft: **keine Syntaxfehler**.
  Die Quellmodule `portal.js`, `central.js`, `challenge.js` und
  `worker.js` sind im Bundle inhaltlich unverändert enthalten.
- Mit künstlichen Daten die **Bereinigung abgeschlossener Termine**, den
  Schutz einer **verschobenen Termin-ID** sowie das Erhalten von
  **Geburtstagszuordnungen und zukünftigen Terminen** nochmals geprüft.
  Zusätzlich geprüft, dass die öffentliche Kalenderantwort keine echten
  Originaltitel, Geburtstage oder Empfängerlisten ausgibt.
- Release-Daten, iPad-Version, Handy-Version, Worker-Cache und
  `worker.bundle.js` stimmen überein.

Die oben dokumentierten **410 Tests** stammen aus dem bereits ausgeführten
ursprünglichen Prüflauf. Sie wurden bei dieser Nachprüfung **nicht erneut als
vollständiger Node-Testlauf** ausgeführt, da hier kein lokal ausgechecktes
Repository zur Verfügung stand. Die zusätzlichen gezielten V8-Prüfungen und
Referenzkontrollen ersetzen keine Browser-, OneDrive- oder iPad-Praxisprüfung.

**Produktionsabhängigkeit:** Der neue GitHub-Stand `2026.10.16.2` enthält
keine weitere Worker-Funktionsänderung gegenüber `2026.10.16.1`. Der Worker
muss jedoch weiterhin mit dem aktuellen `cloudflare/push/worker.bundle.js`
ausgerollt und mit aktiver Cron-Ausführung geprüft werden, sofern dies noch
nicht geschehen ist. Bei der Nachprüfung gab es keinen Zugriff auf die
produktive Cloudflare-Konfiguration oder echte Mitgliederkonten.

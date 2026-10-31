# Privater iPhone-Mitgliederpilot · Build 1015

Der Mitglieder-Build öffnet das echte H₂O-Portal unter
`https://ffw-wasser.github.io/home/deckel.html`. Die Apple-Demo bleibt mit
`H2O_APP_REVIEW` und ihrer eigenen Domain getrennt erhalten. Zugang, Passwort,
Passkeys und Mitgliedsrechte verwenden die bestehende Portalprüfung.

## Umgesetzter Stand

- Original-Icon als kleines Bild; zweizeilige Kopfzeile mit festem Platz für beide Widgetgrößen.
- Ein Widget-Tipp öffnet Termine; die bereits geöffnete App behält ihre Sitzung und wird nicht unnötig neu geladen.
- Übertragen werden nur Termin, Zeit, Ort, Kleidung und Rückmeldestatus aus der bereits persönlich gefilterten Portalantwort. Keine Namen, Zugangstoken, Passkeys, Einladungen oder Kalender-Abos.
- Widerruf mit HTTP 401/403, Abmeldung und Verlust der Identität leeren das Widget. Eine verspätete Fehlerantwort einer alten Sitzung löscht keine neu angemeldete Sitzung.
- Terminende und Zwölfstunden-Ablauf stehen als echte zukünftige Widgeteinträge fest. Auch ein leerer Kalender läuft ab. Bei Netzfehlern bleibt ausschließlich der zeitlich begrenzte letzte Stand.
- Uhrzeiten bleiben in Europe/Berlin. Ohne neuen App-Abruf gibt es keine Hintergrundabfrage und keine garantierte Sofortaktualisierung nach einer Änderung durch andere Mitglieder.

## Bauen und Signieren

1. Der Workflow `h2o-ios-widget.yml` prüft Swift-Richtlinien, kompiliert echte und Demo-Variante und rendert kleine/mittlere Widgetbilder mit künstlichen Daten. Die Bilder liegen im Artefakt `h2o-member-widget-layouts`.
2. `Check application changes` kann auf dem Pilotzweig manuell mit `build_member_pilot=true` gestartet werden. Erst nach den vollständigen Prüfungen wird ein signiertes Mitglieder-IPA erzeugt. Dieser Weg lädt nichts nach TestFlight.
3. Der Mitglieder-Signierworkflow baut genau den gewählten Commit ohne Review-Flag mit den echten App-Entitlements. Beide Profile müssen gültig, mit demselben Zertifikat signierbar und für die App Group freigegeben sein. Das Haupt-App-Profil muss zusätzlich Associated Domains zulassen. Bei fehlender Berechtigung bricht die Prüfung ab; sie schwächt die App-Berechtigungen nicht ab.
4. Der getrennte Workflow `h2o-ios-member-pilot.yml` ermöglicht später einen ausdrücklich gewählten TestFlight-Upload. Der Standard ist `false`. Der vorhandene GitHub-Environment-Name `apple-testflight-review` wird nur für bereits eingerichtetes Signiermaterial weiterverwendet; er wählt nicht den Demo-Modus aus.

## Vor Installation zu veröffentlichen

- Der Portalanteil dieses PRs muss online sein, damit die echte Portalantwort das native Widget füllt. Ein neues IPA allein veröffentlicht diese Web-Änderung nicht.
- Der separate Domain-PR in `ffw-wasser/ffw-wasser.github.io` stellt ausschließlich die Zuordnung für Team/App-ID und die beiden Portalpfade bereit. Die aktuelle Live-Zuordnung ist leer. Erst nach Übernahme, Apple-Cache-Abgleich und Gerätetest ist native Passkey-Anmeldung bestätigt. Passwortanmeldung und Einladungs-QR bleiben getrennt zu prüfen.

## Auf dem eigenen iPhone prüfen

Nach Installation in TestFlight zuerst das echte Portal öffnen und persönlich anmelden.
Termine laden, beide Widgetgrößen hinzufügen und Logo sowie vollständige Kopfzeile
bei normaler und getönter Darstellung kontrollieren. Einen Status ändern und das
Widget erneut ansehen. Das Widget aus einer anderen geöffneten Portalansicht antippen;
es muss Termine öffnen. Anschließend abmelden: persönliche Widgetdaten müssen verschwinden.
Auch QR-Login, Passkey, Passwort, PDF, fehlende Verbindung und große Schrift prüfen.

Die isolierte Demo kann diese echten Anmeldungstests nicht ersetzen. Signatur,
Upload und abgeschlossene Apple-Verarbeitung sind jeweils eigene Nachweise.
Keine App-Store-Einreichung und keine Verteilung an weitere Mitglieder erfolgen automatisch.

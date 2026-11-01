# Privater iPhone-Mitgliederpilot · Build 1018

Der Mitglieder-Build öffnet das echte H₂O-Portal unter
`https://ffw-wasser.github.io/home/deckel.html`. Die Apple-Demo bleibt mit
`H2O_APP_REVIEW` und ihrer eigenen Domain getrennt erhalten. Zugang, Passwort,
Passkeys und Mitgliedsrechte verwenden die bestehende Portalprüfung.

## Widgetkorrektur im Portal 2026.10.31.3

Der Wechsel zum Home-Bildschirm leert weiterhin die geschützten Ansichten, erhält aber den bestätigten Widgetstand und die freiwillige Push-Registrierung. Zuvor wurde beim Ausblenden versehentlich derselbe Ablauf wie bei einer Abmeldung ausgeführt. Abmeldung, Kontowechsel und erkannter Zugriffsverlust löschen die Widgetdaten weiterhin. Die Korrektur benötigt keinen neuen nativen Build; Build 1015 lädt das aktualisierte Portal. Der Browser-Regressionslauf prüft App → Home → App sowie das anschließende ausdrückliche Löschen der Identität mit künstlichen Daten.

## Umgesetzter Stand

- Build 1018 priorisiert Datum und Rückmeldung entsprechend der zweiten freigegebenen Vorschau: ausgeschriebener Wochentag/Monat und große Tageszahl im roten Feld, kräftiger Statusbalken mit Haken/Kreuz/Fragezeichen/Strich. Die Uhrzeit ist kleiner. Im kleinen Widget entfallen Ort und Kleidung; das mittlere behält beide Zusatzangaben. Die Terminauswahl bleibt unverändert.

- Build 1017: freigegebene Feuerwehr-Dienstkarte mit bordeauxroter Kante und schmalem gelbem Reflexstreifen. Beide Größen zeigen das Datum als rotes Kalenderfeld und die Uhrzeit besonders groß. Im kleinen Widget stehen Kalender und Termin nebeneinander; unten Rückmeldung und Ort. Im mittleren Widget stehen Kalender links, Termin/Uhrzeit/Ort/Kleidung rechts und die ausgeschriebene Datumszeile unten. Nur ein tatsächlicher Termin „Probe“ erhält die Überschrift „Nächste Probe“; andere Titel bleiben erhalten. Leere und veraltete Kalenderstände bleiben gekennzeichnet.
- Ab Build 1017 ist die Verschlüsselungsangabe aus PR #243 im Paket enthalten; der bereits hochgeladene Build 1016 benötigt noch die einmalige manuelle Antwort.

- Build 1016: kompakte einzeilige Kopfzeile mit Original-Wappen. Im kleinen Widget folgen Termin, Datum, große Uhrzeit und farbige Rückmeldeplakette direkt aufeinander. Im mittleren Widget stehen Datum und Uhrzeit links in einer eigenen Fläche, Termin, Ort und Kleidung rechts; der Status steht oben. Keine flexible Leerfläche zwischen Titel und Datum.
- Kalender-Rückmeldungslinks öffnen in Build 1016 direkt den betreffenden Termin im vollständigen Portal mit Navigation und Widget-Aktualisierung. Die separate Browser-Rückmeldeseite ersetzt die App-Ansicht nicht mehr. Nur eine gültige Termin-ID wird übernommen.
- Ein Widget-Tipp öffnet Termine; die bereits geöffnete App behält ihre Sitzung und wird nicht unnötig neu geladen.
- Übertragen werden nur Termin, Zeit, Ort, Kleidung und Rückmeldestatus aus der bereits persönlich gefilterten Portalantwort. Keine Namen, Zugangstoken, Passkeys, Einladungen oder Kalender-Abos.
- Widerruf mit HTTP 401/403, Abmeldung und Verlust der Identität leeren das Widget. Eine verspätete Fehlerantwort einer alten Sitzung löscht keine neu angemeldete Sitzung.
- Terminende und Zwölfstunden-Ablauf stehen als echte zukünftige Widgeteinträge fest. Auch ein leerer Kalender läuft ab. Bei Netzfehlern bleibt ausschließlich der zeitlich begrenzte letzte Stand.
- Uhrzeiten bleiben in Europe/Berlin. Ohne neuen App-Abruf gibt es keine Hintergrundabfrage und keine garantierte Sofortaktualisierung nach einer Änderung durch andere Mitglieder.

## Verschlüsselungsangabe für TestFlight

In `H2OPortal/Info.plist` ist `ITSAppUsesNonExemptEncryption` als Boolean `false` hinterlegt. Die native App verwendet Apples Systemfunktionen (WebKit/HTTPS und Systemanmeldung), keine eigene Verschlüsselungsimplementierung oder eingebundene Kryptobibliothek. Damit wird die Angabe bei künftig erzeugten Builds mitgeliefert, statt sie bei jedem Upload erneut abzufragen. Bei neuen Kryptobibliotheken oder eigener Verschlüsselung muss diese Einstufung erneut geprüft werden.

Der bereits hochgeladene Build 1016 enthält die Angabe noch nicht und benötigt einmalig die Auswahl „Keinen der oben genannten Algorithmen“ unter „Fehlende Compliance → Verwalten“. Ein bestehender Upload wird durch die Quelltextänderung nicht nachträglich verändert.

Apple-Referenz: https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption

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
Auch persönliche Zugangseinladung, Passkey, Passwort, PDF, fehlende Verbindung und große Schrift prüfen.

Die isolierte Demo kann diese echten Anmeldungstests nicht ersetzen. Signatur,
Upload und abgeschlossene Apple-Verarbeitung sind jeweils eigene Nachweise.
Keine App-Store-Einreichung und keine Verteilung an weitere Mitglieder erfolgen automatisch.

## Ersteinrichtung und echte iPhone-Mitteilungen

Nach persönlicher Anmeldung bietet die native App zuerst das persönliche Kalenderabo
und danach Mitteilungen an. Beide Schritte sind freiwillig und überspringbar.
Die Browser-Anleitung zum Home-Symbol erscheint in der nativen App nicht mehr.
Kalenderabos werden über den geprüften persönlichen webcal-Link in Apple Kalender
bestätigt; ein Vollzugriff auf den iPhone-Kalender wird dafür nicht angefordert.

Native Mitteilungen sind mit UNUserNotificationCenter und APNs vorbereitet. Eine
Systemfreigabe wird erst nach Tippen auf „Mitteilungen erlauben“ angefordert.
„Aktiv“ erscheint erst nach bestätigter Registrierung beim geschützten Portaldienst.
Die bestehende Empfänger-/Mitgliederprüfung, Gerätebegrenzung und Widerruf gelten
weiter. Apple-Pushs enthalten nur einen allgemeinen Hinweis ohne Termin-/Mitgliedsdaten.

Vor echter Zustellung noch erforderlich:
- In Apple Developer Push Notifications für de.feuerwehrwasser.h2o aktivieren und
  das Haupt-App-Store-Profil mit aps-environment=production sowie Associated Domains neu erzeugen.
- Einen APNs-Schlüssel (.p8) im Apple-Konto anlegen. Im Cloudflare-Worker ausschließlich
  als Secret H2O_APNS_PRIVATE_KEY hinterlegen; H2O_APNS_KEY_ID und H2O_APNS_TEAM_ID=VKL57X3H6F
  konfigurieren. Schlüssel weder in den Chat noch ins Repository kopieren.
- Den geprüften Worker-Kandidaten erst nach Freigabe bereitstellen und mit dem
  eigenen iPhone die echte Zustellung, Ablehnung, spätere Aktivierung und Abmeldung testen.

Der Signierversuch vom Entwicklungszweig wurde durch die bestehenden GitHub-Regeln
für apple-testflight-review vor Beginn des Jobs abgelehnt: Nur freigegebene Zweige
können dieses Environment benutzen. Die Schutzregel wurde nicht verändert.
Ein signiertes Mitgliederpaket liegt deshalb noch nicht vor.

## Aktueller Installationsweg: nur der Kontoinhaber testet

1. Auf dem eigenen iPhone TestFlight verwenden und den freigegebenen H₂O-Testbuild installieren.
2. H₂O über das installierte App-Symbol öffnen und den vorhandenen Passkey oder das Passwort verwenden.
3. Kalenderabo und Mitteilungen bei der ersten Einrichtung auswählen oder überspringen.
4. Das optionale Widget zum Home-Bildschirm hinzufügen. Das ist keine zweite App-Installation.

Der gemeinsame Installations-QR unter Verwaltung → H₂O Portal öffnet `install.html`.
Die Seite erkennt das Handy: Android öffnet den internen Google-Play-Test; für Apple
bleibt bis zur Freigabe des Store-Links ein Hinweis mit Browseralternative sichtbar.
`native/store/install-links.json` enthält nur öffentliche, streng geprüfte Store-URLs.

Neue Mitglieder werden anschließend vor Ort verifiziert: Identität prüfen, Mitglied
auswählen und Zugangseinrichtung freigeben. Der persönliche QR und Freigabecode
verwenden das bestehende serverseitig autorisierte Einmalticket (30 Minuten). Mit der
normalen Handykamera außerhalb der App scannen und den Link öffnen. Der QR wird lokal
erzeugt und bei Mitgliederwechsel, Sperren und Ablauf gelöscht. Keine E-Mail-Einladung.
Bestehende Zugänge auf weiteren Geräten direkt anmelden. Der native Scanner und seine
Kameraberechtigung bleiben entfernt. Installation und persönliche Freigabe sind getrennt.
Der Anwesenheits-QR am Gerätehaus hat einen anderen Zweck und bleibt erhalten.

Für weitere Mitglieder wird jetzt kein TestFlight-Link eingerichtet. Nach der
späteren Apple-Freigabe kann ein App-Store-Link geteilt werden; eine nicht gelistete
Verteilung muss Apple gesondert genehmigen. Dann brauchen Mitglieder kein TestFlight.
Browserzugänge bestehender Mitglieder und deren gespeicherte Anmeldungen bleiben
kompatibel; die native App führt keine Safari-Home-Installation mehr durch.

Apple-Grundlagen:
https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/
https://developer.apple.com/support/unlisted-app-distribution/


## Widgetgestaltung – Build 1019

Die kleine und mittlere Ansicht verwenden einen gemeinsamen ruhigen Aufbau: Originalwappen und dezente Wortmarke, ein helles Grundfeld, Datum als Hauptinformation und Rückmeldung als farbige Textzeile mit eindeutigem Symbol. Gefüllte Datums-/Statuskästen und die rot-gelbe Kopfleiste entfallen. Die Uhrzeit steht kleiner; Ort und Kleidung erscheinen zusätzlich im mittleren Widget. Im kleinen Widget bleibt der Terminname in der unteren Zeile erkennbar.

Die bestehenden Simulatorfälle prüfen beide Größen auf den kleinsten und größeren unterstützten Flächen, lange Titel, den langen Monatsnamen September, alle Rückmeldungen, Ganztägigkeit, veralteten Stand und einen leeren Kalender. Die Bilder werden aus dem echten SwiftUI-Code erzeugt. Die native Buildnummer ist in `native/ios/project.yml` hinterlegt; eine reine Widgetdarstellung ändert keine Webdateien oder Portaldaten.


## Bestätigtes Kalenderblatt – Build 1020

Die bestätigte Gestaltung verwendet einen warmen Papiergrund, eine schmale bordeauxrote Oberkante und eine integrierte Statuszeile am unteren Rand. Tag und Monat bleiben die Hauptinformation. Das kleine Widget zeigt eine kompakte Monatsangabe neben dem zweistelligen Tag; im breiten Widget steht der ausgeschriebene Monat darunter. Die Uhrzeit bleibt klein. Ort und Kleidung erscheinen im breiten Widget als Text. Datenumfang, Zugriff und Ablauf bleiben unverändert.


## Vollständige Prüfdemo – Build 1021

„Apple-Prüfdemo öffnen“ am unteren Rand startet im gleichen Binärpaket `review.html` in einem neuen `WKWebsiteDataStore.nonPersistent()`. „Demo verlassen · Mitgliederanmeldung“ verwirft diese Webansicht und öffnet den normalen, getrennten Mitgliederspeicher. Ein Demolink kann nicht in der normalen Mitglieder-Webansicht geöffnet werden. Externe Navigationen und native Mitteilungsregistrierung sind in der Demo gesperrt.

Die Prüfseite wird mit `node scripts/build-review-portal.cjs` aus der echten Portaloberfläche erzeugt. Nur der eindeutig gekennzeichnete Adapter unter `native/review/` ersetzt die API-Antworten durch erfundene Daten. Er liest keine Mitgliederanmeldung. Rückmeldungen, Nachweise, Buchungen, Theaterbestellungen, Kontakte und Jahresplan sind prüfbar. Öffentliche Dienstvorschriften verwenden die vorhandenen PDF-Dateien; echte Zahlungen, Erinnerungsnachrichten, Pushregistrierung und Kalenderinstallation werden nicht ausgelöst. Die Selbstbedienungs-Löschung entfernt nur den Demo-Zugang; „Demo zurücksetzen“ stellt den Ausgangsstand her. Erneute Demo-Anmeldung bzw. Bestätigung: Benutzername `demo`, Passwort `demo`. Diese Werte berechtigen zu keinem Produktivzugriff.

Prüfungen: `tests/review-portal.test.cjs`, `tests/review-portal-browser.cjs`, Swift-URL-Tests und iOS-Kompilierung in der CI. Der synthetische Adapter ist kein Nachweis eines produktiven Passkey-, Push- oder Löschtests auf einem physischen Gerät. Die öffentliche Datenschutzseite und ihre offenen Pflichtangaben bleiben ein eigener Einreichungspunkt.

## G26-Einwilligung

Unter Meine Nachweise steht eine eigene, nicht vorausgewählte Checkbox mit Zweck, Gesundheitsbezug, Datenquelle, berechtigten Empfängern, Betreiberkontakt und Widerrufshinweis. Erst das Häkchen und „Einwilligung speichern“ geben die Fristen zusätzlich im Portal frei. „G26-Einwilligung widerrufen“ sperrt die Freigabe wieder. Die GF-Übersicht kennzeichnet fehlende Einwilligungen neutral; sie erklärt die Person nicht für ungeeignet. Die medizinische Fristenanzeige und Eingabe werden serverseitig geschützt. Primäre Verwaltungsunterlagen werden nicht gelöscht. Konto-Löschung und Mitgliedsentfernung verwerfen die Portal-Einwilligung; ein Wechsel der Datenquelle macht sie ungültig.

Die öffentliche Datenschutzseite ist `privacy.html`, mit Betreiberanschrift, Datenquellen, G26-Einwilligung, Diensten, Aufbewahrung und Rechten. Technische Prüfungen sind kein Nachweis einer rückwirkenden Rechtsgrundlage früherer Verwaltungsdatenübernahmen.

## Relative Termintage – Build 1021

Im kleinen und mittleren Widget ersetzt „Heute“ bzw. „Morgen“ den numerischen Tag und Monat. Für spätere Termine bleibt das Datum sichtbar. Maßgeblich ist der Kalendertag in Europe/Berlin, auch bei Zeitumstellungen. Ein geplanter Timeline-Eintrag um Mitternacht aktualisiert die Beschriftung; Terminende und die bestehende Ablaufgrenze von zwölf Stunden gelten weiterhin. Die Simulatorbilder enthalten zusätzliche Fälle für heute und morgen in allen unterstützten Größen.

## Besser lesbare Begleittexte – Build 1022

Kopfzeile und Wochentag sind einen Punkt größer. Uhrzeit, Ort und Kleidung sind zwei Punkte größer, die Monatsangabe im mittleren Widget einen Punkt. Im kleinen Widget wächst die Zeile mit Terminname und Uhrzeit passend mit. Der vertikale Abstand im mittleren Widget wird entsprechend angepasst. Datum, Heute/Morgen und Rückmeldestatus behalten ihre Gewichtung. Die bestehenden Simulatorfälle prüfen beide Größen einschließlich langer Texte, September, Ganztägigkeit und leerem Kalender.

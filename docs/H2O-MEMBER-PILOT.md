# Privater iPhone-Mitgliederpilot · Build 1026


Die obere Widget-Verlaufskante folgt ab Build 1041 der bestätigten Rückmeldung:
Dabei grün, Entschuldigt gelb, Unsicher orange, ohne Auswahl neutral blau-grau.
Der Farbwechsel blendet in etwa 0,55 Sekunden über. Bei reduzierten Animationen
bleibt der Wechsel direkt; Android animiert nur bei geändertem Status und ohne
zusätzliche Hintergrundabrufe. Die Darstellung auf realen Homescreens hängt vom
System beziehungsweise Launcher ab.

Der Mitglieder-Build öffnet das echte H₂O-Portal unter
`https://ffw-wasser.github.io/home/deckel.html`. Die Apple-Demo bleibt mit
`H2O_APP_REVIEW` und ihrer eigenen Domain getrennt erhalten. Zugang, Passwort,
Passkeys und Mitgliedsrechte verwenden die bestehende Portalprüfung.

## Widgetkorrektur im Portal 2026.10.31.3

Der Wechsel zum Home-Bildschirm leert weiterhin die geschützten Ansichten, erhält aber den bestätigten Widgetstand und die freiwillige Push-Registrierung. Zuvor wurde beim Ausblenden versehentlich derselbe Ablauf wie bei einer Abmeldung ausgeführt. Abmeldung, Kontowechsel und erkannter Zugriffsverlust löschen die Widgetdaten weiterhin. Die Korrektur benötigt keinen neuen nativen Build; Build 1015 lädt das aktualisierte Portal. Der Browser-Regressionslauf prüft App → Home → App sowie das anschließende ausdrückliche Löschen der Identität mit künstlichen Daten.

## Umgesetzter Stand

- Build 1026 zeigt das konkrete Terminthema aus dem persönlichen Kalender, beispielsweise „Löschangriff“, statt „Nächste Probe“. Der Portalstand 2026.11.01.17 entfernt dafür einen wiederholten Terminart-Präfix wie „Probe ·“. Ohne Thema bleibt die ursprüngliche Terminart erhalten. Kleine und mittlere Widgets zeigen das Thema bei Bedarf zweizeilig. Beide Änderungen benötigen den neuen iPhone-Build und den aktuellen Portalstand.

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

Der Mitglieder-Signierworkflow verwendet `macos-26-intel` (GitHub-Standardrunner mit Xcode 26). Die zuvor verwendeten arm64-Runner konnten den Uploadauftrag wegen Kapazitätsfehlern zweimal nicht übernehmen. Signierung, Profile, App Group und ausdrückliche Uploadfreigabe bleiben unverändert.

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

Ab Portalversion 2026.11.01.10 ist bei fünf gespeicherten Mitteilungsgeräten auch
in der nativen App **Push-Verbindungen zurücksetzen** sichtbar. Erst die Bestätigung
entfernt die eigenen Mitteilungsverbindungen; andere Mitglieder bleiben unberührt.
Danach auf den aktuellen Handys erneut Mitteilungen erlauben. Zugang und Kalenderabo
bleiben erhalten. Dafür ist kein neuer TestFlight-Build nötig.

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

Ab Build 1023 liegt „Apple-Prüfdemo öffnen“ unter „Brauchst du Hilfe?“ auf der Anmeldeseite; nach Mitgliederanmeldung ist der Einstieg ausgeblendet. Der Wechsel wird weiter bestätigt. Der Link startet im gleichen Binärpaket `review.html` in einem neuen `WKWebsiteDataStore.nonPersistent()`. „Demo verlassen · Mitgliederanmeldung“ verwirft diese Webansicht und öffnet den normalen, getrennten Mitgliederspeicher. Ein Demolink kann nicht in der normalen Mitglieder-Webansicht geöffnet werden. Externe Navigationen und native Mitteilungsregistrierung sind in der Demo gesperrt.

Die Prüfseite wird mit `node scripts/build-review-portal.cjs` aus der echten Portaloberfläche erzeugt. Nur der eindeutig gekennzeichnete Adapter unter `native/review/` ersetzt die API-Antworten durch erfundene Daten. Er liest keine Mitgliederanmeldung. Rückmeldungen, Nachweise, Buchungen, Theaterbestellungen, Kontakte und Jahresplan sind prüfbar. Öffentliche Dienstvorschriften verwenden die vorhandenen PDF-Dateien; echte Zahlungen, Erinnerungsnachrichten, Pushregistrierung und Kalenderinstallation werden nicht ausgelöst. Die Selbstbedienungs-Löschung entfernt nur den Demo-Zugang; „Demo zurücksetzen“ stellt den Ausgangsstand her. Erneute Demo-Anmeldung bzw. Bestätigung: Benutzername `demo`, Passwort `demo`. Diese Werte berechtigen zu keinem Produktivzugriff.

Prüfungen: `tests/review-portal.test.cjs`, `tests/review-portal-browser.cjs`, Swift-URL-Tests und iOS-Kompilierung in der CI. Der synthetische Adapter ist kein Nachweis eines produktiven Passkey-, Push- oder Löschtests auf einem physischen Gerät. Die öffentliche Datenschutzseite und ihre offenen Pflichtangaben bleiben ein eigener Einreichungspunkt.

## G26-Einwilligung

Unter Meine Nachweise steht eine eigene, nicht vorausgewählte Checkbox mit Zweck, Gesundheitsbezug, Datenquelle, berechtigten Empfängern, Betreiberkontakt und Widerrufshinweis. Erst das Häkchen und „Einwilligung speichern“ geben die Fristen zusätzlich im Portal frei. „G26-Einwilligung widerrufen“ sperrt die Freigabe wieder. Die GF-Übersicht kennzeichnet fehlende Einwilligungen neutral; sie erklärt die Person nicht für ungeeignet. Die medizinische Fristenanzeige und Eingabe werden serverseitig geschützt. Primäre Verwaltungsunterlagen werden nicht gelöscht. Konto-Löschung und Mitgliedsentfernung verwerfen die Portal-Einwilligung; ein Wechsel der Datenquelle macht sie ungültig.

Die öffentliche Datenschutzseite ist `privacy.html`, mit Betreiberanschrift, Datenquellen, G26-Einwilligung, Diensten, Aufbewahrung und Rechten. Technische Prüfungen sind kein Nachweis einer rückwirkenden Rechtsgrundlage früherer Verwaltungsdatenübernahmen.

## Relative Termintage – Build 1021

Im kleinen und mittleren Widget ersetzt „Heute“ bzw. „Morgen“ den numerischen Tag und Monat. Für spätere Termine bleibt das Datum sichtbar. Maßgeblich ist der Kalendertag in Europe/Berlin, auch bei Zeitumstellungen. Ein geplanter Timeline-Eintrag um Mitternacht aktualisiert die Beschriftung; Terminende und die bestehende Ablaufgrenze von zwölf Stunden gelten weiterhin. Die Simulatorbilder enthalten zusätzliche Fälle für heute und morgen in allen unterstützten Größen.

## Besser lesbare Begleittexte – Build 1022

Kopfzeile und Wochentag sind einen Punkt größer. Uhrzeit, Ort und Kleidung sind zwei Punkte größer, die Monatsangabe im mittleren Widget einen Punkt. Im kleinen Widget wächst die Zeile mit Terminname und Uhrzeit passend mit. Der vertikale Abstand im mittleren Widget wird entsprechend angepasst. Datum, Heute/Morgen und Rückmeldestatus behalten ihre Gewichtung. Die bestehenden Simulatorfälle prüfen beide Größen einschließlich langer Texte, September, Ganztägigkeit und leerem Kalender.

## Interaktive Terminkarte – Build 1027

Der freigegebene Entwurf verwendet einen dunklen Navy-Hintergrund, eine dezente rote Oberkante und das bestehende H₂O-Wappen. Datum/Heute/Morgen und das konkrete Terminthema stehen vorn. Ein Tipp auf Datum oder Thema öffnet genau diesen Termin in der vollständigen App. Kleine Widgets zeigen Datum, Thema, Uhrzeit und den eigenen Status; Antippen öffnet die Rückmeldung in H₂O. Bei genügend Platz erscheinen Ort und Kleidung.

Mittlere und große Widgets zeigen „Dabei“, „Entschuldigt“ und „Unsicher“ dauerhaft als zusammenhängende Auswahl. Die bestätigte Antwort ist markiert; eine andere Antwort lässt sich direkt antippen. Einen gesonderten Ändern-Button gibt es nicht. Der Lichtbalken unter den Tasten zeigt die laufende Übertragung in der Farbe der angeforderten Antwort; weitere Antworten sind währenddessen gesperrt. Die bisher bestätigte Auswahl bleibt bis zur Serverbestätigung markiert. Eine Meldung „Gespeichert“ gibt es nicht; der feste Hinweisplatz bleibt bei laufender und erfolgreicher Speicherung leer. Ohne gewählte Antwort bleiben alle Optionen neutral; „Rückmeldung offen“ steht in Signalgelb darunter, nach einer ausdrücklichen Anforderung „Bitte Rückmeldung geben“. Kleine und flache Widgets öffnen den vollständigen Termin in H₂O. Bei einer unterbrochenen Verbindung bleibt „Nicht bestätigt“ mit „Erneut versuchen“ und derselben Vorgangsnummer. Versionskonflikte verlangen eine Aktualisierung in H₂O; fehlende Berechtigung löscht den lokalen Stand. Keine Antwort wird heimlich später versendet.

iPhone-Build 1029 folgt dem abgestimmten Entwurf: Anthrazit, rote Oberkante (3 Punkte), Kalender mit rotem Monatskopf und hellem Papier, ruhige Metadaten und gemeinsame Statusauswahl. Mittlere und große Größen zeigen die drei Antworten dauerhaft; große zusätzlich zwei Folgetermine. Kleine zeigen bis zu drei Themenzeilen, dann Auslassungspunkte; Antippen öffnet den vollständigen Termin.


## Widget ohne zusätzliche Kopfzeile – Build 1030

Die Zeile „H₂O · Feuerwehr Wasser“ entfällt in allen Widgetgrößen. Die rote Oberkante bleibt; Kalender und Terminthema werden größer dargestellt und nutzen den gewonnenen Platz. Direkte Statusauswahl und Speicherfeedback bleiben erhalten. Der Hinweis auf einen gespeicherten Kalenderstand bleibt bei der Statusanzeige erreichbar.

Bestätigte Statusfelder sind kräftig und heller eingefärbt: Dabei grün #287D49, Entschuldigt gelb #F4C542, Unsicher orange #E87524. Grün trägt weiße, Gelb und Orange dunkle Beschriftung. Offene Antworten behalten den signalgelben Hinweis und keine ausgewählte Option.

Beim Wechsel der Widgetgröße erhält der Layoutbaum eine größenabhängige Identität und wird neu aufgebaut. Die Produktionsansicht verwendet weiterhin die von WidgetKit vorgegebene Größe; die Darstellungstests geben diese Größe gezielt vor. Ein zusätzlicher Hosting-Test wechselt dasselbe Widget mehrfach zwischen Mittel und Groß und prüft Inhalt im unteren Bereich der großen Ansicht. Das ersetzt keine Abnahme des Größenwechsels im realen iPhone-Homescreen.

Thema, Datum, Metadaten und Statusauswahl verwenden größere Ausgangsschriften. Lange Themen bekommen größenabhängig mehrere Zeilen; die Darstellung verkleinert Text erst bei tatsächlich begrenztem Platz.

Im kleinen Widget wird die Schrift zusätzlich an der Breite des längsten Wortes ausgerichtet, damit größere Ausgangsschrift keine unnötigen Wortzerlegungen verursacht. Der Wechseltest verwendet einen dunklen Host ohne App-Safe-Area, damit leere Randflächen nicht als Inhalt zählen.

Bei einem Versionskonflikt liefert der Dienst ausschließlich den eigenen aktuellen Antwortstatus und dessen Version. Das Widget übernimmt diesen Stand und zeigt „Stand aktualisiert – erneut wählen“ mit wieder freier Auswahl. Es schreibt nicht selbstständig erneut. Zugang, Kalenderalter, Fristen, Empfängerrechte und Vorgangsnummer bleiben unverändert. Abgelaufene Zugänge erfordern weiterhin H₂O. Android hängt direkt aufeinanderfolgende ausdrückliche Antworten an den vorherigen Auftrag an, statt sie am noch auslaufenden Auftrag zu verwerfen; nach 30 Sekunden erfolgt kein stiller Versand.

Die Textfläche des Terminblocks ist auch bei langen Hinweisen ausdrücklich auf die verfügbare Breite begrenzt. Jeder statische Bildtest prüft zusätzlich, dass die helle Kalenderkachel links sichtbar bleibt.


## Großes Widget – Build 1031

In der Widgetauswahl gibt es zusätzlich „H₂O · Großer Termin“ mit festem Großformat. Nach dem Update dieses Widget neu hinzufügen. Alle Widgetarten aktualisieren sich bei App-Aktualisierung, Rückmeldung und Abmeldung gemeinsam. Der Wochentag unter der Tageszahl ist kräftiger. Die Größeninformation wird vom Timeline-Provider weitergegeben; die Simulatorprüfungen decken auch große Ansichten ab.

Nach bestätigter Berichtsspeicherung im Gerätehaus wird der Kalendertermin zentral abgeschlossen. Das Portal und der nächste Widgetabruf zeigen den nächsten offenen Termin; vorhandene Antworten bleiben erhalten. Ein noch ausstehender Kalenderabgleich wird auf dem Gerätehausgerät gespeichert und beim nächsten authentifizierten Aktualisieren wiederholt. Der Bericht wird dabei nicht erneut hochgeladen. Bereits angezeigte Handywidgets benötigen weiterhin ihren normalen App- oder Antwortabruf; es gibt keinen garantierten sofortigen Hintergrundabruf.

## Build 1032: Datum und Kalenderaufruf

Heute/Morgen und der Wochentag unter der Tageszahl sind im kleinen Widget mit 12, im mittleren mit 14 und im großen mit 16 Punkt fett dargestellt. Die Kalenderkarte erhält passende Breite; im mittleren Widget wird der Außenabstand verringert, damit Antworttasten und Status vollständig bleiben.

„Tag im Kalender öffnen“ übergibt ausschließlich einen geprüften Tageszeitstempel an die Kalender-App. Fehlt die Kalender-App, öffnet sich die Tagesansicht im Browser. Automatische Aufrufe, fremde Seiten und Unterframes bleiben gesperrt; die isolierte Apple-Prüfdemo öffnet weiterhin keine externen Kalender.

Build 1033: Monatsname und rotes Monatsfeld sind größer. Dafür ist die Tageszahl etwas kleiner; Heute/Morgen beziehungsweise der Wochentag bleiben gut lesbar. Die Kalenderkarte behält ihre Anordnung, und die übrigen Bedienelemente bleiben erreichbar.


## Build 1034: Rückmeldung ohne unnötigen Farbabruf

Beim Speichern von Widget- und Portalantworten wird die optionale Google-Terminfarbe nicht mehr abgerufen. Aktuelle Empfänger-, Freigabe-, Abschluss- und Versionsprüfungen bleiben erhalten. Das iPhone nutzt innerhalb des laufenden Widgetprozesses dieselbe kurzlebige Netzwerksitzung für weitere Antworten und kann dadurch eine vorhandene Verbindung weiterverwenden. Zugang und Antwort werden weiterhin pro Anfrage geprüft; Cookies, Zugangsdatenablage und Antwortcache sind ausgeschaltet. Die Verarbeitung bleibt bis zur Serverbestätigung sichtbar. Eine konkrete Zeitersparnis am echten Gerät ist noch zu messen.


## Build 1035 Finale Widgetgestaltung und gespeicherte Termine

Marineblau mit dezentem Bordeauxverlauf, Kalenderblatt mit Binderingen und einer feinen Linie unter dem Tag. Das vorhandene Original-App-Icon steht mit 12 Prozent Deckkraft rechts; seine Größe richtet sich nach der gemessenen Themenbreite. Bei schmaler Fläche, langer Überschrift oder großer Schrift entfällt das Icon. Der Titel hat maximal zwei Zeilen; vollständige Angaben öffnen sich durch Antippen. Uhrzeit, Ort, Kleidung und Metadatensymbole verwenden denselben Farbwert #C6D2DF.

Die bestätigte Antwort bleibt während des Speicherns ausgewählt. Die feine Linie unter den Antworttasten folgt dem bestätigten Status und hat ihren Farbschwerpunkt unter dessen Taste. Erst die Serverbestätigung ändert Auswahl, Linie und Speicheranzeige. Ein erneuter Tipp auf die bereits bestätigte Antwort verschickt keine weitere Anfrage. Fehler und Versionskonflikte behalten den vorhandenen Wiederholungsweg.

Die zwölfstündige Gültigkeit der Antwortfreigabe bleibt unverändert. Gespeicherte Termine verschwinden danach nicht mehr pauschal: Sie bleiben bis zum jeweiligen Ende innerhalb einer Anzeigegrenze von maximal 30 Tagen sichtbar und zeigen nach zwölf Stunden „Gespeicherter Stand · H₂O öffnen“. Ohne aktuelle Freigabe kann nicht geantwortet werden. App öffnen lädt den Serverstand und erneuert die Freigabe. Es gibt keinen neuen Hintergrundzugang und keinen garantierten Serverabruf bei geschlossener App. Abmeldung und erkannter Zugriffsverlust löschen weiterhin den gesamten Widgetstand.

Auf iOS ist die gemeinsame Datei nach dem ersten Entsperren seit einem Geräteneustart auch bei gesperrtem Bildschirm lesbar; sie bleibt verschlüsselt und vom Backup ausgeschlossen. WidgetKit liest den gemeinsamen Speicher zusätzlich etwa stündlich nach Systemplanung. Android verwendet den bestehenden zeitgesteuerten Auftrag. Die Timeline beziehungsweise der Auftrag schalten bei Terminende auf den nächsten gespeicherten Termin.

Die nativen CI-Bildprüfungen rendern die tatsächlich ausgelieferten Ansichten mit künstlichen Daten. Sie ersetzen keine Messung am echten iPhone oder Android-Gerät und keine Store-Freigabe.


## Build 1036 Plastische Darstellung nach dem freigegebenen Entwurf

Die Rückmeldetasten haben jetzt einzeln abgerundete, gewölbt wirkende Farbflächen mit heller Oberkante und kleinem Schatten. Die gemeinsame dunkelblaue Leiste erhält einen eigenen Verlauf und eine Lichtkante. Der obere Bordeauxbereich und der Außenrand sind deutlicher; Terminmetadaten sind kräftiger gesetzt und verwenden weiterhin einheitlich #C6D2DF. Die Kalenderkarte erhält eine rote Unterkante und einen Papierrand. Ihr Schatten wird auf die zusammengesetzte Karte angewendet, damit Ziffern und Buchstaben keinen eigenen Schlagschatten bekommen.

Die Binderinge sitzen in einem eigenen Streifen oberhalb der Monatsbeschriftung. Der Monatskopf hat zusätzlichen Abstand zum Metall. Bei wenig Platz entfällt weiterhin zuerst die Dekoration. Der Farbstreifen unter den Rückmeldetasten besitzt einen sichtbaren hellen Kern und einen örtlich begrenzten, weich auslaufenden Reflex unter der bestätigten Auswahl. Auswahl und Linie wechseln weiterhin erst nach Serverbestätigung.

Die nativen Bildprüfungen enthalten zusätzlich den Vergleichsfall Indoor Cycling, 20:00, Injoy EM, Sportkleidung, Entschuldigt. Unter Android wird außerdem der tatsächliche Abstand zwischen Binderingen und Monatsschrift geprüft. Kalenderöffnung, Antwortversand, Cache und Berechtigungen ändern sich in diesem Build nicht.

## Build 1037 – Lichtwirkung und oberer Verlauf am Entwurf nachgezogen

Der obere Kartenbereich verläuft nun von sattem Bordeauxrot (#951C35) über einen bereits nach 8 % deutlich dunkleren Weinrotton (#5C152C) in dunkles Blau (#10263A bei 24 % der Höhe), mit klarer heller Oberkante. Die bisherige violette Mischfläche entfällt. Die zusätzliche graue Trennlinie über den Rückmeldetasten ist unsichtbar; ihr Platz bleibt für das bestehende Layout reserviert.

Die Tasten und die blaue Leiste erhalten eine stärkere obere Lichtkante, dunklere Unterkante und deutlichere Schatten. Der Leuchtstreifen trägt die bestätigte Rückmeldefarbe über eine breitere Fläche unter der gewählten Taste und läuft weich zu den neutralen Seiten aus. Ohne bestätigte Auswahl bleibt er neutral. Das Originalwappen ist adaptiv unverändert angeordnet, jetzt jedoch mit 50 % statt 12 % Deckkraft sichtbar. Metadaten bleiben einheitlich #C6D2DF. Kalenderösen, Papierkarte, Antwortfreigaben und Speicherrückmeldungen bleiben unverändert.

Die vorhandenen nativen Bildprüfungen enthalten den Vergleichsfall „Indoor Cycling · 20:00 · Injoy EM · Sportkleidung“ und die Größen-/Schriftvarianten. Die fertigen Bilder werden vor der Veröffentlichung gegen den Entwurf und Build 1036 verglichen.

## Build 1038 – Ruhiger Statuswechsel und größeres Wappen

„Gespeichert“ und die Erfolgsplakette entfallen. Der feste Hinweisplatz bleibt für offene Rückmeldungen, Fehler, notwendige Aktualisierungen und veraltete Kalenderstände reserviert. Beim Speichern bleiben Tasten, bestätigte Auswahl und Kartenhöhe stabil; es gibt keine zusätzliche Abdunklung und keinen wechselnden Platzhaltertext. Erst die Serverbestätigung ändert den ausgewählten Status.

Auf iPhone gleitet der Lichtschwerpunkt beim Start der Antwort für 0,55 Sekunden zur angeforderten Taste und übernimmt deren Farbe. Nach Bestätigung wird er heller, bei Fehler kehrt er zum bestätigten Status zurück. „Bewegung reduzieren“ wird beachtet. WidgetKit bestimmt den tatsächlichen Übergang; es wird keine dauernde Animation oder Aktualisierungsschleife erzwungen. Auf Android läuft während der Übertragung ein nativer unbestimmter Ladebalken in der Antwortfarbe; danach erscheint wieder der Lichtschwerpunkt der bestätigten Auswahl. Es wird kein erfundener Prozentfortschritt angezeigt.

Im großen Widget stehen Thema und Metadaten getrennt: Das Thema nutzt die volle verfügbare Breite, das Originalwappen sitzt größer neben Uhrzeit und Kleidung (regulär 56 pt/dp, bei Enge kleiner; bei großer Systemschrift entfällt die Dekoration). Mittlere und kleine Ansichten behalten ihre bisherige Anordnung. Native Bildprüfungen decken alle drei Ladefarben, offene und fehlerhafte Rückmeldungen sowie große Widgets mit kurzen und langen Themen ab. Tatsächliche Übergangsflüssigkeit und Launcher-Verhalten sind zusätzlich am Gerät zu beurteilen. Antwortfreigabe, Wiederholungsschutz und Datenformat bleiben unverändert.


## Widget-Hinweis für native App-Updates – Build 1040

Mittlere und große iPhone-Widgets nutzen die vorhandene feste Zeile unter der Lichtleiste zusätzlich für „App-Update verfügbar · TestFlight“. Fehler, veralteter Kalenderstand und offene Rückmeldungen haben Vorrang; beim Speichern bleibt nur die Lichtleiste aktiv. Im Normalfall bleibt die Zeile leer. Die bestätigten Android-Proportionen bleiben erhalten.

Die Apple-Erweiterung liest bei der regulären Timeline-Erneuerung höchstens stündlich ausschließlich die öffentliche Datei `native/store/widget-updates.json` auf GitHub Pages. Keine Anmeldung, Cookies, Zugangsdaten oder Mitgliederdaten werden übertragen. Offline bleibt ein bestätigter Prüfstand höchstens 24 Stunden verwendbar; zusätzlich begrenzt `availableUntil` die tatsächliche TestFlight-Verfügbarkeit. Die installierte native Buildnummer wird verglichen, nicht die Portalversion. WidgetKit bestimmt den tatsächlichen Abrufzeitpunkt. Die erste Version mit dieser Funktion muss regulär installiert werden.

**Freigabeschritt:** `iosTestFlight` bleibt zunächst `null`. Erst nachdem der neue Build in TestFlight verarbeitet, der vorgesehenen Mitgliedergruppe zugeordnet und dort tatsächlich installierbar ist, die Datei mit `{"schema":1,"iosTestFlight":{"build":1040,"availableUntil":"ECHTES-ABLAUFDATUM-ALS-ISO-8601"}}` aktualisieren und über Pages veröffentlichen. Das echte Ablaufdatum aus TestFlight übernehmen; bei zurückgezogenem Build wieder `null` setzen. Ein erfolgreicher Upload oder ein ungemergter Entwurf darf diesen Wert niemals automatisch erhöhen. Die Anzeige ist für die bestehende gemeinsame TestFlight-Gruppe bestimmt; vor einem späteren Wechsel auf den App Store muss die Quelle entsprechend umgestellt werden.

Die Installation bleibt bei TestFlight beziehungsweise dessen automatischen Updates. H₂O selbst installiert keine iPhone-App. Tests prüfen Versionsvergleich, Ablauf, fehlende/ungültige Freigabe und den Vorrang von Rückmeldefehlern; die Simulator-Bildprüfung enthält einen Update-Hinweis. Reale Verteilung und zeitliches Widget-Verhalten sind zusätzlich auf dem iPhone zu prüfen.

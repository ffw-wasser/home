# Native Android-App mit Mitglieder-Widget


Die obere Widget-Verlaufskante folgt ab Build 1041 der bestätigten Rückmeldung:
Dabei grün, Entschuldigt gelb, Unsicher orange, ohne Auswahl neutral blau-grau.
Der Farbwechsel blendet in etwa 0,55 Sekunden über. Bei reduzierten Animationen
bleibt der Wechsel direkt; Android animiert nur bei geändertem Status und ohne
zusätzliche Hintergrundabrufe. Die Darstellung auf realen Homescreens hängt vom
System beziehungsweise Launcher ab.

Eine Erinnerung erscheint bei offener oder unsicherer Rückmeldung als Hinweis im
Widget; dabei ersetzt ein großes gelbes Warndreieck das Wappen, wo der Iconplatz vorhanden ist. Nach Zu- oder Absage erscheinen wieder Wappen und ruhige Hinweiszeile. Ein empfangener Push löst einen begrenzten,
authentifizierten Statusabruf für bereits freigegebene Widgettermine aus. Er verlängert
weder Anmeldung noch Kalenderalter. Hintergrundzustellung und Aktualisierungszeit
bleiben vom Betriebssystem abhängig. Reine Beobachter sehen „Nur zur Information“
ohne Abstimmung.

Ziel: Dasselbe geschützte H₂O Portal wie auf dem iPhone, ergänzt um ein natives
Android-Widget und freiwillige Firebase-Cloud-Messaging-Mitteilungen.
Verteilung ausdrücklich über den **internen Google-Play-Test**, keine öffentliche
Produktionsveröffentlichung. Bis zu 100 eingeladene Google-Konten; Nutzerziel maximal
50 Geräte. Google bezeichnet die App weiterhin als Testversion. Der Testlink allein
berechtigt nicht zum Mitgliederzugang. Die Android-Web-App bleibt verfügbar.

## Installation und persönliche Verifizierung

1. In Google Play einmal die Google-Konto-Adresse des Mitglieds in die interne
   Testerliste aufnehmen. Keine E-Mail versenden.
2. In Verwaltung → H₂O Portal den gemeinsamen Installations-QR anzeigen. Das Mitglied
   scannt mit der normalen Handykamera, nimmt mit genau seinem freigegebenen eigenen
   Google-Konto am internen Test teil und installiert über Google Play.
3. Bei einem neuen H₂O-Zugang vor Ort die Identität prüfen, das richtige Mitglied
   auswählen und Zugangseinrichtung freigeben. Den persönlichen QR mit der normalen
   Handykamera außerhalb der App scannen, Link öffnen und Passkey oder Benutzername
   und Passwort einrichten. Das Einmalticket gilt 30 Minuten.
4. Bestehende Konten direkt anmelden, auch auf weiteren Geräten. Eine Play-Testfreigabe
   gewährt keinen Zugang zu persönlichen Feuerwehrdaten.

Die Store-Verknüpfung und QR-Anleitung werden mit dem Webportal aktualisiert; dafür
ist kein neuer Android-Build nötig. Echte Kamera-/App-Übergabe und Play-Kontowechsel
müssen auf einem Mitgliedsgerät geprüft werden.

## Bereits implementiert

- Bestehendes Portal mit Passkey oder Passwort, geschütztem PDF-Export. Keine zusätzliche QR-/Hilfe-Leiste beim App-Start; Hilfe unter Mehr. Neue Zugänge werden über den persönlichen Freigabelink oder Freigabecode eingerichtet.
- Zwei im Widget-Menü auswählbare Formate im Stil des iPhone-Widgets: **Termin kompakt (2×2)** und **Termin breit (4×1)**. Beide lassen sich bis 48 dp Höhe (eine Rasterzeile, abhängig vom Launcher) horizontal und vertikal am Rahmen ändern; die Darstellung passt sich dem Platz an. Die bisherige breite Providerkennung bleibt für eingerichtete Widgets erhalten. Cremefarbene Karte, bordeauxrote Kopfkante, Datum/Heute/Morgen und farbige Rückmeldezeile.
- Größenveränderbares Startbildschirm-Widget: nächster persönlich freigegebener Termin,
  Heute/Morgen nach Berliner Ortszeit, Uhrzeit, Ort, Kleidung und Rückmeldung.
  Antippen öffnet Termine in der App. Das Widget führt keine Netzwerkabrufe aus.
- Widget-Daten ausschließlich aus der authentifizierten, gefilterten Portalantwort;
  keine Namen, Token, Kalender-URLs oder G26-Daten. Abmeldung und erkannter
  Zugriffsverlust leeren den Speicher. Maximal zwölf Stunden alter Stand wird beim
  nächsten Widget-Update verworfen; Android kann Hintergrundupdates verzögern.
  Nach Ablauf muss das Portal wieder geöffnet werden. Leere Kalender verfallen ebenso.
- FCM-Datenmitteilungen ohne Termin- oder Mitgliederdetails, lokale Freigabe und
  Android-Berechtigung vor Anzeige. Keine Analytics-Abhängigkeit, automatische
  FCM-Registrierung ausgeschaltet. Kein vorgetäuschter Push-Erfolg ohne Konfiguration.
- Alte tägliche Pauschal-Erinnerung entfernt; ihr bestehender Auftrag wird beendet.
- Keine produktiven Android-Debug-Zertifikate freischalten.

## Kontoangaben und weitere Voraussetzungen

1. Als Entwicklerkontoinhaber Geräteprüfung auf einem geliehenen oder eigenen
   echten, nicht gerooteten Android-Gerät ab Android 10 abschließen.
2. Play-Console-Eintrag `H2O Portal`, Paketname `de.feuerwehrwasser.h2o`, anlegen
   beziehungsweise vorhandenen Eintrag prüfen. **Interner Test**, Deutschland,
   kostenlos. Kein Produktions-Track und kein öffentlicher Rollout.
3. Android-App in einem passenden Firebase-Projekt registrieren. Cloud Messaging
   HTTP v1 aktivieren. Analytics nicht einschalten. Öffentliche Firebase-App-Konfiguration
   als GitHub-Actions-Variablen hinterlegen:
   `H2O_FIREBASE_APP_ID`, `H2O_FIREBASE_API_KEY`, `H2O_FIREBASE_PROJECT_ID`,
   `H2O_FIREBASE_SENDER_ID`. Diese Werte werden in den Android-Build aufgenommen.
4. Im eigenen Projekt ein Dienstkonto `h2o-push` ausschließlich mit der Rolle
   `roles/firebasecloudmessaging.admin` einrichten. Dort einen JSON-Schlüssel erzeugen.
   Auf dem bestehenden Worker `feuerwehr-wasser-deckel-push` unter Einstellungen →
   Variablen und Secrets → Hinzufügen den Typ **Secret** wählen, Name
   `H2O_FCM_SERVICE_ACCOUNT_JSON`, und den vollständigen JSON-Dateiinhalt einfügen.
   Direkt in Cloudflare eingeben; niemals im Chat oder Repository ablegen.
   Es sind keine weiteren FCM-Variablen erforderlich. Bestehende Konfiguration mit
   `H2O_FCM_PROJECT_ID`, `H2O_FCM_CLIENT_EMAIL`, `H2O_FCM_PRIVATE_KEY` bleibt unterstützt.
   Ein vorhandenes ungültiges JSON-Secret wird nicht durch Altwerte umgangen.
   Dienstkonto auf das nötige FCM-Senden beschränken. Private Schlüssel und
   Zugangsdaten nie in Chat, Git oder Workflow-Ausgabe kopieren.
5. Bestehende Release-Signierung über die vier Android-Signierungsvariablen
   aus `native/README.md` vollständig konfigurieren. Ein ungeprüftes Debug-APK
   ist kein Google-Play-Upload. Die CI erzeugt zunächst ein unsigniertes AAB.
   Für den manuell startbaren signierten Kandidaten außerdem
   `H2O_ANDROID_KEYSTORE_BASE64` als Repository-Secret speichern. Der Workflow
   dekodiert es nur kurzzeitig, entfernt die Datei wieder und lädt nie selbst
   bei Google Play hoch. Erst nach den übrigen Prüfungen den Workflow mit
   `signed_internal_candidate` starten.
6. Endgültigen **App-Signing**-SHA256-Fingerabdruck aus Play Console verwenden,
   nicht den Upload-Fingerabdruck. Bestehende Apple-Zuordnung erhalten und die
   Android-Zuordnung unter `https://ffw-wasser.github.io/.well-known/assetlinks.json`
   ergänzen. `H2O_ANDROID_APP_ORIGINS` mit diesem Zertifikat am Worker setzen.
   Passwort-Anmeldung benötigt diese Passkey-Zuordnung nicht.
7. Signiertes AAB nur in den internen Test hochladen. Google-Konten der freiwilligen
   Mitglieder in die interne Testerliste eintragen; Opt-in-Link persönlich verteilen.
   Nie Mitgliederlisten ins Repository aufnehmen. Der geschlossene 12-Personen-Test
   ist nur für einen späteren Produktionszugriff nötig.

Build 1026 zeigt das konkrete Terminthema statt „Nächste Probe“. Der Portalstand 2026.11.01.17 entfernt einen wiederholten Terminart-Präfix wie „Probe ·“; ohne Thema bleibt die Terminart erhalten. Kompakte Widgets ab 160 dp und breite Widgets ab 160 dp bei normaler Systemschrift erlauben zweizeilige Themen.

Build 1026 nutzt ab Android 12 die vom Startbildschirm gemeldeten tatsächlichen Widget-Größen. Datum und Überschrift wachsen bei größeren Widgets mit; die breite Datumsspalte nutzt ein Drittel des verfügbaren Inhaltsbereichs. Bei hohen kompakten Widgets steht der Monat unter dem größeren Tagesdatum, bei mehr Höhe können breite Widgets längere Titel mehrzeilig zeigen. Größere Systemschrift wird bei der verfügbaren Datumshöhe berücksichtigt. Ältere Android-Versionen und Launcher ohne Größenliste verwenden weiterhin die Hoch-/Querformatangaben. Zum Ändern der Größe das Widget auf dem Startbildschirm gedrückt halten und die Rahmenpunkte ziehen. Dafür ist ein Android-App-Update erforderlich; eingerichtete Widgets bleiben erhalten.

Build 1025 ergänzt die flache Darstellung unter 100 dp. Schmale flache Widgets zeigen Datum, Uhrzeit und Rückmeldung; der Titel bleibt in der Vorlesebeschreibung und in der geöffneten App. Ab 100 dp bleiben die bisherigen ausführlichen Ansichten erhalten. Bestehende Widgets behalten ihre Providerkennung.

Google-Play-Texte, Datenschutz-, Support- und Kontolöschungslink: `native/store/GOOGLE-PLAY-ANGABEN.md`. Konto-Checkliste oben beschreibt Voraussetzungen; sie ist kein aktueller Live-Nachweis noch fehlender Konfiguration.

## Prüfungen

Bei „Maximal fünf Geräte pro Mitglied“ bietet das Portal ab 2026.11.01.10 auch
in beiden nativen Apps **Push-Verbindungen zurücksetzen** an. Nach ausdrücklicher
Bestätigung werden nur die Mitteilungsverbindungen des angemeldeten Kontos
entfernt. Anschließend Mitteilungen auf jedem aktuellen Gerät erneut erlauben.
Anmeldung, Kalenderabo und Mitgliedsdaten bleiben erhalten. Frühere Testinstallationen
können zum Limit beitragen. Die Korrektur wird als Portalupdate ausgeliefert.

GitHub Actions `Build Android H2O app and widget` führt Kotlin-Unit-Tests,
Android Lint, Debug-APK und unsigniertes Release-AAB aus. APK, AAB und Berichte
werden als Artefakt bereitgestellt. Der separate App-Workflow prüft die Web- und
Worker-Änderungen. Ohne bestandenes CI und Gerätetest keine Installationsfreigabe.

Auf einem echten Gerät: persönlicher Freigabelink/-code, Passwort und Passkey, Wiederanmeldung,
G26-Einwilligung, PDF-Speichern, App-Link, beide Widget-Einträge, Größenänderung in beiden Richtungen, langer Titel und größere Schrift, Heute/Morgen über Mitternacht, Antwortänderung,
Abmeldung/Kontowechsel/Austritt, abgelaufener Cache, FCM im Vorder-/Hintergrund,
verweigerte Benachrichtigung und Offline-Neustart. Nur synthetische Konten für
Bilder und automatisierte Prüfungen verwenden. Erfolgreiche Builds ersetzen diese
Gerätetests nicht. Die Emulatorprüfung rendert beide Formate, die minimale Größe, flache und hohe Widgets sowie 130 % Schrift mit synthetischen Daten. Bei Ladefehlern erscheinen ausschließlich die Aktionen Erneut laden und Im Browser öffnen.

Offizielle Vorgaben:
- https://support.google.com/googleplay/android-developer/answer/9845334
- https://support.google.com/googleplay/android-developer/answer/14316361
- https://support.google.com/googleplay/android-developer/answer/14151465
- https://firebase.google.com/docs/cloud-messaging/send/v1-api

## Interaktive Terminkarte – Build 1027

Der freigegebene Entwurf verwendet einen dunklen Navy-Hintergrund, eine dezente rote Oberkante und das bestehende H₂O-Wappen. Datum/Heute/Morgen und das konkrete Terminthema stehen vorn. Ein Tipp auf Datum oder Thema öffnet genau diesen Termin in der vollständigen App. Kleine Widgets zeigen Datum, Thema, Uhrzeit und den eigenen Status; Antippen öffnet die Rückmeldung in H₂O. Bei genügend Platz erscheinen Ort und Kleidung.

Mittlere und große Widgets zeigen „Dabei“, „Entschuldigt“ und „Unsicher“ dauerhaft als zusammenhängende Auswahl. Die bestätigte Antwort ist markiert; eine andere Antwort lässt sich direkt antippen. Einen gesonderten Ändern-Button gibt es nicht. Der Lichtbalken unter den Tasten zeigt die laufende Übertragung in der Farbe der angeforderten Antwort; weitere Antworten sind währenddessen gesperrt. Die bisher bestätigte Auswahl bleibt bis zur Serverbestätigung markiert. Eine Meldung „Gespeichert“ gibt es nicht; der feste Hinweisplatz bleibt bei laufender und erfolgreicher Speicherung leer. Ohne gewählte Antwort bleiben alle Optionen neutral; „Rückmeldung offen“ steht in Signalgelb darunter, nach einer ausdrücklichen Anforderung „Bitte Rückmeldung geben“. Kleine und flache Widgets öffnen den vollständigen Termin in H₂O. Bei einer unterbrochenen Verbindung bleibt „Nicht bestätigt“ mit „Erneut versuchen“ und derselben Vorgangsnummer. Versionskonflikte verlangen eine Aktualisierung in H₂O; fehlende Berechtigung löscht den lokalen Stand. Keine Antwort wird heimlich später versendet.

Ohne eigene Antwort bleibt der Status offen. Nach einer GF-Erinnerung steht bei genügend Platz „Bitte Rückmeldung geben“. Antworten sind schon vor einer Erinnerung möglich. Offen und Unsicher sind keine Absage und keine tatsächliche Anwesenheit.

Die nächsten drei bereits freigegebenen eigenen Termine werden übernommen und nach Ende chronologisch weitergeschaltet, auch wenn die Antwort offen blieb. Große Widgets zeigen bis zu zwei Folgetermine. Kalenderstände verfallen weiterhin nach zwölf Stunden; ohne frische App-Abfrage ist danach H₂O zu öffnen. Android kann geplante Hintergrundaktualisierungen zur Energieeinsparung verzögern.

Datenschutz: Die vollständige Anmeldung, Passkeys und persönliche Kalenderlinks bleiben im Portal. Das Widget erhält nur eine verschlüsselte, auf die übernommenen drei Termine begrenzte Antwortberechtigung, gebunden an die noch gültige Sitzung und maximal zwölf Stunden. Bei jeder Antwort werden Sitzung, Zugang, Mitgliedschaft, Empfänger, Terminbeginn, Kalenderfrische und Antwortversion erneut geprüft. iOS speichert sie in einer geschützten, von Backups ausgeschlossenen App-Group-Datei; Android verschlüsselt sie mit Android Keystore in privaten, nicht gesicherten App-Daten. Abmeldung, Kontowechsel und erkannter Zugriffsverlust entfernen den Stand.

Die neue Funktion benötigt Portal/Worker und den neuen nativen App-Build. Ein Pull Request oder grüner Test ist keine Veröffentlichung. Reale iPhone-/Android-Abnahme bleibt zusätzlich erforderlich.

Das breite Widget startet neu als 4×2-Karte mit Platz für Antworttasten; bestehende Widgets behalten ihre Größe und bleiben bis auf eine Zeile verkleinerbar.

## Herunterziehen mit Fortschrittsring – Build 1028

Beim Herunterziehen am oberen Rand schließt sich der Ring bis zur bisherigen Schwelle von 140 CSS-Pixeln. Dort erfolgt höchstens ein kurzer haptischer Impuls je Ziehbewegung, auch beim mehrfachen Überqueren derselben Schwelle. Loslassen startet den Abgleich; währenddessen rotiert der Ring. Zurückziehen unter die Schwelle oder Abbrechen verwirft den Vorgang. Laufender Abruf und zehn Sekunden Pause verhindern weitere Impulse und doppelte Abrufe.

Die iPhone-App nutzt UISelectionFeedbackGenerator, die Android-App ab API 34 GESTURE_THRESHOLD_ACTIVATE und auf älteren Geräten CLOCK_TICK. Native Nachrichten akzeptieren nur die bestehende vertrauenswürdige Hauptseite und werden zusätzlich zeitlich begrenzt; Android respektiert die Systemeinstellung für haptisches Feedback. Im Browser wird die optionale Vibration API verwendet. Ohne Unterstützung bleibt die Ringanzeige vollständig bedienbar. Eine echte Vibration lässt sich nur auf einem unterstützten realen Handy beurteilen.


## Einheitlicher Widget-Entwurf – Build 1029

Anthrazit (#191B20), rote Oberkante (#A52332, 3 dp), helle Kalenderkachel (#F2EEE5) und ein zusammenhängender Statusregler mit drei dauerhaft sichtbaren Optionen in mittleren und großen Widgets. Keine getrennten roten Statusflächen und kein Ändern-Button. Große Widgets zeigen zwei Folgetermine. Schmale und flache Widgets reduzieren Metadaten und öffnen den Termin in der App. Die tatsächliche Launcherfläche und Systemschrift bestimmen die passende Ansicht.

Die Bildprüfung umfasst lange Themen, 130 Prozent Systemschrift, offene und angeforderte Antworten, laufende Speicherung, Fehler und bestätigte Antworten. Offene Rückmeldungen tragen einen signalgelben Hinweis.


## Größere Terminansicht in Zwischenhöhen – Build 1030

Breite Widgets ab 210 dp Höhe erhalten eine größere Kalenderkachel sowie deutlich größere Themen-, Orts- und Kleidungsschrift. Die verfügbare Höhe und die Systemschrift werden gemeinsam berücksichtigt; kleine und flache Ansichten sowie die direkte Statusauswahl bleiben erhalten. Dies korrigiert den auf einem realen Android-Gerät sichtbaren großen Leerraum um eine zu kleine Terminansicht. Die Emulatorprüfung enthält nun zusätzlich diese Zwischenhöhen mit kurzem Thema „Probe“, langen Themen und offener Rückmeldung.

Die Kopfzeile „H₂O · Feuerwehr Wasser“ entfällt in allen Widgetgrößen. Kalender und Thema nutzen den gewonnenen Platz; die rote Oberkante bleibt erhalten.

Bestätigte Statusfelder sind kräftig und heller eingefärbt: Dabei grün #287D49, Entschuldigt gelb #F4C542, Unsicher orange #E87524. Grün trägt weiße, Gelb und Orange dunkle Beschriftung. Offene Antworten behalten den signalgelben Hinweis und keine ausgewählte Option.

Thema, Datum, Metadaten und Statusauswahl verwenden größere Ausgangsschriften. Lange Themen bekommen größenabhängig mehrere Zeilen; die Darstellung verkleinert Text erst bei tatsächlich begrenztem Platz.

Bei einem Versionskonflikt liefert der Dienst ausschließlich den eigenen aktuellen Antwortstatus und dessen Version. Das Widget übernimmt diesen Stand und zeigt „Stand aktualisiert – erneut wählen“ mit wieder freier Auswahl. Es schreibt nicht selbstständig erneut. Zugang, Kalenderalter, Fristen, Empfängerrechte und Vorgangsnummer bleiben unverändert. Abgelaufene Zugänge erfordern weiterhin H₂O. Android hängt direkt aufeinanderfolgende ausdrückliche Antworten an den vorherigen Auftrag an, statt sie am noch auslaufenden Auftrag zu verwerfen; nach 30 Sekunden erfolgt kein stiller Versand.

Build 1031: Wochentag/Heute/Morgen unter dem Datum wird kräftiger dargestellt. Nach einem zentral bestätigten Probeabschluss zeigt der nächste Kalenderabruf den nächsten offenen Termin.


## Höhe ausnutzen – Build 1032

Kalender und Termintexte wachsen mit der tatsächlich verfügbaren Höhe. Schmale hohe Widgets zeigen Kalender und Thema untereinander; große Ansichten geben freien Platz dem Haupttermin statt gestreckten Folgezeilen. Wochentag sowie Heute/Morgen sind deutlich größer und bleiben kräftig. Antworttasten behalten ihre Mindesthöhe. Größenwechsel und vergrößerte Systemschrift werden weiterhin berücksichtigt. Bestehende Widgets aktualisieren sich nach dem App-Update; bei älteren Android-Versionen bleiben die festen Layoutbreiten erhalten.

„Tag im Kalender öffnen“ übergibt in der Android-App nur den Zeitstempel an Android. Die Kalender-App öffnet den gewählten Tag; fehlt eine passende Kalender-App, öffnet sich die Tagesansicht im Browser. Der Web-Intent bleibt für normale Android-Browser erhalten.

Build 1033: Monatsname und rotes Monatsfeld sind größer. Dafür ist die Tageszahl etwas kleiner; Heute/Morgen beziehungsweise der Wochentag bleiben gut lesbar. Die Kalenderkarte behält ihre Anordnung, und die übrigen Bedienelemente bleiben erreichbar.


## Build 1034: Schnellere Verarbeitung der Rückmeldung

Beim Speichern von Widget- und Portalantworten entfällt der optionale Google-Farbabruf. Unter Android 12 und neuer fordert eine ausdrücklich angetippte Widgetantwort bevorzugte Ausführung an. Wenn das Systemkontingent ausgeschöpft ist, bleibt der normale Auftrag erhalten; ältere Android-Versionen verwenden weiterhin den bisherigen Weg. Versionsschutz, ausdrücklicher Wiederholungsversuch und die Grenze von 30 Sekunden für den Versand bleiben bestehen. Die Verarbeitung bleibt bis zur Serverbestätigung sichtbar. Eine konkrete Zeitersparnis am echten Gerät ist noch zu messen.


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

Die Android-Bildprüfung gleicht auch den Kalenderaufbau mit iOS ab: Das Papier beginnt unter den darüberliegenden Metallösen; oberhalb des roten Monatsfelds bleibt kein heller Papierstreifen.

## Build 1037 – Lichtwirkung und oberer Verlauf am Entwurf nachgezogen

Der obere Kartenbereich verläuft nun von sattem Bordeauxrot (#951C35) über einen bereits nach 8 % deutlich dunkleren Weinrotton (#5C152C) in dunkles Blau (#10263A bei 24 % der Höhe), mit klarer heller Oberkante. Die bisherige violette Mischfläche entfällt. Die zusätzliche graue Trennlinie über den Rückmeldetasten ist unsichtbar; ihr Platz bleibt für das bestehende Layout reserviert.

Die Tasten und die blaue Leiste erhalten eine stärkere obere Lichtkante, dunklere Unterkante und deutlichere Schatten. Der Leuchtstreifen trägt die bestätigte Rückmeldefarbe über eine breitere Fläche unter der gewählten Taste und läuft weich zu den neutralen Seiten aus. Ohne bestätigte Auswahl bleibt er neutral. Das Originalwappen ist adaptiv unverändert angeordnet, jetzt jedoch mit 50 % statt 12 % Deckkraft sichtbar. Metadaten bleiben einheitlich #C6D2DF. Kalenderösen, Papierkarte, Antwortfreigaben und Speicherrückmeldungen bleiben unverändert.

Die vorhandenen nativen Bildprüfungen enthalten den Vergleichsfall „Indoor Cycling · 20:00 · Injoy EM · Sportkleidung“ und die Größen-/Schriftvarianten. Die fertigen Bilder werden vor der Veröffentlichung gegen den Entwurf und Build 1036 verglichen.

## Build 1038 – Ruhiger Statuswechsel und größeres Wappen

„Gespeichert“ und die Erfolgsplakette entfallen. Der feste Hinweisplatz bleibt für offene Rückmeldungen, Fehler, notwendige Aktualisierungen und veraltete Kalenderstände reserviert. Beim Speichern bleiben Tasten, bestätigte Auswahl und Kartenhöhe stabil; es gibt keine zusätzliche Abdunklung und keinen wechselnden Platzhaltertext. Erst die Serverbestätigung ändert den ausgewählten Status.

Auf iPhone gleitet der Lichtschwerpunkt beim Start der Antwort für 0,55 Sekunden zur angeforderten Taste und übernimmt deren Farbe. Nach Bestätigung wird er heller, bei Fehler kehrt er zum bestätigten Status zurück. „Bewegung reduzieren“ wird beachtet. WidgetKit bestimmt den tatsächlichen Übergang; es wird keine dauernde Animation oder Aktualisierungsschleife erzwungen. Auf Android läuft während der Übertragung ein nativer unbestimmter Ladebalken in der Antwortfarbe; danach erscheint wieder der Lichtschwerpunkt der bestätigten Auswahl. Es wird kein erfundener Prozentfortschritt angezeigt.

Im großen Widget stehen Thema und Metadaten getrennt: Das Thema nutzt die volle verfügbare Breite, das Originalwappen sitzt größer neben Uhrzeit und Kleidung (regulär 56 pt/dp, bei Enge kleiner; bei großer Systemschrift entfällt die Dekoration). Mittlere und kleine Ansichten behalten ihre bisherige Anordnung. Native Bildprüfungen decken alle drei Ladefarben, offene und fehlerhafte Rückmeldungen sowie große Widgets mit kurzen und langen Themen ab. Tatsächliche Übergangsflüssigkeit und Launcher-Verhalten sind zusätzlich am Gerät zu beurteilen. Antwortfreigabe, Wiederholungsschutz und Datenformat bleiben unverändert.


## Build 1039 – Android-Proportionen nach der iPhone-Vorlage

Breite Terminkarten zeigen die drei Rückmeldetasten bereits ab 140 dp Höhe, sofern die Systemschrift genügend Platz lässt. Die 44 dp hohen Tasten und der feste Hinweisplatz bleiben erhalten. Bei weniger Platz öffnet der vorhandene kompakte Status weiterhin den Termin in H₂O.

Das Kalenderblatt bleibt in mittleren Karten schmaler und wächst bei zusätzlicher Höhe nur begrenzt. Thema und Metadaten erhalten dadurch mehr Breite. Das Wappen steht in einer eigenen, vertikal zentrierten Spalte rechts, regulär 40 dp groß; bei geringer Höhe oder großer Systemschrift entfällt es zuerst. Ein kurzes Thema wie „Indoor Cycling“ wird bei Bedarf maßvoll verkleinert, damit es wie auf iPhone einzeilig bleibt. Große Widgets mit Folgeterminen behalten ihre Anordnung.

Die Emulator-Bildprüfung enthält die Referenzkarte bei 140, 150, 160, 170 und 230 dp Höhe sowie vergrößerter Systemschrift. Sie prüft die vollständig sichtbare Rückmeldeleiste und den Abstand zwischen Wappen und Text. Die tatsächlichen Größen im Samsung-Launcher sind zusätzlich am Galaxy zu beurteilen.

Breite Zwischenhöhen unter 140 dp behalten die kompakte Statuszeile, zeigen aber ein größeres einzeiliges Thema, Uhrzeit/Ort und Kleidung. Bei normaler Schrift nutzt ein 36-dp-Wappen rechts den sonst freien Platz. Auch 110 und 130 dp sind als Bildprüfungen enthalten.


Antippen der kompakten Statuszeile öffnet weiterhin den zugehörigen Termin in H₂O, um die Antwort dort zu ändern.

## App-Updates beim Öffnen – Build 1039

Die Android-App fragt beim Öffnen beziehungsweise bei Rückkehr in den Vordergrund Google Play nach einer neueren, für das angemeldete Play-Konto verfügbaren Version. Ein freiwilliger Hinweis „Aktualisieren“ startet nach Antippen den Google-Dialog für ein flexibles Update. Erst nach Zustimmung lädt Play die neue Version im Hintergrund. Bei „Jetzt neu starten“ zuerst offene Eingaben speichern; nur Antippen dieser Aktion schließt die Installation ab. „Später“ blendet den Hinweis für dieselbe Version 24 Stunden aus; eine neuere Version darf wieder angeboten werden. Ein bereits heruntergeladenes Update wird bei Rückkehr in die App wieder erkannt. Offline, ohne verfügbaren Play-Dienst oder ohne Update bleibt H₂O normal bedienbar. Es werden keine APK-Dateien selbst heruntergeladen und keine zusätzlichen Berechtigungen oder Mitgliederdaten übertragen.

Diese Ergänzung ist kein zentraler Installationsbefehl und keine Push-Mitteilung. Die verfügbaren Versionen werden weiterhin im internen Google-Play-Test freigegeben. Der erste Build mit dieser Funktion muss zunächst normal installiert werden; testen lässt sich der Ablauf erst mit einer danach angebotenen höheren Versionsnummer und passender Play-Signatur/Kontoberechtigung.

Auf iPhone erfolgen automatische App-Updates über TestFlight beziehungsweise den App Store, sofern auf dem Gerät aktiviert. H₂O installiert dort keine neue native Version selbst.

Die Android-Emulatorprüfung verwendet Googles FakeAppUpdateManager: Start ohne Dialog, Zustimmung, Download ohne automatischen Neustart, Wiedererkennen des fertigen Downloads, ausdrücklicher Neustart, „Später“ sowie fehlendes Update und nicht verfügbarer Play-Dienst. Reale Store-Berechtigung, Signierung, Verteilung und Installation sind zusätzlich im internen Play-Test zu prüfen.


## Build 1040 – Farbiger kompakter Status und harmonische Proportionen

Kleine und flache Widgets färben die gesamte bestätigte Statusfläche: Dabei grün, Entschuldigt gelb, Unsicher orange, jeweils mit Haken. Auf Gelb und Orange ist die Schrift dunkel, auf Grün weiß. Der Pfeil übernimmt denselben Kontrast. Ohne Antwort bleiben die Flächen neutral; offene Antworten, Fehler, Hinweise und veraltete Kalenderstände werden weiterhin eindeutig angezeigt. Während des Speicherns bleibt die bestätigte Antwort maßgeblich.

Das Kalenderblatt bleibt in mittleren Karten etwa 1,3-mal so hoch wie breit, statt mit zusätzlicher Launcherhöhe immer länger zu werden. Bei großer Systemschrift hat lesbarer Text weiterhin Vorrang. Mittlere Karten halten Kalender, Thema und Antwortleiste als zusammenhängende Gruppe in der verfügbaren Höhe. Zusätzlicher Launcherplatz verteilt sich ober- und unterhalb, statt eine große Lücke zwischen Termin und Antworten zu erzeugen. Das identische Originalwappen wird wie im iPhone-Widget regulär 48 dp groß rechts dargestellt, in der flachen breiten Karte 40 dp. Große Karten behalten ihre bisherige Anordnung. Die tatsächliche Launchergröße und Systemschrift bestimmen weiterhin, wann Details oder die direkte Antwortauswahl Platz haben.

Die vorhandene Emulatorprüfung kontrolliert alle drei bestätigten Farben, lesbaren Textkontrast, neutrale Fehler-/Offen-Zustände und bestätigte Auswahl während einer laufenden Änderung. Zusätzliche geometrische Prüfungen sichern den Abstand zur Antwortleiste und das größere Wappen ab.

Breite kurze Widgets erhalten bei mindestens 110 dp Höhe und ausreichender Schriftfläche eine eigene kompakte Ansicht mit allen drei 44 dp hohen Antworttasten. Kalender, einzeiliges Thema und Wappen stehen darüber; bei Fehlern oder offener Antwort ersetzt der Hinweis die Kleidungszeile. Bei großer Systemschrift oder noch weniger Höhe bleibt die farbige Statusfläche mit Öffnung des Termins als Rückfall erhalten. Die zwei gezielten Entwurfsvorschauen zeigen 330 × 230 dp und 330 × 110 dp mit „Indoor Cycling“, 20:00, Injoy EM, Sportkleidung und Entschuldigt.

Nach der Bildprüfung bleibt die kompakte Ansicht unverändert. Die größere Vorschau verwendet eine über die gesamte Breite laufende, größere Überschrift. Darunter wachsen Kalenderblatt, Zeit/Ort, Kleidung und Wappen proportional mit der verfügbaren Höhe; das Kalenderblatt behält sein kurzes Seitenverhältnis. Bei langen Themen oder vergrößerter Systemschrift werden die Größen aus dem verbleibenden Platz berechnet. Die beiden Größen sind nach der erneuten Bildvorschau bestätigt; der Entwurf wird um die folgenden Update-Hinweise ergänzt.


## Hinweisplatz unter der Lichtleiste – Build 1040

Die Zeile bleibt nach bestätigter Antwort leer. Fehler, nicht bestätigte Änderungen, notwendige Kalenderaktualisierung und offene Rückmeldungen gehen dem Hinweis „App-Update verfügbar“ vor. Beim Speichern meldet ausschließlich die Lichtleiste den laufenden Vorgang. Die kompakte Ansicht behält ihren vorhandenen Hinweisplatz im Kopfbereich.

Die Update-Verfügbarkeit stammt aus Google Play für das jeweilige Konto. Die App übernimmt sie beim Öffnen; der vorhandene Widget-Hintergrundlauf prüft sie zusätzlich höchstens stündlich (Android kann den Lauf verschieben). Ein nach 24 Stunden nicht mehr bestätigter Stand verschwindet. Nach Installation derselben oder einer höheren Buildnummer ist der Hinweis sofort ungültig. Ein Tipp öffnet H₂O mit dem vorhandenen freiwilligen Update-Ablauf. Der Hinweis löst weder Download noch Neustart aus.

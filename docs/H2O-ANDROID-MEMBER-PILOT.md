# Native Android-App mit Mitglieder-Widget

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

Build 1026 zeigt das konkrete Terminthema statt „Nächste Probe“. Der Portalstand 2026.11.01.17 entfernt einen wiederholten Terminart-Präfix wie „Probe ·“; ohne Thema bleibt die Terminart erhalten. Kompakte Widgets ab 160 dp und breite Widgets ab 200 dp erlauben zweizeilige Themen.

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

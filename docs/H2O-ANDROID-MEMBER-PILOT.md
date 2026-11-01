# Native Android-App mit Mitglieder-Widget

Ziel: Dasselbe geschützte H₂O Portal wie auf dem iPhone, ergänzt um ein natives
Android-Widget und freiwillige Firebase-Cloud-Messaging-Mitteilungen.
Verteilung ausdrücklich über den **internen Google-Play-Test**, keine öffentliche
Produktionsveröffentlichung. Bis zu 100 eingeladene Google-Konten; Nutzerziel maximal
50 Geräte. Google bezeichnet die App weiterhin als Testversion. Der Testlink allein
berechtigt nicht zum Mitgliederzugang. Die Android-Web-App bleibt verfügbar.

## Bereits implementiert

- Bestehendes Portal mit Passkey oder Passwort, geschütztem PDF-Export und Einladungs-QR.
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

## Was im Konto noch fehlt

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

## Prüfungen

GitHub Actions `Build Android H2O app and widget` führt Kotlin-Unit-Tests,
Android Lint, Debug-APK und unsigniertes Release-AAB aus. APK, AAB und Berichte
werden als Artefakt bereitgestellt. Der separate App-Workflow prüft die Web- und
Worker-Änderungen. Ohne bestandenes CI und Gerätetest keine Installationsfreigabe.

Auf einem echten Gerät: Einladung/QR, Passwort und Passkey, Wiederanmeldung,
G26-Einwilligung, PDF-Speichern, App-Link, kleiner/großer Widgetbereich mit langem
Titel und größerer Schrift, Heute/Morgen über Mitternacht, Antwortänderung,
Abmeldung/Kontowechsel/Austritt, abgelaufener Cache, FCM im Vorder-/Hintergrund,
verweigerte Benachrichtigung und Offline-Neustart. Nur synthetische Konten für
Bilder und automatisierte Prüfungen verwenden. Erfolgreiche Builds ersetzen diese
Gerätetests nicht.

Offizielle Vorgaben:
- https://support.google.com/googleplay/android-developer/answer/9845334
- https://support.google.com/googleplay/android-developer/answer/14316361
- https://support.google.com/googleplay/android-developer/answer/14151465
- https://firebase.google.com/docs/cloud-messaging/send/v1-api

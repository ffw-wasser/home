# Android-Mitgliederpilot – Build 3

Entwicklungszweig `feature/h2o-android-member-pilot`, aufbauend auf dem iPhone-Mitgliederpilot in PR #239. Noch keine Play-Store-Veröffentlichung und kein produktiver Worker-Deploy. Die bestehenden Mitglieder bleiben registriert; die Anmeldung in der neu installierten App erfolgt mit dem vorhandenen Passwort oder einem unterstützten Passkey. Eine neue Freigabe wird durch die Installation allein nicht erforderlich.

## Einrichtung und Widget

- Android ab Version 9 (API 28); App-ID `de.feuerwehrwasser.h2o`.
- Anmeldung → persönliches Kalenderabo → freiwillige Mitteilungen. Beide Schritte lassen sich überspringen und unter Konto & Sicherheit nachholen. Kein QR-Scanner, keine zusätzliche Home-Webinstallation.
- Auf Android wird Google Kalender angeboten. Das persönliche, nur lesbare Abo wird in Google Kalender bestätigt; es gibt keine Berechtigung zum Lesen oder Schreiben des gesamten Gerätekalenders. Bei Bedarf den Abo-Link am Computer unter Weitere Kalender → Per URL hinzufügen.
- Homescreen lange drücken → Widgets → H₂O-Termine. Das Widget lässt sich in eine kleine oder breite Ansicht ziehen. Es zeigt den nächsten persönlich freigegebenen Termin mit Logo und eigener Rückmeldung; die breite Ansicht ergänzt Ort und Kleidung.
- Die App aktualisiert das Widget nach bestätigten Portalantworten und Rückmeldungen. Keine Hintergrund-Abfrage mit gespeicherten Zugangstoken. Abmeldung und erkannter Zugriffsverlust leeren den Stand. Daten gelten höchstens zwölf Stunden; Android kann die inexacte Aktualisierung im Energiesparmodus verzögern. Abgelaufene Daten werden beim nächsten Rendern verworfen. Das Widget ersetzt keine Alarmierung.
- Die frühere tägliche lokale Erinnerung wird beim Start abbestellt. Der alte Worker bleibt als wirkungslose Migrationsklasse erhalten. Kamera und ZXing sind entfernt.

## Prüfbau

Der Workflow `h2o-android-pilot.yml` baut eine Debug-APK, führt JVM-Tests und Android Lint aus und prüft die echten RemoteViews im Android-15-Emulator. Die Widgets werden mit künstlichen Daten als kleine, breite und leere Ansicht aufgenommen. Die Vorschau-Activity existiert ausschließlich im Debug-Bau und öffnet keine Mitgliedersitzung.

Die herunterladbare APK `h2o-android-debug` ist ein Prüfbau mit temporärer Debug-Signatur. Sie ist nicht für Mitgliederverteilung oder Store-Updates freigegeben. Die gemeinsame Portaloberfläche muss aus demselben Änderungsstand bereitgestellt sein, bevor ein echter Gerätetest den neuen Ablauf beurteilen kann.

Lokaler Bau mit Java 17, Gradle 8.13 und Android SDK 36:

```sh
cd native/android
gradle testDebugUnitTest lintDebug assembleDebug
gradle connectedDebugAndroidTest
```

## Noch erforderliche Konfiguration

1. Eine Firebase-Android-App für exakt `de.feuerwehrwasser.h2o` anlegen und Firebase Cloud Messaging HTTP v1 aktivieren. Beim Bau die vier öffentlichen Clientwerte als Umgebungsvariablen oder Gradle-Properties angeben: `H2O_FIREBASE_PROJECT_ID`, `H2O_FIREBASE_APP_ID`, `H2O_FIREBASE_SENDER_ID`, `H2O_FIREBASE_API_KEY`. Ohne diese Werte meldet die App Mitteilungen als noch nicht eingerichtet und fragt keine Berechtigung ab.
2. Auf dem Worker ausschließlich als Secret `H2O_FCM_SERVICE_ACCOUNT` die Service-Account-JSON mit `project_id`, `client_email` und PKCS8-`private_key` hinterlegen. Die Berechtigung zum Senden für das betreffende Projekt muss vorhanden sein. Dieser Schlüssel gehört niemals in APK, Repository, Testdaten oder Dokumentation. Es wird ausschließlich der feste Google-OAuth-Endpunkt verwendet.
3. Den geprüften Worker und die gemeinsame Portaloberfläche nach entsprechendem Veröffentlichungsauftrag ausrollen. iOS bleibt APNs; Android kennzeichnet seine Geräteregistrierung mit `platform: android`. Mitgliedsprüfung, aktuelle Freigaberevision, Gerätebesitz, Widerruf und maximal fünf Geräte werden gemeinsam durchgesetzt.
4. Erst dann auf einem echten Android-Handy testen: Systemabfrage nach ausdrücklichem Antippen, Hintergrundempfang, Ausschalten/Abmelden, erneutes Anmelden, Kontowechsel und gegebenenfalls Tokenwechsel. Ein neuer FCM-Token wird beim nächsten Vordergrundabgleich erneut zugeordnet. Eine erfolgreiche OAuth-/Payload-Simulation beweist keine echte Zustellung.
5. Vor einer dauerhaften Installation eine eigene Release-Signatur einrichten (`H2O_ANDROID_KEYSTORE`, `H2O_ANDROID_STORE_PASSWORD`, `H2O_ANDROID_KEY_ALIAS`, `H2O_ANDROID_KEY_PASSWORD`, `H2O_REQUIRE_RELEASE_SIGNING=true`). Für native Passkeys/App Links außerdem die echte Signatur in `assetlinks.json` auf der Root-Domain und im Worker unter den erlaubten Android-App-Origins zuordnen. Keine CI-Debug-Fingerprints veröffentlichen. Bis zur geprüften Zuordnung den vorhandenen Passwortzugang verwenden.

Firebase-Autoinitialisierung bleibt bis zur ausdrücklichen Auswahl aus. Die Mitteilung enthält ausschließlich den allgemeinen Hinweis „Eine Mitteilung liegt vor. Bitte H₂O öffnen.“; Namen und Kalenderinhalte werden nicht an FCM gegeben. Daten-Mitteilungen werden lokal nach deaktivierter Auswahl verworfen. Die Zustellung bleibt von Android, Google Play Services, Netzwerk und Geräteeinstellungen abhängig.

Anleitungen: [Firebase Android](https://firebase.google.com/docs/cloud-messaging/android/get-started), [FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api), [Android Widgets](https://developer.android.com/develop/ui/views/appwidgets/overview).

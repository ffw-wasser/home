# H₂O Portal als iPhone- und Android-App

Stand: Entwicklungsvorbereitung, App-Version 1.0.0 (Build 1).

Die beiden nativen Projekte übernehmen das bestehende Mitgliederportal über seine
HTTPS-Adresse. Die Mitglieder müssen die Webseite nicht mehr auf den Home-Bildschirm
legen. Die Gerätehaus-Verwaltung mit OneDrive bleibt in der Hauptanwendung.

## Bereits vorbereitet

| Funktion | Umsetzung |
| --- | --- |
| iPhone/iPad | SwiftUI, WKWebView, dauerhaftes geräteeigenes Web-Datenprofil |
| Android | Kotlin, Android WebView mit expliziter Credential-Manager-Unterstützung |
| Einladung | Nativer QR-Scanner, nur exakte H₂O-Einladungsadresse mit Einmalcode |
| Links aus WhatsApp | Universal Links/App Links für deckel.html und termin.html vorbereitet |
| Anmeldung | Bestehende Passkeys; explizite Android-Zertifikatsbindung im Worker vorbereitet |
| Erinnerung | Freiwillige, allgemeine tägliche App-Erinnerung, lokal auf dem Gerät |
| Ohne Internet | Native Einstiegshilfe und erneutes Laden; private Serverdaten brauchen Internet |
| Build-Prüfung | GitHub Actions: Android-Debug-APK mit Unit-Tests, iOS-Simulator-Build, dieselben Link-Sicherheitstests separat mit Apple Foundation |
| Datenschutz | HTTPS, keine Geheimnisse im Projekt, keine privaten URLs in Logs/Analytics, Android-Backup aus |

Die lokale Erinnerung heißt bewusst **App-Erinnerung**. Sie ist keine Synchronisierung
der Termine, ersetzt keine Zu-/Absagen und wird auf Android ungefähr zugestellt.
Server-Push (APNs/FCM) ist **noch nicht implementiert**. Die App blendet deshalb die
Browser-Push-Aktivierung und den Home-Bildschirm-Installationshinweis aus. Es wird
keine funktionsfähige Serverbenachrichtigung vorgetäuscht.

## Was vor der ersten Anmeldung nötig ist

Entwicklerkonten können Gebühren verursachen. Für eine berechtigte gemeinnützige
Organisation oder Behörde kann bei Apple ein Gebührenerlass beantragt werden;
die Feuerwehr sollte den rechtlich passenden Anbieter vor der Anmeldung klären.
Google nennt eine einmalige Registrierungsgebühr von 25 USD. Es wurden keine Konten
registriert und keine Zahlungen ausgelöst. Offizielle Hinweise:
https://developer.apple.com/de/help/account/membership/fee-waivers und
https://support.google.com/googleplay/android-developer/answer/6112435 .

1. Finale App-Kennung bestätigen: derzeit `de.feuerwehrwasser.h2o` auf beiden Plattformen.
2. Apple-Team-ID und Android-App-Signaturzertifikat festlegen. Google Play App Signing
   verwendet für die ausgelieferte App den **App-Signaturschlüssel**, nicht den Uploadschlüssel.
3. Nur mit den echten, öffentlichen Kennungen ausführen:

   ```sh
   H2O_APPLE_TEAM_ID=ECHTE_TEAM_ID H2O_ANDROID_SHA256=ECHTER_SHA256_FINGERABDRUCK node scripts/prepare-native-association.cjs
   ```

   Die Beispielwerte sind absichtlich ungültig: ohne reale Kennungen erzeugt das
   Skript keine Dateien. Private Schlüssel, Passwörter und Tokens gehören weder
   in den Befehl noch ins Repository.
4. Die erzeugten `.well-known`-Dateien müssen direkt unter
   `https://ffw-wasser.github.io/.well-known/` mit HTTP 200 ohne Weiterleitung
   ausgeliefert werden. **`/home/.well-known/` reicht nicht.** Dafür ist eine
   passende Root-Pages-Veröffentlichung nötig (üblicherweise das Repository
   `ffw-wasser/ffw-wasser.github.io`); diese Vorbereitung legt sie nicht an.
5. Den erzeugten Wert `H2O_ANDROID_APP_ORIGINS` beim bestehenden Cloudflare-Worker
   konfigurieren und den geprüften Worker-Quellstand ausliefern. Er enthält nur
   die erlaubten Zertifikatsfingerabdrücke, keine Geheimnisse. Ohne Konfiguration
   wird kein Android-App-Ursprung akzeptiert. Keine Wildcards, keine frei
   übermittelten Client-Ursprünge; Signatur und RP-ID werden weiter geprüft.
6. iOS mit demselben Apple-Team und den vorbereiteten Associated Domains signieren.
7. Einrichtung, Wiederanmeldung und Wiederherstellung auf echten Geräten testen.

Die App hat einen eigenen Anmeldespeicher. Eine Anmeldung in Safari/Chrome wird
nicht automatisch in den App-Container übernommen. Die Geräte-PIN bestätigt einen
Passkey; sie ist keine Ersatzanmeldung mit der Getränke-PIN. Ein zusätzlicher
Passwortzugang wurde durch diese Vorbereitung nicht eingeführt.

## Bauen und prüfen

Android: JDK 17, Gradle 8.13, Android-SDK 36 und Build-Tools 35.0.0.

```sh
gradle -p native/android :app:testDebugUnitTest :app:assembleDebug
```

Xcode-Projekt erzeugen (Mac mit Xcode, XcodeGen):

```sh
xcodegen generate --spec native/ios/project.yml
xcodebuild build-for-testing -project native/ios/H2OPortal.xcodeproj -scheme H2OPortal -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO
```

Der Build-Workflow kompiliert die iOS-App und die XCTest-Bundles für den Simulator.
Die Link-Sicherheitstests laufen anschließend mit `swift test --package-path native`
unter macOS gegen dieselbe Swift-Implementierung und Apple Foundation. Dafür wird
keine WebView und kein Produktivportal gestartet. Ein erfolgreicher Simulator-Build
ist kein Nachweis eines bestandenen Kamera-, Passkey- oder Gerätetests.

Der Build-Workflow erzeugt ein **Entwicklungs-APK** und eine **Simulator-App**.
Das sind keine fertigen App-Store-Pakete. Ein Simulator-Build kann weder auf einem
iPhone installiert noch bei Apple eingereicht werden. Android-Debug-Keys niemals
in der produktiven Origin-Liste freischalten; dafür einen getrennten Testdienst nutzen.

Automatische Projekt-/Zuordnungsprüfungen:

```sh
node --test tests/native-association.test.cjs tests/portal-identity.test.cjs
```

## Verbindliche Freigabepunkte

Vor einer Store-Einreichung sind noch offen:

- Entwicklerkonten und verantwortliche veröffentlichende Organisation.
- Root-Domain-Zuordnung, echte Signaturen, Release-Builds (Android AAB / iOS Archive).
- Native Server-Mitteilungen mit APNs/FCM, oder ausdrücklich eine erste Version
  ohne Server-Push. Browser-Push ist keine native Ersatzimplementierung.
- Gerätetest: Passkey erstellen/anmelden/wiederherstellen, Einladung und WhatsApp-Link,
  neuer Zugang nach Gerätewechsel, Abmelden, QR-Kamera bei Ablehnung/Abbruch/Hintergrund,
  Termine/Rückmeldungen, Zahlungen, PDF-Buch und PDF-Export, Offline-/Wiederanlauf,
  lokale Erinnerung mit gesperrtem Bildschirm, große Schrift und Screenreader.
- Speziell prüfen: Dateien-Export und Downloads aus WebViews können zusätzliche
  native Übergaben benötigen; hierfür wird keine ungeprüfte Funktion zugesichert.
- Aktuelle Datenschutzangaben, Support- und Datenschutz-URL, Screenshots,
  Prüfungskonto oder geeigneter Testmodus ohne echte Mitgliederdaten.
- Entscheidung zum Ablauf eines Löschwunsches und zu den Store-Anforderungen an
  Kontolöschung. Es wird nicht stillschweigend eine Löschfunktion für Vereinsdaten gebaut.
- Store-Prüfung: Apple beurteilt den Mehrwert über eine umverpackte Website hinaus.
  Nativer QR-Scanner, lokale Erinnerungen und Offline-Hilfe sind vorhanden, garantieren
  aber keine Zulassung. Gegenstand der Einreichung muss der tatsächliche Funktionsstand sein.

Die Vorbereitung registriert keine kostenpflichtigen Konten, veröffentlicht keine
App und ändert keine produktiven OneDrive-Dateien oder Worker-Einstellungen.

## Quellen der technischen Entscheidungen

- Apple Passkeys: https://developer.apple.com/documentation/authenticationservices/supporting-passkeys
- Android WebView/Credential Manager: https://developer.android.com/identity/sign-in/credential-manager-webview
- Android WebKit 1.14: https://developer.android.com/jetpack/androidx/releases/webkit
- AGP 8.11 / Gradle 8.13: https://developer.android.com/build/releases/agp-8-11-0-release-notes
- QR-Scanner: https://github.com/journeyapps/zxing-android-embedded
- Apple Mindestfunktionalität: https://developer.apple.com/app-store/review/guidelines/#minimum-functionality

# H₂O Portal als iPhone- und Android-App

Stand: Entwicklungsvorbereitung, App-Version 1.0.0 (Build 2).

Die vom Auftraggeber übermittelte öffentliche Apple-Team-ID `VKL57X3H6F` ist im
iOS-Projekt vorbelegt. Eine Prüfung im Apple-Konto, gültige Zertifikate und
Provisioning-Profile sowie die Freigabe der App-ID stehen weiterhin aus. Die
Team-ID allein signiert und veröffentlicht keine App.

Die beiden nativen Projekte übernehmen das bestehende Mitgliederportal über seine
HTTPS-Adresse. Die Mitglieder müssen die Webseite nicht mehr auf den Home-Bildschirm
legen. Die Gerätehaus-Verwaltung mit OneDrive bleibt in der Hauptanwendung.

## Bereits vorbereitet

| Funktion | Umsetzung |
| --- | --- |
| iPhone/iPad | SwiftUI, WKWebView, dauerhaftes geräteeigenes Web-Datenprofil |
| Android | Kotlin, Android WebView mit expliziter Credential-Manager-Unterstützung |
| Einladung | iOS: Scanner auf der Anmeldeseite unter „Erste Einrichtung oder Zugang verloren“, nur ohne angemeldete Sitzung; Android: Scanner in der nativen Leiste. Nur exakte H₂O-Einladungsadresse mit Einmalcode |
| Links aus WhatsApp | Universal Links/App Links für deckel.html und termin.html vorbereitet |
| Anmeldung | Passkey oder Benutzername/Passwort; explizite Android-Zertifikatsbindung für Passkeys im Worker vorbereitet |
| Erinnerung | iOS: entfernt; frühere tägliche App-Erinnerungen werden beim ersten Start des Updates beendet. Android: freiwillige tägliche lokale Erinnerung |
| PDF-Export | Native Speichern-/Teilen-Dialoge für bestätigte Portal-PDFs bis 10 MB; Gerätetest noch offen |
| Ohne Internet | iOS: bei Ladefehler direkt „Erneut laden“; Hilfe über die vorhandenen Portal-Infos. Android: native Einstiegshilfe. Private Serverdaten brauchen Internet |
| Build-Prüfung | GitHub Actions: Android-Debug-APK mit Unit-Tests, iOS-Simulator-Build, dieselben Link-Sicherheitstests separat mit Apple Foundation |
| Datenschutz | HTTPS, keine Geheimnisse im Projekt, keine privaten URLs in Logs/Analytics, Android-Backup aus |

Die iPhone-App zeigt keine zusätzliche native Kopfleiste mehr. Nach der Anmeldung
steht der gesamte Inhaltsbereich dem Portal zur Verfügung. Der dunkelblaue Fußbereich
wird hinter dem unteren iPhone-Sicherheitsabstand bis zum Home-Indikator fortgeführt. Zur ersten Einrichtung
auf der Anmeldeseite „Erste Einrichtung oder Zugang verloren“ öffnen und dort
„Einladung scannen“ wählen. Passkey-/Passwortanmeldung bleiben unverändert.

Die lokale Erinnerung auf Android heißt bewusst **App-Erinnerung**. Sie ist keine Synchronisierung
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
Passkey; sie ist keine Ersatzanmeldung mit der Getränke-PIN. Alternativ ist ein persönlicher Passwortzugang vorbereitet. Dafür muss der Dienst mit
einem eigenen H2O_PASSWORD_PEPPER eingerichtet und geprüft werden (siehe cloudflare/push/PORTAL.md).

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
Zusätzlich entstehen ein **unsigniertes Android-AAB** und ein **unsigniertes iPhone-Gerätearchiv**.
Diese Pakete sind für die anschließende Signierung vorbereitet.
Das sind keine fertigen App-Store-Pakete. Ein Simulator-Build kann weder auf einem
iPhone installiert noch bei Apple eingereicht werden. Android-Debug-Keys niemals
in der produktiven Origin-Liste freischalten; dafür einen getrennten Testdienst nutzen.

Automatische Projekt-/Zuordnungsprüfungen:

```sh
node --test tests/native-association.test.cjs tests/portal-identity.test.cjs
```

## PDFs in der nativen App

Der mitgelieferte Adapter übernimmt echte Klicks auf PDF-Blob-Links im Mitgliederportal.
Er lädt keine beliebigen Netzwerkadressen und überträgt keine Sitzungstoken. Nur die
Hauptseite der exakt erlaubten Portaladresse darf die native Datei-Übergabe ansprechen.
Dateiname, PDF-Signatur, Inhaltstyp und maximal 10 MB werden auf beiden Seiten geprüft.

Auf Android erscheint die Auswahl zum Speichern in Dateien oder zum Teilen. Beim
Speichern wird der vom Nutzer gewählte System-Dateidialog verwendet. Beim Teilen
bekommt nur die ausgewählte Anwendung einen Lesezugriff auf die private Cache-Datei.
Die FileProvider-Freigabe umfasst nur den PDF-Exportordner, keine Zugangsdateien.
Nach einer Navigation werden noch nicht bestätigte Exportübergaben verworfen.

Auf iPhone/iPad öffnet sich das systemeigene Teilen-Menü mit „In Dateien sichern“.
Die temporäre App-Datei wird nach Schließen dieses Menüs entfernt. Abgebrochene
App-Sitzungen können temporäre Dateien hinterlassen; bei erneutem Öffnen beziehungsweise
Export werden Dateien, die älter als 24 Stunden sind, aufgeräumt. Auf Android gilt
entsprechend die Bereinigung beim nächsten Appstart/Export. Eine vom Nutzer bewusst
außerhalb der App gespeicherte Kopie bleibt am gewählten Speicherort.

## Signierung der Store-Pakete

Android liest Signaturangaben ausschließlich aus der Build-Umgebung:
`H2O_ANDROID_KEYSTORE`, `H2O_ANDROID_STORE_PASSWORD`, `H2O_ANDROID_KEY_ALIAS`,
`H2O_ANDROID_KEY_PASSWORD`. Alle vier Werte müssen vollständig vorhanden sein und die
Keystore-Datei muss existieren. Signaturdateien und Passwörter niemals ins Repository
oder in öffentliche Workflow-Ausgaben aufnehmen.

Für einen tatsächlichen Release-Build die bereits sicher eingerichtete Umgebung nutzen:

```sh
H2O_REQUIRE_RELEASE_SIGNING=true gradle -p native/android :app:bundleRelease
```

Dieser Aufruf bricht ohne Signaturangaben ab. Die normale Build-Prüfung erstellt
absichtlich ein unsigniertes AAB, damit keine Kontozugangsdaten für PR-Prüfungen nötig
sind. Das Upload-Zertifikat und der endgültige Google-Play-App-Signaturschlüssel können
unterschiedlich sein; die Domain-Zuordnung muss zum ausgelieferten App-Zertifikat passen.

Für iOS in Xcode das tatsächliche Team wählen und die zugehörigen Associated Domains
freischalten. Danach mit gültigem Distributionsprofil archivieren und über Organizer
verteilen. Das in CI erzeugte unsignierte Gerätearchiv ist ein Build-Nachweis, keine
auf einem iPhone installierbare oder einreichbare Fassung.

### iPhone von Windows aus signieren und zu TestFlight hochladen

Der Workflow **H2O iPhone TestFlight** (`.github/workflows/ios-testflight.yml`)
verwendet einen kurzlebigen GitHub-Mac mit Xcode 26 oder neuer. Die manuelle
Signierung nutzt das vorhandene Apple-Distribution-Zertifikat und das
App-Store-Profil für `VKL57X3H6F.de.feuerwehrwasser.h2o`. Das lokale
Windows-Zertifikat muss zusammen mit seinem privaten Schlüssel als
passwortgeschützte P12-Datei exportiert sein; die öffentliche CER-Datei reicht nicht.

In **Settings → Secrets and variables → Actions** diese Repository-Secrets anlegen:

| Secret | Inhalt |
| --- | --- |
| `BUILD_CERTIFICATE_BASE64` | Vollständige P12-Datei, Base64-codiert |
| `P12_PASSWORD` | Passwort dieser P12-Datei |
| `BUILD_PROVISION_PROFILE_BASE64` | Vollständige `.mobileprovision`-Datei, Base64-codiert |
| `APPSTORE_API_KEY_ID` | Key ID des App-Store-Connect-Teamschlüssels |
| `APPSTORE_ISSUER_ID` | Issuer ID des Teamschlüssels |
| `APPSTORE_API_PRIVATE_KEY` | Vollständiger PEM-Inhalt der `.p8`-Datei, inklusive BEGIN-/END-Zeilen |

Ein zusätzliches Keychain-Secret ist nicht nötig: Das Passwort des temporären
Schlüsselbunds wird für jeden Lauf zufällig erzeugt. Keine Signaturdateien,
Passwörter oder Schlüssel im Repository ablegen. Base64 ist keine Verschlüsselung.
Der Workflow lädt ausschließlich die fertige signierte IPA als Artefakt hoch;
P12, P8 und temporärer Schlüsselbund werden im abschließenden Schritt entfernt.

Nach Prüfung und Übernahme des Workflows samt nativer App nach `main`:

1. **Actions → H2O iPhone TestFlight → Run workflow** öffnen, Branch **main** wählen.
2. Zuerst die Upload-Option ausgeschaltet lassen, um Profil, Zertifikat und den
   tatsächlichen signierten Geräte-Build zu prüfen.
3. Nach erfolgreichem Build erneut starten und die Option **Signierten Build zu
   Apple TestFlight hochladen** aktivieren. Apple verarbeitet den Build anschließend;
   ein erfolgreicher Upload bedeutet noch keine abgeschlossene Verarbeitung.
4. In **App Store Connect → App → TestFlight** Verarbeitung, Verschlüsselungsangaben
   und interne Tester einrichten. Der Workflow fügt keine Tester hinzu und reicht
   keine öffentliche App-Store-Prüfung ein.

Auf Pull Requests laufen ausschließlich Prüfungen mit künstlichen Profilen und
die Shell-Syntaxprüfung; Signatursecrets werden dabei nicht verwendet. Ein manueller
Signaturlauf ist auf `main` begrenzt. Der Profilprüfer kontrolliert App-ID, Team,
Ablaufdatum, Verteilungsart, Associated Domains und ein zum Profil passendes gültiges
Zertifikat mit privatem Schlüssel. Falsche, abgelaufene oder nicht passende Angaben
brechen den Build ab. Der macOS-Importfehler „The specified item already exists in
the keychain“ wird als möglicher Doppeleintrag behandelt; danach muss die gültige
Signaturidentität mit privatem Schlüssel dennoch zum Profil passen. Andere
Importfehler, insbesondere ein falsches P12-Passwort, bleiben Abbruchgründe.
Bei Associated Domains akzeptiert der Prüfer sowohl die Profilliste als auch
Apples einzelnen `*`-Platzhalter in der Profil-Allowlist. Die eigentliche App
behält ihre ausdrücklich eingetragenen Domains; der Platzhalter wird nicht in
die App-Berechtigungen übernommen.
Jede Ausführung erhält eine eigene Build-Nummer aus
`1000 + GitHub-Run-Nummer` und Wiederholungsnummer (z. B. `1001.1`).

Die Root-Domain-Zuordnung für Passkeys und Universal Links sowie die tatsächliche
Bereitstellung von Portal und Worker bleiben separate Voraussetzungen. Ein
signierter Build bestätigt diese Dienste und echte Geräteabläufe nicht. Der
erste Signaturlauf und ein Upload müssen im tatsächlichen Apple-/GitHub-Betrieb
geprüft werden; lokale Profiltests können sie nicht ersetzen.

Offizielle Referenzen:
https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications
und https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/ .

## Verbindliche Freigabepunkte

Vor einer Store-Einreichung sind noch offen:

- Entwicklerkonten und verantwortliche veröffentlichende Organisation.
- Root-Domain-Zuordnung, echte Signaturen, Release-Builds (Android AAB / iOS Archive).
- Native Server-Mitteilungen mit APNs/FCM, oder ausdrücklich eine erste Version
  ohne Server-Push. Browser-Push ist keine native Ersatzimplementierung.
- Gerätetest: Passkey erstellen/anmelden/wiederherstellen, Einladung und WhatsApp-Link,
  neuer Zugang nach Gerätewechsel, Abmelden, QR-Kamera bei Ablehnung/Abbruch/Hintergrund,
  Termine/Rückmeldungen, Zahlungen, PDF-Buch und PDF-Export, Offline-/Wiederanlauf,
  Android: lokale Erinnerung mit gesperrtem Bildschirm; iOS: keine Kopfleiste nach Anmeldung,
  Scanner nur vor Anmeldung, Entfernung früherer Erinnerungen; große Schrift und Screenreader.
- Speziell prüfen: Die neue PDF-Übergabe ist automatisiert geprüft und nativ kompiliert;
  Speichern/Teilen mit den tatsächlichen iPhone-/Android-Datei-Apps bleibt ein Gerätetest.
- Aktuelle Datenschutzangaben, Support- und Datenschutz-URL, Screenshots,
  Prüfungskonto oder geeigneter Testmodus ohne echte Mitgliederdaten.
- Entscheidung zum Ablauf eines Löschwunsches und zu den Store-Anforderungen an
  Kontolöschung. Es wird nicht stillschweigend eine Löschfunktion für Vereinsdaten gebaut.
- Store-Prüfung: Apple beurteilt den Mehrwert über eine umverpackte Website hinaus.
  Nativer QR-Scanner sowie auf Android lokale Erinnerungen und Offline-Hilfe sind vorhanden, garantieren
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

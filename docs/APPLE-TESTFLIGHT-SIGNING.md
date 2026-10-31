# H2O iPhone Widget – TestFlight Signierung unter Windows

Stand: 31.10.2026. Entwicklungszweig PR #238. Es wurde noch kein signiertes IPA erstellt oder TestFlight-Upload ausgeführt.

## Bereits eingerichtet

- Apple Team: VKL57X3H6F.
- Haupt-App: de.feuerwehrwasser.h2o.
- Widget: de.feuerwehrwasser.h2o.widget.
- Gemeinsame App Group: group.de.feuerwehrwasser.h2o.
- Neues Apple Distribution Zertifikat mit privatem Schlüssel als PFX exportiert.
- Zwei App Store Connect Provisioning-Profile: H2O Portal AppStore und H2O Widget AppStore.
- Eine .p8 existiert; vor dem Upload muss überprüft werden, dass dies ein **App Store Connect API Key** ist und kein APNs-Schlüssel.

## Schritt 1 – getrennte GitHub-Umgebung

Unter https://github.com/ffw-wasser/home/settings/environments eine Umgebung mit dem Namen **apple-testflight-review** anlegen.

Soweit im GitHub-Konto verfügbar, nur den Branch main freigeben und erforderliche Reviewer aktivieren. Geheime Dateien nur als **Environment secrets** hinterlegen, niemals als Dateien im Repository, als normale GitHub-Variablen oder im Chat.

## Schritt 2 – vier Secrets für die reine Signierung

| Name des Environment Secrets | Wert |
| --- | --- |
| H2O_IOS_P12_BASE64 | Base64 der auf dem Windows-PC gespeicherten PFX-Datei |
| H2O_IOS_P12_PASSWORD | Passwort der PFX-Datei |
| H2O_IOS_APP_PROFILE_BASE64 | Base64 des neuen Profils für die Haupt-App |
| H2O_IOS_WIDGET_PROFILE_BASE64 | Base64 des neuen Profils für das Widget |

PowerShell-Beispiel zur lokalen Base64-Kodierung einer Datei und zum Kopieren in die Zwischenablage:

~~~powershell
$path = "$env:USERPROFILE\H2O-Apple-Signing\H2O-Apple-Distribution.pfx"
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes($path)) | Set-Clipboard
~~~

Den Inhalt direkt in das passende GitHub-Environment-Secret einfügen und speichern. Für jedes Profil den Dateipfad durch seinen tatsächlichen .mobileprovision-Pfad ersetzen und das jeweils richtige Secret befüllen. Danach die Zwischenablage leeren:

~~~powershell
Set-Clipboard -Value ''
~~~

Base64 ist keine Verschlüsselung. Der Schutz entsteht erst bei Speicherung als GitHub Secret. PFX-Datei und Passwort nicht hochladen oder weitergeben.

## Schritt 3 – drei zusätzliche Secrets für den späteren Upload

In App Store Connect unter Benutzer und Zugriff > Integrationen > App Store Connect API sicherstellen, dass die .p8 ein API-Schlüssel mit Key ID und Issuer ID ist. Ein APNs-Key ist ungeeignet.

| Name des Environment Secrets | Wert |
| --- | --- |
| H2O_APPSTORE_API_KEY_BASE64 | Base64 der App Store Connect API .p8 |
| H2O_APPSTORE_KEY_ID | Zugehörige Key ID |
| H2O_APPSTORE_ISSUER_ID | Zugehörige Issuer ID |

Für einen signierten **Build ohne Upload** werden diese drei Secrets noch nicht benötigt.

## Manuelle Build-Freigabe

Der vorbereitete Workflow liegt unter .github/workflows/h2o-apple-testflight-review.yml.

- Er läuft nur bei bewusster manueller Auslösung auf **main**, nie automatisch durch einen Pull Request.
- Er verwendet macOS 26, einen temporären Schlüsselbund und zwei separate Provisioning-Profile.
- Die signierte Variante öffnet ausschließlich die **synthetische Apple-Demo** beim neuen Cloudflare-Test-Worker.
- Er exportiert ein IPA. Das Build-Artefakt wird bei GitHub für drei Tage aufbewahrt.
- Upload zu TestFlight erfolgt **nur**, wenn der Benutzer die Workflow-Option upload_to_testflight aktiv einschaltet.
- Der Workflow enthält keinen Pfad zur produktiven Feuerwehr-D1-Datenbank.

Wichtig: GitHub zeigt neue workflow_dispatch-Workflows normalerweise erst an, wenn sie auf dem Default-Branch vorhanden sind. PR #238 darf erst nach separater ausdrücklicher Freigabe integriert werden. Vorher kann der neue Release-Workflow nicht über die gewohnte GitHub-Actions-Oberfläche gestartet werden.

Nach dem Upload kann der Kontoinhaber als interner TestFlight-Tester die neue App auf seinem iPhone prüfen. Externe Beta-Tester benötigen zusätzlich eine Apple-Beta-Prüfung mit funktionierendem Demo-QR-Code.

# Mein Deckel – geschützte Handyansicht

Vorbereitete Erweiterung, noch nicht für echte Mitgliederdaten freigeschaltet. Ein Node-22-Webdienst dient die Handyansicht und liest OneDrive. Keine Finanzdaten werden auf Render gespeichert. Persönliche Zugangsdaten bleiben als `Getraenke/zugang-<SHA256 der Mitgliedskennung>.json` in OneDrive. Der Gerätehaus-Browser schreibt diese Datei mit seinem bestehenden Microsoft-Zugang. Der Server bietet keine öffentliche Funktion zum Erstellen eines Mitgliedszugangs.

## Render

Ein Web Service aus `https://github.com/ffw-wasser/home.git`, Feature-Branch zum Testen, Region Frankfurt, kostenloser Plan. Build: `node --check backend/server.cjs`. Start: `node backend/server.cjs`. Health Check: `/health`. Ein schlafender kostenloser Dienst benötigt beim ersten Aufruf zusätzliche Zeit. Nur eine Instanz betreiben: die PIN-Versuchsbegrenzung liegt im Arbeitsspeicher.

Server-Geheimnisse ausschließlich in Render Environment, niemals in GitHub, Browser-Code oder Chat:

| Variable | Inhalt |
| --- | --- |
| SESSION_SECRET | Zufälliges Geheimnis mit mindestens 32 Zeichen |
| MS_CLIENT_ID | Microsoft-App für den Server |
| MS_CLIENT_SECRET | Geheimnis dieser Microsoft-App |
| MS_REFRESH_TOKEN | Delegiertes Refresh Token des OneDrive-Eigentümers |
| OD_DRIVE_ID | Laufwerk der bestehenden Anwendung |
| OD_DRINKS_FOLDER_ID | ID des bestehenden Ordners Getraenke |
| PUBLIC_ORIGIN | Exakte HTTPS-Adresse des Dienstes; alternativ nutzt der Server RENDER_EXTERNAL_URL |

Für persönliches OneDrive ist eine delegierte Microsoft-Anmeldung erforderlich. Eine reine Anmeldung des Servers mit Client-ID und Client-Secret genügt nicht. Microsoft-App mit Unterstützung persönlicher Microsoft-Konten und Web-Redirect registrieren; über den offiziellen Authorization-Code-Flow mit `Files.Read offline_access` einmalig durch den Eigentümer autorisieren. Refresh Token sicher direkt im Render-Dashboard hinterlegen. Diese vorbereitete Version enthält noch keinen geführten OAuth-Einrichtungsassistenten. Token-Erneuerungen bleiben im RAM; bei Neustart wird der hinterlegte Ausgangswert verwendet. Bei Widerruf oder ungültigem Ausgangstoken muss die Verbindung neu autorisiert werden. Eine dauerhaft wartungsarme Token-Rotation ist vor dem Regelbetrieb noch zu ergänzen.

Referenz: https://learn.microsoft.com/en-us/graph/auth-v2-user

## Gerätehaus und Mitglieder

Erst nach erfolgreichem Verbindungstest die HTTPS-Adresse in `globalThis.DRINKS_MOBILE_ORIGIN` im Webseiten-Code aktivieren. Ohne Adresse bleibt die neue Schaltfläche verborgen.

Im geöffneten persönlichen Getränkekonto „Auf meinem Handy ansehen“ wählen und QR-Code scannen. Bei jedem Erstellen wird der bisherige persönliche Link ungültig. Der private Link enthält 256 Bit Zufall im URL-Fragment (nicht in Server-Anfragen oder Referrer). OneDrive speichert nur dessen SHA256-Hash. Link privat als Lesezeichen speichern, PIN eingeben, eigenen Deckel ansehen. Anmeldung gilt 15 Minuten; Änderungen der PIN oder des Links sperren bestehende Sitzungen beim nächsten Abruf. Nach fünf Anmeldeversuchen innerhalb von 15 Minuten wird dieser Zugang vorübergehend blockiert. Neustarts setzen diese Begrenzung zurück.

Die API enthält weder Mitgliederlisten noch fremde Konten, PIN-Hashes oder Microsoft-Tokens. Finanzdaten werden nur frisch aus OneDrive gelesen, bei Fehlern ausgeblendet und nicht in Browser-Speichern abgelegt. PayPal-Links lösen keine automatischen Zahlungsbuchungen aus. Das Eintragen und Bestätigen bleibt auf dem Gerätehaus-iPad.

Tests: `node --test tests/*.test.cjs`. Vor Aktivierung zusätzlich echte OneDrive-Verbindung und privaten Link auf iPhone/iPad prüfen. Keine echten Zahlungen als Test buchen.

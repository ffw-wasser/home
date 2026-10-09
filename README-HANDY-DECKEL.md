# Persönlicher Handy-Deckel ohne Server

Die Handyansicht `deckel.html` benötigt weder Installation noch Microsoft-Anmeldung. Sie zeigt den letzten vom Gerätehaus-iPad veröffentlichten Kontostand, Guthaben, Bonusfortschritt und fünf letzte Buchungen. PayPal öffnet den offenen Betrag für `paypal.me/FeuerwehrWasser`. Nach Prüfung des tatsächlichen PayPal-Eingangs trägt die Administration den Betrag unter Einstellungen → Getränkeverwaltung → Offene Deckel & PayPal ein. Eine Teilzahlung reduziert den offenen Betrag entsprechend, eine vollständige Zahlung gleicht ihn aus. Treuebonus wird wie bei Mitgliederzahlungen berechnet; danach wird die Handyansicht automatisch zur Aktualisierung vorgemerkt. Die Handyansicht selbst kann weder Striche noch Zahlungen oder PINs verändern.

## Einmalige Einrichtung durch die Administration

1. Unter https://github.com/new als `ffw-wasser` ein **öffentliches**, separates Repository `deckel-daten` anlegen. README hinzufügen und Hauptzweig `main` verwenden. Keine GitHub Actions oder Pages für dieses Daten-Repository einrichten. Es dient nur als Ablage verschlüsselter Dateien.
2. Unter https://github.com/settings/personal-access-tokens/new einen **Fine-grained personal access token** erstellen. Repository access: **Only select repositories**, ausschließlich `deckel-daten`. Repository permissions: **Contents → Read and write**. Keine weiteren Schreibrechte. Eine angemessene Ablaufzeit festlegen und den Zugang vor Ablauf erneuern.
3. Am Gerätehaus-iPad OneDrive verbinden. In der Anwendung **Einstellungen → Getränkeverwaltung → Handy-Deckel** öffnen, mit dem Administrationspasswort anmelden, Repository und Token eingeben und **Verbindung prüfen und in OneDrive speichern** wählen. Den Token ausschließlich dort eingeben, niemals im Chat oder in Quellcode. Er wird in `Getraenke/handy-verbindung.json` privat in OneDrive gespeichert.

Die bestehende ChatGPT-GitHub-Verbindung kann keinen Schreibzugang an die laufende iPad-Webseite übergeben. Deshalb ist diese einmalige Administrations-Einrichtung erforderlich. Die Erweiterung ist ohne sie eingebaut, kann aber noch keine persönlichen Zugänge veröffentlichen.

## Mitglieder

1. Eigenes Getränkekonto am iPad mit der bestehenden PIN öffnen.
2. **Mein Deckel aufs Handy** antippen und persönlichen QR-Code scannen.
3. Die Seite als Lesezeichen speichern. Beim erneuten Anzeigen bleibt der Link gleich. Niemand benötigt eine App oder ein Microsoft-Konto.

Der persönliche Link enthält den AES-Schlüssel im URL-Fragment. Jeder mit dem vollständigen Link kann den zugehörigen Deckel lesen. Den Link wie ein Passwort behandeln und nicht teilen. **Zugang erneuern** erzeugt einen neuen Schlüssel und veröffentlicht den aktuellen Deckel neu. Ein alter Link kann neue Kontostände danach nicht mehr entschlüsseln; CDN-Caches können die Umstellung verzögern. Bereits gelesene Daten und historische verschlüsselte GitHub-Versionen mit dem alten Schlüssel bleiben zugänglich. Eine vollständige rückwirkende Löschung oder Sperre kann die statische Lösung nicht leisten.

## Daten und Aktualisierung

Die eigentlichen Konten, PINs, privaten Schlüssel und Zugangsdaten bleiben in OneDrive. Nur eine minimierte Ansicht ohne Namen, echte Mitgliedskennungen, Buchungskennungen, PIN-Hashes oder Tokens wird mit **AES-256-GCM** verschlüsselt und in `deckel/<zufällige Kennung>.json` veröffentlicht. Jeder Snapshot hat eine neue zufällige 96-Bit-Nonce, eine an die zufällige Kennung gebundene Authentifizierung und eine feste Klartextlänge von 4096 Bytes, damit die Dateigröße nicht die Zahl der Buchungen verrät. Öffentliche Commit-Zeitpunkte und zufällige Dateikennungen sind sichtbar; verschlüsselte Daten bleiben im Git-Verlauf erhalten.

Nach bestätigten Strichen und Zahlungen veröffentlicht das iPad separat im Hintergrund. Ein Fehler kann keine bestätigte Buchung zurücknehmen oder doppelt buchen. Die Oberfläche weist auf noch nicht aktualisierte Handyansichten hin. Beim erneuten Öffnen der Getränke sowie nach einer Bonusänderung werden eingerichtete Ansichten erneut zur Veröffentlichung vorgemerkt. Zusätzlich gibt es **Handyansicht aktualisieren** am eigenen Konto und **Alle Handyansichten aktualisieren** in der Administration.

Das iPad muss online bleiben und OneDrive verbunden sein. Wird die Webseite während der Hintergrund-Veröffentlichung geschlossen oder ist der GitHub-Token abgelaufen, bleibt auf dem Handy ein älterer Stand sichtbar. Deshalb wird immer das Veröffentlichungsdatum angezeigt. GitHub-CDN-Caches können Änderungen für einige Minuten verzögern. Auf dem Handy werden weder Klartext noch Schlüssel in localStorage/sessionStorage oder einem neuen Service Worker gespeichert; der private Link bleibt zum erneuten Öffnen im Lesezeichen/Browser-Verlauf.

## Kosten

Keine Render-Dienste, Server, neuen Datenbanken, gekauften Domains oder kostenpflichtigen GitHub Actions nötig. Die vorhandene öffentliche GitHub-Pages-Webseite dient die Ansicht; das separate öffentliche Repository dient nur der Ablage. GitHub-Nutzungsgrenzen bleiben zu beachten. Es werden keine automatischen Upgrades eingerichtet.

## Prüfung

`node --test tests/*.test.cjs` prüft die vorhandenen Abläufe sowie Verschlüsselung, falsche Schlüssel, Manipulation, Linkrotation, Veröffentlichungsfehler und Administrationsschutz. Browserprüfungen verwenden ausschließlich fiktive Mitglieder und simulierte OneDrive-/GitHub-Antworten. Vor dem ersten realen Mitgliedszugang die einmalige Verbindung am iPad einrichten und mit einem eigenen Konto den QR-Abruf prüfen. Keine echten Zahlungen als Test buchen.

## PayPal-Eingänge in der Administration

Mitglied wählen, tatsächlich erhaltenen Betrag eingeben, optional den PayPal-Transaktionscode hinterlegen und den geprüften Eingang bestätigen. Es wird eine unveränderliche Zahlung mit `confirmation: admin` angehängt; der Kontostand wird nicht überschrieben. Mit demselben Transaktionscode kann dieselbe Zahlung auf diesem Konto nicht nochmals gebucht werden. Ein Code ist keine automatische PayPal-Verifikation und bietet keinen kontenübergreifenden Dublettenschutz. Bei unklarem Speicherstatus wird dieselbe Buchungsnummer erneut geprüft. Beträge über dem aktuell offenen Deckel werden abgelehnt. Ältere Clients, die Admin-Zahlungen noch nicht kennen, lehnen betroffene Konten ab; die Anwendung vor Nutzung der neuen Funktion neu laden.

## Freiwillige manuelle Push-Erinnerungen

Die reine Kontostand-Anzeige bleibt ohne Versandserver nutzbar. Für Handy-Popups ist zusätzlich der kostenlose Cloudflare-Dienst unter [cloudflare/push/README.md](cloudflare/push/README.md) einzurichten. Ohne diese Verbindung findet kein Push-Versand statt.

Nur nach ausdrücklicher Aktivierung der Erinnerungen speichert das Handy den persönlichen Link lokal in IndexedDB. So öffnet ein Benachrichtigungsklick den eigenen Deckel. Technische Geräte-Adressen und zufällige Kennungen liegen zusätzlich bei Cloudflare. Der geheime Deckel-Link, Namen und Beträge werden nicht an den Versanddienst übertragen. Die Administration versendet ausschließlich manuell; es gibt keine automatischen Erinnerungen.

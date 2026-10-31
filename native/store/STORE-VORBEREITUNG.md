# H₂O Portal – Apple-Veröffentlichung vorbereiten

Stand: 31.10.2026. Arbeitsunterlagen für den Kontoinhaber; noch keine App-Store-Einreichung.

## Ziel und bestätigter Stand

- Fertige App zur nicht gelisteten Verteilung, nach gesonderter Apple-Genehmigung.
- Gemeinsamer Installations-QR für iPhone/iPad und Android: `https://ffw-wasser.github.io/home/install.html`. Die Seite ist veröffentlicht.
- Android öffnet die bestehende PWA. iPhone/iPad erhalten nach Freigabe den Apple-Link; bis dahin bleibt die Browserinstallation verfügbar.
- Build 1018 erfolgreich signiert und zu Apple TestFlight hochgeladen und der Store-Version zugeordnet. Das Widget setzt die zuletzt freigegebene Gewichtung um: Datum/Monat und Status groß, Uhrzeit klein.
- `ITSAppUsesNonExemptEncryption=false` ist ab 1017 im Paket enthalten. Kein eigener Kryptocode und keine Drittanbieter-Kryptobibliothek im nativen Container.
- App Store Connect: nur Deutschland, kostenlos, manuelle Veröffentlichung, Support-URL und Copyright gespeichert. Datenschutzangaben als Entwurf erfasst. Datenschutz-URL und vollständiger Prüfzugang noch offen. Die Namenskorrektur auf Markus Bürklin wurde bei Apple beantragt. Kein externer Apple-Installationslink verfügbar.

## Übertragbare Store-Texte

Name: H2O Portal

Untertitel: optional, auf Wunsch weggelassen.

Beschreibung:

Das H₂O Portal begleitet die Mitglieder der Feuerwehr Abteilung Wasser im Dienstalltag.

• Feuerwehrtermine ansehen und die eigene Teilnahme zurückmelden.
• Persönliche Nachweise und anstehende Fristen im Blick behalten.
• Den eigenen Getränkedeckel ansehen und freigegebene Buchungen vornehmen.
• Feuerwehrwissen und Ausbildungsunterlagen aufrufen.
• Freigegebene Kontakte und Informationen finden.
• Den nächsten persönlichen Termin und den Rückmeldestatus im iPhone-Widget sehen.

Die Feuerwehrverwaltung gibt den persönlichen Zugang frei. Die Anmeldung erfolgt per Passkey oder Benutzername und Passwort. Die Installation allein gewährt keinen Mitgliederzugang. Kalenderabo und Mitteilungen sind freiwillig; einzelne Funktionen hängen von der persönlichen Freigabe ab.

Die App ist für den internen Alltag der Feuerwehr Wasser bestimmt. Sie ersetzt keine Notruf- oder Alarmierungsanlage. Bei einem Notfall 112 wählen.

Keywords: Feuerwehr,Wasser,Emmendingen,Termine,Probe,Ausbildung,Mitglieder

Kategorie-Vorschlag: Produktivität. Preis-Vorschlag: kostenlos. Verteilung: nicht gelistet beantragen; die Apple-Genehmigung steht aus. Länder, Kategorie und rechtlichen Anbieter im Apple-Konto bestätigen.

Nicht mehr bewerben: nativer Einladungs-QR-Scanner, tägliche lokale Erinnerung, Challenge oder Treuepunkte. Keine garantierte Sofortaktualisierung des Widgets versprechen.

## Datenschutzangaben: fachlicher Entwurf, vor Übermittlung abgleichen

Kein pauschales „Keine Daten erhoben“. Auch die Webinhalte der nativen App und eingebundene Dienste gehören zur Bewertung.

| Vorhandene Verarbeitung | In Apple abzugleichen |
| --- | --- |
| Mitgliedername, Zugangskennung, Benutzername, öffentliche Passkey-Kennung | Kontaktinformationen / Benutzer-ID; App-Funktionalität; mit Benutzer verknüpft |
| Rückmeldungen, Mitgliedszuordnung, Fristen und Nachweisprüfstatus | Benutzerinhalte / sonstige Daten; medizinisch bezogene G26-Gültigkeiten ausdrücklich auf Kategorie Gesundheit prüfen |
| Getränke, Buchungen, Zahlungen, offene Beträge und Bestellungen | Kaufverlauf / andere Finanzinformationen nach Apples Definition abgleichen |
| APNs-Token, Pushregistrierung und persönlicher Abo-Abrufstatus | Gerätekennung und Nutzungsdaten nach tatsächlichem Dienstbetrieb abgleichen |
| Widgetstand nur in der App Group | Lokale Verarbeitung: nächster Termin und Status, begrenzte Lebensdauer; kein Zugangstoken im Widget |
| Microsoft, Cloudflare, Google, Apple; PayPal/OpenLigaDB bei Nutzung | Empfänger und tatsächlichen Datenfluss abgleichen; keine fremden Datenschutzsiegel als eigene Zertifizierung darstellen |

Keine Werbe- oder Analyse-SDKs im nativen Projekt. Kein werbliches Tracking im Code eingerichtet. Providerseitige Protokollierung, Aufbewahrungsfristen und rechtlicher Verantwortlicher sind noch zu bestätigen. Datenschutzrichtlinie muss öffentlich ohne Anmeldung erreichbar sein; die interne Infokachel allein genügt dafür nicht.

## Tatsächliche offene Freigabepunkte

1. Im Apple-Konto anmelden und bestehende Beschreibung, Support-/Datenschutz-URL, Anbieter, Kontakt, Altersfreigabe, Geräte/Länder und Verteilung abgleichen. Vorhandene Angaben weiterverwenden, keine Identität oder Adresse erfinden.
2. Einen funktionsfähigen Apple-Prüfzugang mit künstlichen Daten für die relevanten Funktionen desselben eingereichten Mitglieder-Builds bereitstellen. Die bisherige separate Demo ist nur eine Termindemo und ersetzt das nicht. Kein allgemeiner Zugang zu echten Mitgliederdaten.
3. Kontolöschung: Konto & Sicherheit → Konto → Portal-Konto löschen. Erneute Anmeldung und ausdrückliche Bestätigung erforderlich. Löscht eigene Portalzugänge, Sitzungen, Push, Kalenderabo und Rückmeldungen serverseitig gemeinsam. Die separat verwaltete Mitgliedschaft, Nachweise, Unterlagen, Bestellungen und das zentrale Getränkekonto bleiben entsprechend der bestätigten Abgrenzung erhalten. Alte Freigaben werden ungültig; erneuter Zugang nur mit neuer Freigabe und erneuerter Zugangskennung. Keine produktiven Konten zum Testen löschen.
4. Am echten iPhone prüfen: Passkey und Passwort, Kalenderlink → Rückmeldung → Navigation → Home → Widget, jede Statusfarbe, Neuinstallation, Abmeldung, große Schrift, PDF-Rückkehr. Native Pushzustellung und Domainzuordnung müssen real bestätigt sein; automatisierte Tests allein reichen dafür nicht.
5. Die vorbereiteten Store-Bilder am finalen nativen Build abgleichen und ohne echte Mitgliederdaten verwenden. iPhone- und iPad-Unterstützung des Projekts erfordert passende Screenshots.
6. Erst nach vollständigem Stand zur App Review einreichen, in Review Notes die gewünschte nicht gelistete Verteilung erklären und den Apple-Antrag stellen. Keine Beta als fertige App einreichen. Manuelle Freigabe wählen, wenn vor einem automatischen öffentlichen Start zunächst die Unlisted-Entscheidung abgewartet werden muss.

## Gemeinsamen QR-Code freischalten

Die QR-Grafik `assets/install/h2o-install.svg` enthält ausschließlich die öffentliche Installationsseite, keine Einladung, kein Token und keine Mitgliedsnummer. Die Seite erkennt das Gerät lokal; auf unbekannten Geräten zeigt sie beide Wege. Der QR wird ausschließlich in der entsperrten Gerätehaus-Oberfläche unter Verwaltung → H₂O Portal angezeigt, beim Sperren ausgeblendet und von der öffentlichen Installationsseite nicht dargestellt. Die zugrundeliegende allgemeine Installationsadresse und QR-Datei sind nicht geheim und können weitergegeben werden; sie berechtigen nicht zum Mitgliederzugriff. Die Kamera-App des Handys genügt.

Wenn der echte Apple-Link im Konto verfügbar und auf dem iPhone geprüft ist, `native/store/install-links.json` unter `ios` mit dem vollständigen offiziellen `https://apps.apple.com/.../id...`-Link ergänzen. Für einen gewünschten externen Test stattdessen den echten öffentlichen `https://testflight.apple.com/join/...`-Link verwenden. Keinen Gruppenverwaltungslink oder persönlichen E-Mail-Einladungslink eintragen. Der gemeinsame QR bleibt bei diesem Wechsel gleich.

Eine separate druckbare iPhone-Karte lässt sich vollständig offline erzeugen:

```sh
node scripts/create-ios-install-qr.cjs https://ffw-wasser.github.io/home/install.html AUSGABEORDNER
```

Der endgültige Apple-Link ist noch nicht bekannt; `ios: null` zeigt bewusst keine falsche Apple-Installationsschaltfläche. Persönliche Zugangsfreigabe bleibt ein gesonderter Vorgang.

## Bildschirmbilder

`scripts/capture-ios-store-screens.cjs` erzeugt echte Portalansichten mit künstlicher In-Memory-Datenbank. Netzwerkzugriffe auf echte Dienste werden blockiert. Ausgabe: `qa/ios-store`, iPhone 1206×2622 und iPad 2064×2752. Die Bilder sind Vorbereitung, kein Nachweis eines Tests auf physischer Apple-Hardware. Manifest enthält `nativeDeviceVerified:false`. Vor Store-Upload gegen den finalen Build prüfen.

## Apple-Referenzen

- https://developer.apple.com/support/unlisted-app-distribution/
- https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/
- https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review/
- https://developer.apple.com/support/offering-account-deletion-in-your-app/
- https://developer.apple.com/app-store/app-privacy-details/
- https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/

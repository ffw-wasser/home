# Apple Review: isolierter H2O-Demozugang

Stand: 31.10.2026. Planung, noch nicht eingerichtet oder veröffentlicht.

## Anlass

Apple konnte den alten TestFlight-Build 1.0.0 (1008.1) wegen eines fehlenden Demo-QR-Codes nicht vollständig prüfen (Guideline 2.1). Für den neuen Widget-Build wird ein separater, überprüfbarer Demo-Zugang benötigt.

## Sicherheitsregeln

- Kein echter Mitgliederzugang und keine produktiven QR-Einladungen für Apple.
- Keine echten Namen, Termine, Telefonnummern, Nachweise, OneDrive-Dokumente oder Google-Kalenderdaten in der Demo.
- Demo mit eigenem Cloudflare-Worker, eigener D1-Datenbank, eigenen Zugangsdaten und synthetischen Terminen; keine produktiven Secrets kopieren.
- Kein allgemeiner Demo-Schalter, der die normale H2O-Authentisierung umgeht.
- Die vorhandene native iOS-App akzeptiert derzeit nur die reguläre H2O-Webadresse. Für einen Review-Build muss eine gesonderte, fest eingetragene Demo-Adresse vorgesehen und mit denselben Sicherheitsprüfungen behandelt werden.
- Den Demo-QR-Code erst nach vollständigem Test erzeugen und ausschließlich über die vorgesehenen App-Store-Connect-Prüfungsinformationen teilen.

## Umsetzungsschritte

1. Getrennte Demo-Umgebung mit synthetischen Mitgliedern und Terminen anlegen.
2. Review-Build-Konfiguration und feste Demo-Domain ergänzen, ohne die Produktivversion zu verändern.
3. Einmalige Apple-App-Group- und Signing-Konfiguration für App und Widget einrichten.
4. Signiertes iPhone-Paket auf GitHub Actions macOS erstellen und nach App Store Connect hochladen.
5. QR-Anmeldung, Termine, Rückmeldungen, Widget und Widerruf auf einem echten iPhone prüfen.
6. Gültigen Demo-QR-Code und genaue Anleitung in TestFlight > Testinformationen > Beta-App-Prüfungsinformationen hinterlegen und Apple antworten.

## Vorbereiteter englischer Review-Hinweis

> This is an invitation-only member portal. A dedicated demo QR code and synthetic test data are provided for review. Scan the demo QR code, complete sign-in, open the appointments screen, and add the H2O next-appointment widget to the iPhone home screen. The demo account does not access real member data.

Diesen Text erst mit einem tatsächlich funktionierenden Demo-Zugang an Apple senden. Der bisherige Simulator-Build ist nicht signiert und kann nicht auf dem iPhone installiert werden.

## Einrichtung in Cloudflare – manuelle Freigabeschritte

Die folgende Einrichtung ist **noch nicht ausgeführt**. Der bestehende Worker `feuerwehr-wasser-deckel-push` und seine produktive D1-Datenbank bleiben unberührt.

1. In Cloudflare unter **Workers & Pages** einen **neuen** Worker `h2o-apple-review` anlegen, nicht den produktiven Worker kopieren oder ersetzen.
2. Unter **D1** eine **neue** Datenbank `h2o-apple-review` anlegen. Ausschließlich die Struktur des vorhandenen Schemas, niemals den Inhalt oder einen Export der Produktivdaten importieren.
3. Beim neuen Worker ausschließlich diese D1-Datenbank als `DB` binden. Keine bestehenden produktiven Variablen, Tokens, OneDrive- oder Google-Zugangsdaten übernehmen. Eigene Demo-Secrets erst bei konkreter Implementierung erstellen.
4. Separaten Demo-Web-Host mit einer eigens konfigurierten Origin vorsehen. Die im iOS-Code verwendete Domain `h2o-review.example.invalid` ist **absichtlich nicht erreichbar** und darf nicht als funktionierender Endpunkt ausgegeben werden.
5. Demo-Backend muss die normalen Mitglieds-/Rollenprüfungen behalten. Demo-Mitglieder, -Termine und -Rückmeldungen ausschließlich künstlich erzeugen.
6. Erst nach Integration und Sicherheitsprüfung den Review-Build mit `H2O_REVIEW_FLAG=H2O_APP_REVIEW` kompilieren. Ohne diesen Flag bleibt die produktive H2O-Adresse fest eingestellt.
7. Auf dem iPhone QR-Login, Widget, Rückmeldung, Abmeldung und Zugriffsentzug durchtesten. Erst danach Apple-Prüfungsnotizen ergänzen.

**Nächster Blocker:** Für das tatsächliche Anlegen von Cloudflare Worker/D1 wird Zugriff auf das Cloudflare-Dashboard benötigt. Es wurde bisher **kein** Worker und **keine** Datenbank angelegt. Ein reiner Cloudflare-Worker genügt noch nicht als statischer Demo-Web-Host; die getrennte Bereitstellung der Portaloberfläche muss zusätzlich implementiert werden.

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

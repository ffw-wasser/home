# Apple Review – getrennte H₂O-Demo

Stand: 31.10.2026. **Cloudflare-Testsystem eingerichtet; App noch nicht in TestFlight.**

## Bestätigter Stand

- Cloudflare-Worker: `h2o-apple-review`
- URL: `https://h2o-apple-review.522dn4fc5f.workers.dev/home/deckel.html`
- Eigene D1-Datenbank: `h2o-apple-review` mit `DB`-Bindung und Tabelle `review_replies`.
- Beide Cloudflare-Secrets `H2O_REVIEW_INVITE_CODE` und `H2O_REVIEW_SESSION_KEY` vom Projektbetreiber eingerichtet. Geheimwerte **nicht** im Repository oder Chat.
- `/health` vom Betreiber mit `ok: true`, `environment: synthetic-review`, `configured: true` bestätigt.
- Der Betreiber hat Demo-Login, Beispieltermine und das Speichern einer Rückmeldung im Browser erfolgreich getestet.
- Der Demo-Worker enthält nur drei synthetische Termine; keine Anbindung an das Produktions-D1, OneDrive oder den produktiven Google-Kalender.
- Die iOS-Review-Variante ist per `H2O_REVIEW_FLAG=H2O_APP_REVIEW` explizit opt-in, lädt nur die exakte Demo-Adresse und verwendet `H2OPortalReview.entitlements`, damit keine Produktions-Associated-Domains freigeschaltet werden. Normale Builds verwenden unverändert die produktive H₂O-Adresse.
- Das iPhone-Widget und die native Review-QR-Integration sind **nur im Simulator kompiliert**, nicht auf einem echten iPhone geprüft.
- Bereits vorhandener TestFlight-Build 1.0.0 (1008.1) war wegen fehlenden Demo-QR-Codes zurückgestellt; der neue Code trägt Buildnummer 1009 und ist noch nicht signiert oder hochgeladen.

## Apple Developer: nächste Schritte

1. Unter **Certificates, Identifiers & Profiles > Identifiers** die App Group `group.de.feuerwehrwasser.h2o` registrieren.
2. App-ID `de.feuerwehrwasser.h2o` kontrollieren, **App Groups** einschalten und `group.de.feuerwehrwasser.h2o` zuordnen.
3. App-ID `de.feuerwehrwasser.h2o.widget` registrieren (falls nicht vorhanden), **App Groups** einschalten und **dieselbe Gruppe** zuordnen.
4. Anschließend die Apple-Distribution-Zertifikate und **zwei App-Store-Connect-Provisioning-Profile** (je Ziel eines) für das vorhandene persönliche Apple-Team `VKL57X3H6F` vorbereiten. Private Schlüssel, Zertifikat-Passwörter und API-Keys niemals in den Chat oder ins Repository kopieren.
5. Ein manueller signierter Build über einen gesicherten GitHub-macOS-Workflow ist erst nach diesen Berechtigungen/Signaturprofilen möglich.

## Geräte-Pilot vor externer Beta-App-Review

Der Kontoinhaber kann über eine **interne TestFlight-Gruppe** zunächst selbst testen. Interne Tester müssen Benutzer von App Store Connect sein. Die Apple-Beta-Prüfung für externe Tester ist dafür nicht nötig; **ein signierter und zu App Store Connect hochgeladener Build ist trotzdem Voraussetzung**.

## Demo-QR-Code (später für externe Apple-Prüfung)

Der QR-Inhalt enthält das Geheimnis aus `H2O_REVIEW_INVITE_CODE` und lautet:

```text
https://h2o-apple-review.522dn4fc5f.workers.dev/home/deckel.html#setup=HIER_ERSTER_GEHEIMER_DEMO_CODE
```

Den echten Code **nur lokal** in einem QR-Generator erstellen, der keine Drittanbieter-Übertragung verursacht, und danach ausschließlich in App Store Connect mit Apple teilen. Den zweiten geheimen Wert (Session Key) niemals in einen QR-Code aufnehmen. Bis der QR-Code geprüft ist, nicht als vorhanden ausgeben.

Die isolierte Demo zeigt die Terminfunktionen und das Widget, **nicht** die vollständige produktive Mitgliederverwaltung. Vor einer Freigabe für externe Tester prüfen, ob Apple mit diesen eingeschränkten Testfunktionen die App ausreichend beurteilen kann. Keinesfalls einen allgemeinen Demo-Zugriff in die produktive H₂O-App einbauen.

## Widerruf

Nach Abschluss des Apple-Reviews die zwei Demo-Secrets bei Bedarf rotieren; Rotation von `H2O_REVIEW_SESSION_KEY` entwertet bestehende Sitzungen. Die Demo kann deaktiviert werden, ohne das Produktivsystem zu beeinflussen.

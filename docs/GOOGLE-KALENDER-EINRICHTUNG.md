# Google Kalender für die H₂O-Verwaltung vorbereiten

Die Umsetzung gehört zu PR #191 / Web-App-Version 2026.10.27.5 und ist zur Finalisierung nach erfolgreicher vollständiger CI freigegeben.
Er richtet keine Google-Dienste oder Konten automatisch ein.

Stand 27.10.2026: Der Anwender hat die Einrichtung von Google-Cloud-Projekt, Calendar API, OAuth-Client und Worker-Konfiguration abgeschlossen und die Anzeige „Google Kalender verbunden · Bearbeitung erlaubt“ bestätigt. Damit ist die Anmeldung und Kalenderberechtigung für dieses Konto bestätigt. Die gemeinsame Praxisprüfung mit beiden Verwaltungskonten und echten Terminänderungen bleibt gesondert durchzuführen. Zugangsdaten werden hier nicht dokumentiert. Beim erneuten Verbinden wurde anschließend ein Fehler nach der Google-Freigabe gemeldet. Im Code wurde eine Cloudflare-inkompatible Weiterleitungseinstellung gefunden und für Version 2026.10.27.8 korrigiert. Die reale Verbindung ist nach Veröffentlichung erneut zu prüfen.

Die Bedienrubrik „Google-Kalender pflegen“ ist für diesen Ablauf aktualisiert; siehe [Kalender-Bedienung](KALENDER-BEDIENUNG.md).

## Voraussetzungen

- Martin bleibt Eigentümer des bestehenden Feuerwehrkalenders.
- Martin gibt dem zweiten Google-Konto „Änderungen an Terminen vornehmen“.
- Beide Personen benötigen weiterhin die bestehende H₂O-Verwaltungsberechtigung.
- Normale Portalmitglieder benötigen kein Google-Konto und keine zusätzliche Anmeldung.

## Einmalige technische Konfiguration

1. In einem kontrollierten Google-Cloud-Projekt die **Google Calendar API** aktivieren.
   Keine kostenpflichtigen Produkte oder Abrechnung ohne separate Zustimmung aktivieren.
2. OAuth-Zustimmungsbildschirm für die tatsächlichen Administratoren vorbereiten.
   Für den Test die beiden Google-Konten als Testnutzer eintragen. Vor einer allgemeineren
   Verwendung Googles Freigabe-/Verifizierungsanforderungen prüfen.
3. OAuth-Client vom Typ **Webanwendung** anlegen. Als exakte autorisierte Redirect-URI:
   `https://ffw-wasser.github.io/home/google-calendar-auth.html`
4. Im Worker folgende Werte als Konfiguration/Secret hinterlegen:
   - `GOOGLE_CALENDAR_CLIENT_ID`: die Web-Client-ID.
   - `GOOGLE_CALENDAR_CLIENT_SECRET`: ausschließlich als privates Worker-Secret.
5. Den Client-Schlüssel weder ins Repository noch in den Chat oder in OneDrive-Anleitungen
   kopieren. Die im Browser ausgelieferten Dateien enthalten keinen Client-Schlüssel.
6. Nach erfolgreicher vollständiger CI die zur Finalisierung freigegebenen Worker-/Webdateien ausliefern. Vor echter Nutzung beide Google-Konten und ihre Kalenderrechte prüfen.
   Das Speichern dieser Anleitung oder ein erfolgreicher Testlauf veröffentlicht nichts.

Ohne beide Konfigurationswerte bleibt „Google Kalender verbinden“ gesperrt. Die bestehende
ICS-Terminanzeige und normale Portal-Anmeldung bleiben verfügbar.

## Anmeldung je Verwaltungsperson

Einstellungen → Kalender → Verbindung → „Google Kalender verbinden“.
Im Google-Fenster das eigene berechtigte Konto auswählen und Kalenderzugriff erlauben.
H₂O bestätigt anschließend Google-Lese-/Bearbeitungsrechte am bereits verbundenen Kalender.
Die H₂O-Verwaltungsrolle allein erlaubt keine Google-Änderung.

Bei einer Fehlermeldung nach der Freigabe den vollständigen Text beachten:
Die Google-Aufrufe verwenden den von Cloudflare unterstützten Modus `manual` und
weisen Weiterleitungen ausdrücklich ab. Weder Client-Schlüssel noch Zugriffstokens
werden an Weiterleitungsziele gesendet.

G01 bezeichnet den Google-Codeaustausch, G02 die Google-Zugangsprüfung und G03
den Kalenderdienst. Netzwerkfehler, Zeitüberschreitungen und ungültige Antworten
werden für diese Schritte getrennt gemeldet. Keine Anmeldecodes, Tokens oder
Client-Schlüssel weitergeben. Ein fehlgeschlagener Lese-/Verbindungsversuch kann
erneut gestartet werden. Bei einer unklaren Terminänderung zuerst in Google prüfen,
ob die Änderung bereits gespeichert wurde. Die Sammelmeldung „Portal derzeit nicht
erreichbar“ beweist keinen Gesamtausfall und bleibt bei anderen unerwarteten
Portalfehlern möglich. Die Ursache eines realen Google-Fehlers ist erst nach dem
betroffenen Verbindungstest geklärt.


Der Ablauf nutzt Authorization Code mit PKCE (SHA-256), einen verschlüsselten, zeitlich
begrenzten und an Datenquelle/PKCE gebundenen Zustand sowie eine feste Redirect-URI.
Ein zufälliger Rückkanal erlaubt die Rückkehr auch dann, wenn der Browser die Verbindung
zum ursprünglichen Fenster trennt. Falsche Herkunft und abweichender Zustand werden abgewiesen.
Es gibt keine Anmeldung durch manuelles Einfügen von Google-Zugangstokens.

Das kurzlebige Access-Token bleibt ausschließlich im Arbeitsspeicher dieses Verwaltungsfensters.
Es wird nicht in localStorage, sessionStorage, D1 oder OneDrive gespeichert. Beim Sperren/
Verlassen der Verwaltung wird es entfernt. Es wird kein Offline-Zugriff/Refresh-Token
angefordert. Nach Schließen oder Ablauf kann erneutes Verbinden nötig sein.
„Google-Verbindung auf diesem Gerät beenden“ entfernt die lokale Verbindung; die erteilte
App-Freigabe kann zusätzlich im Google-Konto widerrufen werden.

## Bereits getestet – ausschließlich künstlich

- Serverprüfung für H₂O-Verwaltung, PKCE, Ablauf, falschen Zustand, Quellbindung,
  Scope, Google-OAuth-Client und Google-Kalenderrechte.
- Vollständiger Browserablauf mit simuliertem Google-Fenster, falscher Herkunft,
  Codeaustausch, Rückkanal, lokaler Trennung und Sperren der Verwaltung.
- Bestehender H₂O-Termin wird anhand der Quellkennung eindeutig aufgelöst;
  Mitgliederantworten erhalten keine internen Quellkennungen.
- Keine echten Google-Konten, Freigaben oder produktiven Kalender wurden verwendet.

## Noch offene Funktionen / Abnahme

Die Verbindung, API und Oberfläche zum Ändern und Löschen bestehender Termine sind umgesetzt
und mit künstlichen Konten geprüft. Neue Termine werden ausschließlich in Google Kalender angelegt. In der
Feuerwehr-Anwendung am bestehenden Termin „Bearbeiten“ und darin
„Google-Termin bearbeiten“ wählen. Titel, Zeitraum, Ort
und öffentliche Beschreibung werden mit einer Prüfung auf gleichzeitige Änderungen gespeichert.
Zeiten gelten für Europe/Berlin; bei Ganztag ist das Ende exklusiv. Der H₂O-Bearbeitungslink
lässt sich beim Speichern direkt in die Beschreibung aufnehmen. Abbrechen schützt
ungespeicherte Eingaben, Löschen verlangt eine Bestätigung. Ganze Serien und Termine
mit Gästen bleiben bis zum Integrationstest für Änderungen gesperrt. Ein einzelnes
Serienvorkommen wird über seinen ursprünglichen Start zugeordnet. Unveränderte Uhrzeiten
behalten ihre exakten Sekunden und ihren Zeitpunkt, auch beim Wechsel der Sommerzeit.
Nach Speicherung wird der H₂O-Import neu geladen; Google kann Änderungen im ICS
verzögert liefern. Persönliche Einladungen verwenden einen eigenen privaten
Einladungskalender und einen eigenständigen Apps-Script-Zeittrigger. Die einmalige
Einrichtung, freiwillige Adressbestätigung und praktische Abnahme stehen in
[Persönliche Kalendereinladungen und Antworten](google-calendar-invitations/README.md).
Die kurzlebige Browserverbindung für Quelltermin-Korrekturen bleibt davon getrennt.

Vor Produktivfreigabe beide echten Google-Konten und ihre Kalenderrechte prüfen.
Google-/Apple-/Outlook-Einladungen, Serienausnahmen und die Sichtbarkeit persönlicher
Teilnehmerdaten im öffentlichen ICS müssen separat getestet werden. Keine privaten
Teilnehmer-/Mitgliederdaten in den öffentlichen Kalender schreiben.

Offizielle Grundlage:
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://googleapis.dev/nodejs/google-auth-library/latest/interfaces/GenerateAuthUrlOpts.html
- https://developers.google.com/workspace/calendar/api/v3/reference/events

## Auswählen direkt in Google Kalender am Computer

Die gesonderte [H₂O-Kalendererweiterung](google-calendar-addon/README.md) bietet
Terminart, Kleidung, mehrere Gruppen und Freigabe als Seitenleiste im gespeicherten
Google-Termin. Code und automatisierte Tests sind vorbereitet; die persönliche
Installation und reale Abnahme durch beide Verwaltungspersonen stehen noch aus.
Google unterstützt diese Kalender-Add-ons nicht auf Mobilgeräten. Gruppenlisten
werden als Namen konfiguriert, ohne Mitglieder, und nach Änderungen separat nachgeführt.

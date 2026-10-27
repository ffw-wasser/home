# Google Kalender für die H₂O-Verwaltung vorbereiten

Dieser Stand ist Teil von Draft-PR #191 und noch nicht veröffentlicht.
Er richtet keine Google-Dienste oder Konten automatisch ein.

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
6. Erst nach gesonderter Produktionsfreigabe die geänderten Worker-/Webdateien ausliefern.
   Das Speichern dieser Anleitung oder ein erfolgreicher Testlauf veröffentlicht nichts.

Ohne beide Konfigurationswerte bleibt „Google Kalender verbinden“ gesperrt. Die bestehende
ICS-Terminanzeige und normale Portal-Anmeldung bleiben verfügbar.

## Anmeldung je Verwaltungsperson

Einstellungen → Kalender → Verbindung → „Google Kalender verbinden“.
Im Google-Fenster das eigene berechtigte Konto auswählen und Kalenderzugriff erlauben.
H₂O bestätigt anschließend Google-Lese-/Bearbeitungsrechte am bereits verbundenen Kalender.
Die H₂O-Verwaltungsrolle allein erlaubt keine Google-Änderung.

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

Die Verbindung, API und Oberfläche zum Erstellen, Ändern und Löschen sind umgesetzt
und mit künstlichen Konten geprüft. Unter Verbindung „Neuen Google-Termin anlegen“
oder am bestehenden Termin „Google-Termin bearbeiten“ wählen. Titel, Zeitraum, Ort
und öffentliche Beschreibung werden mit einer Prüfung auf gleichzeitige Änderungen gespeichert.
Zeiten gelten für Europe/Berlin; bei Ganztag ist das Ende exklusiv. Der H₂O-Bearbeitungslink
lässt sich beim Speichern direkt in die Beschreibung aufnehmen. Abbrechen schützt
ungespeicherte Eingaben, Löschen verlangt eine Bestätigung. Ganze Serien und Termine
mit Gästen bleiben bis zum Integrationstest für Änderungen gesperrt. Ein einzelnes
Serienvorkommen wird über seinen ursprünglichen Start zugeordnet. Unveränderte Uhrzeiten
behalten ihre exakten Sekunden und ihren Zeitpunkt, auch beim Wechsel der Sommerzeit.
Nach Speicherung wird der H₂O-Import neu geladen; Google kann Änderungen im ICS verzögert liefern. Persönliche Kalendereinladungen,
E-Mail-Profil und automatischer Antwortabgleich bleiben deaktiviert. Für einen späteren
Hintergrundabgleich ist ein eigener, datenschutzgeprüfter serverseitiger Zugriff nötig;
die hier bewusst kurzlebige Browserverbindung ersetzt diesen nicht.

Vor Produktivfreigabe beide echten Google-Konten und ihre Kalenderrechte prüfen.
Google-/Apple-/Outlook-Einladungen, Serienausnahmen und die Sichtbarkeit persönlicher
Teilnehmerdaten im öffentlichen ICS müssen separat getestet werden. Keine privaten
Teilnehmer-/Mitgliederdaten in den öffentlichen Kalender schreiben.

Offizielle Grundlage:
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://googleapis.dev/nodejs/google-auth-library/latest/interfaces/GenerateAuthUrlOpts.html
- https://developers.google.com/workspace/calendar/api/v3/reference/events

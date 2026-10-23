# OneDrive ohne anonymen Freigabelink

Die Entra-App-Registrierung und die Microsoft-Anmeldung bleiben bestehen. Der
Datenordner wird über feste Laufwerks- und Ordnerkennungen angesprochen. Die
Ordneradresse selbst erteilt keine Berechtigung; Microsoft prüft das angemeldete
Konto bei jedem Zugriff. Persönliche Freigaben mit Bearbeitungsrecht müssen für
alle verwendeten Microsoft-Konten bestehen.

## Bestehende Geräte umstellen

1. Auf jedem Gerätehaus-iPad und Verwaltungsgerät die aktuelle Anwendung öffnen.
2. Den OneDrive-Status und anschließend **Verbindung verwalten** öffnen. Die
   Verwaltung entsperren und eine laufende Synchronisierung abwarten.
3. **Direkten Ordnerzugriff einrichten** wählen. Die Anwendung liest den bisherigen
   Ordner und bestätigt die dort vorhandene App-Datendatei erneut über Microsoft.
   Erst danach wird die private Ordneradresse auf diesem Gerät gespeichert.
4. Mit jedem berechtigten Konto Laden und reguläres Speichern, Historie, Kontakte
   und Hydrantenplan prüfen. Auch vorhandene Getränkekonten und Portalzugänge
   kontrollieren. Der Umstellungsschalter selbst schreibt keine Testdaten.
5. Erst nach Umstellung und erfolgreichen Tests aller Geräte den anonymen Link in
   OneDrive unter **Zugriff verwalten** entfernen. Persönliche Berechtigungen der
   berechtigten Konten beibehalten. Anschließend Zugriff und Speichern erneut
   prüfen. Solange der anonyme Link noch besteht, beweist der direkte Zugriff
   allein nicht, dass alle persönlichen Berechtigungen nach seiner Entfernung
   ausreichen.

Der Schalter entfernt keine OneDrive-Freigabe und verändert keine Nutzerdaten in
OneDrive oder Cloudflare. Er legt keinen neuen Ordner, keine neue Datendatei und
keine neuen Konten an. Laufwerks-/Ordnerkennungen und damit die Quelle für
Getränkekonten, Portal und Synchronisierung bleiben gleich. Ein gespeicherter
Anwesenheitsentwurf wird nur dann an die neue Adresse gebunden, wenn er zur exakt
bisherigen Verbindung gehört. Andere Entwürfe bleiben unverändert.

## Weitere oder neue Geräte

Die private Ordneradresse lässt sich in der entsperrten Verbindungsverwaltung
ablesen und auf weiteren Verwaltungsgeräten zusammen mit derselben Entra-Client-ID
eintragen. Unterstützt werden persönliche OneDrive-Ordneradressen und feste
Microsoft-Graph-Ordneradressen. Danach mit einem ausdrücklich berechtigten
Microsoft-Konto anmelden. Keine produktiven Ordnerkennungen, Kontodaten oder
Dienstschlüssel im öffentlichen Anwendungscode hinterlegen.

Normale H₂O-Mitglieder nutzen weiterhin ihren persönlichen Portalzugang. Dafür
ist keine OneDrive-Anmeldung erforderlich.

## Grenzen und Fehler

Bei fehlenden Rechten, abweichendem Ordner, fehlender App-Datendatei, Kontowechsel
oder gesperrter Verwaltung wird die Umstellung abgebrochen. Eine Änderung der
Adresse ersetzt keine Berechtigungsvergabe. Der automatische Wiederanlauf prüft
den Ordner erneut authentifiziert und weicht bei verweigertem Direktzugriff
nicht auf das erneute Einlösen eines Freigabelinks aus.

Automatisierte Prüfungen verwenden ausschließlich künstliche Konten und
Microsoft-Antworten. Sie ersetzen keinen Test der tatsächlichen Microsoft-Konten,
keinen echten iPad-Test und keine abschließende Freigabeprüfung nach Entfernung
des anonymen Links.

Microsoft-Dokumentation:
- https://learn.microsoft.com/en-us/graph/api/driveitem-get?view=graph-rest-1.0
- https://support.microsoft.com/en-us/sharepoint/lists/sharepoint-sharing-and-permissions/external-or-guest-sharing-in-onedrive-sharepoint-and-lists

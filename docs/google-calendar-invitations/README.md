# Persönliche Kalendereinladungen und Antworten

Neue Termine, Farben und die H₂O-Auswahl werden weiterhin im bisherigen
Feuerwehr-Google-Kalender gepflegt. Mitglieder erhalten daraus persönliche
Einladungen und können im eigenen Kalender antworten. H₂O übernimmt die Antworten.
WhatsApp ist für diesen Ablauf nicht erforderlich.

Der öffentliche Feuerwehrkalender enthält weiterhin **keine Gastadressen**.
Das Skript erstellt einen zusätzlichen privaten Kalender mit einer eigenen
Einladung je Termin und Mitglied. Jede Einladung enthält genau eine Gastadresse.
Das bestehende H₂O-Kalender-Add-on und die Farbanbindung bleiben unverändert.

## Einmalige Einrichtung durch die Verwaltung

1. In der Feuerwehr-Anwendung **Einstellungen → Kalender → Verbindung →
   Persönliche Kalendereinladungen** öffnen. „Einladungsanbindung einrichten“
   wählen. `H2O_CALENDAR_ID` und den einmalig angezeigten Verbindungsschlüssel
   bereithalten. Ein erneuter Schlüssel ersetzt den bisherigen.
2. Mit dem Google-Konto, das den automatischen Abgleich dauerhaft ausführen soll,
   auf [script.google.com](https://script.google.com/) ein **neues eigenständiges
   Projekt** anlegen, beispielsweise „H₂O Einladungen“. Nur ein Konto führt diese
   Einrichtung aus. Das Projekt wird nicht als Web-App oder Kalender-Add-on
   bereitgestellt; vorhandene Skriptprojekte bleiben erhalten.
3. `Code.gs` durch die [Vorlage](Code.gs) ersetzen. Unter Projekteinstellungen
   die Manifestdatei anzeigen lassen und `appsscript.json` durch die
   [Manifestvorlage](appsscript.json) ersetzen. Die Vorlage aktiviert den
   erweiterten Calendar-Dienst. Bei einem automatisch angelegten Cloud-Projekt
   aktiviert Apps Script die zugehörige API selbst; bei einem selbst zugeordneten
   Standard-Cloud-Projekt die Google Calendar API dort aktivieren.
4. In den Projekteinstellungen zwei **Skripteigenschaften** setzen:

   | Name | Wert |
   | --- | --- |
   | `H2O_CALENDAR_ID` | Die Kalender-ID aus der H₂O-Verbindungsansicht, keine ICS-URL |
   | `H2O_INVITATION_SECRET` | Der in H₂O erzeugte Verbindungsschlüssel |

   Weder den Schlüssel noch persönliche Adressen in den öffentlichen Kalender,
   in Freigabelinks oder in öffentlich sichtbaren Quellcode schreiben.
5. Im Editor einmal **`h2oSetupInvitations` ausführen** und die angezeigten
   Berechtigungen für das eigene Projekt prüfen und freigeben. Benötigt werden:
   ein vom Skript erstellter Kalender einschließlich seiner Termine, lesender
   Zugriff auf Kalenderfreigaben, Verbindung zum H₂O-Dienst, der Zeittrigger und
   das Versenden von Bestätigungs-E-Mails. Es werden keine Gmail-Leserechte,
   Drive-Rechte oder Google-Administrationsrechte angefordert.
6. Das Skript erstellt **„H₂O · Persönliche Einladungen“**, speichert dessen ID
   selbst und richtet einen Abgleich etwa alle fünf Minuten ein. Diesen Kalender
   privat lassen. Termine weiterhin im bisherigen Feuerwehrkalender bearbeiten.
   Der neue Kalender darf nicht öffentlich, für eine Domain, eine Gruppe oder
   zum Lesen freigegeben werden. Das Skript prüft die Freigaben vor jedem Lauf.
7. Die Feuerwehr-Anwendung aktualisieren. Unter Verbindung muss ein erfolgreicher
   Abgleich mit Datum und Uhrzeit stehen. Ausstehende oder fehlerhafte Aufträge
   werden dort ebenfalls angezeigt.

Das zusätzliche eigenständige Projekt ist für den kurzen Abgleich vorgesehen.
Google begrenzt Zeittrigger in Add-ons auf höchstens einen Lauf pro Stunde.
Eine zusätzliche OAuth-JSON-Datei wird für dieses Skript nicht benötigt. H₂O
speichert keine Google-Zugangs- oder Refresh-Token für den Hintergrundabgleich.

## Ein Mitglied verbinden

1. In H₂O persönlich anmelden und **Mehr → Konto & Sicherheit →
   Kalendereinladungen** öffnen.
2. Die Adresse des tatsächlich verwendeten Kalenderkontos eingeben, beispielsweise
   eine Google-, iCloud- oder Outlook-Adresse. Eine Adresse gehört zu genau einem
   H₂O-Konto. Einladung und Antwort müssen dieselbe Kalenderidentität verwenden.
3. „Kalendereinladungen und Antwortabgleich über Google erlauben“ aktivieren und
   die Bestätigungs-E-Mail anfordern. Der Versand erfolgt beim nächsten Abgleich.
   Der einmalige Link ist 24 Stunden gültig. Höchstens drei Anfragen pro Tag und
   mindestens zehn Minuten Abstand schützen vor wiederholten E-Mails.
4. Den Link aus der E-Mail öffnen, bei Bedarf mit dem eigenen H₂O-Zugang anmelden
   und **Kalenderadresse bestätigen** wählen. Ein Mitglied benötigt dafür kein
   Google-Konto. Erst nach der Bestätigung werden Termine eingeladen.
5. Die persönlichen Einladungen im eigenen Kalender öffnen und beantworten:

   | Kalenderantwort | Anzeige in H₂O |
   | --- | --- |
   | Annehmen / Zusagen | Zugesagt |
   | Vielleicht / Vorläufig | Noch unsicher |
   | Ablehnen / Absagen | Entschuldigt |
   | Noch nicht geantwortet | Offen; eine vorhandene H₂O-Antwort bleibt erhalten |

Die Einladung muss im betreffenden Kalenderkonto verfügbar sein. Ein öffentliches
Kalenderabonnement oder eine manuell importierte ICS-Datei erzeugt keine persönliche
Antwortmöglichkeit. Wenn derselbe Feuerwehrkalender bereits abonniert wurde, das
alte Abonnement ausblenden oder entfernen, um doppelte Einträge zu vermeiden.
H₂O bietet bei einer aktiven persönlichen Einladung keine zusätzliche ICS-Übernahme an.

Neue Einladungen für die nächsten 90 Tage werden entsprechend der wirksamen H₂O-Gruppen,
Freigaben und individuellen Ausnahmen eingeladen. Es werden begrenzte Aufträge
verarbeitet; bei vielen Einladungen oder Anbieterkontingenten kann der erste
Durchlauf mehrere Abgleiche benötigen. Antworten erscheinen nach dem regelmäßigen
Abgleich in H₂O und der vorhandenen Gruppenführer-/Gerätehausübersicht.

Während eine persönliche Einladung aktiv ist, wird im Kalender geantwortet.
Dadurch können gleichzeitig abgegebene H₂O- und Kalenderantworten einander nicht
unbemerkt überschreiben. Eine frühere H₂O-Antwort bleibt bis zur ersten bewussten
Kalenderantwort bestehen. Antworten werden bis zum Terminbeginn übernommen. Spätere Änderungen bitte am
Gerätehaus-iPad klären. Die Anzeige „Entschuldigt“ ist weiterhin eine Vormerkung;
die tatsächliche Anwesenheit wird wie bisher im Gerätehaus geprüft.

## Änderungen und Beenden

- Zeit, Ort, Kleidung und Gruppen am Quelltermin ändern. H₂O übernimmt wirksame
  Änderungen in die persönlichen Einladungen; Antworten werden dabei erhalten.
- Entfallene Termine, zurückgenommene Freigaben und entfernte Empfänger führen zur
  Absage ihrer Einladungen. Widerruf und Mitgliedersperrung blockieren weitere
  Antwortimporte sofort; die Absage erfolgt beim nächsten erfolgreichen Abgleich. Abgelaufene Einladungen werden nach Terminende aus dem privaten Kalender entfernt
  und gegenüber den persönlichen Kalendern zurückgezogen. Je nach Anbieter kann
  eine Absagemeldung erscheinen oder ein zurückgezogener Eintrag sichtbar bleiben.
  H₂O-Antworten und Anwesenheitsberichte werden dadurch nicht gelöscht. Die lokale
  Zustellzuordnung wird anschließend ohne E-Mail und Beschreibung archiviert.
- Unter „Anbindung verwalten“ kann das Mitglied die Adresse ändern oder die
  Kalenderanbindung beenden. Eine neue Adresse muss erneut bestätigt werden.
  Danach kann wieder direkt in H₂O geantwortet werden.
- Den privaten Einladungskalender nicht von Hand als Terminquelle verwenden.
  Eine dort von der Organisation gelöschte Einladung wird nicht automatisch erneut
  versendet. H₂O gibt die direkte Antwort wieder frei und zeigt der Verwaltung einen
  Fehler. Für eine bewusste Neueinrichtung die persönliche Anbindung beenden und
  erneut bestätigen lassen.

Bestätigungs-E-Mails und Kalendereinladungen unterliegen den Google-Kontingenten.
Ein ausgeschöpftes Bestätigungsmail-Kontingent stoppt den Antwortabgleich nicht.
Fehlgeschlagene Vorgänge bleiben zur Wiederholung erhalten. Schlüssel nie als
Fehlerbericht weitergeben; in H₂O werden nur Status, Zähler und Zeitpunkte angezeigt.
Alte ausschließlich für WhatsApp gespeicherte Kontaktdaten werden beim nächsten
Mitgliederabgleich aus der geschützten Portalprojektion entfernt.

## Praktische Abnahme

Zunächst nur ein Testmitglied verbinden und die tatsächlich freigegebenen Termine
prüfen. Eine echte Einladung auf dem iPhone/Apple Kalender, mit Google Kalender und
mit Outlook jeweils annehmen, ändern und ablehnen; anschließend die Anzeige in
H₂O kontrollieren. Auch Terminverschiebung und Entfernung aus einer Gruppe prüfen.
Automatisierte Tests verwenden ausschließlich künstliche Daten und ersetzen diese
providerübergreifende Praxisprüfung nicht.

## Offizielle Grundlagen

- [Google: Zeitgesteuerte Trigger](https://developers.google.com/apps-script/guides/triggers/installable#time-driven_triggers)
- [Google: Erweiterte Dienste und API-Aktivierung](https://developers.google.com/apps-script/guides/services/advanced)
- [Google: Kalenderereignisse und Teilnehmerantworten](https://developers.google.com/workspace/calendar/api/v3/reference/events)
- [Google: Inkrementeller Kalenderabgleich](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Apple: Auf Einladungen im iPhone-Kalender antworten](https://support.apple.com/de-de/guide/iphone/iphc0eddfe3c/ios)

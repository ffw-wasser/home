# H₂O Portal – Datenschutztext zur Vervollständigung

**Entwurf, noch nicht veröffentlichen.** Die technische Beschreibung folgt dem Programmstand. Betreiber und Kontaktanschrift sind bestätigt. Rechtsgrundlagen (insbesondere für G26-Gültigkeiten), Aufbewahrung der Finanzdaten und vertragliche Regelungen mit Dienstleistern sind vor Veröffentlichung zu klären.

## Verantwortliche Stelle und Kontakt

Verantwortlich für die Datenverarbeitung im eigenständig betriebenen H₂O Portal:

Markus Bürklin\
Hirtenweg 1\
79312 Emmendingen\
E-Mail: m.b.1982@web.de

Der Betreiber entscheidet selbst über die Datenverarbeitung im Portal und verwendet dabei auch Informationen der Feuerwehrverwaltung. Die Verantwortung für den Portalbetrieb hängt nicht von seiner persönlichen Feuerwehrmitgliedschaft ab.

## Zweck und Daten

Das H₂O Portal dient freigegebenen Mitgliedern der Feuerwehr Wasser. Es zeigt Feuerwehrtermine, Rückmeldungen, persönliche Nachweise, das Getränkekonto sowie freigegebene Informationen und Lernmaterialien.

Verarbeitet werden je nach freigegebener Funktion der Name und die Mitgliedszuordnung, Anmeldekennungen, Rückmeldungen, Gültigkeits- und Bestätigungsdaten von Nachweisen, Getränke- und Bestelldaten, Zahlungen und offene Beträge. Bei G26 werden Gültigkeitsdaten verarbeitet; medizinische Atteste werden in diesem Ablauf nicht hochgeladen.

Passkeys verwenden öffentliche Schlüssel. Private Passkey-Schlüssel und biometrische Daten werden vom Authentifikator verwaltet und nicht an den Portaldienst übertragen. Alternativ eingerichtete Passwörter werden serverseitig als Prüfwerte gespeichert. Freigaben zur erstmaligen Einrichtung sind einmalig und 30 Minuten gültig.

[Rechtsgrundlagen für Rückmeldungen, Kontoführung und freiwillige Zusatzfunktionen sowie für von der Verwaltung übernommene Angaben festlegen. Für G26-Gültigkeiten ist insbesondere zu klären, ob eine ausdrückliche, freiwillige und widerrufliche Einwilligung der betroffenen Mitglieder für diese Verarbeitung im persönlich betriebenen Portal vorliegt. Die Betreiberbestätigung ersetzt diese Einwilligung nicht.]

## Zugriff und Dienste

Der persönliche Zugang öffnet die für das Mitglied freigegebenen Funktionen. Berechtigte Verwaltungs- und Führungskräfte sehen die für ihre Aufgaben freigegebenen Daten. Das Scannen eines Installations-QR-Codes ersetzt die Freigabe zur Mitgliedsanmeldung nicht.

GitHub Pages liefert die Weboberfläche aus. Cloudflare betreibt den geschützten Portaldienst mit Datenbank. Microsoft OneDrive enthält unabhängig verwaltete gemeinsame Dateien und Berichte. Google liefert die eingerichteten Kalendertermine. Optionale Mitteilungen nutzen die Mitteilungsdienste des jeweiligen Geräts. PayPal wird beim Bezahlen geöffnet; OpenLigaDB bei der Fußballfunktion.

[Konkrete Anbieter, Vertragsgrundlagen, mögliche Drittlandübermittlungen und einschlägige Garantien bestätigen. Technische Verbindungsdaten können auch bei Dienstleistern anfallen; deren Aufbewahrung nicht als bereits geprüft darstellen.]

Die native App enthält keine Werbe- oder Analyse-SDKs. Im nativen Projekt ist kein werbliches Tracking eingerichtet.

## Apple-Prüfdemo

Die im gleichen App-Build angebotene Prüfdemo verwendet ausschließlich erfundene Mitglieder-, Termin-, Nachweis- und Kontodaten. Sie nutzt einen getrennten, nicht dauerhaften Webspeicher und keine produktiven Schnittstellen. Öffentliche Ausbildungsdateien können ohne Anmeldung aus dem vorhandenen Webangebot geladen werden. Zahlungen, echte Kalenderabos und Mitteilungsregistrierungen sind dort gesperrt. Die Demo gibt keinen Mitgliederzugang frei.

## Speicherung auf dem Gerät

Anmeldesitzung und persönliche Einstellungen werden auf dem Gerät gespeichert. Der native Widget-Speicher enthält nur den nächsten persönlich freigegebenen Termin mit Zeit, Ort, Kleidung und Rückmeldestatus, höchstens zwölf Stunden. Namen und Zugangstoken werden nicht an das Widget übergeben. Bei Abmeldung oder erkanntem Zugriffsverlust wird der Widget-Stand geleert. Ein bereits geöffneter Kalender oder ein anderes Gerät kann zuvor geladene Angaben zwischengespeichert haben.

## Portal-Konto löschen und Daten berichtigen

Unter **Konto & Sicherheit → Konto → Portal-Konto löschen** kann das persönliche Portal-Konto nach erneuter Anmeldung und ausdrücklicher Bestätigung gelöscht werden. Servergespeicherte persönliche Anmeldedaten, Portal-Sitzungen, Push-Verbindungen, Kalenderabo-Links und Portal-Rückmeldungen werden gemeinsam entfernt. Die alten Zugänge funktionieren anschließend nicht mehr. Für einen späteren Zugang ist eine erneute Freigabe durch die Verwaltung erforderlich. Bereits im Passwortmanager gespeicherte Passkeys und im Kalender gespeicherte Kopien können dort selbst entfernt werden.

Die unabhängig geführte Feuerwehrmitgliedschaft, Nachweise und Unterlagen sowie das zentrale Getränkekonto und Bestellungen werden dadurch nicht gelöscht. Die Feuerwehrunterlagen werden für die Dauer der Feuerwehrmitgliedschaft geführt. Bei Beendigung der Mitgliedschaft werden diese Unterlagen durch die Verwaltung gelöscht. Die Löschung des Portal-Kontos beendet die Mitgliedschaft nicht. Anfragen zu Verwaltungsdaten sind an die verantwortliche Stelle zu richten.

[Die Aufbewahrungsregel für Feuerwehrunterlagen wurde vom Betreiber bestätigt. Rechtsgrundlagen sowie die Behandlung von Getränkeabrechnungen und Bestellungen gesondert bestätigen. Keine gesetzliche Aufbewahrungspflicht allein aus der technischen Trennung ableiten.]

## Rechte

Im Rahmen der gesetzlichen Voraussetzungen bestehen Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Widerspruch und Datenübertragbarkeit. Soweit eine Verarbeitung auf Einwilligung beruht, kann diese für die Zukunft widerrufen werden. Außerdem besteht ein Beschwerderecht bei der zuständigen Datenschutzaufsichtsbehörde.

Zuständige Aufsichtsbehörde: Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg, https://www.baden-wuerttemberg.datenschutz.de/.

[Gegebenenfalls Pflicht zur Bereitstellung bestimmter Daten sowie Folgen einer Nichtbereitstellung ergänzen.]

Stand des technischen Entwurfs: 1. November 2026.

Grundlage für die offenen Pflichtangaben: Artikel 13 DSGVO, https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=de.

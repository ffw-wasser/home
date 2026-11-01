# Google Play – H₂O Portal

Stand: 1. November 2026. Übertragbare Angaben aus dem bestehenden Projekt.
Dieses Dokument bestätigt keine Speicherung im Play-Konto und keinen Store-Rollout.
Verteilung bleibt interner Test; keinen Produktions-Track starten.

## Eintrag und öffentliche Links

- App: H2O Portal
- Paket: de.feuerwehrwasser.h2o
- Supportname und E-Mail: wie auf der öffentlichen Supportseite.
- Support: https://ffw-wasser.github.io/home/support.html
- Datenschutz: https://ffw-wasser.github.io/home/privacy.html
- Kontolöschung ohne installierte App: https://ffw-wasser.github.io/home/support.html#konto-loeschen
- Installation: https://ffw-wasser.github.io/home/install.html
- Kostenlos; keine Werbung im bestehenden App-Code. Kategorie-Vorschlag: Produktivität.
- Kurzbeschreibung (unter 80 Zeichen): Feuerwehrtermine, Rückmeldungen und dein persönliches H₂O Portal.

Beschreibung:

Das H₂O Portal begleitet die Mitglieder der Feuerwehr Abteilung Wasser im Dienstalltag.
Feuerwehrtermine ansehen, die eigene Teilnahme zurückmelden, persönliche Nachweise
und Fristen prüfen, den eigenen Getränkedeckel öffnen und Ausbildungsunterlagen nutzen.
Ein Startbildschirm-Widget zeigt den nächsten freigegebenen Termin und deine Rückmeldung.
Das breite Widget lässt sich auf eine Zeile verkleinern. Die tatsächliche Größe hängt
vom Startbildschirm ab; Android kann Aktualisierungen verzögern.

Die Feuerwehrverwaltung gibt deinen persönlichen Zugang vor Ort frei. Die Anmeldung
erfolgt per Passkey oder Benutzername und Passwort. Kalenderabo und Mitteilungen sind
freiwillig. Die Installation oder Teilnahme am Play-Test gewährt keinen Mitgliederzugang.
Die App ersetzt keine Notruf- oder Alarmierungsanlage. Bei einem Notfall 112 wählen.

## Datenschutzformular – fachliche Zuordnung

Die Webinhalte und eingebundenen Dienste gehören zur Bewertung der nativen App.
Für ausschließlich interne Tests sieht Google eine Ausnahme von der Datensicherheitsrubrik
vor. Datenschutzseite trotzdem hinterlegen; keinen Produktions-Rollout erzwingen, um
dieses Formular auszufüllen.

| Verarbeitung | Im Formular zu berücksichtigen |
| --- | --- |
| Name und Mitgliedszuordnung, Benutzername, öffentliche Passkey-Kennung | Personenbezogene Daten: Name, Nutzer-IDs; Kontoverwaltung und App-Funktionalität |
| Rückmeldungen und selbst eingetragene Nachweise | App-Aktivitäten / andere nutzergenerierte Inhalte; App-Funktionalität |
| G26-Gültigkeit und daraus abgeleiteter Status | Gesundheitsdaten; freiwillige gesonderte Einwilligung und Widerruf. Keine Diagnosen/Atteste |
| Getränke, Bestellungen, bestätigte Zahlungen und offener Betrag | Kaufverlauf und andere Finanzinformationen; App-Funktionalität. Keine Kreditkartendaten im Portal |
| FCM-Token und technische Zustelldaten | Geräte- oder andere IDs; freiwillige Mitteilungen, erst nach Aktivierung. Firebase Analytics ist nicht eingebunden |
| Hosting, Kalenderabo und externe Links | Tatsächliche Provider-Verarbeitung prüfen; keine pauschale Aussage „keine Weitergabe“ |
| Widget und kleine Namenszeile | Name nur in der angemeldeten App, nicht im Widget. Widget nur nächster Termin und Status, lokal mit Ablauf; kein zusätzliches Analyseprofil |

Kein Werbetracking und keine Werbe-ID im App-Code. Keine Standort-, Kamera-, Mikrofon-
oder Adressbuchberechtigung für diese Mitglieder-App. Verbindungsdaten beim Hosting
sind davon getrennt zu bewerten. TLS ist für den Portaltransport vorgesehen;
dies bedeutet keine Ende-zu-Ende-Verschlüsselung aller Providerdaten.
„Weitergabe“, Pflicht-/Wahlangabe und Erhebungszwecke pro Datentyp anhand der
Google-Definitionen und des tatsächlichen Betriebs bestätigen, insbesondere die
Dienstleisterausnahme. Keine unabhängige Sicherheitsprüfung oder Zertifizierung behaupten.

## Kontolöschung und Prüfzugang

In-App: Konto & Sicherheit → Konto → Portal-Konto löschen, mit erneuter Anmeldung.
Die öffentliche Supportseite bietet denselben Umfang als Löschanfrage per E-Mail;
Identität wird vor der Bearbeitung geprüft. Feuerwehrmitgliedschaft, eigenständig
verwaltete Nachweise, Unterlagen, Getränkekonto und Bestellungen bleiben davon getrennt.
Keine produktiven Konten für Store-Prüfungen verwenden.

Die isolierte Beispieldemo unter https://ffw-wasser.github.io/home/review.html enthält
nur künstliche Daten; sie ersetzt keine Prüfung der App auf einem echten Gerät.
Falls Google für die gewählte Teststufe einen App-Prüfzugang verlangt, den vorgesehenen
Prüfablauf im Konto erklären. Keine Zugangsdaten ins Repository aufnehmen.
Zielgruppe, Altersfreigabe und eine gegebenenfalls verlangte Gesundheitserklärung nach
den tatsächlichen Fragen im Konto beantworten. Die Fristenverwaltung ist kein
medizinischer Diagnosedienst; Gesundheitsbezug trotzdem angeben.

## Quellen

- https://support.google.com/googleplay/android-developer/answer/9845334
- https://support.google.com/googleplay/android-developer/answer/10787469
- https://support.google.com/googleplay/android-developer/answer/13327111

## Geräteprüfung für Build 1025

Beide Widgets in Höhe und Breite verändern, einzeilig mit normaler und großer Schrift
prüfen. Datum, Uhrzeit und Status müssen lesbar bleiben. Sehr schmal und flach entfällt
der sichtbare Titel; Antippen öffnet die vollständigen Termine. Bestehende Widgets,
leerer Kalender, Offlinezustand und Abmeldung prüfen. Der Assistent bietet Kalender
und Mitteilungen freiwillig an. Die kleine Namenszeile muss bei Abmeldung verschwinden.

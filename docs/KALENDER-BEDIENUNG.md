# Kalender und Jahresplan

Der bestehende Feuerwehr-Google-Kalender bleibt die gemeinsame Terminquelle.
Berechtigte Verwaltungspersonen können Termine direkt in Google oder nach
persönlicher Google-Anmeldung in H₂O pflegen. Der Kalendereigentümer bleibt
unverändert. Datum, Uhrzeit, ganztägige und mehrtägige Zeiträume werden übernommen.
Die Beschreibung wird als Klartext angezeigt; HTML und Skripte werden nicht ausgeführt.

## Gemeinsame Terminpflege in H₂O

1. Einstellungen → Kalender → Verbindung → „Google Kalender verbinden“ öffnen und
   mit dem eigenen freigegebenen Google-Konto anmelden. „Google Kalender verbunden ·
   Bearbeitung erlaubt“ bestätigt die Kalenderberechtigung. Bei Ablauf erneut verbinden.
2. Unter Verbindung „Neuen Google-Termin anlegen“ oder am vorhandenen Termin
   „Google-Termin bearbeiten“ wählen. Titel, Beginn/Ende, Ort und öffentliche Beschreibung
   pflegen. Zeiten gelten für Europe/Berlin. Bei Ganztag ist das Enddatum der erste Tag
   nach dem Termin. Ganze Serien und Termine mit Gästen direkt in Google ändern.
3. Am Termin „Bearbeiten“ für die H₂O-Einstellungen öffnen: Terminart, Kleidung,
   Freigabe, mehrere anklickbare Gruppen sowie individuelle Ergänzungen/Ausschlüsse.
   Die H₂O-Auswahl separat am Termin speichern und die betroffenen Personen prüfen.
4. Google-Terminangaben mit „In Google Kalender speichern“ sichern. Auf Wunsch den
   H₂O-Bearbeitungslink in die Beschreibung aufnehmen. Er öffnet den betreffenden
   Termin nach der bestehenden Verwaltungsanmeldung. Kopieren ist ebenfalls möglich.
   Der H₂O-Import wird neu geladen; Änderungen aus Google können verzögert erscheinen.
   Bei Konflikten den aktuellen Google-Stand neu laden, statt fremde Änderungen zu überschreiben.

„Google-Kalender pflegen“ erklärt diesen Ablauf direkt in der Kalenderverwaltung.
Das direkte Google-Beispiel und die Schlagwort-/Gruppenreferenz bleiben aufklappbar.
Persönliche Kalendereinladungen und automatischer Antwortabgleich sind noch nicht
verfügbar; die Personenauswahl steuert die H₂O-Sichtbarkeit und Rückmeldungen.

Ein Titel mit `INFO:` kennzeichnet eine reine Information. Auch Wörter wie Probe,
Geburtstag oder Einsatz machen daraus keinen funktionalen Termin. Informationen
haben keine Anmeldung, Erinnerung, Anwesenheit oder Punktevergabe. Zunächst
erscheinen sie nur im Gerätehaus und im Gesamt-PDF. In der Kalenderverwaltung
kann die H₂O-Anzeige für alle Mitglieder oder ausgewählte Personen freigegeben
werden. H₂O zeigt weiterhin nur die jeweils erlaubten Termine und den eigenen
Geburtstag. Informationen erscheinen nicht in der Rückmeldeliste.

Unter „Zusatzinfo bearbeiten“ lässt sich die Google-Beschreibung durch eine
lokale Zusatzinfo ersetzen. „Google-Beschreibung verwenden“ stellt die Übernahme
wieder her. Titel und Datum werden direkt in Google oder über den Google-Termin-Editor in H₂O gepflegt. Änderungen können
einige Minuten benötigen; geöffnete Ansichten anschließend aktualisieren.

Die bestehende Google-Farbanbindung bleibt getrennt von der persönlichen Google-Anmeldung zum Bearbeiten. Terminfarben weiterhin direkt in Google setzen; bei eingeschalteter Farbanbindung werden sie übernommen. Ohne erfolgreichen Farbabruf gelten die gespeicherten App-Farben.

Unter „Farben der Terminarten“ werden Farben zentral gespeichert. Sie gelten
im Jahresplan, in der iPad-Übersicht und in beiden PDF-Ansichten. Die Lesefarbe
wird bei sehr hellen Farben abgedunkelt. Farben verändern keine funktionalen
Regeln. Ferien sind hellgelb, Sonntage apricot, Feiertage werden namentlich
gekennzeichnet. Einsatz ist keine auswählbare Art für geplante Kalendertermine;
die spontane Einsatzerfassung bleibt erhalten.

Die linke Übersicht im Hauptbereich erscheint ab 1000 Pixeln Breite und nur
mit der vorhandenen Gerätehaus-Verbindung. Sie scrollt unabhängig und beginnt
beim aktuellen Monat. Termine sind dort ausschließlich lesbar. Die vollständige
Jahresansicht bleibt über das Menü erreichbar; „Heute“ springt zum aktuellen
Monat. Beim Trennen oder Wechseln der Datenquelle werden Kalenderdaten entfernt.

„Als PDF ansehen“ verwendet in Gerätehaus und H₂O denselben Export: A3 quer,
genau zwei Seiten mit je sechs Monaten. Die Monatsspalten nutzen ihren Platz
unabhängig. Lange Zusatzinfos und ausnahmsweise überfüllte Tage werden in dieser
Übersicht erkennbar gekürzt; vollständig bleiben sie in der Kalenderansicht. Die aktive
Filterauswahl gilt auch für das PDF. Persönliche PDFs werden beim Abmelden
geschlossen und ihre lokalen Dateiverweise verworfen.

## Technische Trennung

Darstellung und Informationssichtbarkeit liegen verschlüsselt und versioniert
in `portal_calendar_colors` und `portal_calendar_display`. Die bestehenden
funktionalen Terminregeln werden dadurch nicht geändert. INFO wird vor jeder
Regelzuordnung erzwungen. Die persönliche Jahresprojektion filtert serverseitig;
die öffentliche Projektion enthält keine Zusatzinfos. Die Jahres-Rohdaten werden
weiterhin nur kurz zwischengespeichert und bei jedem Abruf frisch autorisiert
und dekoriert.

# Kalender und Jahresplan

Termine im verbundenen Feuerwehr-Google-Kalender pflegen. Datum, Uhrzeit,
ganztägige und mehrtägige Zeiträume werden übernommen. Die Beschreibung wird
als Klartext angezeigt; HTML und Skripte werden nicht ausgeführt.

Ein Titel mit `INFO:` kennzeichnet eine reine Information. Auch Wörter wie Probe,
Geburtstag oder Einsatz machen daraus keinen funktionalen Termin. Informationen
haben keine Anmeldung, Erinnerung, Anwesenheit oder Punktevergabe. Zunächst
erscheinen sie nur im Gerätehaus und im Gesamt-PDF. In der Kalenderverwaltung
kann die H₂O-Anzeige für alle Mitglieder oder ausgewählte Personen freigegeben
werden. H₂O zeigt weiterhin nur die jeweils erlaubten Termine und den eigenen
Geburtstag. Informationen erscheinen nicht in der Rückmeldeliste.

Unter „Zusatzinfo bearbeiten“ lässt sich die Google-Beschreibung durch eine
lokale Zusatzinfo ersetzen. „Google-Beschreibung verwenden“ stellt die Übernahme
wieder her. Titel und Datum bleiben in Google zu pflegen. Änderungen können
einige Minuten benötigen; geöffnete Ansichten anschließend aktualisieren.

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

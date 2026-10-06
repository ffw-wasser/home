Feuerwehr Wasser 3.0 Modular, 2026-10-02

- Historische, nicht geladene JavaScript- und CSS-Versionen entfernt.
- Aktive Hauptmodule auf stabile Dateinamen umgestellt.
- CSS-Schichten nach Foundation, Components, Features und Pages benannt.
- UI-, Attendance-, iOS- und Dark-Mode-Dateien klaren Fachordnern zugeordnet.
- Doppelte Wappengrafik und nicht verwendeten Screenshot entfernt.
- Große Taktikgrafiken verlustarm in WebP konvertiert.
- Service-Worker-Cache auf Version 3.0 aktualisiert.
- Freiraum-DOM-Fix, Datenqualitäts-Fix, Schatten-Fix und iOS-Tastatur-Fix bleiben enthalten.
- Vollständiges Gesamtprojekt.


Feuerwehr Wasser 3.1, 2026-10-06
- Schritt 2 mit grossen, besser lesbaren Personenkarten.
- Alterskameraden bleiben unter der Einsatzabteilung.
- Heutige Anmeldungen stehen unter den Personenbereichen.
- Rechte, mitscrollende Aktionsleiste mit Schritt-3-Aktion und Auswahl uebernehmen.
- Dark Mode projektweit um Kontrastregeln fuer dynamische Kacheln, Dialoge, Tabellen und Formulare erweitert.
- Vollstaendiges Gesamtprojekt.


Feuerwehr Wasser 3.2, 2026-10-06
- Schritt 2 strukturell neu zusammengesetzt, ohne nachtraegliche DOM-Patches.
- Heutige Anmeldungen inklusive Tabelle fest unter Einsatzabteilung und Alterskameraden.
- Funktion zum Loeschen aller Anmeldungen eines Datums aus Schritt 2 entfernt.
- Namenskarten deutlich hoeher und besser voneinander unterscheidbar.
- Dark Mode inklusive CSS, JavaScript und Einbindungen vollstaendig entfernt.


Feuerwehr Wasser 3.3, 2026-10-06
- Nur die generische Funktion Datum loeschen entfernt.
- Datum bleibt auch nach gespeicherten Teilnehmern frei aenderbar.
- Funktion Alle heutigen Teilnehmer zuruecksetzen wiederhergestellt.
- Rechte Aktionskarten ohne Ueberlagerung konsolidiert.


Feuerwehr Wasser 3.4, 2026-10-06
- Namen auf allen Personenkarten immer zweizeilig: Nachname oben, Vorname unten.
- Einheitliche Namenshoehe unabhaengig von der Namenslaenge.


Feuerwehr Wasser 3.5, 2026-10-06
- Einsatzabschluss robust neu strukturiert.
- Fehlende Module und Formelemente werden kontrolliert behandelt.
- Abschlussbutton wird nach Abbruch, Validierungsfehler oder Ausnahme sicher zurueckgesetzt.


Feuerwehr Wasser 3.6, 2026-10-06
- Nachnamen bleiben ausnahmslos in einer Zeile.
- Gemeinsame Schriftgroesse wird automatisch am laengsten sichtbaren Nachnamen ausgerichtet.
- Neuberechnung erfolgt beim Rendern und bei Groessenaenderungen.


Feuerwehr Wasser 3.7, 2026-10-06
- Einsatzabschluss erzeugt das Haupt-PDF jetzt vollstaendig lokal.
- Keine OneDrive-Konvertierung und kein Netzwerkabruf beim Einsatzabschluss.
- Fehler Failed to fetch beim Fortfahren beseitigt.


Feuerwehr Wasser 3.8, 2026-10-06
- Die komplette Teilnehmerkarte in Schritt 2 faerbt sich passend zum gewaehlten Status.
- Anwesend gruen, Entschuldigt gelb, Organisation blau, Betrifft nicht grau.
- Rahmen, Seitenmarkierung und Schatten folgen ebenfalls dem Status.


Feuerwehr Wasser 3.9, 2026-10-06
- Komplette lokale Einsatz-PDF-Funktion korrigiert.
- PDF-Bibliothek, beide Vorlagenseiten und Einsatzdaten werden korrekt an den PDF-Generator uebergeben.
- Verfuegbarkeit aller benoetigten Komponenten wird vor der Erstellung geprueft.
- Fehler Cannot read properties of undefined reading create beseitigt.


Feuerwehr Wasser 4.0, 2026-10-06
- Originale Einsatzprotokoll-Erzeugung wiederhergestellt.
- Bericht wird wieder aus der originalen Wordvorlage erzeugt und anschliessend in PDF konvertiert.
- Dadurch entsprechen alle Feldpositionen wieder der Originalversion.
- Der abweichende lokale Koordinaten-Nachbau wird fuer den Einsatzabschluss nicht mehr verwendet.


Feuerwehr Wasser 4.1, 2026-10-06
- Smarte Fahrzeugeinteilung prueft die Kapazitaet vor jeder einzelnen Zuordnung.
- Auch manuelle Fahrzeugzuordnungen koennen keine Ueberbesetzung mehr erzeugen.
- Einsatzbericht wird beim Zurueckgehen zwischengespeichert.
- Rueckkehr aus Schritt 2 oder 3 in den bereits begonnenen Einsatzbericht ist wieder moeglich.


Feuerwehr Wasser 4.2, 2026-10-06
- Vor dem Speichern des Einsatz-Terminpakets erscheint eine verbindliche PDF-Vorschau.
- Namen, Funktionen, Fahrzeugzuordnung, Positionen und Seitenumbrueche koennen geprueft werden.
- PDF kann zusaetzlich gross in einem eigenen Fenster geoeffnet werden.
- Zurueck zum Protokoll verwirft den Abschluss nicht und ermoeglicht Korrekturen.
- Erst Geprueft, Terminpaket speichern fuehrt den Abschluss fort.


Feuerwehr Wasser 4.3, 2026-10-06
- Einsatzprotokoll wird waehrend der Eingabe automatisch und dauerhaft lokal zwischengespeichert.
- Beim Wechsel von Schritt 4 zu Schritt 3 und beim erneuten Oeffnen bleiben alle Eingaben erhalten.
- Vor jeder PDF-Erzeugung und auch im Fehlerfall wird der komplette Entwurf nochmals gesichert.
- Die Wordvorlage ist eingebettet; dadurch entsteht beim Laden der Vorlage kein Failed-to-fetch-Fehler mehr.
- Netzwerkfehler der OneDrive-PDF-Konvertierung werden verstaendlich gemeldet, ohne Daten zu loeschen.


Feuerwehr Wasser 4.4, 2026-10-06
- Karte Ausgewaehlte Teilnehmende steht in der rechten Seitenleiste jetzt ueber Anwesenheit vollstaendig.
- Die Seitenleiste beginnt auf Hoehe der ersten Teilnehmerkarte.
- Die ausgewaehlte Teilnehmerliste bleibt beim Scrollen sichtbar.
- Lange Teilnehmerlisten scrollen innerhalb der Karte.


Feuerwehr Wasser 4.5, 2026-10-06
- Einsatz-PDF wird vollstaendig lokal im Browser erzeugt; OneDrive und Word-Konvertierung sind dafuer nicht mehr erforderlich.
- Dadurch entfallen Netzwerk- und Konvertierungsfehler beim Einsatzabschluss.
- DarkMode-Schalter und alte DarkMode-Reste werden beim Start sowie bei nachgeladenen Altstaenden entfernt.
- Alte gespeicherte DarkMode-Einstellungen werden geloescht.


Feuerwehr Wasser 4.6, 2026-10-06
- Blockierung beim Fertigstellen des Einsatzes behoben.
- Vorlagenbilder werden abschnittsweise und mit UI-Pausen dekodiert.
- Dekodierte Vorlagen werden fuer weitere Versuche zwischengespeichert.
- Fortschrittstext informiert waehrend der lokalen PDF-Erstellung.
- Aufwaendiger globaler DarkMode-DOM-Beobachter entfernt.


Feuerwehr Wasser 4.7, 2026-10-06
- Einsatz-PDF wird in einem separaten Hintergrundprozess erzeugt.
- Die Bedienoberflaeche bleibt waehrend der PDF-Erstellung reaktionsfaehig.
- Der PDF-Prozess hat eine feste Zeitgrenze und meldet Fehler zurueck.


Feuerwehr Wasser 4.8, 2026-10-06
- PDF-Hintergrundprozess funktioniert jetzt auch beim direkten Start ueber file://.
- Worker-Code und PDF-Abhaengigkeiten sind vollstaendig eingebettet.
- Keine externen Worker-Dateien oder Datei-URLs werden mehr nachgeladen.


Feuerwehr Wasser 4.9, 2026-10-06
- Fehler window is not defined im PDF-Hintergrundprozess behoben.
- Worker stellt fuer eingebettete browserorientierte Module eine kompatible window-Referenz bereit.
- Cache-Kennung und Worker-Version aktualisiert.


Feuerwehr Wasser 5.0, 2026-10-06
- PDF-Vorschau beim Einsatzabschluss vollstaendig entfernt.
- Nach der PDF-Erstellung wird das Terminpaket unmittelbar gespeichert.
- Kein Vorschaufenster und keine zusaetzliche Bestaetigung mehr.


Feuerwehr Wasser 5.1, 2026-10-06
- Fehlende operationCsv-Funktion wiederhergestellt.
- CSV-Inhalt des Einsatz-Terminpakets wird wieder erzeugt.
- PDF-Vorschau bleibt entfernt; Terminpaket wird direkt gespeichert.


Feuerwehr Wasser 5.2, 2026-10-06
- Auf iPads laufen Auswahl uebernehmen und Weiter zu Schritt 3 nebeneinander am unteren Bildschirmrand mit.
- Teilnehmerkarten sind auf iPads auf zwei Karten pro Reihe begrenzt.
- Beim Wechsel zu Fahrzeug besetzen wird automatisch an den Kartenanfang gescrollt.
- Beim Wechsel zum Einsatzprotokoll beginnt die Ansicht oben am Formular.


Feuerwehr Wasser 5.3, 2026-10-06
- Teilnehmerkarten werden auf dem iPad in drei Spalten angezeigt.
- Die beiden mitlaufenden Schaltflaechen am unteren Bildschirmrand bleiben unveraendert.


Feuerwehr Wasser 5.3, 2026-10-06
- Teilnehmerkarten auf dem iPad auf drei Karten pro Reihe festgelegt.
- Mitlaufende Schaltflaechen am unteren Bildschirmrand bleiben erhalten.


Feuerwehr Wasser 5.4, 2026-10-06
- Erfolgsanimation erscheint nur noch nach tatsaechlich gespeichertem Terminpaket.
- Bei Abbruch, fehlender Freigabe oder nicht ausgefuehrtem Speichern bleiben Einsatzdaten erhalten und es wird kein falscher Erfolg angezeigt.
- Nach erfolgreichem Speichern wird der Einsatz weiterhin archiviert, das Protokoll geleert und zur Startansicht gewechselt.


Feuerwehr Wasser 5.5, 2026-10-06
- Beim Abschluss wird der Dokumenteditor aus Schritt 4 vor dem ZIP-Speicherdialog geschlossen.
- Dadurch kann auf dem iPad der Dialog Teilen und speichern sichtbar geoeffnet werden.
- Falls Safari den modalen Dialog ablehnt, erscheint automatisch eine sichtbare nichtmodale Ersatzanzeige.


Feuerwehr Wasser 5.6, 2026-10-06
- Windows/Chrome: Wenn der ausgewaehlte Ordner nicht beschreibbar ist, wird das ZIP automatisch ueber den Browser-Download gespeichert.
- iPad: Auswahl uebernehmen und Anwesenheit vollstaendig sind auf kleinen und grossen iPads fest am unteren Bildschirmrand verankert.


Feuerwehr Wasser 5.7, 2026-10-06
- Geprueft, fortfahren setzt den Abschluss nun eindeutig und nur einmal fort.
- Der Pruefdialog wird sicher geschlossen und die Verarbeitung im naechsten Bildaufbau fortgesetzt.
- Sofortige Rueckmeldung PDF und ZIP werden erstellt wurde ergaenzt.


Feuerwehr Wasser 5.8, 2026-10-06
- Einsatzabschluss und Pruefdialog wurden auf den nachweislich funktionierenden Ablauf aus Version 4.8 zurueckgesetzt.
- Die spaeter ergaenzten Windows-Download- und iPad-Aktionsleisten-Korrekturen bleiben erhalten.


Feuerwehr Wasser 5.9, 2026-10-06
- Urspruengliche Einsatzbericht-PDF-Vorschau vor dem Speichern wiederhergestellt.
- ZIP-Erstellung startet erst nach Geprueft, Terminpaket speichern.
- Zurueck zum Protokoll bricht den Abschluss ab und behaelt alle Daten.


Feuerwehr Wasser 6.0, 2026-10-06
- PDF-Erstellung wieder direkt aus der Word-Vorlage ueber die bewaehrte OneDrive-Konvertierung.
- Dadurch werden Feldpositionen, Seitenumbrueche und Vorlagenlayout nicht mehr durch den lokalen PDF-Renderer verschoben.
- PDF-Vorschau vor dem Speichern bleibt erhalten.
- Fehlermeldungen nach der Vorschau zeigen nun den konkreten Speicherfehler an.

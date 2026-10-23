# Navigation und Jahresprobenplan

Der FFW-Kopfbereich enthält weiterhin Termin und Getränke. Das Menü führt direkt zu
Jahresplan, Pläne & Pegel, Veranstaltungen und der geschützten Verwaltung. Infos steht
abgesetzt am Ende. Historie und Statistik sind Register innerhalb der Verwaltung.
Die Navigation des persönlichen H₂O-Portals bleibt erhalten. Dessen bestehender
persönlicher Zugang ist weiterhin für Veranstaltungsbestellungen erforderlich.

Die Jahresansicht orientiert sich am bereitgestellten Probeplan: Monatsraster mit
Tageszeilen, gelben Wochenenden, apricotfarbenen Ferien und rosa Geburtstagen.
Der Druck verwendet zwei Halbjahresseiten mit sechs Monatsspalten im A3-Querformat.
Die Bildschirmansicht zeigt je nach Breite eine, zwei oder drei Monatsspalten.
Termine stammen ausschließlich aus der vorhandenen Google-Kalenderverbindung.
Die Jahresabfrage ersetzt weder den Arbeitskalendercache noch Bonusmarker.

Öffentlich sind nur freigegebene Proben mit neutralen Titeln sichtbar. Originaltitel,
weitere Termine und Geburtstage erfordern die bestehende Verwaltungsfreigabe und
bestätigte OneDrive-Verbindung. Die Jahresdaten werden nur im Arbeitsspeicher gehalten.
Ein älterer Worker ohne Jahresabfrage wird mit einem verständlichen Hinweis erkannt.
Die Geburtstagspunkte und ihre bestehenden Jahresmarker bleiben unverändert.
Die Zuordnung der Geburtstagsserie zum Mitglied liegt unter Getränke → Treuepunkte.

## Ferienquelle

Die inklusiven landesweiten Zeiträume für 2026 bis 2029 wurden am 23.10.2026 anhand
des [Kultusministeriums Baden-Württemberg](https://km.baden-wuerttemberg.de/de/service/ferien)
geprüft. Weihnachten 2025/2026, Ostern und Pfingsten 2026 sind zusätzlich in der
[KMK-Übersicht 2025/2026](https://www.kmk.org/fileadmin/Dateien/pdf/Ferienkalender/FER2025_26.pdf)
belegt. Bewegliche Ferientage werden nicht als landesweite Ferien dargestellt.
Andere Jahre erhalten einen Hinweis auf die unvollständigen Feriendaten.

## Lokale Prüfung

- Vollständige Testsuite: 789 Tests bestanden.
- Kalender und Sicherheit: 280 bestehende Tests bestanden, zusätzlich vier Tests
  für Jahresabruf, öffentliche Datenbegrenzung, Berliner Datumsgrenzen und Ferien.
- Neuer Browsertest: fünf eindeutige Menüeinträge; Passwort vor Verwaltungsübersicht;
  Abbruch; zwölf Monate einschließlich vergangener Termine; Uhrzeiten und Ganztag;
  unabhängige Filter; Geburtstagszuordnung; Entfernen privater Daten beim Sperren.
- Kalendergruppen-Browsertest: automatische und manuelle Zuordnung, Entwürfe,
  Register und Entfernen privater Gruppennamen bestanden.
- Bildschirmbreiten 320, 390, 768 und 1024 Pixel ohne horizontales Überlaufen.
- Druck mit künstlichen Terminen: zwei Seiten; beide Seiten visuell geprüft.
- Syntax, Worker-Bundle, Release und Offline-Dateiliste geprüft.

Die Browserdaten sind ausschließlich künstliche Testdaten. Produktive Konten,
OneDrive-Dateien und Geburtstagsbuchungen wurden nicht verändert. Reale iPhone-/iPad-
Geräte, Microsoft-Anmeldung und das produktive Cloudflare-Deployment sind durch die
lokalen Tests nicht abgedeckt. Die GitHub-Prüfung muss zusätzlich erfolgreich sein.

## Veröffentlichung

Version 2026.10.23.4 ist als PR-Kandidat vorbereitet. Erst nach Freigabe zusammenführen.
Für die Jahresansicht ist der aktualisierte Worker zusammen mit den Frontend-Dateien
erforderlich. Ein erfolgreicher Quelltest bestätigt keine produktive Veröffentlichung.

## Jahresplan im persönlichen H₂O-Portal

Version 2026.10.23.5 ergänzt unter Mehr die Kachel „Jahresplan“. Der kurze Titel
bleibt auch nach dem Verschieben in die untere Handynavigation lesbar. Eine bestehende
individuelle Kachelanordnung bleibt erhalten; die neue Kachel wird in Mehr ergänzt.
Der Portalplan verwendet dieselbe Darstellung und Ferienquelle wie die FFW-Ansicht.
Auf dem Handy stehen Monate untereinander. Monatswahl und Heute bleiben beim Scrollen
erreichbar; selten benötigte Filter liegen unter Anzeige & Filter. Lange Terminthemen
werden umgebrochen, nicht abgeschnitten. Ereignisse werden vor der Darstellung nach
Tag indiziert, um wiederholte Datumsformatierung auf dem Handy zu vermeiden.

Die persönliche Jahresabfrage verlangt die bestehende Passkey-Sitzung. Sie liefert
nur freigegebene Proben für das betreffende Mitglied und dessen eigenen Geburtstag.
Andere Geburtstagsnamen, unfreigegebene Einträge, Mitgliederkennungen und
Empfängerlisten werden nicht ausgegeben. Bonusbuchungen bleiben unverändert.
Beim Abmelden, Kontowechsel und Verlassen der Jahresansicht werden persönliche
Jahresdaten aus der Darstellung entfernt. Verspätete Antworten dürfen sie nach
dem Sperren nicht wiederherstellen.

Zusätzliche Prüfung: Empfängergrenzen und widerrufene Zugänge auf dem Worker sowie
ein Portal-Browsertest auf 320, 360, 390, 412 und 768 Pixeln. Er prüft bestehende
Anordnungen, Kacheltitel in beiden Navigationsbereichen, lange Termintexte,
Monatsauswahl, Details, Filter und das Entfernen persönlicher Inhalte beim Abmelden.

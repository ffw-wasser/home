# Lesbarkeit und ruhige Termine-Ansicht – Version 2026.10.16.24

## Ergebnis und Gestaltung

Die H₂O-Terminseite beginnt mit dem Datenstand und den Terminkarten. Die doppelte
Feuerwehr-Zeile, „Dein Überblick“, der allgemeine Erklärungssatz und die Überschriften
„Als Nächstes“ / „Weitere offene Rückmeldungen“ entfallen. Reihenfolge, Rückmeldungen,
bereits beantwortete Termine unter „Weitere Termine“, Geburtstags- und wichtige
Nachweiswarnungen bleiben erhalten. Die Terminregion besitzt weiterhin einen
zugänglichen Namen. Der Hinweis zur Rückmeldefrist steht weiterhin in der Hilfe.

Einheitliche Abstufung: 16–17 px für Lesetexte und wichtige Aktionen, mindestens
14 px für kleinere Hinweise und Navigation, 18 px für Termindaten, 20 px für
Kartentitel. Bestehende größere Überschriften und Kontostände bleiben größer.
Die vorhandenen Blau-, Grün-, Rot- und Gelbtöne behalten ihre Bedeutung.

## Befunde und Änderungen

- Die Bestandsaufnahme fand 261 feste Schriftgrößen unter 14 px in den CSS-Dateien,
  einschließlich mobiler Sonderregeln. Diese wurden in den zuständigen Regeln auf
  mindestens 0,875 rem angehoben. Die Typografievariablen wurden mit angepasst.
- Feste px-Schriftgrößen wurden in gleichwertige rem-Werte übertragen, damit sie
  mit einer vergrößerten Basisschrift wachsen. Bewusste Schriftgröße 0 für
  Symbolersetzungen blieb unverändert. Layoutmaße wurden nicht pauschal skaliert.
- Fließtexte, Formularhinweise, Portalaktionen und Aufklappüberschriften erhielten
  eine klare Größenabstufung und passende Zeilenabstände. Kleine Displays führen
  nicht wieder zu winzigen Schriftgrößen.
- Der graue App-Fußtext hatte auf seinem Hintergrund nur ca. 3,37:1 Kontrast;
  einzelne Verwaltungsbeschreibungen lagen bei 4,46:1. Die betreffenden Grautöne
  wurden abgedunkelt. Auch der Hinweis „× pro Jahr“ wurde verbessert (vorher 4,30:1).
- Eine zusätzliche statische Prüfung fand unter anderem weiße Schrift auf orangefarbenen
  Aktionsflächen mit 3,19:1 und gelblichen Zählern mit rund 3:1. Die Hintergründe
  wurden in derselben Farbfamilie abgedunkelt. Deaktivierte Steuerelemente bleiben
  als inaktiv unterscheidbar und sind nicht Teil der aktiven Kontrastprüfung.
- Lange Texte dürfen in Einstellungen, Mitgliederverwaltung und Hilfe umbrechen;
  die Einstellungskarten verwenden eine schrumpfbare Inhaltsspalte. Die Portalnavigation
  passt ihre Spalten bei stark vergrößerter Schrift an, statt Texte abzuschneiden.
  „Nachweise“ ist dort kürzer beschriftet, der zugängliche Name lautet weiterhin
  „Meine Nachweise“. Eine weiche Worttrennung vermeidet zufällige Buchstabenumbrüche.

## Prüfung

- 475 vorhandene automatisierte Tests und JavaScript-Syntaxprüfungen erfolgreich.
- `scripts/check-browser.cjs`: bestehende Abläufe, Hilfe, Einstellungen, Kalender,
  Empfänger und Handy-Navigation erfolgreich; keine Laufzeitfehler/fehlenden Assets.
- `scripts/check-readability.cjs`: 13 App-/Verwaltungsseiten und alle fünf Portalseiten
  auf 320, 390, 768 und 1280 px (72 Kombinationen), jeweils normal und mit 200 %
  Basisschrift. Kein horizontaler Seitenüberlauf, keine gemessenen sichtbaren Texte
  unter 14 px und keine Kontrastunterschreitung in den erfassten aktiven Texten mit
  einfarbig bestimmbaren Hintergründen. Die Terminreihenfolge und der Zugang zu
  beantworteten Terminen werden mit künstlichen Daten geprüft.
- Sichtprüfung der Terminkarten auf 320/390 px und der Einstellungen auf 768 px.
- Versions- und Service-Worker-Kennung gemeinsam aktualisiert. Keine Worker-Funktion
  geändert; für diese Version ist kein Cloudflare-Deployment erforderlich.

## Maßstab und Grenzen

Als Orientierung dienen [WCAG 2.2](https://www.w3.org/TR/WCAG22/): Textkontrast
4,5:1 (große Schrift 3:1), vergrößerbare Schrift und Umbruch auf kleinen Bildschirmen.
14 px sind unsere gestalterische Untergrenze für Zusatztexte, keine WCAG-Vorgabe.

Die Browserprüfung ist eine Stichprobe mit künstlichen Daten und isoliert dargestellten
Verwaltungsseiten, keine vollständige Barrierefreiheitszertifizierung. Sie prüft
root-relative Schriftvergrößerung; physische iPhone-/Android-Systemvergrößerung,
alle denkbaren Datenbestände, Druck/PDF-Ausgaben, Text auf Bildhintergründen und
Screenreaderbedienung wurden nicht vollständig geprüft. Echte Gerätetests bleiben sinnvoll.

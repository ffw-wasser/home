# Fitness: Rolle, Termine und Statistik

Die Verwaltung setzt unter **Mitglieder → Fitnesstrainer** die eigenständige
Portalrolle. Sie verleiht keine Feuerwehrfunktion. Unter **Kalender & Gruppen →
Gruppen → Fitness** werden Teilnehmer und zuständige Trainer getrennt zugeordnet.
Eine bereits gespeicherte Gruppenliste erhält die leere Fitnessgruppe ergänzend.
Produktive Personen werden ausschließlich in der geschützten Verwaltung zugeordnet,
nicht im öffentlichen Quellcode vorgemerkt.

Google Kalender bleibt die Terminquelle. Die bestehende Erweiterung bietet Fitness
als Terminart und Sportkleidung als Auswahl an. Alternativ in der Beschreibung:

```text
Terminart: Fitness
Gruppe: Fitness
Freigabe: Ja
```

Der Worker prüft die Rolle, die aktive Trainerzuordnung, die Terminart und den gesamten
Empfängerkreis bei jeder Anfrage. Gemischte oder außerhalb der Fitnessgruppe ergänzte
Empfänger erlauben keinen Trainerzugriff. Entzug und Deaktivierung gelten auch für
laufende Sitzungen und persönliche Kalenderabos. Die Rolle hat Vorrang vor einem
versehentlich zusätzlich hinterlegten GF-Kennzeichen. Eigene Fitnessantworten sind
nur bei zusätzlicher Teilnehmerzuordnung möglich.

Unter **Statistik → Fitness** lädt die entsperrte Verwaltung die separate Kategorie
für das ausgewählte Kalenderjahr. Angeboten, zugesagt, entschuldigt, unsicher und offen
bleiben getrennt. Durchschnittliche Quote ist das ungewichtete Mittel der
terminweisen Zusagen / betreffenden Personen; Termine ohne Empfänger werden nicht
in dieses Mittel aufgenommen. Abgesagte oder nicht freigegebene Termine zählen nicht.
Die Jahresprojektion wird aus dem bestehenden privaten Kalender geladen; bei
veraltetem Kalenderstand wird keine scheinbar aktuelle Auswertung angezeigt.

Nach Terminende werden verschlüsselte Summen ohne Namen und Mitgliedskennungen
in `portal_fitness_history` gesichert, bevor die bisherige Terminbereinigung läuft.
Persönliche Fitnessantworten bleiben für Abschlusskorrekturen höchstens 400 Tage
verfügbar. Die früheste Einführung wird in `portal_fitness_meta` gespeichert;
ältere bereits gelöschte Antworten werden nicht als offene Antworten rekonstruiert.
Statistische Summen beziehen sich auf den beim Abschluss bekannten Empfängerkreis.

Fitness nutzt die bestehende Anwesenheitserfassung und Berichtablage. Beim Abschluss
übernimmt die bestehende Kalenderklassifikation „Betrifft nicht“ als Ausschluss nur
für diesen Termin; die Gruppe bleibt unverändert. Scheitert der Abgleich nach dem
Speichern des Berichts, bleibt der Abschluss zur Wiederholung offen. Tatsächlich
Anwesende werden aus geladenen Fitnessberichten separat als Mittel pro erfasstem
Termin angezeigt. Zusagen werden nicht als bestätigte Anwesenheit ausgegeben.
Fitnessberichte sind aus sämtlichen bisherigen Feuerwehrstatistiken ausgeschlossen.

Prüfungen: `tests/portal-fitness.test.cjs`, `tests/fitness-browser.cjs`, bestehende
Kalender-, Gruppen-, Statistik-, Abschluss-, Sicherheits- und Hilfeprüfungen.
Die Beispieldaten aller Tests und Hilfebilder sind künstlich.

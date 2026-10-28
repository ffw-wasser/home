# Kalenderabo mit H₂O-Antwortlink

Stand: 2026.10.28.3.

Der gewählte Ablauf behält den öffentlichen Google-Kalender als einzige
Kalenderanzeige. Rückmeldungen werden über einen öffentlichen, nicht berechtigenden
Link im bestehenden Termin in H₂O geöffnet. Die Verwaltung schaltet die Antwort
pro Termin ausdrücklich frei. Handy-Mitteilungen folgen ausschließlich auf Befehl.
Gruppenführer können nach Freischaltung im vorhandenen Rückmeldedialog erinnern.

Persönliche Einladungen und die Einrichtung neuer Kalenderadressen sind entfernt. Der aktive Ablauf nutzt ausschließlich öffentliche Rückmeldelinks und die vorhandene Push-Freigabe. Alte API-Aufrufe für Adressbestätigung und Einrichtung liefern 410. Der geschützte Bestand des früheren Einladungskalenders wird nur noch bereinigt: begrenzte, wiederholbare Absagen, keine neuen Einträge, Mails oder Kalenderantwortimporte. Das vorhandene Google-Skript bleibt kompatibel; eine optionale bereinigte Vorlage hat keine Mail-Berechtigung und beendet nur ihren eigenen Trigger nach bestätigtem Abschluss. Antworten, Protokolle und der öffentliche Kalender werden nicht gelöscht.

Der Rückmeldelink enthält nur die bestehende Termin-ID. Google-Änderungen benötigen
die eigene, kurzlebige OAuth-Anmeldung mit Schreibrechten und ETag; sie ergänzen
nur den Link im bestehenden Eintrag, ohne neue Termine oder Gäste. Beschreibung,
Zeiten und der Google-Add-on-Auswahlblock bleiben erhalten. Der Link kann auch
manuell kopiert und eingefügt werden. Native Zu-/Absagen im Kalender entfallen für
diesen Ablauf; persönliche Kalenderadressen werden nicht mehr benötigt.

Einmalige begrenzte Versendungen werden über die gespeicherte Anforderungskennung
fortgesetzt. GF-Erinnerungen nutzen eine eigene ausdrücklich bestätigte Kampagne;
Rolle, aktuelle Mitgliedschaft, Empfänger, Freischaltung und Terminzeit werden
serverseitig geprüft. Entschuldigte erhalten keine Nachricht.

Bedienung, Migration, Grenzen und Abnahme: [Anleitung](google-calendar-invitations/README.md).


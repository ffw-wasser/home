# Persönliche Kalendereinladungen – Umsetzung

Implementierter Stand: Version 2026.10.28.2.
Google-Einrichtung und eine echte Google-Zusage mit Übernahme in H₂O wurden vom
Nutzer bestätigt. Die Praxisprüfung mit Apple Kalender und Outlook steht noch aus.

Neue Termine werden weiterhin ausschließlich im bestehenden öffentlichen
Feuerwehr-Google-Kalender angelegt. Die H₂O-Auswahl dort bestimmt Gruppen und
Freigabe der Terminanzeige; gespeicherte H₂O-Korrekturen bleiben wirksam.

Persönliche Einladungen liegen in einem zusätzlichen privaten Google-Kalender.
Pro Mitglied und Termin gibt es genau eine Einladung mit nur einer Gastadresse.
Mitglieder müssen kein Google-Konto besitzen; sie können Google Kalender,
Apple Kalender oder Outlook verwenden. Die tatsächliche Unterstützung der
Antworten muss zusätzlich mit echten Testeinladungen geprüft werden.

Ein Mitglied hinterlegt seine Kalenderadresse freiwillig unter Konto & Sicherheit.
Eine getrennte Bestätigungs-E-Mail enthält einen einmaligen Link. Erst nach
Bestätigung im angemeldeten persönlichen H₂O-Konto werden Termine zugestellt.
Neue Adressen werden erneut bestätigt. Widerruf oder Verlust der Mitgliedschaft
stoppt weitere Einladungen und den Antwortimport; vorhandene Einladungen werden
bei der nächsten erfolgreichen Synchronisierung abgesagt.

Der getrennte Admin-Befehl „Rückmeldung anfordern“ öffnet pro Termin die H₂O-
Antworten und die persönlichen Einladungen. Normale Freigaben starten keine Abfrage.
Die Anforderung wird separat unter portal_response_requests gespeichert.
Ein Zeittrigger in einem eigenständigen Apps-Script-Projekt verarbeitet nur diese
angeforderten Termine und Antworten. Er prüft vor jedem Lauf die privaten Kalenderfreigaben.
Der Worker liefert nur mit einem eigens erzeugten Verbindungsschlüssel Zugriff
auf den begrenzten Einladungsauftrag. Es werden keine Google-Refresh-Token in H₂O
gespeichert. Schlüssel, E-Mail-Adressen und Zuordnungen bleiben geschützt;
Mitgliederlisten und Rückmeldungen kommen nie in den öffentlichen Kalender.

Google-Antworten werden über die dauerhafte Einladungskennung zugeordnet.
Der Google-Sync-Token wird erst nach erfolgreich übernommenen Seiten gespeichert;
bei Ablauf wird erneut gelesen, ohne bestehende H₂O-Antworten zu löschen.
Versionen und begrenzte Synchronisierungsläufe schützen vor überholten Ergebnissen.
Bestehende H₂O-Antworten bleiben bis zur ersten bewussten Kalenderantwort erhalten.
Auch bei aktiver Einladung bleiben H₂O-Rückmeldungen und Korrekturen möglich.
Eine H₂O-Korrektur wird als versionierter Auftrag an die persönliche Kalendereinladung
übertragen. Bis zur Bestätigung der genauen Antwortversion schützt H₂O sie vor
Kalenderimporten. Neuere App-Korrekturen machen alte Aufträge ungültig. Danach
werden neue Kalenderantworten wieder übernommen. Das bestehende Apps-Script-Projekt
benötigt die aktuelle Code.gs-Vorlage; unverändertes Manifest und Schlüssel bleiben
bestehen. Alte Adapter erhalten keine unbekannten Aufträge und lassen Korrekturen
sicher vorgemerkt. ETags schützen den Google-Schreibzugriff gegen gleichzeitige Änderungen.
Versionskonflikte bei gleichzeitigen Änderungen verlangen erneutes Laden.

WhatsApp-Einstellungen, Versandaktionen und Rückkehr-Schaltflächen entfallen.
Bestehende persönliche H₂O-Anmeldungen und früher versandte Terminlinks bleiben
kompatibel. Push-Mitteilungen bleiben als zusätzliche freiwillige Erinnerung, ausschließlich
auf ausdrücklichen Befehl beim jeweiligen Termin. Automatische Erinnerungen und
Standarderinnerungen des technischen Einladungskalenders entfallen; eigene
Erinnerungen im Mitgliedskalender bleiben dessen persönliche Einstellung.

Die H₂O-Ansicht Konto & Sicherheit erhält gleichartige, nebeneinander im Ablauf
stehende Abschnitte für Kalender, Push, Aktualisierung und Anmeldung. Karten
werden nicht in weitere Karten eingeschlossen.

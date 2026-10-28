# Kalenderabo mit H₂O-Antwortlink – ein Termineintrag

Version 2026.10.28.4. Nach dem Update ist Kalenderabo mit H₂O-Antwortlink der einzige aktive Rückmeldeweg. Neue persönliche Kalendereinladungen und Kalenderadress-Bestätigungen sind entfernt.

## Gewünschter Ablauf

1. Alle Termine wie bisher im öffentlichen Feuerwehr-Google-Kalender vorbereiten.
   Mitglieder abonnieren in H₂O unter **Daten und Sicherheit → Feuerwehrkalender abonnieren** genau diesen voreingestellten Kalender. Apple Kalender oder Google Kalender wählen und beim Anbieter einmal bestätigen; ein bestehendes Abo nicht erneut hinzufügen. Alternativ den Abo-Link kopieren und als Kalenderabonnement hinzufügen. Für Google bei Bedarf am Computer **Weitere Kalender → + → Per URL** verwenden. Der Link wird aus der bestehenden öffentlichen Kalenderverbindung geladen, nie aus persönlichen Einladungsdaten. Es wird keine Kalenderdatei importiert.
2. Unter **Kalender → Verbindung → Kalenderabo mit H₂O-Antwortlink** den Status prüfen. Eine neue Einladungsanbindung oder zusätzliche Mitgliederfreigabe gibt es nicht mehr. Die bestehende Push-Freigabe gilt weiterhin.
3. Unter **Kalender → Termine** beim bestehenden Termin **Rückmeldelink in Google
   ergänzen** wählen. Dafür unter Verbindung das eigene berechtigte Google-Konto
   verbinden. Alternativ **Rückmeldelink kopieren** und den Link selbst in dieselbe
   Google-Beschreibung einfügen. Titel, Zeit, Ort und bestehende Notizen bleiben
   erhalten. Es wird kein zweiter Termin erstellt und keine Abfrage gestartet.
   Ganze Serien und Termine mit Gästen bleiben für die direkte Änderung gesperrt;
   einzelne Serienvorkommen werden über ihre bestehende H₂O-Kennung zugeordnet.
4. Erst wenn gewünscht **Rückmeldung anfordern** bestätigen. Das schaltet die
   Antworten für genau diesen Termin frei und sendet Handy-Mitteilungen an die
   berechtigten Mitglieder mit aktivierten Mitteilungen. Entschuldigte erhalten
   keine Nachricht. Bei begrenzten Sendungen **Abfrageversand fortsetzen / prüfen**
   verwenden; derselbe Versand bleibt einmalig. Normales Speichern, Linkergänzung,
   Terminanzeige und Sammelfreigaben starten keine Abfrage.
5. Mitglieder öffnen im Kalendertermin den Link **H₂O-Rückmeldung**, melden sich
   bei Bedarf persönlich an und antworten in H₂O. Vor der Freischaltung sind die
   Antworttasten gesperrt. Antworten lassen sich bis Terminbeginn ändern oder
   zurücknehmen. Native Kalender-Antwortschaltflächen werden nicht verwendet.

Abonnements aktualisieren Beschreibungen je nach Kalenderanbieter zeitversetzt.
Der öffentliche Link enthält ausschließlich die Termin-ID, keine Anmeldung,
Mitgliedsadresse, Antwort oder Berechtigung. Der Server prüft die tatsächliche
Mitgliedschaft und Empfängerauswahl. Eine eigene Kalenderadresse ist nicht nötig.
Die H₂O-Kalenderansicht bietet im Linkmodus keinen zusätzlichen ICS-Import an.

## Bestehende zusätzliche Einladungen entfernen

Der neue Dienst erstellt keine Einladungs- oder Bestätigungsmail-Aufträge mehr. Alte Aufträge zur Einladung oder Kalenderantwort werden abgewiesen; alte Antwortimporte werden ignoriert.
Das vorhandene eigenständige Google-Skript vorerst weiterlaufen lassen: Beim
nächsten erfolgreichen Abgleich zieht es nur seine bisherigen persönlichen
Einladungen zurück. Der öffentliche Kalender und sein Abo werden nicht geändert.
Der Anbieter kann Absagemeldungen zeigen oder zurückgezogene Einträge noch eine
Weile anzeigen. Bereits manuell importierte Kalenderdateien lassen sich nicht
zentral entfernen. Gespeicherte H₂O-Antworten und Anwesenheitsberichte bleiben erhalten;
alte Kalenderantworten können sie nach der Umstellung nicht mehr überschreiben.

Vorhandenen privaten Kalender, Trigger und Schlüssel zum Aufräumen beibehalten.
Das bisherige Skript versteht die bestehenden Absageaufträge; für diese Umstellung
ist keine zusätzliche Google-Berechtigung und kein neuer Kalender erforderlich.
Bisherige Kalenderadressen bleiben geschützt gespeichert, bis das Mitglied unter Konto & Sicherheit **Alte Kalenderadresse entfernen** wählt. Eingabe, Einwilligung und Bestätigung neuer Adressen sind entfernt. Abgeschlossene Bereinigungsaufträge enthalten keine alte E-Mail-Adresse, Beschreibung oder Bestätigungskennung mehr. Nach erfolgreicher Bereinigung zeigt die Verwaltung null offene Einladungen. Der alte Trigger `h2oSyncInvitations` kann dann entfernt werden. Die optional aktualisierte, ausschließlich bereinigende `Code.gs` beendet ihren eigenen Trigger nach bestätigtem Abschluss selbst; fremde Trigger und Kalender werden nicht angefasst.

## Erinnerungen durch Gruppenführer

Ein hinterlegter Gruppenführer kann in **Rückmeldungen ansehen → Erinnerung
abschicken** nach Bestätigung für den geöffneten Termin erinnern. Der Server prüft
Rolle, Mitgliedschaft, Empfängerauswahl, Freischaltung und Terminbeginn. Ein im
Client behauptetes GF-Kennzeichen genügt nicht. Entschuldigte werden vor dem
Versand erneut ausgeschlossen. Begrenzte Sendungen können mit derselben Kennung
fortgesetzt werden. Automatische Erinnerungen bleiben ausgeschaltet.

Die rote Zahl am Termine-Icon zählt angeforderte offene oder unsichere Antworten.
Manuelle Handy-Mitteilungen markieren außerdem das installierte App-Symbol, soweit
Gerät und Berechtigungen dies unterstützen. Es gibt keine Zustell-/Lesegarantie.

## Abnahme vor Veröffentlichung

Automatisiert mit künstlichen Daten prüfen: Umstellung und Konflikte, ungültige
alte Läufe, begrenzte einmalige Benachrichtigungen, alte Kalenderantworten,
Empfänger-/GF-Rechte, gesperrte Antwort vor Freischaltung, Anmeldung über den Link,
Änderung/Rücknahme, Google-ETags und Erhalt vorhandener Beschreibungen einschließlich
Add-on-Auswahlblock. Echte Abo-Aktualisierung und Entfernung bisheriger Einladungen
auf Google, Apple Kalender und Outlook bleiben eine Geräteabnahme nach Freigabe.


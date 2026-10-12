# Deckelchallenge aktivieren

Die Website ist vorbereitet. Der bestehende Cloudflare-Dienst benötigt dieses
Update, bevor die Challenge auf dem Handy verfügbar ist. Kein neuer Dienst,
keine neuen Secrets und kein kostenpflichtiger Tarif sind erforderlich.

1. In Cloudflare die **bestehende D1-Datenbank deckel-push → Console** öffnen.
   Den Inhalt von `challenge.sql` ausführen. Es werden nur zwei neue Tabellen
   angelegt. Bestehende Tabellen, Geräte und Buchungen nicht löschen.
2. **Workers & Pages → feuerwehr-wasser-deckel-push → Edit code** öffnen.
   Den bisherigen Editorinhalt durch den vollständigen Inhalt der neuen
   **worker.bundle.js** ersetzen und **Deploy** wählen. Nicht nur `worker.js`
   verwenden. DB-Bindung und bisherige Secrets unverändert lassen.
3. `/health` öffnen: zusätzlich muss **challengeVersion: 1** erscheinen.
   Ohne neue Tabellen bleiben die bisherigen Konten und Erinnerungen verfügbar;
   nur die Challenge ist nicht aktiviert.
4. Auf dem Gerätehaus-iPad OneDrive verbinden und die Verwaltung entsperren.
   **Getränke → Verwaltung → Fragen & Antworten** öffnen. Den vorbereiteten
   Fragenpool importieren, fachlich prüfen und mindestens sieben Fragen einzeln
   freigeben. Örtliche Fahrzeugangaben vor der Freigabe am Fahrzeug abgleichen.
5. **Geprüfte Fragen in den Spieldienst übertragen** wählen. Entwürfe bleiben in
   OneDrive. Freigegebene Fragen und Lösungen werden verschlüsselt in D1 gespeichert.
   Nach weiteren Änderungen erneut übertragen. Bereits erstellte Runden behalten
   ihren eigenen unveränderlichen Fragenstand.
6. Den persönlichen **Mein Deckel** am Handy auffrischen und **Deckelchallenge**
   öffnen. Mit Spielnamen und frei wählbarem Einsatz eine Runde erstellen. Nur
   den achtstelligen Spielcode teilen, niemals den persönlichen Deckellink!
   Andere Mitglieder treten über ihren eigenen Deckel bei und bestätigen den Einsatz.
   Der Gastgeber startet die Runde ab zwei Teilnehmern.

## Regeln

- 2 bis 20 Teilnehmer; keine tägliche Begrenzung der Duelle. Mehrere Runden sind
  möglich und bleiben unter „Meine Runden“ (zuletzt 50 lokal geöffnet) erreichbar.
- Alle beantworten dieselben sieben Fragen mit vier Antworten und einer Lösung.
  Reihenfolge und Antwortpositionen werden für jede Runde neu gemischt.
  Ein Antippen speichert die endgültige Antwort. Keine Zeitwertung.
- Die meisten richtigen Antworten gewinnen. Gleichstand teilt den möglichen
  Gewinn centgenau, begrenzt auf die bei der Abrechnung vorhandenen Schulden.
  Der ungenutzte Anteil wird anderen punktgleichen Gewinnern bis zu deren
  Schulden zugeteilt. Jeder Verlierer übernimmt höchstens den bestätigten Einsatz;
  kann nicht alles übertragen werden, wird die Belastung gleichmäßig reduziert.
  Haben alle gleich viele richtige Antworten, wird nichts übertragen.
- Beispiel: Vier Teilnehmer, Einsatz 1,50 Euro, ein Sieger mit mindestens 4,50 Euro
  Schulden: Sieger −4,50 Euro, drei Verlierer jeweils +1,50 Euro. Hat der Sieger
  nur 1,00 Euro Schulden, werden insgesamt nur 1,00 Euro übertragen.
- Lösungsanzeige erst nach Abschluss durch alle Teilnehmer. Keine Antworten oder
  Zwischenergebnisse anderer Spieler vorzeitig abrufbar.
- Jeder Teilnehmer darf die Runde vor Abschluss für alle abbrechen. Keine
  Abbruchstrafe. Offene Lobby: 24 Stunden; gestartete Runde: 30 Minuten.
  Eine nicht vollständig beantwortete Runde wird nicht abgerechnet.
- Ein Konto-Reset oder ersetzter Zugang eines Teilnehmers verhindert die Abrechnung.
  Gleichzeitige Zahlungen und andere Runden werden gegen frische Kontoversionen geprüft.

## Geld, Treuepunkte und Sicherheit

Die Challenge überträgt bestehende Schulden, keine Geldzahlung und kein Guthaben.
Die Summe aller Kontoschulden bleibt unverändert. Getränkeverbrauch, ursprüngliche
Buchungen, Zahlungen, vorausbezahlte Beträge und Treuepunkte werden nicht verändert.
Jedes Konto erhält einen eigenen unveränderlichen Challenge-Nachweis. Ein solcher
Eintrag und damit bereits verrechnete Getränke können nicht einzeln im Adminbereich
gelöscht werden, da dies die gemeinsame Bilanz verfälschen oder fiktive Einzahlungen
erzeugen würde. Eine spätere Korrektur benötigt eine gemeinsame Rückabwicklung der
Runde; diese Admin-Rückabwicklung ist noch nicht enthalten. Normale Getränke- und
Zahlungskorrekturen bleiben unverändert möglich. Der Gewinn schützt erledigte Getränkebeträge
gegen spätere Mitglieder-Rücknahme; Originale bleiben bestehen.

Fragen, Spielnamen, Antworten und Konteninhalte liegen AES-GCM-verschlüsselt in D1.
Der Server benötigt sie kurzzeitig zur Prüfung und Abrechnung im Arbeitsspeicher.
Nur zufällige Rundenkennung, Spielcode, Version und technische Zeit stehen unverschlüsselt.
Der vollständige persönliche Deckellink wird nicht als Einladung verwendet.
Anfragen nutzen die bereits bestehenden persönlichen Zugänge, keine OneDrive-Anmeldung
am Handy. Der Admin-Zugang ist weiterhin ausschließlich privat konfiguriert.
Unbestätigte Handyaktionen werden mit derselben ID wiederholt und auf dem eigenen
Handy verschlüsselt gespeichert. Bei einem Netzfehler keine zweite Runde anlegen,
sondern **Denselben Vorgang erneut prüfen** verwenden.

## Betrieb und Prüfung

`node cloudflare/push/build.cjs` erzeugt die vollständige Worker-Datei ohne weitere
Abhängigkeiten. Fragen und Lösungen sind nicht im öffentlichen Repository eingebaut.
Die D1-Abrechnung prüft alle betroffenen Kontoversionen vor dem ersten Schreiben
und führt Spielabschluss sowie alle Kontobuchungen in einer gemeinsamen Transaktion aus.
HTTP- und Datenbankfehler bedeuten keine bestätigte Übertragung.

Cloudflare-Free-Kontingente bleiben begrenzt. Runden werden nur bei geöffnetem
Challenge-Menü und sichtbarer App regelmäßig geprüft, nicht im Hintergrund.
Stark gewachsene Kontohistorien oder ausgeschöpfte Kontingente können zu Wartezeiten
führen. Nicht automatisch in einen kostenpflichtigen Tarif wechseln.
Vor dem ersten echten Einsatz mit zwei eigenen Testkonten eine kleine Runde vollständig
spielen und Summe, Treuepunkte, Verbrauch sowie Abbruch prüfen. Automatisierte lokale
Tests ersetzen diese Prüfung auf dem tatsächlich bereitgestellten Worker nicht.

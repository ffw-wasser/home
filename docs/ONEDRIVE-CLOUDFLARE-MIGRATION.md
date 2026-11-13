# OneDrive durch Cloudflare ersetzen

## Stand: erste Übernahmephase, kein Speicherwechsel

Die bestehende Anwendung nutzt weiterhin OneDrive. Dieser Branch ergänzt eine
getrennte, private Übernahmekopie. Die Endpunkte verändern weder den laufenden
Bestand noch Mitgliederkonten, Passkeys, Push-Geräte, Kalenderabos oder Widgets.
Es gibt bewusst noch keinen Aktivierungsendpunkt. `verified` bedeutet nur, dass
die im Manifest aufgeführten Dateien kopiert und nachgelesen wurden, nicht dass
OneDrive abgelöst ist oder der Export dem aktuell laufenden Bestand entspricht.

### Zielaufteilung

| Inhalt | Ziel |
| --- | --- |
| Programmcode, öffentliche Anwendung | GitHub wie bisher |
| Bereits zentrale Getränkekonten, Portal, Identitäten | Vorhandene D1-Tabellen unverändert |
| Mitglieder, Anwesenheit, Historie, Einstellungen | Neue D1-Datenhaltung mit Versionsschutz, noch umzusetzen |
| PDFs, Terminpakete, Sicherungen, private Unterlagen | Privates R2, nach Migration mit kontrolliertem Zugriff |
| Anmeldung Gerätehaus / Verwaltung | Widerrufbarer Gerätezugang und persönliche Admin-Identität, noch umzusetzen |

## Vorbereitung in Cloudflare

1. Im bestehenden Konto einen **privaten** R2-Standard-Bucket erstellen. Keine
   öffentliche Domain und keinen `r2.dev`-Zugriff aktivieren. EU-Jurisdiktion und
   Anforderungen für die übrigen Daten und Dienste vor dem produktiven Umzug prüfen.
   Keine kostenpflichtigen Tarif-Upgrades automatisch aktivieren.
2. Erst nach tatsächlicher Erstellung folgende Bindung in `cloudflare/push/wrangler.jsonc`
   ergänzen. Der Platzhalter wird durch den tatsächlich angelegten Bucketnamen ersetzt:

   ```json
   "r2_buckets": [{"binding":"MIGRATION_FILES","bucket_name":"BUCKETNAME"}]
   ```

   Die Bindung steht noch nicht in der Produktionskonfiguration, damit vorhandene
   Builds ohne eingerichtetes R2 weiterhin funktionieren. Fehlende Bindung führt
   ausschließlich bei den neuen Übernahmeendpunkten zu HTTP 503.
3. `cloudflare/push/storage-migration.sql` in der bestehenden D1-Datenbank ausführen.
   Es werden zwei zusätzliche Tabellen erstellt; bestehende Tabellen bleiben unverändert.
4. Worker aus den Quellen bauen, prüfen und erst danach bereitstellen. Ein Merge
   allein bestätigt weder R2-Bindung noch SQL-Ausführung noch Worker-Bereitstellung.
5. `INVITE_SECRET` unverändert sichern und beibehalten. Es schützt bereits vorhandene
   Daten und wird mit getrennter Schlüsselableitung für die Übernahmekopie verwendet.

## Vollständigen Export übernehmen

Einen vollständigen, unveränderten lokalen Export des eingerichteten gemeinsamen
OneDrive-Ordners außerhalb des Repositorys verwenden. Alle Unterordner einschließen,
auch private Einstellungen und Sicherungen. Ein Export kann Zugangsdaten enthalten;
er darf weder ins Repository noch in öffentliche Artefakte oder CI-Logs gelangen.
Die Übernahme liest den Export ausschließlich und lädt keine produktiven Daten zu GitHub.

Umgebungsvariablen in einer geschützten lokalen Sitzung setzen (keine Secrets als
Befehlsargumente, in Dateien im Repository oder in Chatnachrichten eintragen):

- `H2O_WORKER_ORIGIN`: bestehende HTTPS-Worker-Adresse ohne Pfad.
- `H2O_ADMIN_TOKEN`: vorhandener privater Verwaltungszugang.
- `H2O_SOURCE`: unveränderte Datenquellenkennung `driveId:folderId` aus dem bestehenden
  Dienst. Bei persönlichen OneDrive-Laufwerken die 16-stellige Hex-Laufwerkskennung
  wie in `DrinksStore` kleinschreiben. Die Kennung niemals neu erzeugen.

```sh
node scripts/migrate-onedrive-snapshot.cjs /absoluter/pfad/zum/export
```

Das Skript erstellt eine sortierte Bestandsliste mit SHA-256-Prüfsummen, startet
oder setzt genau dieselbe Übernahme fort, lädt jede Datei hoch und lädt jede Kopie
zum unabhängigen Vergleich wieder herunter. Am Ende wird der lokale Export erneut
inventarisiert. Bei Änderungen, Unterbrechung oder unbestätigter Antwort abbrechen
und denselben unveränderten Export erneut verwenden. Veränderte Exporte erzeugen
eine neue Übernahme, statt die alte Kopie zu überschreiben.

Grenzen dieser ersten Phase: 1–2000 Dateien, maximal 8 MiB je Datei, maximal
512.000 Byte Bestandsliste; keine symbolischen Links. Größere Bestände werden vor
Beginn abgewiesen und benötigen einen gesonderten, noch nicht implementierten
Upload in Teilen. Keine Datei wird wegen der Größe stillschweigend ausgelassen.
Leere Ordner und OneDrive-Versionsverläufe sind nicht Bestandteil der Übernahme.
Ein lokaler Export ist kein Nachweis eines konsistenten Online-Stands: Vor der
endgültigen Umschaltung sind Schreibpause und Schlussabgleich mit OneDrive nötig.

## Schutz und Wiederaufnahme

- Alle neuen Endpunkte benötigen serverseitig den vorhandenen Admin-Zugang und
  die SHA-256-Kennung der bereits aktiven H₂O-Datenquelle. Lokale PINs reichen nicht.
- Dateinamen und Manifest liegen verschlüsselt in D1; Dateiinhalte liegen
  AES-GCM-verschlüsselt in R2. R2-Schlüssel enthalten keine Originalnamen.
- Dateiübertragung ist binär. Körpergrößen werden beim Einlesen begrenzt.
  Antworten sind `no-store`; Downloads sind zusätzlich `private`.
- Ein D1-Beleg entsteht erst nach erneutem R2-Lesen, Entschlüsseln und Hashvergleich.
  Wiederholte Übertragung desselben Inhalts erzeugt keine doppelte Datei.
- Eine R2-Datei ohne D1-Beleg nach Abbruch wird beim nächsten Versuch nachgeprüft
  beziehungsweise erneut geschrieben. Abgebrochene Übernahmen bleiben isoliert.
- Das Skript folgt keinen HTTP-Weiterleitungen und protokolliert weder Dateinamen
  noch Inhalte, Tokens oder Datenquellenkennungen. Der finale Laufhash erlaubt die
  Zuordnung des Übernahmestands. Die Konsole meldet keine ungeprüfte Aktivierung.
- Diese Kopie ersetzt noch keine automatische Datensicherung. Eine unabhängige
  Sicherung samt Wiederherstellungstest ist vor der Ablösung erforderlich.

## Nächste Umsetzung vor der Umschaltung

1. Tatsächlichen OneDrive-Bestand erfassen und Übernahmekopie nachlesen.
2. Gerätehaus-/Admin-Anmeldung von Microsoft lösen; Geräte sperrbar machen.
3. Datenhaltung hinter den zuständigen Modulen ersetzen: Stammdaten, Anwesenheit,
   Historie/Korrekturen, Berichte, private Kontakte/Ausbildung/Hydranten, Einstellungen,
   Sicherungen und Wiederherstellung. Identitäten und Quellkennung erhalten.
4. Offline-Warteschlange, Konflikte und doppelte Zustellung absichern. Alte
   Gerätehaus-Versionen beim Wechsel gegen weitere OneDrive-Schreibzugriffe absichern.
5. Web, iPad, iOS, Android und Widgets mit bestehenden Zugängen praktisch testen.
6. Schreibpause, endgültigen Abgleich, vollständige Sicherung und wiederherstellbaren
   Umschaltpunkt herstellen. Erst dann den aktiven Speicher wechseln.

Tests dieser Phase: `node --test tests/storage-migration.test.cjs`; die Datei ist
auch in `cloudflare` und `sicherheit` der fokussierten Tests aufgenommen.
Produktives R2, reale OneDrive-Daten und native Geräte werden damit nicht geprüft.

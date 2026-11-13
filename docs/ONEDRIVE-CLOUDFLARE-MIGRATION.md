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

## Zweite Phase: isolierter D1-Testbetrieb

`storage-state.js` und `storage-state.sql` ergänzen einen getrennten Datenstand
für den Testbetrieb. Auch diese Phase stellt die laufende Anwendung **nicht** um.
Sie schafft noch keine vollständige Gerätehaus-Anmeldung oder persönliche
Admin-Oberfläche. Die bestehenden Microsoft-Zugänge werden noch gebraucht.

1. `storage-state.sql` zusätzlich in derselben D1-Datenbank ausführen. Es ergänzt
   drei Tabellen und einen Index. Keine vorhandenen Tabellen löschen oder ersetzen.
2. Den aus den geprüften Quellen erzeugten Worker bereitstellen. Vorhandene
   Secrets und Bindungen beibehalten.
3. Die beiden Skripte `migrate-onedrive-snapshot.cjs` und
   `prepare-cloudflare-storage.cjs` derselben geprüften Revision außerhalb der
   Übernahmekopie im selben lokalen Ordner speichern. Dann ausführen:

   ```sh
   node scripts/prepare-cloudflare-storage.cjs /pfad/zur/uebernahmekopie
   ```

   Bei gemeinsam gespeicherten Skripten den tatsächlichen Skriptpfad angeben.
   Die Quelle muss dieselbe unveränderte, bereits vollständig geprüfte Kopie sein.
   Das Skript liest die bestehende Verbindung nur lokal, akzeptiert ausschließlich
   den bekannten Produktionsworker und gibt keine Zugangsdaten oder Namen aus.

Der Datenstand wird nur aus einer nachgelesenen, in R2 geprüften Datendatei
`feuerwehr-wasser-daten.json` übernommen. Er liegt AES-GCM-verschlüsselt in D1;
alle bisherigen Felder bleiben erhalten. Wiederholte Vorbereitung überschreibt
keine zwischenzeitlichen Änderungen im Testbetrieb. Die erste Grenze für den
einzelnen JSON-Datenstand beträgt 500.000 UTF-8-Bytes; größere Daten werden
abgewiesen und benötigen eine gesonderte Aufteilung.

Das Skript legt einen zufälligen Testzugang für höchstens fünf Minuten an,
liest den D1-Bestand über diesen unabhängigen Zugang nach und vergleicht ihn
mit der lokalen Datendatei. Anschließend sperrt es den Zugang wieder und prüft
per erneutem Abruf, dass er tatsächlich HTTP 401 erhält. Eine unbestätigte
Sperrung führt zu einem Fehler. Bei einem harten Prozessabbruch begrenzt der
automatische Ablauf die Gültigkeit des Testzugangs.

### Rechte und parallele Änderungen

- Nur der bestehende Server-Admin-Zugang darf einen bestätigten Datenstand
  vorbereiten, ein Gerät anmelden oder sperren. Eine lokale PIN reicht nicht.
- Geräte erhalten einen eigenen zufälligen Zugang nur für **einen** Teststand
  und **eine** Datenquelle. Ein Gerätezugang ist kein Portal-, Widget-, Dokumenten-
  oder Server-Admin-Zugang. Er kann keine ursprünglichen Verbindungsdateien lesen.
- Tokens werden nur als SHA-256-Prüfwert gespeichert, Gerätebezeichnungen
  verschlüsselt. Maximal zehn aktuell gültige Geräte pro Teststand, maximal
  30 Tage je Registrierung. Gesperrte Kennungen können nicht wieder aktiviert werden.
- Schreiben prüft die erwartete Version und bestätigt die zufällige Vorgangskennung
  in derselben D1-Transaktion. Unveränderte Wiederholungen werden quittiert;
  geänderte Wiederverwendung oder parallele Überschreibung führt zu HTTP 409.
- Gerätesperrung und Ablauf werden beim Schreiben nochmals innerhalb der
  Transaktion geprüft. Antworten sind `no-store`. Die Originalkopie, OneDrive,
  Getränkekonten und bestehende Mitgliederzugänge werden nicht verändert.

Vor dem tatsächlichen Betrieb fehlen weiterhin Gerätehaus-/Admin-Oberflächen,
persönliche Verwaltungsidentitäten, Dokumenten-/Historienzugriffe, die neue
Synchronisierung samt Offline-Warteschlange und der abschließende Abgleich.
Ein erfolgreicher Testbetrieb ist keine abgeschlossene OneDrive-Ablösung.

Tests: `tests/storage-state.test.cjs` prüft Import aus dem bestätigten R2-Bestand,
Geräte- und Quellengrenzen, Sperrung/Ablauf, CAS-Konflikte, Wiederholung nach
verlorenen Antworten und Transaktionsrollback sowie den lokalen Vorbereitungslauf.
Reale iPad-, iOS-, Android- und R2-/D1-Abläufe bleiben gesondert zu prüfen.

## Dritte Phase: private Dateiablage mit Versionen

`storage-files.js` und `storage-files.sql` ergänzen einen getrennten Datei-Testbetrieb
für Berichte, Sicherungen, Ausbildung und andere übernommene Unterlagen. Die
laufende Gerätehaus-Anwendung wird auch durch diese Phase noch **nicht** umgestellt.
Die neuen Endpunkte unter `/admin/storage-files/` akzeptieren ausschließlich den
bestehenden Server-Admin-Zugang. Die zuvor eingerichteten Gerätezugänge erhalten
dadurch keine zusätzlichen Rechte und können keine Verbindungsdateien auslesen.

### Einrichtung und Vergleich

1. `storage-files.sql` in derselben D1-Datenbank ausführen. Es ergänzt drei Tabellen
   und einen Index für aktuelle Metadaten, alte Versionen und Vorgangsquittungen.
2. Den geprüften Worker bereitstellen. Bindung `MIGRATION_FILES`, vorhandene Secrets
   und Quellkennung bleiben gleich.
3. `prepare-cloudflare-files.cjs` zusammen mit `migrate-onedrive-snapshot.cjs` derselben
   geprüften Revision außerhalb der unveränderten lokalen Kopie speichern. Ausführen:

   ```sh
   node scripts/prepare-cloudflare-files.cjs /pfad/zur/uebernahmekopie
   ```

Der Dateivergleich benötigt den bereits vorbereiteten D1-Teststand und dieselbe
bestätigte R2-Übernahmekopie. Die Stammdatendatei wird ausschließlich durch den
getrennten Datenspeicher behandelt und ist in der Datei-API gesperrt. Andere Dateien
werden mit ihren Ordnerpfaden indexiert und jeweils erneut aus R2 geladen und per
SHA-256 mit der lokalen Kopie verglichen. Die Indexierung verwendet vorhandene
verschlüsselte Übernahmeobjekte; unveränderte Dateien werden nicht nochmals kopiert.
Leere Ordner waren nicht Bestandteil der ursprünglichen Übernahme. Änderungszeiten
stammen aus der lokalen Windows-/Exportkopie; ein alter Microsoft-Versionsverlauf
oder nicht mitexportierte Microsoft-Metadaten werden dadurch nicht rekonstruiert.

Das Skript legt anschließend einen zufällig benannten künstlichen Testordner an.
Es prüft binäres Schreiben, erneutes Lesen, Korrektur mit alter Version, Löschen und
Wiederherstellung. Der Testordner und seine Testdatei werden abschließend als
gelöscht markiert und aus der aktuellen Auflistung ausgeschlossen. Die Inhalte der
übernommenen Benutzerdateien und die lokale Kopie werden nur gelesen. Ein
unbestätigter Vergleich, Schreibvorgang oder Aufräumvorgang führt zu einem Fehler.
Bei hartem Prozessabbruch kann ein isolierter Testordner verbleiben; ein erneuter
Lauf erzeugt einen neuen Testordner und bereinigt keine fremden Pfade automatisch.

### Schutz und Wiederherstellung

- Namen und Pfade liegen verschlüsselt in D1. Der Index verwendet nur SHA-256-
  Kennungen für Dateien und Elternordner. Neue Inhalte liegen AES-GCM-verschlüsselt
  in R2; Schlüssel und zusätzliche authentifizierte Daten sind je Zweck getrennt.
- Uploads verwenden einen begrenzten JSON-Header und binäre Daten statt Base64.
  Die Grenze bleibt 8 MiB pro Datei und 32 Pfadsegmente. Rückgaben sind `no-store`,
  Dateidownloads zusätzlich `private`, `attachment` und `application/octet-stream`.
- Jede neue R2-Datei wird vor dem Bestätigen nachgelesen und geprüft. Objektschlüssel
  enthalten Vorgangskennung und Inhaltsprüfsumme: Gleichzeitige Anfragen mit derselben
  Kennung und unterschiedlichem Inhalt können die erfolgreiche Version nicht beschädigen.
- Aktueller Stand, Quittung und frühere Metadatenversion werden in einer D1-Transaktion
  gespeichert. Versionskonflikte und geänderte Wiederverwendung führen zu HTTP 409.
  Eine Anfrage mit verlorener Antwort kann unverändert wiederholt werden.
- Elternordner und leere Ordner beim Löschen werden innerhalb der Transaktion
  geprüft. Die Wiederaufnahme einer Indexierung überschreibt weder neuere Versionen
  noch Löschmarkierungen und legt keine Datei unter einem gelöschten Ordner an.
- Löschen ist hier eine Löschmarkierung. Alte Inhalte und Metadaten bleiben erhalten;
  Wiederherstellung benötigt eine explizite alte Version und die erwartete aktuelle
  Version. Historische R2-Objekte werden nicht automatisch entfernt und verbrauchen
  entsprechend zusätzlichen Speicher. Zeitgesteuerte unabhängige Sicherungen und
  eine Aufbewahrungsstrategie sind vor dem produktiven Wechsel weiterhin nötig.

Tests: `tests/storage-files.test.cjs` prüft unter anderem verschlüsselte Dateinamen,
Ordnerstruktur, Originalversionen, Parallelanfragen, Transaktionsrollback, beschädigte
R2-Rückgaben und die vollständige lokale Prüfsequenz mit ausschließlich künstlichen
Daten. Reale Unterlagen und die Gerätehaus-Oberfläche sind damit noch nicht getestet.

## Vorbereitung in Cloudflare

1. Im bestehenden Konto einen **privaten** R2-Standard-Bucket erstellen. Keine
   öffentliche Domain und keinen `r2.dev`-Zugriff aktivieren. EU-Jurisdiktion und
   Anforderungen für die übrigen Daten und Dienste vor dem produktiven Umzug prüfen.
   Keine kostenpflichtigen Tarif-Upgrades automatisch aktivieren.
2. Für den am 13.11.2026 vom Nutzer als erstellt bestätigten Bucket ist folgende
   Bindung in `cloudflare/push/wrangler.jsonc` vorbereitet:

   ```json
   "r2_buckets": [{"binding":"MIGRATION_FILES","bucket_name":"feuerwehr-wasser-migration","jurisdiction":"eu"}]
   ```

   Im Dashboard des vorhandenen Workers unter Bindungen denselben EU-Bucket mit
   dem Variablennamen `MIGRATION_FILES` verbinden. Kein API-Token und kein
   öffentlicher Zugriff sind dafür nötig. Name, Konto und EU-Jurisdiktion vor der
   Veröffentlichung abgleichen; die Bestätigung des Nutzers ersetzt keinen
   erfolgreichen Worker-/R2-Zugriffstest. Fehlende Bindung führt ausschließlich
   bei den neuen Übernahmeendpunkten zu HTTP 503.
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

Ab Version `2026.11.13.9` verwenden die ausgelieferten Gerätehaus-Module den
Cloudflare-Transport. Die Microsoft-Anmeldung und Word-Konvertierung werden nicht
mehr geladen. Die tatsächliche produktive Umschaltung ist erst durch den
abschließenden lokalen Aktivierungslauf bestätigt; ein GitHub-Commit allein
bestätigt keine Umschaltung.

### Manuelle Aktivierung

1. `storage-runtime.sql` einmal in der bestehenden D1-Datenbank `deckel-push`
   ausführen. Die bisherigen Tabellen und Secrets bleiben erhalten.
2. Den geprüften Worker bereitstellen und seinen `/health`-Fingerprint mit dem
   gebauten Bundle vergleichen. R2-Bindung und EU-Jurisdiktion beibehalten.
3. Alle alten Gerätehaus-Fenster einschließlich des iPads schließen. OneDrive
   vollständig synchronisieren lassen. Während der Schlusskopie keine Dateien
   im Originalordner bearbeiten.
4. Die vier zusammengehörigen Skripte aus demselben geprüften Commit lokal
   bereitstellen: `activate-cloudflare-storage.cjs`,
   `migrate-onedrive-snapshot.cjs`, `prepare-cloudflare-storage.cjs` und
   `prepare-cloudflare-files.cjs`. Unter Windows starten mit
   `node activate-cloudflare-storage.cjs --choose`.
   Das Skript prüft zuerst den öffentlichen Worker-Fingerprint und sendet bei
   einer abweichenden Bereitstellung keinen Verwaltungszugang.
5. Den aktuellen synchronisierten Originalordner `Webseite` auswählen, der
   `feuerwehr-wasser-daten.json`, `Getraenke` und `Berichte` enthält. Keine alte
   Downloads-Kopie auswählen. Das Skript erstellt eine unabhängige neue
   Schlusskopie unter Downloads, prüft Original und Kopie vor und nach der
   Übertragung sowie alle Inhalte beim Nachlesen aus Cloudflare.
6. Nach bestätigter Aktivierung öffnet das Skript den Browser mit einem eigenen
   Gerätezugang. Es protokolliert keine Schlüssel und verändert den
   OneDrive-Originalordner nicht. Ein erneuter Lauf bei bereits aktivem
   Cloudflare-Speicher importiert niemals alte Daten über den laufenden Stand.
7. Weitere Laptops mit Zugriff auf den gemeinsamen lokalen OneDrive-Ordner:
   Anwendung öffnen → Cloudflare-Verbindung öffnen → Ordner „Webseite“ auswählen.
   Die Anwendung liest nur die zwei Verbindungsdateien unter `Getraenke` und
   richtet einen eigenen Gerätezugang ein. Die übrigen Dateien werden nicht
   gelesen oder hochgeladen. Die ausgewählten Dateien sind kein Datenimport.
   Der Hauptschlüssel wird nicht im Browser gespeichert.
   Alternative ohne Ordnerzugriff: In Einstellungen → H₂O-Dienst weitere
   Verwaltungsgeräte koppeln. Code bzw.
   Link: einmalig, fünf Minuten gültig. Bei der installierten Gerätehaus-App den
   Link direkt im Verbindungsfenster einfügen. Aktive Geräte verlängern ihre
   Verbindung; unbenutzte Zugänge laufen nach 30 Tagen aus. Einzelne Geräte
   können jederzeit gesperrt werden. Persönliche Mitgliederzugänge, Apps,
   Kalenderabos und Widgets behalten ihre bisherigen Dienstidentitäten.

Nicht synchronisierte iPad-Daten werden vor einer Übernahme unter
`Backups/Umstellung` privat gesichert. Ein unveränderter alter Ausgangsstand
kann lokale Änderungen mit Versionsschutz übernehmen. Bei abweichenden
Änderungen entscheidet die Verwaltung zwischen gesichertem lokalem Stand und
Cloudflare-Stand. Keine automatische Entscheidung anhand des jüngeren Datums.
Frühere D1-Stände und Dateiversionen bleiben erhalten. Vorhandene historische
Archivdaten, Laufbahnangaben und Zusatzfelder werden nicht stillschweigend
entfernt. Lokale PDF-Kopien bleiben beim Handover erhalten.

Die neue Einsatz-PDF wird vollständig lokal mit eingebetteten Schriften
erstellt. Fahrzeuge, Mannschaft/Funktionen, persönliche Reservezeiten,
Stromausfall, Alarmierungswege sowie sämtliche Berichtsfelder sind enthalten.
Passt der gesamte Inhalt nicht auf zwei Seiten, wird die Ausgabe mit einem
Hinweis gestoppt; Eingaben werden nicht gekürzt. Die optionalen früheren
Word-Quelldateien bleiben als Projektbestand erhalten, werden jedoch nicht
mehr in die Anwendung oder ihren Offline-Cache geladen.

Prüfungen: `tests/storage-runtime.test.cjs`, `tests/cloud-sync.test.cjs`,
`tests/cloud-storage-browser.cjs` (realer Transport gegen künstlichen Worker/
D1/R2-Bestand), `tests/operation-local-pdf.test.cjs` sowie die bestehenden
Berichts-, Kalender-, Getränke-, Sicherheits- und Backupprüfungen. Reale
native Geräte und produktive Nutzerdateien sind damit nicht automatisch geprüft.

### Vollständiger Berichtsdownload

Unter Einstellungen → Berichte & Datensicherung wird der ZIP-Download mit
„Alle Jahre“, einem ganzen Jahr oder einem Monat innerhalb des gewählten Jahres
vorbereitet. „Berichte laden“ liest die privaten Cloudflare-Berichtsdateien mit
ihren konkreten Dateiversionen. Die Auswahl verwendet das ursprüngliche
Termindatum aus CSV oder Einsatzdaten, ersatzweise aus dem datierten Dateinamen;
Uploadzeit und Korrekturzeit bestimmen niemals den Zeitraum. Berichte ohne
erkennbares Termindatum werden ausdrücklich nur im Gesamtexport aufgenommen.

Die ZIP-Datei enthält alle ausgewählten Originaldateien unter `Originale/`
einschließlich vollständiger Terminpakete und darin enthaltener Anlagen. PDF
und CSV aus den Paketen sind zusätzlich unter `PDF/` und `CSV/` zugänglich.
`Berichtsverzeichnis.csv` dokumentiert Pfad, Dateiversion und Termindatum.
Bei einem fehlgeschlagenen Abruf oder einem ungültigen Paket wird kein
unvollständiger Download erzeugt. Nach Geräteabmeldung werden geladene
Exportdaten verworfen; ein laufender Export darf nicht mehr ausgegeben werden.

Prüfungen: `tests/report-download.test.cjs` und
`tests/report-download-browser.cjs` (Chromium und WebKit, nur Beispieldaten).
Das zugehörige Hilfebild wird mit
`node scripts/capture-help-screens.cjs --only=geraetehaus-berichte-download`
aus der tatsächlichen Oberfläche erzeugt.

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

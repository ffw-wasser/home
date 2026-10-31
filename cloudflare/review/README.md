# H₂O Apple Review – isolierter Test-Worker

**Nur für `h2o-apple-review`; niemals auf den produktiven Worker deployen.** Die Mitgliederdaten bleiben in der bestehenden H₂O-Umgebung.

## Bestehende Cloudflare-Testressourcen

- Worker: `h2o-apple-review`
- Host: `https://h2o-apple-review.522dn4fc5f.workers.dev`
- Getrennte D1-Datenbank: `h2o-apple-review`, Binding `DB`
- Kein produktives OneDrive, Google-Kalender, Mitglieder-D1 oder produktiver Authentisierungs-Token.

## 1. Isoliertes Schema einrichten

Cloudflare > Storage & Databases > D1 > **h2o-apple-review** > Console: Den Inhalt von [schema.sql](schema.sql) ausführen.

Das Schema enthält **nur** Rückmeldungen zu drei fest eingebauten erfundenen Terminen. Es wird kein Mitglied angelegt oder von produktiven Daten kopiert.

## 2. Zwei getrennte geheime Werte erzeugen

Im Browser oder auf dem eigenen Rechner zwei **unterschiedliche** zufällige Zeichenfolgen mit je mindestens 32 URL-sicheren Zeichen erzeugen, idealerweise 43 Zeichen aus 32 Kryptozufallsbytes. Eine lokale Node.js-Möglichkeit auf Windows:

```powershell
node -e "const c=require('node:crypto');console.log(c.randomBytes(32).toString('base64url'))"
```

Den Befehl **zweimal** ausführen; Werte nur lokal speichern und **niemals im Chat, im GitHub-Code, in einem Screenshot oder als Klartext-Variable** veröffentlichen.

Beim **neuen** Worker unter Settings > Variables and Secrets zwei **Secrets** erstellen:

- `H2O_REVIEW_INVITE_CODE` – erster Zufallswert (Apple-Demo-Einladung)
- `H2O_REVIEW_SESSION_KEY` – zweiter, unabhängiger Zufallswert (HMAC-Sitzungssignatur)

Die Testumgebung verweigert die Anmeldung, wenn diese Werte fehlen oder zu kurz sind.

## 3. Worker-Code ausliefern

In **Workers & Pages > h2o-apple-review > Edit code** den Inhalt von [worker.js](worker.js) übernehmen und bereitstellen. Bestehende Bindung `DB` erhalten.

`GET https://h2o-apple-review.522dn4fc5f.workers.dev/health` zeigt eine JSON-Antwort mit `environment: "synthetic-review"` und `configured: true`, sobald alle Bindings und Secrets vorhanden sind. Sie enthält niemals geheime Werte.

`GET https://h2o-apple-review.522dn4fc5f.workers.dev/home/deckel.html` zeigt die H₂O-Demo-Anmeldemaske. Mit dem **Einladungswert** anmelden und beispielhafte Probe, Unterricht und Sonderprobe prüfen. Änderungen gehen nur in die separate `review_replies`-Tabelle.

## 4. QR-Code für Apple erst nach funktionierendem Test

Die korrekte URL ist:

```text
https://h2o-apple-review.522dn4fc5f.workers.dev/home/deckel.html#setup=DEIN_GEHEIMER_EINLADUNGSCODE
```

Der QR-Code enthält damit einen geheimen Zugang. **Keine QR-Code-Onlinegeneratoren verwenden:** Diese würden die vollständige Einladung auf fremde Server übertragen. Einen QR-Code lokal/offline auf dem eigenen Gerät erstellen und ausschließlich bei App Store Connect in den Review-Notizen hochladen. Die Review-Notizen können alternativ zusätzlich die manuelle Eingabe des Demo-Codes beschreiben. Niemals die Einladung in öffentliches GitHub oder diese Unterhaltung kopieren.

## 5. iPhone-Test-Build

Die Review-Origin ist nur unter `H2O_APP_REVIEW` aktiviert. Das XcodeGen-Projekt akzeptiert dafür bei der Erstellung des **Review-Builds** den Build-Parameter `H2O_REVIEW_FLAG=H2O_APP_REVIEW`. Ein gewöhnlicher Build verwendet weiterhin die produktive GitHub-Pages-Domain.

Der Worker ist **eine isolierte Demo der Terminfunktion und des Widgets**, nicht die vollständige operative Mitgliederverwaltung. Für eine endgültige Apple-Prüfung muss untersucht werden, ob die übrigen wesentlichen App-Funktionen für Apple ausreichend testbar sind. Die Demo nicht als vollständige produktive H₂O-Kopie ausgeben.

## Widerruf

Bei Abschluss der Prüfung `H2O_REVIEW_INVITE_CODE` und `H2O_REVIEW_SESSION_KEY` rotieren. Durch Rotation des zweiten Secrets werden bereits ausgegebene Sitzungen sofort ungültig. Die Testdatenbank kann anschließend gelöscht werden, ohne Produktivdaten zu verändern.

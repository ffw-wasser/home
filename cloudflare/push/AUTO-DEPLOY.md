# GitHub automatisch mit dem vorhandenen Cloudflare-Worker veröffentlichen

Vorbereitet für **ffw-wasser/home**, Produktionsbranch **main** und den vorhandenen
Worker **feuerwehr-wasser-deckel-push**. Die Website bleibt auf GitHub Pages.
Die einmalige GitHub-Verbindung muss im Cloudflare-Konto bestätigt werden.

## Einmalige Einrichtung

1. In Cloudflare **Workers & Pages → feuerwehr-wasser-deckel-push** öffnen.
2. **Settings / Einstellungen → Builds → Connect / Verbinden** öffnen.
3. GitHub verbinden und nur das Repository **ffw-wasser/home** freigeben.
   Den bestehenden Worker verbinden; keine zweite Anwendung erstellen.
4. Folgende Werte eintragen:

| Einstellung | Wert |
|---|---|
| Repository | `ffw-wasser/home` |
| Produktionsbranch | `main` |
| Root directory / Stammverzeichnis | `cloudflare/push` |
| Build command | `node ../../scripts/prepare-worker.cjs` |
| Deploy command | `npx --yes wrangler@4.151.0 deploy --keep-vars` |
| Builds für andere Branches / Preview Builds | Aus |
| Node.js | `24` (durch die Versionsdatei im Stammverzeichnis vorgegeben) |

5. Unter Watch paths die Voreinstellung beibehalten: Include paths `*`,
   Exclude paths leer. So lösen auch Änderungen unter `js/`, `tests/` und
   `scripts/` außerhalb von `cloudflare/push` einen Build aus.
6. Cloudflares automatisch erzeugten Build-Zugang verwenden. Keine bestehenden
   App-Schlüssel in Build-Variablen oder ins Repository kopieren.
7. Speichern und den ersten Build auslösen, etwa über **Retry build / Build erneut
   ausführen** in der Build-Historie. Falls noch kein Build vorhanden ist, einen
   neuen Commit auf `main` veröffentlichen.
8. Erst ein erfolgreicher Eintrag in **Deployments → View build history** und ein
   aktives Deployment bestätigen die funktionierende automatische Veröffentlichung.
   Bis dahin ist nur die Repository-Seite vorbereitet.

Workers Builds ist im Free-Tarif enthalten; dort bleiben. Keine kostenpflichtigen
Upgrades für diese Einrichtung aktivieren.

## Ablauf ab der Verbindung

Ein Commit auf `main` startet das Erstellen der Paketdatei, die Syntaxprüfung und
sämtliche automatisierten Tests. Schlägt ein Schritt fehl, stoppt der Build vor der
Veröffentlichung. Nach erfolgreichem Build veröffentlicht Wrangler den vorhandenen
Worker. Der manuelle Austausch von `worker.bundle.js` entfällt.

Die bereits vollständige Paketdatei wird mit `no_bundle` ohne eine zweite
Umwandlung veröffentlicht; weitere Quelldateien werden nicht als Worker-Module
hochgeladen. `keep_vars` erhält im Dashboard hinterlegte Variablen. Vorhandene Secrets werden
weiterverwendet. Die vorhandene D1-Bindung **DB**, der Workername und der minütliche
Cron-Trigger sind in `wrangler.jsonc` hinterlegt. Es werden bei diesem Vorgang keine
SQL-Skripte ausgeführt und keine Datenbankinhalte migriert oder gelöscht.

Die feste Wrangler-Version hält Veröffentlichungen nachvollziehbar. Ein späteres
Update dieser Version wird separat geprüft; danach den Deploy-Befehl auch in den
Cloudflare-Build-Einstellungen anpassen.

## Lokal prüfen

Aus dem Repository-Hauptverzeichnis:

```sh
node scripts/prepare-worker.cjs
```

Oder aus `cloudflare/push`:

```sh
node ../../scripts/prepare-worker.cjs
```

Dieser Befehl benötigt keine Cloudflare-Zugangsdaten und veröffentlicht nichts.
Die bisherige manuelle Veröffentlichung der Paketdatei bleibt als Ausweichweg
verfügbar. Eine vorherige Version lässt sich über Cloudflare Deployments zurückrollen.

## Offizielle Dokumentation

- [Vorhandenen Worker verbinden](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Build-Einstellungen](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Watch paths](https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/)
- [Free-Tarif und Build-Limits](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)

## Verbindungstest bei leerer Build-Historie

Für einen Verbindungstest eine tatsächliche Änderung unter `cloudflare/push/`
auf `main` veröffentlichen und den neuen Commit in Cloudflares Build-Historie
suchen. Ein erfolgreicher GitHub-Pages-Build bestätigt nur die Website, nicht
die Veröffentlichung des Cloudflare-Workers.

Erscheint trotz einer solchen Dateiänderung kein Build, in Cloudflare den
verbundenen Repository-Namen, den Produktionsbranch `main`, die aktivierten
Produktionsbuilds und die Watch paths prüfen. Die GitHub-Freigabe für
`ffw-wasser/home` muss für die Cloudflare-Git-Integration erteilt sein.

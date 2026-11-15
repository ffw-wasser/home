# Dokumentation und Projektpflege

- [Projektkarte](PROJEKTKARTE.md): zuständige Module und Datenflüsse.
- [Arbeitsleitfaden](WORK-LEITFADEN.md): Änderungen, Prüfungen und Veröffentlichung.
- [Historische Prüfberichte](archive/README.md): datierte Ergebnisse früherer Versionen.
- [Cloudflare-Veröffentlichung](../cloudflare/push/AUTO-DEPLOY.md): Betrieb und Deployment.

## Pflegegrenzen

`js/` und `css/` enthalten den Anwendungscode, `tests/` die automatisierten Prüfungen, `scripts/` die Erzeuger und Prüfwerkzeuge. Die Version wird ausschließlich in `app-release.json` gepflegt. HTML-Hilfe und Review-Portal werden mit ihren bestehenden Skripten erzeugt.

`qa/`, `node_modules/` und native Build-Verzeichnisse sind lokale Ausgaben und werden nicht eingecheckt. Freigegebene Hilfebilder unter `assets/help/guide/` bleiben versioniert. Historische Datenformate, Migrationen, Signierungsabläufe und alte Release-Workflows nur nach Prüfung ihrer Nutzung ändern.

Nach Änderungen an Hilfe oder Version: `node scripts/build-help-guide.cjs`, `node scripts/update-release.cjs`, anschließend `node scripts/build-review-portal.cjs`. Vor Merge sind vollständige CI, Bundle- und Release-Prüfung erforderlich. Ein bestandener Test ersetzt keinen Nachweis des produktiven Deployments.

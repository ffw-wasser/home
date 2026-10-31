# H₂O iOS / TestFlight / Widget – Gesamtprüfung

Stand: **31.10.2026**. Code- und Konfigurationsprüfung; kein physischer iPhone-Gerätetest und kein Livezugriff auf das persönliche App-Store-Connect-Konto.

## Bestätigt

- Verifizierte Apple-Distribution-Signierung von Haupt-App und Widget anhand des erfolgreichen GitHub-Workflow-Screenshots; signiertes IPA als GitHub-Artefakt erzeugt.
- App-Store-Connect-Upload von **1.0.0 (1009)** durch Screenshots bestätigt. Zuletzt **„Verarbeitung läuft“**, daher Abschluss und interne Installation noch nicht bestätigt.
- App-IDs: `de.feuerwehrwasser.h2o`, `de.feuerwehrwasser.h2o.widget`; gemeinsam `group.de.feuerwehrwasser.h2o`. Beide Profile bestanden den späteren Signierungscheck.
- Separater Demo-Worker unter `h2o-apple-review.522dn4fc5f.workers.dev`, eigene D1 und Secrets; Test von Anmeldung und Rückmeldungen durch Betreiber bestätigt.
- Review-Build wird mit `H2O_REVIEW_FLAG=H2O_APP_REVIEW` und speziellen Review-Entitlements gebaut; Produktion verwendet ein anderes Webziel. Haupt-PWA/Produktionsworker wurden dadurch nicht geändert.
- Original-App-Icon **ist als echte PNG-Bilddatei in 1024 × 1024 im iOS-Projekt vorhanden** (H₂O-Flamme/Wassertropfen). Der graue Eintrag beim noch verarbeiteten Build beweist kein fehlendes Asset.
- Signierungsworkflow auf `main` ist manuell und hat `upload_to_testflight=false` als Standard. Er lädt den festen Entwicklungs-Commit `41dacad39386bf769c362b445b4dc68a0e6ffc6b`. Deshalb ändern spätere Commits an PR #238 **nicht** den bereits hochgeladenen Build und auch **nicht automatisch** künftige Signierläufe.

## Befunde / Risiken

### A. Vor einer vollständigen Mitgliederveröffentlichung zwingend

1. **Mitgliederdaten-Ablauf im Widget**: Das alte Widget verwendete lediglich `TimelineReloadPolicy.after` zur Aktualisierung, sodass bei verzögerten iOS-Neuladevorgängen persönliche Termine zu lange angezeigt werden könnten. Die im Entwicklungszweig ergänzte Fassung setzt echte zukünftige Timeline-Einträge auf Terminende und nach 12 Stunden. **Nicht in Build 1009 enthalten.**
2. **Produktions-Passkeys und Deep Links** sind in der isolierten Review-Version nicht testbar, weil die Review-Entitlements die produktiven Associated Domains bewusst ausschließen. Vor einem regulären Mitglieder-Build die echte Domänenzuordnung, Anmeldung auf iPhone und QR-Onboarding separat testen.
3. **Die Demo deckt nur einen Teil der Funktionen ab**: Probe/Unterricht/Sonderprobe und Rückmeldungen, plus Widget. Für eine externe Beta-Prüfung bzw. App-Store-Prüfung verlangt Apple nach Guideline 2.1 Zugriff auf die relevanten App-Funktionen (Demo-QR oder funktionsfähiger Demo-Modus). Die bestehende Demo ist ausdrücklich **nicht** als vollständiger Nachweis dafür freigegeben. Guideline 4.2 fordert zudem mehr als eine bloß verpackte Website; die Widget-Integration hilft, ist aber keine Zulassungsgarantie.
4. **Echte Widget-Funktion auf iPhone ungeprüft**: Hinzufügen kleiner/mittlerer Größe, Anzeige, Antwortwechsel, QR-Login, Tippen zum Öffnen, Ausschalten nach Ablauf/Logout und Neuinstallation auf einem echten iPhone nachvollziehen.

### B. Vor dem nächsten TestFlight-Build korrigieren bzw. abgleichen

1. **Versionsreihenfolge**: Es existieren ältere TestFlight-Builds `1010.1` und `1012.1`, während der neue Demo-Build `1009` heißt. Für die nächste Abgabe eine neue eindeutige und höhere Buildnummer (beispielsweise `1013`) wählen. Vor dem erneuten Upload den im signierten Workflow verwendeten festen Git-Commit bewusst auf den freigegebenen, getesteten Stand ändern; niemals einfach auf HEAD umstellen.
2. **Demo-Uhrzeiten**: Alte Beispieltermine wurden per UTC-Stunde statt deutscher Ortszeit konstruiert und erschienen in Deutschland um ein oder zwei Stunden verschoben. Im Entwicklungszweig auf `Europe/Berlin` geändert und Testprüfung ergänzt. Diese Korrektur erfordert zusätzlich die **gezielte Aktualisierung des separaten Demo-Workers** und ist noch nicht live.
3. **Widget-Kleidung/Ort**: Das mittlere Widget zeigt beide Felder; das kleine Widget zeigt aktuell nur Termin, Datum, Zeit und Status. Das Nutzerziel „Ort und Kleidung“ ist in der kleinen Variante noch nicht vollständig abgedeckt. Lesbarkeit der Schriftgrößen für ältere Mitglieder und echte iPhone-Vorschau prüfen.
4. **App-Symbol**: Quelldatei vorhanden; in App Store Connect nach Abschluss der Verarbeitung kontrollieren, ob das H₂O-Symbol erscheint. Wenn nicht, die tatsächliche signierte IPA-Asset-Kompilierung und Xcode-Export prüfen.
5. **Native Shell und Store-Regeln**: Die aktuelle Demo hat eine bewusst reduzierte, nicht produktionsähnliche Oberfläche. Für externe Tests/App Store die App-Funktionalität, Datenschutzangaben, Review-Notizen und das native Widget insgesamt prüfen.

### C. Einschränkungen des bisherigen Nachweises

- Ein erfolgreicher GitHub-Build beweist Kompilierung und Signatur, aber keine bestandene Apple-Verarbeitung, keinen erfolgreichen internen iPhone-Test und keine App-Store-Freigabe.
- Kein Zugriff auf den aktuellen App-Store-Connect-Status: Letzte vom Betreiber bereitgestellte Aufnahme zeigt Build 1009 noch in Verarbeitung. Apple zeigt „Abgeschlossen“, „Fehlgeschlagen“ oder weitere Hinweise nach der Verarbeitung.
- Keine geheimen PFX-, .p8-, Cloudflare-Demo-Codes oder GitHub-Secrets im Repository oder Prüfdokument enthalten. Die eingetragenen Secrets wurden nicht ausgelesen.
- Der Zustand der produktiven Mitglieder-App wurde **nicht vollständig funktional auf einem echten Gerät** geprüft. Der Workflow ist absichtlich von der normalen H₂O-PWA getrennt.

## Nächster Ablauf

1. Apple-Verarbeitungsstatus für 1009 und nachgeliefertes Icon kontrollieren.
2. Wenn Build verfügbar: 1009 ausschließlich in einer internen TestFlight-Gruppe zuordnen; auf eigenem iPhone Demo-Login, Demo-QR und Widget ausprobieren, keine externen Mitglieder einladen.
3. Die aufgeführten Änderungen im Entwicklungszweig fertig prüfen; für ein Folgepaket neue Buildnummer über 1012.1 vergeben, Signing-Workflow nur nach bewusster Prüfung auf neuen festen Commit aktualisieren.
4. Erst nach erfolgreichem Test am Gerät, vollständigem Review-Zugang und gesonderter Zustimmung eine App-Store- oder Mitgliederveröffentlichung planen.

Referenzen: Apple „Keeping a widget up to date“, „App Review Guidelines“ 2.1/4.2, „View builds and metadata“, „Add internal testers“.

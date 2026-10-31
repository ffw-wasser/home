# Arbeitspaket: H2O Portal als Mitglieder-App mit Startbildschirm-Widget

Stand: 31.10.2026 · **Planung, keine Produktivfreigabe**

## Ziel und Rahmen

- Rund **35 Mitglieder**; für die Kapazitätsplanung zunächst **21 Android- und 14 iPhone-Geräte** annehmen, zusätzlich mit einzelnen Zweitgeräten rechnen.
- **Eine Installation** je Gerät: vollständiges H2O Portal mit integriertem, optional hinzufügbarem Startbildschirm-Widget. Keine zweite Widget-App.
- Keine Beteiligung oder Apple-Business-Verwaltung durch die Stadt. Vorhandene persönliche Apple-Entwicklerlizenz nutzen.
- Die laufende Web-PWA bleibt als funktionsfähiger Rückfallweg bestehen; keine erneute Entwicklung der Portal-Fachfunktionen und keine Migration der Mitgliederdaten ohne separaten Auftrag.
- Installation soll möglichst einfach sein, Schutz durch bestehende **serverseitige** H2O-Mitglieder- und Rollenkontrolle. Versteckte Store-Links sind **kein** Zugriffsschutz.
- Keine Veröffentlichung in Stores, kein Merge in `main` und kein Produktiv-Worker-Deploy ohne gesonderte ausdrückliche Freigabe.

## Bereits vorhandene Grundlage

`native/ios/` und `native/android/` sind seit 27.10.2026 archiviert, aber als Ausgangspunkt vorhanden (siehe `native/README.md`). Vor Wiederaufnahme **tatsächlichen aktuellen Stand prüfen**; frühere Workflows, App-Links/Passkey-Zuordnung und Test-Vorbereitung dürfen nicht als aktiv vorausgesetzt werden. Die vorhandene `deckel.html` bleibt Quelle der Portaloberfläche. `AGENTS.md` und `docs/PROJEKTKARTE.md` beachten.

## Widget, erste Version

- Optik passend zum aktuellen H2O-Design: **Feuerwehr Wasser**, H2O-Symbol, nächster relevanter Termin (Datum, Uhrzeit, Art, Ort, Kleidung), eigener Status **Dabei / Entschuldigt / Unsicher / Offen**.
- Der **gesamte Widget-Tipp** öffnet die native H2O-App direkt bei **Termine**. Schnelleinstiege Check-in / Mein Deckel erst nach zuverlässigem Grundablauf optional ergänzen.
- Termin ausschließlich aus der **geschützten H2O-Terminquelle**, nicht aus öffentlichen Kalenderfreigaben. Mit vorhandener Gruppen-/Mitgliedszuordnung filtern; „betrifft nicht“ nicht als „offen“ darstellen. Kein Geburtstag / keine Gesundheits- oder Nachweisdaten.
- Bei keinem passenden Termin verständlicher Leerzustand. Bei fehlendem Login, Sperrung oder abgelaufener Berechtigung keine persönlichen Daten zeigen; Widget-Einträge lokal entwerten.
- Zeitnahe, aber **nicht sofort garantierte** Aktualisierung durch iOS WidgetKit bzw. Android AppWidget/Glance; letzte erfolgreiche Aktualisierung und ggf. „Stand möglicherweise veraltet“ sichtbar machen.
- Nur Startbildschirm-Widget; keine personenbezogenen Termine in zusätzlichen Sperrbildschirm-Widgets.

## Architektur und Schutz

1. Bestehende native Hüllen gezielt prüfen und aktualisieren: iOS SwiftUI/WKWebView + WidgetKit; Android Kotlin/WebView + Glance oder AppWidgetProvider.
2. Native Widget-Quelle bekommt **minimale read-only Funktion** für genau den eigenen nächsten Termin und eigenen Status. Jede Anfrage serverseitig nach Mitgliedschaft, Token-Ablauf, Rollen und Entzug prüfen. Kein globaler Kalender- oder Admin-Endpunkt und kein öffentlicher Terminfeed.
3. Native WebView-Sitzung und Widget-Zugriff **nicht** durch ungeschützte lokale WebView-Cookies/URL-Parameter verbinden. Falls nötig, kurzlebige/rotierbare widgetgebundene Berechtigung mit minimalem Scope, sichere OS-Speicherung und widerrufbarer Gerätebindung vorsehen. **Keine** Passkeys, Tokens, persönlichen ICS-Links oder Nutzerdaten in GitHub, Logs oder Backup.
4. Beim Logout, Linkreset, Mitgliederaustritt und Sperrung Widgetdaten löschen bzw. unverzüglich beim nächsten möglichen Update verwerfen; keine Statusänderung ohne H2O-Anmeldung.
5. App-Links, Passkeys, Passwort-Login, QR-Onboarding, PDF und Push-Fähigkeit auf echten iOS- und Android-Geräten neu verifizieren. Vorhandene native Vorarbeiten dürfen nicht als bereits erfolgreich getestet gelten.
6. Web-PWA und native App benutzen dieselbe Kalender-/Rückmeldungslogik. Nur benötigte Schnittstellen ergänzen, ohne Datenfluss zu duplizieren.
7. Für die Store-Prüfung **isolierten Demo-Zugang mit künstlichen Daten** vorsehen; keine echten Mitgliederdaten an Prüfer weitergeben.

## Verteilung und Kosten (vor Veröffentlichung nochmals aktuell prüfen)

### iOS

- Vorhandene Apple Developer Program-Lizenz nutzen; nach dem enthaltenen Mitgliedsjahr ist die jährliche Verlängerung einzukalkulieren.
- **Unlisted App** über App Store Connect beantragen, wenn die App vollständig für Review eingereicht ist. Link ist nicht in der Suche gelistet, aber für jeden mit dem Link installierbar; tatsächlicher App-Zugriff bleibt auf autorisierte H2O-Mitglieder begrenzt.
- Apple App Review Guideline **4.2** beachten: Native App muss über eine reine Website-Hülle hinausgehen; das Widget hilft, garantiert aber keine Freigabe.
- Für begrenzte Testläufe TestFlight oder registrierte Testgeräte getrennt vom Dauervertrieb verwenden.

### Android

- Erwartete **21+ Geräte** übersteigen Googles kostenlose **20-Geräte-Limited-Distribution**. Deshalb im Grundplan **reguläre Entwicklerverifizierung / Google-Play-Registrierung mit einmalig ca. 25 USD** berücksichtigen.
- Für einen begrenzten Pilotversuch einen **geschlossenen Google-Play-Testtrack** mit expliziter Mitgliederauswahl prüfen; die Regeln und Eignung als **Dauerverteilung** separat klären. Keine dauerhaft „unsichtbare Produktions-App“ versprechen, solange die konkrete Distribution nicht bestätigt ist.
- Falls eine langfristige Store-Veröffentlichung unerwünscht ist: **verifiziert signierte private APK-Verteilung** vergleichen (2027 globale Android-Entwicklerverifizierung beachten), inklusive Updateprozess und möglicher Installationswarnungen.
- Entwickler-Signaturen und Android App Links vor Release prüfen; Google Play App Signing getrennt vom Uploadschlüssel behandeln.

Offizielle Grundlagen:
- https://developer.apple.com/support/unlisted-app-distribution/
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.android.com/developer-verification
- https://support.google.com/googleplay/android-developer/answer/9845334

## Vorgehen in abgrenzbaren Schritten

1. **Bestandscheck (noch offen)**: native Projekte, Portal-Login, Release-Prozess, Associated Domains, Android-App-Signatur, Stand der Cloudflare-Routen und Abgleich der zwei Plattformen. Alle Risiken dokumentieren.
2. **Technischer Widget-Prototyp (iOS-Code vorhanden; Gerätetest offen)**: lokaler/demonstrativer Termin- und Statusdatensatz für iOS und Android, korrekte Darstellung und Tipp auf H2O Termine; keine echten Mitgliederdaten.
3. **Geschützte Schnittstelle (noch offen)**: begrenzter Read-only-Endpunkt für eigenes Widget, Session-/Gerätebindung, Server-Autorisierung, Entzug, Datenschutz-Tests.
4. **Echte Geräteprüfung (noch offen)**: iPhone und Android mindestens je ein Testgerät; Login/Passkey, QR, Kalender-Rückmeldung, Terminwechsel, Widget-Neuladen, Offline, Sperrung/Austritt und App-Update.
5. **Geschlossene Verteilung (noch offen)**: wenige Pilotmitglieder pro Plattform, Installation/Update dokumentieren. Danach erst Entscheidungen zu Apple Unlisted und Android-Dauerverteilung.
6. **Freigabe (noch offen)**: Tests + CI + manuelle Prüfung, Datenschutzhinweise/Installationsanleitung aktualisieren und **ausdrückliche** Veröffentlichungseinwilligung.

## Akzeptanzkriterien

- Einmalige Installation von H2O genügt; Widget lässt sich ohne Zusatz-App hinzufügen.
- Ein Fingertipp öffnet die **installierte** H2O-App bei Terminen und erhält die Anmeldung soweit sicher möglich.
- Das Widget zeigt nur den **eigenen nächsten relevanten Termin** mit zutreffendem Status und korrekten Datum-/Zeitzonenwerten.
- Nach Tokenentzug / Mitgliedersperre kein weiterer autorisierter Zugriff auf persönliche Widgetdaten.
- Portal-Web-App funktioniert unverändert auf iPhone, Android und Gerätehaus-iPad; bisherige H2O-Daten bleiben erhalten.
- Erst nach realen Gerätetests und separater Freigabe in die Stores / Produktion.

**Status 31.10.2026:** iOS-WidgetKit-Prototyp mit geschützter Datenübernahme beim Öffnen der H₂O-App im **Draft-PR #238** implementiert; App-Signierung, reales iPhone, TestFlight und Veröffentlichung fehlen. Für iOS ist ein eigenständiger read-only Widget-Endpunkt zunächst **nicht** eingerichtet – es wird die bereits authentifiziert geladene Portalantwort minimal gespiegelt. Widgetdaten verfallen nach 12 Stunden. Android bleibt in der Planung.

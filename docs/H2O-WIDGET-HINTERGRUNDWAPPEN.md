# Großes Hintergrundwappen – iOS und Android

Designfreigabe vom 15.11.2026: Originalgestaltung des iPhone-Widgets mit dem
größeren, farbigen Wappen rechts im Hintergrund kombinieren. Kalender, Farben,
Rückmeldeleiste, Statuslicht und Bedienung bleiben erhalten.

## Implementierung

- iOS: `native/ios/Shared/H2OWidgetView.swift`, statisch geladenes originales
  `h2o-symbol-white-512.png` in der Hintergrundebene. Rechtsbündig, maximal
  98 % der verfügbaren Breite/Höhe, Seitenverhältnis unverändert. Die vorhandene
  Widgetkontur beschneidet das Bild.
- Android: Alle neun vom Provider verwendeten responsiven Layouts binden
  `widget_background_crest.xml` direkt hinter der Statuskante und vor den
  Inhalten ein. Das vorhandene `drawable-nodpi/widget_logo.png` wird mit
  `fitEnd` und 3 dp Innenabstand rechts unten eingepasst. Keine zusätzlichen
  Laufzeit-Bitmaps, Netzaufrufe oder Timer.
- Deckkraft auf beiden Plattformen: 25 %; kleine Widgets bzw. Systemschrift
  über Faktor 1,2: 16 %. iOS bei getönter Darstellung: 10 %.
- Ohne Termin kein Wappen. Das Hintergrundbild hat keinen eigenen
  Bedien-/Accessibility-Fokus und reserviert keinen Textplatz.
- Das separate dekorative Vordergrundwappen entfällt. Vorhandene Informations-
  und Erinnerungssymbole bleiben in ihren bisherigen zulässigen Layoutgrößen
  bestehen. Sie sind fachliche Hinweise und kein zweites Markenwappen.

Android nutzt die vorhandene ImageView-Skalierung statt neuer Bitmap-Erzeugung;
iOS verwendet die vorhandene SwiftUI-Hintergrundebene. Dadurch dürfen Details
der Randabstände zwischen Plattformen abweichen. Die ursprünglichen transparenten
Ränder des Originalassets werden beibehalten.

## Validierung

Die bestehenden nativen Layoutprüfungen rendern weiterhin die verfügbaren Größen,
lange Texte, große Systemschriften und Rückmeldezustände. Zusätzlich wird der
synthetische Referenztermin „Ausschusssitzung im GH“, 19:00, GH Wasser, Zivil,
Dabei gerendert. Android prüft die Hintergrundebene, fehlende zusätzliche
Wappenspalte sowie unveränderte Rückmeldeziele und Kalenderproportionen.

Lokaler fachlicher Testlauf:

```sh
node --test tests/android-native.test.cjs tests/h2o-apple-review.test.cjs \
  tests/portal-widget-reply.test.cjs tests/portal-widget-access.test.cjs
```

Native Builds und echte Renderings erfolgen durch die bestehenden PR-Workflows
`h2o-ios-widget.yml`, `h2o-android.yml` und `h2o-android-widget-preview.yml`.
Die Renderbilder liegen in deren Actions-Artefakten. Ein erfolgreicher Build
ersetzt keinen physischen Gerätevergleich. TestFlight-/Store-Veröffentlichung
und neue Store-Buildnummern erfolgen erst im gesonderten Veröffentlichungsablauf.

## Veröffentlichung – Build 1047

Die freigegebene Widgetdarstellung wird als nativer Build 1047 für beide
Plattformen bereitgestellt. Der einmalige Release-Workflow prüft den exakten
PR-Stand und erfolgreiche allgemeine, iOS- und Android-Prüfungen, bevor er den
bestehenden TestFlight-Upload aufruft und das signierte Android-App-Bundle erstellt.
Der Android-Store-Upload erfolgt wie bisher manuell. Der TestFlight-Updatehinweis
wird erst nach bestätigter Installierbarkeit und bekanntem Ablaufdatum freigegeben.

## Statusfarbener Wappenrand – Build 1048

Nur die zuvor weiße Umrandung folgt jetzt der bestätigten Statusfarbe des
Widgets: grün bei Dabei, gelb bei Entschuldigt, orange bei Unsicher; offen
neutral blaugrau, Informationstermine hellblau. Die Flamme, der Wassertropfen,
ihre weißen Glanzstellen und die dunkle Kontur behalten ihre Originalfarben.
Eine noch nicht bestätigte Rückmeldung färbt den Rand nicht vorzeitig um.

`scripts/build-widget-crest.py` trennt die zusammenhängende weiße Umrandung
deterministisch vom vorhandenen transparenten Original. Die beiden Ebenen
bleiben deckungsgleich; Größe und Alpha werden nicht neu skaliert. iOS färbt
die Randebene als Template, Android per ColorFilter. Die bereits vorhandene
Deckkraft wird auf die gemeinsame Hintergrundgruppe angewendet. Es gibt keine
Bildberechnung beim Aktualisieren des Widgets.

Die Android-Geräteprüfung kontrolliert die gespeicherten Originalfarben,
den unangetasteten weißen Glanz im Wassertropfen und den Randfarbwechsel beim
Aktualisieren einer bestehenden Ansicht. Beide nativen Bildprüfungen rendern
die vorhandenen Größen und Statusfälle. Build 1048 ist für die nächste
Veröffentlichung vorbereitet; der Release-Auslöser läuft erst beim Merge.

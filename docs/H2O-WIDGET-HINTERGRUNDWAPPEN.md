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

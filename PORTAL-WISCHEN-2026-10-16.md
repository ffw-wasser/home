# Schnellere Menünavigation – Version 2026.10.16.29

Anlass: Auf dem iPhone wirkte das Wischen träge und wechselte gelegentlich in die unerwartete Richtung.

- Wechsel ab 48 Pixeln statt 70 Pixeln, bereits während der Bewegung statt erst beim Loslassen.
- Die erste deutlich horizontale Bewegung legt die Richtung fest. Gegenbewegungen lösen keinen umgekehrten Wechsel aus. Pro Berührung höchstens eine Seite; an den Enden kein Umlauf.
- Nach links: nächster Menüpunkt rechts in der Navigation. Nach rechts: vorheriger Menüpunkt links.
- Leicht diagonale horizontale Bewegungen werden zugelassen. Eindeutig senkrechter Beginn bleibt Scrollen. Eingabefelder, Textauswahl, horizontale Scroller und Mehrfingerbedienung bleiben ausgenommen.
- Wischen über Schaltflächen und Links ist erlaubt. Der anschließende synthetische Klick wird abgefangen, damit keine Rückmeldung, Buchung oder Kalenderaktion versehentlich ausgeführt wird. Ein neuer bewusster Tap hebt die Klicksperre sofort auf.
- 32 Pixel am Bildschirmrand bleiben für native Browsergesten frei.

490 automatisierte Tests bestanden. Neue Regression prüft sofortigen Wechsel vor Loslassen, Richtungsumkehr, höchstens einen Wechsel und Klickunterdrückung. Browserprüfung mit Touch-Eingaben: kurzer leicht diagonaler Wisch direkt über dem Datumsbutton, anschließende Gegenbewegung und Loslassen; keine Kalenderaktion und keine Rückmeldungsänderung. Syntaxprüfung bestanden. Anleitung und Cacheversion aktualisiert. Kein Worker-Code und keine Datenmigration geändert.

Ein physisches iPhone steht hier nicht zur Verfügung. Native Safari-Randgesten können nicht durch Browseremulation abschließend überprüft werden. Menüschaltflächen bleiben jederzeit als Alternative verfügbar.

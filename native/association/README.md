# Archivierte Domain-Verknüpfung

Die native App-Veröffentlichung ist eingestellt. Die bisherige Apple-Zuordnung ist zurückgenommen: Die öffentlich ausgelieferte Datei enthält leere `applinks`- und `webcredentials`-Listen. Den Generator nicht für eine neue Veröffentlichung verwenden; der aktive Zugang ist das Webportal.

# Domain-Verknüpfung

`node scripts/prepare-native-association.cjs` erzeugt aus echten Team-/Zertifikatskennungen
AASA, Digital Asset Links und die explizite Android-Origin-Konfiguration.
Die Ausgaben liegen im ignorierten Ordner `generated/` und werden nicht automatisch veröffentlicht.
Anleitung und Prüfbedingungen: [../README.md](../README.md).

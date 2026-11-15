# Kalenderauswahl – Version 2026.10.16.28

Das Datum einer Terminkarte ist jetzt eine Schaltfläche. Sie öffnet eine beschriftete, per Tastatur bedienbare Auswahl:

- **Tag im Kalender öffnen:** Auf iPhone/iPad wird der Apple-Kalender über `calshow:` angesprochen. Auf Android wird eine Kalender-Tagesansicht über einen VIEW-Intent angefordert, mit Google Kalender als Browser-Fallback. Am Desktop öffnet sich die Tagesansicht von Google Kalender. Die Links enthalten ausschließlich den Zeitpunkt, keine persönlichen Portalzugänge.
- **Termin übernehmen:** Eine lokal erzeugte `.ics`-Datei enthält Titel, Ort, Beginn und Ende des angezeigten Termins. Die Übernahme muss im Kalender bestätigt werden. Sie ändert keine Rückmeldung und synchronisiert spätere Terminänderungen nicht automatisch.

UTC-Zeiten vermeiden Verschiebungen bei Sommer-/Winterzeit; ganztägige Termine verwenden Berliner Kalendertage mit exklusivem Enddatum. Texte werden für iCalendar maskiert, UTF-8-Zeilen bei 75 Bytes gefaltet. Die stabile Termin-ID wird als Kalenderkennung verwendet. Keine Teilnehmernamen, Zugangsschlüssel oder Antwortstatus im Export. Keine neue Bibliothek, kein öffentlicher Export-Endpunkt und keine neue Serverberechtigung.

489 automatisierte Tests bestanden. Kalenderdatei mit dem vorhandenen iCalendar-Parser zurückgelesen; UTC-Zeiten, Textmaskierung, ganztägiger Zeitwechsel, Zeilenlänge und Plattformlinks geprüft. Browserprüfung: Datumsbutton, Dialog, Download-Inhalt, Schließen und Darstellung bei 320/390/768 Pixeln; keine Änderung der Rückmeldung. Lesbarkeitsprüfung der bestehenden 72 Ansichten ohne Kontrast- oder Überlauffehler. Versions- und Service-Worker-Kennungen aktualisiert.

## Gerätegrenzen

Der Browser kann die Übernahme in eine native Kalender-App nicht selbst bestätigen. Abhängig von iOS/Android und der installierten App wird die Datei zunächst heruntergeladen oder als Vorschau geöffnet. `calshow:` ist nicht Bestandteil der öffentlich dokumentierten Apple-URL-Scheme-Garantien; die Tagesansicht muss auf dem konkreten iPhone geprüft werden. Der Export ist kein Kalenderabonnement. Bestehende iPhone-/Android-Geräteabläufe wurden hier nur über Links und Datei-Inhalte geprüft, nicht auf einem physischen Gerät.

Android beschreibt Tagesansichten über `content://com.android.calendar/time/<ms_since_epoch>` in der [Calendar-Provider-Dokumentation](https://developer.android.com/identity/providers/calendar-provider). Das Format der Datei folgt [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545).

## Cloudflare geprüft

Am 16.10.2026 wurde im angemeldeten Cloudflare-Dashboard die automatische GitHub-Veröffentlichung bestätigt: Commit `b8449a054ac9a5dd5fcb45d8b3110564ba26e9cf` (Verbindungsverbesserung 2026.10.16.27), aktive Worker-Version `494ac2b3`, Status „Bereit“, 100 % Traffic. Das manuelle Kopieren des Bundles ist bei dieser funktionierenden Verbindung nicht erforderlich. Die Kalenderauswahl selbst ändert keinen Worker-Code und benötigt keine Datenmigration.

package de.feuerwehrwasser.h2o
import java.util.Base64

/** Decoding is bounded before allocation; callers separately verify the frame origin. */
data class PdfPayload(val name: String, val bytes: ByteArray) {
    companion object {
        const val MAX_BYTES = 10 * 1024 * 1024
        const val MAX_ENCODED = ((MAX_BYTES + 2) / 3) * 4
        fun decode(name: String, mime: String, encoded: String): PdfPayload {
            require(Regex("^[A-Za-z0-9][A-Za-z0-9._ -]{0,123}\\.[pP][dD][fF]$").matches(name)) { "Ungültiger PDF-Dateiname." }
            require(mime == "application/pdf" && encoded.length <= MAX_ENCODED) { "Nur PDFs bis 10 MB werden unterstützt." }
            val bytes = Base64.getDecoder().decode(encoded)
            require(bytes.size in 5..MAX_BYTES && bytes.copyOfRange(0,5).contentEquals("%PDF-".toByteArray(Charsets.US_ASCII))) { "Die Datei ist keine bestätigte PDF." }
            return PdfPayload(name, bytes)
        }
    }
}

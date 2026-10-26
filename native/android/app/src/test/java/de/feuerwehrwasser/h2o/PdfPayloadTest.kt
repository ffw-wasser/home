package de.feuerwehrwasser.h2o
import java.util.Base64
import org.junit.Assert.*
import org.junit.Test
class PdfPayloadTest {
    private val encoded = Base64.getEncoder().encodeToString("%PDF-1.7\nsynthetic".toByteArray())
    @Test fun acceptsOnlyNamedPdfs() { assertTrue(PdfPayload.decode("Jahresplan-2026.pdf", "application/pdf", encoded).bytes.size > 5) }
    @Test fun rejectsTraversalForeignTypesAndInvalidPayloads() {
        for (name in listOf("../secret.pdf", ".pdf", "file.html", "x/y.pdf")) assertThrows(IllegalArgumentException::class.java) { PdfPayload.decode(name, "application/pdf", encoded) }
        assertThrows(IllegalArgumentException::class.java) { PdfPayload.decode("file.pdf", "text/html", encoded) }
        assertThrows(IllegalArgumentException::class.java) { PdfPayload.decode("file.pdf", "application/pdf", "invalid!") }
        assertThrows(IllegalArgumentException::class.java) { PdfPayload.decode("file.pdf", "application/pdf", Base64.getEncoder().encodeToString("<html>".toByteArray())) }
        assertThrows(IllegalArgumentException::class.java) { PdfPayload.decode("file.pdf", "application/pdf", "A".repeat(PdfPayload.MAX_ENCODED+1)) }
    }
}

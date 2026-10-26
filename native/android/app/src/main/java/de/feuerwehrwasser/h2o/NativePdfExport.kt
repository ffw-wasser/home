package de.feuerwehrwasser.h2o

import android.app.Activity
import android.app.AlertDialog
import android.content.ClipData
import android.content.Intent
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors

class NativePdfExport(private val activity: ComponentActivity, private val current: () -> Boolean, private val epoch: () -> Int, private val notice: (String) -> Unit) {
    private val io = Executors.newSingleThreadExecutor()
    private var pending: PdfPayload? = null
    private var busy = false
    private var closed = false
    private var receiptEpoch = 0
    private fun active() = current() && epoch() == receiptEpoch
    private val save = activity.registerForActivityResult(ActivityResultContracts.CreateDocument("application/pdf")) { uri ->
        val document = pending; pending = null
        if (uri == null || document == null || !active()) { busy = false; return@registerForActivityResult }
        io.execute {
            val ok = runCatching { activity.contentResolver.openOutputStream(uri, "w")?.use { it.write(document.bytes) } ?: error("No output stream") }.isSuccess
            activity.runOnUiThread { busy = false; if (!closed) notice(if (ok) "PDF gespeichert." else "Die PDF konnte nicht gespeichert werden. Bitte erneut versuchen.") }
        }
    }
    private val share = activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { busy = false }
    init { io.execute { clean() } }
    fun receive(raw: String) {
        if (closed || busy || !current() || raw.length > PdfPayload.MAX_ENCODED + 512) return
        busy = true
        receiptEpoch = epoch()
        io.execute {
            val payload = runCatching { val value = JSONObject(raw); PdfPayload.decode(value.getString("name"), value.getString("mime"), value.getString("data")) }.getOrNull()
            activity.runOnUiThread {
                if (closed || !active()) { busy = false; return@runOnUiThread }
                if (payload == null) { busy = false; notice("Die PDF konnte nicht bestätigt werden. Bitte eine PDF bis 10 MB wählen."); return@runOnUiThread }
                pending = payload
                AlertDialog.Builder(activity).setTitle(payload.name).setItems(arrayOf("In Dateien speichern", "Teilen")) { _, which ->
                    if (!active()) { pending = null; busy = false }
                    else if (which == 0) save.launch(payload.name) else share(payload)
                }.setOnCancelListener { pending = null; busy = false }.show()
            }
        }
    }
    private fun share(document: PdfPayload) {
        pending = null
        io.execute {
            val uri = runCatching {
                clean()
                val folder = File(activity.cacheDir, "h2o-pdf-share/" + UUID.randomUUID()).apply { mkdirs() }
                val file = File(folder, document.name); file.writeBytes(document.bytes)
                FileProvider.getUriForFile(activity, activity.packageName + ".pdf-files", file)
            }.getOrNull()
            activity.runOnUiThread {
                if (closed || !active() || uri == null) { busy = false; if (!closed) notice("Die PDF konnte nicht zum Teilen vorbereitet werden."); return@runOnUiThread }
                val intent = Intent(Intent.ACTION_SEND).setType("application/pdf").putExtra(Intent.EXTRA_STREAM, uri)
                    .setClipData(ClipData.newRawUri("PDF", uri)).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                runCatching { share.launch(Intent.createChooser(intent, "PDF teilen")) }.onFailure { busy = false; notice("Keine Anwendung zum Teilen verfügbar.") }
            }
        }
    }
    private fun clean() {
        val root = File(activity.cacheDir, "h2o-pdf-share")
        root.listFiles()?.filter { it.lastModified() < System.currentTimeMillis() - 24L * 60 * 60 * 1000 }?.forEach { it.deleteRecursively() }
    }
    fun close() { closed = true; pending = null; io.shutdown() }
}

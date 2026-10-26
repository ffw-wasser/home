package de.feuerwehrwasser.h2o

import android.Manifest
import android.app.AlertDialog
import android.app.TimePickerDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.*
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import androidx.work.*
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import java.time.Duration
import java.time.ZonedDateTime
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private lateinit var status: TextView
    private val permission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { allowed ->
        if (allowed) reminderTime() else notice("Mitteilungen sind nicht freigegeben. Die App bleibt nutzbar.")
    }
    private val scanner = registerForActivityResult(ScanContract()) { result ->
        result.contents?.let { value ->
            if (PortalLinks.invitation(value)) web.loadUrl(value)
            else notice("Bitte den einmaligen Einladungs-QR der Feuerwehrverwaltung scannen.")
        }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val column = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val tools = LinearLayout(this)
        fun action(label: String, click: () -> Unit) { tools.addView(Button(this).apply { text = label; setOnClickListener { click() } }, LinearLayout.LayoutParams(0, 56.dp, 1f)) }
        action("QR scannen") { scanner.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("Persönliche H₂O-Einladung scannen").setBeepEnabled(false)) }
        action("Erinnerung") { reminders() }
        action("Hilfe") { help() }
        status = TextView(this).apply { setPadding(12.dp, 8.dp, 12.dp, 8.dp); visibility = View.GONE }
        web = WebView(this)
        column.addView(tools); column.addView(status); column.addView(web, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(column)
        ViewCompat.setOnApplyWindowInsetsListener(column) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom); insets
        }
        with(web.settings) {
            javaScriptEnabled = true; domStorageEnabled = true
            allowFileAccess = false; allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString += " H2ONative/1 Android"
            setSupportMultipleWindows(true)
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
            WebSettingsCompat.setWebAuthenticationSupport(web.settings, WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP)
        } else notice("Diese Android-WebView-Version unterstützt keine Passkeys. Bitte Android System WebView aktualisieren oder das Portal im Browser öffnen.")
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false)
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return false
                val value = request.url.toString()
                if (PortalLinks.trusted(value)) return false
                external(request.url); return true
            }
            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) { handler.cancel(); notice("Die sichere Verbindung ist fehlgeschlagen. Bitte später erneut versuchen.") }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) notice("Portal nicht erreichbar. Unter Hilfe kannst du erneut laden oder die Offline-Anleitung öffnen.")
            }
            override fun onPageFinished(view: WebView, url: String) { if (PortalLinks.trusted(url)) status.visibility = View.GONE }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: android.os.Message): Boolean {
                if (!isUserGesture) return false
                val popup = WebView(this@MainActivity)
                popup.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                        if (request.isForMainFrame) { external(request.url); popup.destroy() }; return true
                    }
                }
                (resultMsg.obj as WebView.WebViewTransport).webView = popup; resultMsg.sendToTarget(); return true
            }
            override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult): Boolean { if (!PortalLinks.trusted(url)) { result.cancel(); return true }; AlertDialog.Builder(this@MainActivity).setMessage(message).setPositiveButton("OK") { _, _ -> result.confirm() }.setOnCancelListener { result.cancel() }.show(); return true }
            override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean { if (!PortalLinks.trusted(url)) { result.cancel(); return true }; AlertDialog.Builder(this@MainActivity).setMessage(message).setPositiveButton("OK") { _, _ -> result.confirm() }.setNegativeButton("Abbrechen") { _, _ -> result.cancel() }.setOnCancelListener { result.cancel() }.show(); return true }
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) { override fun handleOnBackPressed() { if (web.canGoBack()) web.goBack() else { isEnabled = false; onBackPressedDispatcher.onBackPressed() } } })
        // A cold start always resolves a trusted page; no session tokens enter intents or logs.
        web.loadUrl(intent?.dataString?.takeIf(PortalLinks::trusted) ?: PortalLinks.HOME)
    }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); intent.dataString?.takeIf(PortalLinks::trusted)?.let(web::loadUrl) }
    private fun external(uri: Uri) {
        if (uri.scheme !in setOf("https", "mailto", "tel")) return
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }.onFailure { notice("Für diesen Link ist keine passende Anwendung verfügbar.") }
    }
    private fun reminders() {
        AlertDialog.Builder(this).setTitle("Tägliche App-Erinnerung").setMessage("Eine allgemeine Erinnerung, das Portal zu prüfen. Keine automatische Erinnerung an einzelne Termine. Android kann die Zustellung verzögern.")
            .setPositiveButton("Uhrzeit wählen") { _, _ ->
                if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) permission.launch(Manifest.permission.POST_NOTIFICATIONS) else reminderTime()
            }.setNegativeButton("Ausschalten") { _, _ -> WorkManager.getInstance(this).cancelUniqueWork("h2o-reminder"); notice("App-Erinnerung ausgeschaltet.") }.setNeutralButton("Schließen", null).show()
    }
    private fun reminderTime() {
        TimePickerDialog(this, { _, hour, minute ->
            val now = ZonedDateTime.now(); var first = now.withHour(hour).withMinute(minute).withSecond(0).withNano(0)
            if (!first.isAfter(now)) first = first.plusDays(1)
            val job = PeriodicWorkRequestBuilder<PortalReminderWorker>(1, TimeUnit.DAYS).setInitialDelay(Duration.between(now, first)).build()
            WorkManager.getInstance(this).enqueueUniquePeriodicWork("h2o-reminder", ExistingPeriodicWorkPolicy.UPDATE, job)
            notice("Tägliche App-Erinnerung eingerichtet. Die Uhrzeit ist ungefähr.")
        }, 18, 0, true).show()
    }
    private fun help() {
        AlertDialog.Builder(this).setTitle("H₂O · Hilfe").setMessage("1. Bei der Verwaltung eine persönliche Einladung holen.\n2. Oben QR scannen wählen und den QR-Code scannen.\n3. Den Passkey auf dem eigenen Handy einrichten.\n\nTermine, Status und Mein Deckel bleiben im Portal. Deine Browser-Anmeldung wird nicht automatisch übernommen. Bei Verlust hilft die Verwaltung.\n\nServer-Push ist in dieser Entwicklungsversion noch nicht eingerichtet. Die tägliche App-Erinnerung funktioniert unabhängig davon.")
            .setPositiveButton("Erneut laden") { _, _ -> web.reload() }.setNeutralButton("Im Browser") { _, _ -> external(Uri.parse(PortalLinks.HOME)) }.setNegativeButton("Schließen", null).show()
    }
    private fun notice(message: String) { if (::status.isInitialized) { status.text = message; status.visibility = View.VISIBLE } }
    override fun onDestroy() { web.destroy(); super.onDestroy() }
    private val Int.dp get() = (this * resources.displayMetrics.density).toInt()
}

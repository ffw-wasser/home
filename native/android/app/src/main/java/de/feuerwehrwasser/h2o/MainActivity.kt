package de.feuerwehrwasser.h2o

import android.Manifest
import android.app.AlertDialog
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
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import androidx.work.WorkManager
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private lateinit var errorActions: LinearLayout
    private lateinit var status: TextView
    private var pageFailed = false
    private var passkeysSupported = false
    private var navigationEpoch = 0
    private lateinit var pdfExport: NativePdfExport
    private var pdfScript = ""
    private var permissionReply: ((Boolean) -> Unit)? = null
    private val permission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { allowed ->
        permissionReply?.invoke(allowed); permissionReply = null
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val column = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        errorActions = LinearLayout(this).apply { visibility = View.GONE }
        fun recovery(label: String, click: () -> Unit) { errorActions.addView(Button(this).apply { text = label; minHeight = 48.dp; setOnClickListener { click() } }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)) }
        recovery("Erneut laden") { web.reload() }
        recovery("Im Browser öffnen") { external(Uri.parse(PortalLinks.HOME)) }
        status = TextView(this).apply { setPadding(12.dp, 8.dp, 12.dp, 8.dp); visibility = View.GONE }
        WorkManager.getInstance(this).cancelUniqueWork("h2o-reminder")
        web = WebView(this)
        pdfExport = NativePdfExport(this, { !isDestroyed && PortalLinks.trusted(web.url ?: "") }, { navigationEpoch }, ::notice)
        pdfScript = assets.open("pdf-export.js").bufferedReader().use { it.readText() }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "H2OPdf", setOf("https://ffw-wasser.github.io")) { view, message, origin, mainFrame, _ ->
                if (mainFrame && message.type == WebMessageCompat.TYPE_STRING && origin.scheme == "https" && origin.host == "ffw-wasser.github.io" && origin.port in listOf(-1,443) && PortalLinks.trusted(view.url ?: "")) message.data?.let(pdfExport::receive)
            }
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            fun trusted(view: WebView, origin: Uri, main: Boolean) = main && origin.scheme == "https" && origin.host == "ffw-wasser.github.io" && origin.port in listOf(-1, 443) && PortalLinks.trusted(view.url ?: "")
            WebViewCompat.addWebMessageListener(web, "H2OWidget", setOf("https://ffw-wasser.github.io")) { view, message, origin, main, _ ->
                if (trusted(view, origin, main) && message.type == WebMessageCompat.TYPE_STRING) message.data?.let {
                    WidgetStore.accept(this, it)
                }
            }
            WebViewCompat.addWebMessageListener(web, "H2ONotifications", setOf("https://ffw-wasser.github.io")) { view, message, origin, main, reply ->
                if (trusted(view, origin, main) && message.type == WebMessageCompat.TYPE_STRING) runCatching {
                    val raw = message.data ?: return@addWebMessageListener
                    if (raw.length > 1024) return@addWebMessageListener
                    val input = JSONObject(raw); val id = input.getString("id"); val action = input.getString("action")
                    if (!id.matches(Regex("[A-Za-z0-9-]{1,64}")) || action !in setOf("status", "request", "disable")) return@addWebMessageListener
                    val epoch = navigationEpoch
                    val done: (String) -> Unit = { value -> runOnUiThread { if (!isDestroyed && epoch == navigationEpoch && PortalLinks.trusted(web.url ?: "")) runCatching { reply.postMessage(value) } } }
                    if (action == "disable") { AndroidNotifications.disable(this); done(JSONObject().put("id", id).put("permission", "default").toString()) }
                    else if (!AndroidNotifications.configured(this)) AndroidNotifications.status(this, id, false, done)
                    else if (action == "request" && Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        if (permissionReply != null) return@addWebMessageListener
                        permissionReply = { _ -> if (epoch == navigationEpoch) AndroidNotifications.status(this, id, true, done) }
                        permission.launch(Manifest.permission.POST_NOTIFICATIONS)
                    } else AndroidNotifications.status(this, id, action == "request", done)
                }
            }
            WebViewCompat.addDocumentStartJavaScript(web, assets.open("android-entry.js").bufferedReader().use { it.readText() }, setOf("https://ffw-wasser.github.io"))
        } else notice("Bitte Android System WebView aktualisieren, damit Widget und Mitteilungen verfügbar sind.")
        column.addView(status); column.addView(errorActions); column.addView(web, LinearLayout.LayoutParams(-1, 0, 1f))
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
        passkeysSupported = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)
        if (passkeysSupported) {
            WebSettingsCompat.setWebAuthenticationSupport(web.settings, WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP)
        } else notice("Diese Android-WebView-Version unterstützt keine Passkeys. Bitte Android System WebView aktualisieren oder Benutzername und Passwort verwenden.")
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false)
        web.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) { pageFailed = false; navigationEpoch++; status.visibility = View.GONE; errorActions.visibility = View.GONE }
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return false
                val value = request.url.toString()
                if (PortalLinks.trusted(value)) return false
                if (request.hasGesture()) external(request.url); return true
            }
            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) { handler.cancel(); pageFailed = true; notice("Die sichere Verbindung ist fehlgeschlagen. Bitte später erneut versuchen."); errorActions.visibility = View.VISIBLE }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) { pageFailed = true; notice("Portal nicht erreichbar. Bitte erneut laden oder im Browser öffnen."); errorActions.visibility = View.VISIBLE }
            }
            override fun onPageFinished(view: WebView, url: String) { if (PortalLinks.trusted(url) && !pageFailed) { web.evaluateJavascript(pdfScript, null); web.evaluateJavascript(assets.open("ios-entry.js").bufferedReader().use { it.readText() }, null); if (passkeysSupported) status.visibility = View.GONE else notice("Bitte Android System WebView für Passkeys aktualisieren oder Benutzername und Passwort verwenden.") } }
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
        PortalLinks.calendarTime(uri.toString())?.let { time ->
            val date = java.time.Instant.ofEpochMilli(time).atZone(WidgetSnapshot.zone).toLocalDate()
            runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("content://com.android.calendar/time/$time"))) }
                .onFailure { external(Uri.parse("https://calendar.google.com/calendar/u/0/r/day/${date.year}/${date.monthValue}/${date.dayOfMonth}")) }
            return
        }
        if (uri.scheme !in setOf("https", "mailto", "tel")) return
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }.onFailure { notice("Für diesen Link ist keine passende Anwendung verfügbar.") }
    }
    private fun notice(message: String) { if (::status.isInitialized) { status.text = message; status.visibility = View.VISIBLE } }
    override fun onDestroy() { pdfExport.close(); web.destroy(); super.onDestroy() }
    private val Int.dp get() = (this * resources.displayMetrics.density).toInt()
}

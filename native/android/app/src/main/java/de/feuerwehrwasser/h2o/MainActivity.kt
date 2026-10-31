package de.feuerwehrwasser.h2o

import android.Manifest
import android.app.AlertDialog
import android.app.NotificationManager
import android.content.Context
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
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import androidx.work.WorkManager
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    companion object { const val OPEN_TERMS = "de.feuerwehrwasser.h2o.OPEN_TERMS" }
    private lateinit var web: WebView
    private lateinit var status: TextView
    private lateinit var errorBar: LinearLayout
    private var pageFailed = false
    private var navigationEpoch = 0
    private lateinit var pdfExport: NativePdfExport
    private var pdfScript = ""
    private var entryScript = ""
    private data class Pending(val id: String, val epoch: Int)
    private var waiting: Pending? = null
    private val pushPrefs get() = getSharedPreferences("h2o.push", Context.MODE_PRIVATE)
    private val permission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { allowed ->
        val job = waiting; waiting = null
        if (job != null) { if (allowed) registerPush(job) else respond(job, "denied") }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WorkManager.getInstance(this).cancelUniqueWork("h2o-reminder")
        WidgetStore.clear(this)
        val column = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        errorBar = LinearLayout(this).apply { visibility = View.GONE; gravity = android.view.Gravity.CENTER_VERTICAL }
        status = TextView(this).apply { setPadding(12.dp, 8.dp, 8.dp, 8.dp) }
        errorBar.addView(status, LinearLayout.LayoutParams(0, -2, 1f))
        web = WebView(this)
        errorBar.addView(Button(this).apply { text = "Erneut laden"; setOnClickListener { web.reload() } })
        pdfExport = NativePdfExport(this, { !isDestroyed && PortalLinks.trusted(web.url ?: "") }, { navigationEpoch }, ::notice)
        pdfScript = assets.open("pdf-export.js").bufferedReader().use { it.readText() }
        entryScript = assets.open("ios-entry.js").bufferedReader().use { it.readText() }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            for (name in listOf("H2OPdf", "H2OWidget", "H2ONotifications")) {
                WebViewCompat.addWebMessageListener(web, name, setOf("https://ffw-wasser.github.io")) { view, message, origin, mainFrame, _ ->
                    if (mainFrame && message.type == WebMessageCompat.TYPE_STRING && origin.scheme == "https" && origin.host == "ffw-wasser.github.io" && origin.port in listOf(-1, 443) && PortalLinks.trusted(view.url ?: "")) {
                        message.data?.let { value -> when (name) {
                            "H2OPdf" -> pdfExport.receive(value)
                            "H2OWidget" -> WidgetStore.accept(this, value)
                            "H2ONotifications" -> notificationRequest(value)
                        } }
                    }
                }
            }
        } else notice("Bitte Android System WebView aktualisieren, um Widget und Mitteilungen zu verbinden.")
        column.addView(errorBar); column.addView(web, LinearLayout.LayoutParams(-1, 0, 1f)); setContentView(column)
        ViewCompat.setOnApplyWindowInsetsListener(column) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom); insets
        }
        with(web.settings) {
            javaScriptEnabled = true; domStorageEnabled = true
            allowFileAccess = false; allowContentAccess = false; mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString += " H2ONative/1 Android"; setSupportMultipleWindows(true)
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) WebSettingsCompat.setWebAuthenticationSupport(web.settings, WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false)
        web.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) { pageFailed = false; navigationEpoch++ }
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return false
                if (PortalLinks.trusted(request.url.toString())) return false
                if (request.hasGesture()) external(request.url); return true
            }
            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) { handler.cancel(); pageFailed = true; notice("Die sichere Verbindung ist fehlgeschlagen. Bitte später erneut versuchen.") }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) { if (request.isForMainFrame) { pageFailed = true; notice("Portal nicht erreichbar. Bitte die Internetverbindung prüfen.") } }
            override fun onPageFinished(view: WebView, url: String) { if (PortalLinks.trusted(url) && !pageFailed) { web.evaluateJavascript(pdfScript, null); web.evaluateJavascript(entryScript, null); errorBar.visibility = View.GONE } }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: android.os.Message): Boolean {
                if (!isUserGesture) return false
                val popup = WebView(this@MainActivity)
                popup.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean { if (request.isForMainFrame) { external(request.url); popup.destroy() }; return true }
                }
                (resultMsg.obj as WebView.WebViewTransport).webView = popup; resultMsg.sendToTarget(); return true
            }
            override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult): Boolean { if (!PortalLinks.trusted(url)) { result.cancel(); return true }; AlertDialog.Builder(this@MainActivity).setMessage(message).setPositiveButton("OK") { _, _ -> result.confirm() }.setOnCancelListener { result.cancel() }.show(); return true }
            override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean { if (!PortalLinks.trusted(url)) { result.cancel(); return true }; AlertDialog.Builder(this@MainActivity).setMessage(message).setPositiveButton("OK") { _, _ -> result.confirm() }.setNegativeButton("Abbrechen") { _, _ -> result.cancel() }.setOnCancelListener { result.cancel() }.show(); return true }
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) { override fun handleOnBackPressed() { if (web.canGoBack()) web.goBack() else { isEnabled = false; onBackPressedDispatcher.onBackPressed() } } })
        openIntent(intent)
    }
    private fun openIntent(value: Intent?) {
        if (value?.action == OPEN_TERMS || PortalLinks.widgetLink(value?.dataString ?: "")) {
            if (PortalLinks.trusted(web.url ?: "") && web.progress >= 100) web.evaluateJavascript("window.DeckelMobile?.jump('portal-section')", null)
            else web.loadUrl(PortalLinks.HOME + "?nativePage=terms")
        } else {
            val address = value?.dataString?.takeIf { PortalLinks.trusted(it) && (!Uri.parse(it).fragment.orEmpty().startsWith("setup=") || PortalLinks.setupLink(it)) }
            web.loadUrl(address ?: PortalLinks.HOME)
        }
    }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); openIntent(intent) }
    private fun external(uri: Uri) {
        if (uri.scheme !in setOf("https", "mailto", "tel") && !PortalLinks.calendarSubscription(uri.toString())) return
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }.onFailure { notice("Für diesen Link ist keine passende Anwendung verfügbar.") }
    }
    private fun notificationRequest(raw: String) {
        if (raw.length > 1000) return
        runCatching {
            val value = JSONObject(raw); val id = value.getString("id"); val action = value.getString("action")
            if (!Regex("[a-f0-9-]{36}").matches(id)) return
            val job = Pending(id, navigationEpoch)
            if (action == "disable") {
                pushPrefs.edit().putBoolean("optIn", false).apply(); getSystemService(NotificationManager::class.java).cancelAll()
                if (FirebaseSetup.initialize(this)) { val messaging = FirebaseMessaging.getInstance(); messaging.isAutoInitEnabled = false; messaging.deleteToken() }
                respond(job, "disabled"); return
            }
            if (action !in setOf("status", "request")) return
            if (!FirebaseSetup.initialize(this)) { respond(job, "unavailable"); return }
            val permitted = Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            if (action == "request" && !permitted) { if (waiting == null) { waiting = job; pushPrefs.edit().putBoolean("asked", true).apply(); permission.launch(Manifest.permission.POST_NOTIFICATIONS) }; return }
            if (!permitted || !NotificationManagerCompat.from(this).areNotificationsEnabled()) { respond(job, if (pushPrefs.getBoolean("asked", false)) "denied" else "default"); return }
            if (action == "request" || pushPrefs.getBoolean("optIn", false)) registerPush(job) else respond(job, "default")
        }
    }
    private fun registerPush(job: Pending) {
        val messaging = FirebaseMessaging.getInstance(); messaging.isAutoInitEnabled = true
        messaging.token.addOnCompleteListener { result ->
            if (result.isSuccessful && !result.result.isNullOrBlank()) { pushPrefs.edit().putBoolean("optIn", true).apply(); respond(job, "granted", result.result) }
            else respond(job, "unavailable")
        }
    }
    private fun respond(job: Pending, permission: String, token: String? = null) {
        if (isDestroyed || job.epoch != navigationEpoch || !PortalLinks.trusted(web.url ?: "")) return
        val value = JSONObject().put("id", job.id).put("permission", permission); if (token != null) value.put("deviceToken", token)
        web.evaluateJavascript("window.dispatchEvent(new CustomEvent('h2o-native-notifications',{detail:$value}))", null)
    }
    private fun notice(message: String) { if (::status.isInitialized) { status.text = message; errorBar.visibility = View.VISIBLE } }
    override fun onResume() { super.onResume(); if (::web.isInitialized) { web.onResume(); if (PortalLinks.trusted(web.url ?: "")) web.evaluateJavascript("document.dispatchEvent(new Event('visibilitychange'))", null) } }
    override fun onPause() { if (::web.isInitialized) web.onPause(); super.onPause() }
    override fun onDestroy() { if (::pdfExport.isInitialized) pdfExport.close(); if (::web.isInitialized) web.destroy(); waiting = null; super.onDestroy() }
    private val Int.dp get() = (this * resources.displayMetrics.density).toInt()
}

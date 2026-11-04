package de.feuerwehrwasser.h2o

import android.app.Activity
import android.content.Context
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.lifecycle.Lifecycle
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability

// Play owns package delivery. No APK downloads, WebView bridge or member credentials.
internal class PlayAppUpdates(
    private val activity: ComponentActivity,
    parent: LinearLayout,
    private val manager: AppUpdateManager = AppUpdateManagerFactory.create(activity)
) {
    private val preferences = activity.getSharedPreferences("h2o-app-updates", Context.MODE_PRIVATE)
    private var closed = false
    private var querying = false
    private var flowOpen = false
    private var version = 0
    private var action: (() -> Unit)? = null
    internal val banner = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(12.dp, 6.dp, 12.dp, 6.dp)
        setBackgroundColor(0xFFEAF3FA.toInt())
        visibility = View.GONE
    }
    internal val label = TextView(activity).apply {
        textSize = 14f
        setTextColor(0xFF10263A.toInt())
        accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
    }
    internal val update = Button(activity).apply { textSize = 14f; minHeight = 48.dp }
    internal val later = Button(activity).apply { text = "Später"; textSize = 14f; minHeight = 48.dp }
    private val listener = InstallStateUpdatedListener { state ->
        if (active()) when (state.installStatus()) {
            InstallStatus.DOWNLOADED -> ready()
            InstallStatus.PENDING, InstallStatus.DOWNLOADING -> show("App-Update wird heruntergeladen …", "Lädt …")
            InstallStatus.INSTALLING -> show("App-Update wird installiert …", "Installiert …")
            InstallStatus.FAILED -> show("App-Update fehlgeschlagen. Bitte erneut versuchen.", "Erneut versuchen", ::requestUpdate)
            InstallStatus.CANCELED -> defer()
            InstallStatus.INSTALLED -> banner.visibility = View.GONE
        }
    }

    init {
        val buttons = LinearLayout(activity).apply { orientation = LinearLayout.HORIZONTAL }
        buttons.addView(update, LinearLayout.LayoutParams(0, -2, 1f))
        buttons.addView(later, LinearLayout.LayoutParams(0, -2, 1f))
        banner.addView(label); banner.addView(buttons)
        parent.addView(banner, 0)
        update.setOnClickListener { if (foreground() && !flowOpen && !querying) action?.invoke() }
        later.setOnClickListener { defer() }
        manager.registerListener(listener)
    }

    fun onResume() {
        if (!active() || querying || flowOpen) return
        querying = true
        manager.appUpdateInfo.addOnSuccessListener { info ->
            if (active()) render(info)
        }.addOnFailureListener {
            // Offline, sideloads and unavailable Play services must not block H₂O.
        }.addOnCompleteListener { querying = false }
    }

    private fun render(info: AppUpdateInfo) {
        version = info.availableVersionCode()
        if (deferred()) { banner.visibility = View.GONE; return }
        when (info.installStatus()) {
            InstallStatus.DOWNLOADED -> ready()
            InstallStatus.PENDING, InstallStatus.DOWNLOADING -> show("App-Update wird heruntergeladen …", "Lädt …")
            InstallStatus.INSTALLING -> show("App-Update wird installiert …", "Installiert …")
            else -> if (available(info)) show("App-Update verfügbar", "Aktualisieren", ::requestUpdate)
                else banner.visibility = View.GONE
        }
    }

    private fun available(info: AppUpdateInfo) = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE &&
        info.availableVersionCode() > BuildConfig.VERSION_CODE && info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)

    private fun requestUpdate() {
        if (!foreground()) return
        querying = true; update.isEnabled = false
        // Each AppUpdateInfo can start a flow only once, so retries always request a fresh one.
        manager.appUpdateInfo.addOnSuccessListener { info ->
            querying = false
            if (!foreground()) return@addOnSuccessListener
            version = info.availableVersionCode()
            if (!available(info)) { render(info); return@addOnSuccessListener }
            flowOpen = true
            preferences.edit().remove("deferredVersion").remove("deferredUntil").apply()
            manager.startUpdateFlow(info, activity, AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build())
                .addOnSuccessListener { result ->
                    flowOpen = false
                    if (active()) {
                        if (result == Activity.RESULT_OK) onResume() else defer()
                    }
                }.addOnFailureListener {
                    flowOpen = false
                    if (active()) show("App-Update konnte nicht gestartet werden.", "Erneut versuchen", ::requestUpdate)
                }
        }.addOnFailureListener {
            querying = false
            if (active()) show("Google Play derzeit nicht erreichbar.", "Erneut versuchen", ::requestUpdate)
        }
    }

    private fun ready() {
        if (!deferred()) show("App-Update bereit · Eingaben vor dem Neustart speichern.", "Jetzt neu starten") {
            if (foreground()) {
                show("App-Update wird installiert …", "Installiert …")
                manager.completeUpdate().addOnFailureListener {
                    if (active()) ready()
                }
            }
        }
    }

    private fun show(message: String, button: String, click: (() -> Unit)? = null) {
        if (deferred()) return
        label.text = message; update.text = button; action = click
        update.isEnabled = click != null
        banner.visibility = View.VISIBLE
    }

    private fun deferred() = preferences.getInt("deferredVersion", -1) == version &&
        System.currentTimeMillis() < preferences.getLong("deferredUntil", 0)

    private fun defer() {
        preferences.edit().putInt("deferredVersion", version)
            .putLong("deferredUntil", System.currentTimeMillis() + 24 * 60 * 60 * 1000L).apply()
        banner.visibility = View.GONE
    }

    private fun active() = !closed && !activity.isFinishing && !activity.isDestroyed
    private fun foreground() = active() && activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
    fun close() { closed = true; action = null; manager.unregisterListener(listener) }
    private val Int.dp get() = (this * activity.resources.displayMetrics.density).toInt()
}

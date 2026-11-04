package de.feuerwehrwasser.h2o

import android.content.Context
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.model.UpdateAvailability
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

// Store-confirmed package availability, kept separate from appointments and reply grants.
internal object WidgetAppUpdate {
    private fun prefs(context: Context) = context.getSharedPreferences("h2o-app-updates", Context.MODE_PRIVATE)
    fun record(context: Context, info: AppUpdateInfo) {
        val version = if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE) info.availableVersionCode() else 0
        prefs(context).edit().putInt("widgetVersion", version).putLong("widgetCheckedAt", System.currentTimeMillis()).apply()
    }
    fun available(context: Context, now: Long = System.currentTimeMillis()): Boolean {
        val preferences = prefs(context)
        val age = now - preferences.getLong("widgetCheckedAt", 0)
        return age in 0 until 24 * 3600000L && preferences.getInt("widgetVersion", 0) > BuildConfig.VERSION_CODE
    }
    suspend fun refresh(context: Context) {
        val age = System.currentTimeMillis() - prefs(context).getLong("widgetCheckedAt", 0)
        if (age in 0 until 3600000L) return
        withTimeoutOrNull(5000) {
            suspendCancellableCoroutine<Unit> { continuation ->
                AppUpdateManagerFactory.create(context).appUpdateInfo.addOnSuccessListener {
                    if (continuation.isActive) { record(context, it); continuation.resume(Unit) }
                }.addOnFailureListener { if (continuation.isActive) continuation.resume(Unit) }
            }
        }
    }
}

package de.feuerwehrwasser.h2o

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject

object AndroidNotifications {
    private fun prefs(context: Context) = context.getSharedPreferences("h2o-notifications", Context.MODE_PRIVATE)
    fun allowed(context: Context) = (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) && context.getSystemService(NotificationManager::class.java).areNotificationsEnabled()
    fun configured(context: Context): Boolean {
        if (BuildConfig.H2O_FIREBASE_APP_ID.isEmpty() || BuildConfig.H2O_FIREBASE_API_KEY.isEmpty() || BuildConfig.H2O_FIREBASE_PROJECT_ID.isEmpty() || BuildConfig.H2O_FIREBASE_SENDER_ID.isEmpty()) return false
        return runCatching {
            if (FirebaseApp.getApps(context).isEmpty()) FirebaseApp.initializeApp(context, FirebaseOptions.Builder()
                .setApplicationId(BuildConfig.H2O_FIREBASE_APP_ID).setApiKey(BuildConfig.H2O_FIREBASE_API_KEY)
                .setProjectId(BuildConfig.H2O_FIREBASE_PROJECT_ID).setGcmSenderId(BuildConfig.H2O_FIREBASE_SENDER_ID).build())
            true
        }.getOrDefault(false)
    }
    fun disable(context: Context) { prefs(context).edit().putBoolean("enabled", false).apply(); context.getSystemService(NotificationManager::class.java).cancel(42) }
    fun status(context: Context, id: String, request: Boolean, done: (String) -> Unit) {
        fun reply(token: String? = null, error: String? = null) {
            val value = JSONObject().put("id", id).put("permission", if (allowed(context)) "granted" else if (prefs(context).getBoolean("asked", false)) "denied" else "default")
            if (token != null) value.put("deviceToken", token)
            if (error != null) value.put("error", error)
            done(value.toString())
        }
        if (!configured(context)) { reply(error = "Android-Mitteilungen sind noch nicht eingerichtet."); return }
        if (request) prefs(context).edit().putBoolean("asked", true).apply()
        if (!allowed(context)) { reply(); return }
        if (!request && !prefs(context).getBoolean("enabled", false)) { reply(); return }
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                if (request) prefs(context).edit().putBoolean("enabled", true).apply()
                reply(token = task.result)
            } else reply(error = "Android konnte sich noch nicht für Mitteilungen registrieren.")
        }
    }
    fun show(context: Context) {
        if (!prefs(context).getBoolean("enabled", false) || !allowed(context)) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("portal-reminders", "Feuerwehr-Mitteilungen", NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(context, 43, Intent(context, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, "portal-reminders").setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("H₂O · Feuerwehr Wasser").setContentText("Eine Mitteilung liegt vor. Bitte H₂O öffnen.")
            .setContentIntent(open).setAutoCancel(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build()
        manager.notify(42, notification)
    }
}
class PortalMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        if (message.data["type"] == "portal-reminder") AndroidNotifications.show(this)
    }
}

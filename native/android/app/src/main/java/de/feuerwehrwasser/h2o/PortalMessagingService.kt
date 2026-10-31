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
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class PortalMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        if (message.data["kind"] != "portal-reminder" || !getSharedPreferences("h2o.push", Context.MODE_PRIVATE).getBoolean("optIn", false)) return
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("h2o-portal", "Feuerwehr-Mitteilungen", NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(this, 80, Intent(this, MainActivity::class.java).setAction(MainActivity.OPEN_TERMS).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        manager.notify(80, NotificationCompat.Builder(this, "h2o-portal").setSmallIcon(R.drawable.ic_h2o_notification)
            .setContentTitle("H₂O · Feuerwehr Wasser").setContentText("Eine Mitteilung liegt vor. Bitte H₂O öffnen.")
            .setContentIntent(open).setAutoCancel(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build())
    }
}

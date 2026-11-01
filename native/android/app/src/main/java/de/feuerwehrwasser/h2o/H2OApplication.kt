package de.feuerwehrwasser.h2o

import android.app.Application

class H2OApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Background FCM services also need the default app. Token auto-init stays disabled.
        AndroidNotifications.configured(this)
    }
}

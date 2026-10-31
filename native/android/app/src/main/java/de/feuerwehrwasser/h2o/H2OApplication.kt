package de.feuerwehrwasser.h2o

import android.app.Application
import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions

class H2OApplication : Application() {
    override fun onCreate() { super.onCreate(); FirebaseSetup.initialize(this) }
}
object FirebaseSetup {
    fun configured(): Boolean = listOf(BuildConfig.H2O_FIREBASE_PROJECT_ID, BuildConfig.H2O_FIREBASE_APP_ID, BuildConfig.H2O_FIREBASE_SENDER_ID, BuildConfig.H2O_FIREBASE_API_KEY).all { it.isNotBlank() }
    fun initialize(context: Context): Boolean {
        if (!configured()) return false
        return runCatching {
            if (FirebaseApp.getApps(context).isEmpty()) FirebaseApp.initializeApp(context, FirebaseOptions.Builder()
                .setProjectId(BuildConfig.H2O_FIREBASE_PROJECT_ID).setApplicationId(BuildConfig.H2O_FIREBASE_APP_ID)
                .setGcmSenderId(BuildConfig.H2O_FIREBASE_SENDER_ID).setApiKey(BuildConfig.H2O_FIREBASE_API_KEY).build())
            true
        }.getOrDefault(false)
    }
}

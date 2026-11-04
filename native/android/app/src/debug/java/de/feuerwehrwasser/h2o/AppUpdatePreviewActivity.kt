package de.feuerwehrwasser.h2o

import android.content.Context
import android.os.Bundle
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import com.google.android.play.core.appupdate.testing.FakeAppUpdateManager
import com.google.android.play.core.install.model.InstallErrorCode

// Synthetic Play service only. No portal session, WebView or real store operations.
class AppUpdatePreviewActivity : ComponentActivity() {
    lateinit var manager: FakeAppUpdateManager
    internal lateinit var updates: PlayAppUpdates
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        getSharedPreferences("h2o-app-updates", Context.MODE_PRIVATE).edit().clear().commit()
        manager = FakeAppUpdateManager(this)
        when (intent.getStringExtra("fixture")) {
            "unavailable" -> manager.setInstallErrorCode(InstallErrorCode.ERROR_API_NOT_AVAILABLE)
            "current" -> manager.setUpdateNotAvailable()
            else -> manager.setUpdateAvailable(BuildConfig.VERSION_CODE + 1)
        }
        val column = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        updates = PlayAppUpdates(this, column, manager)
        column.addView(TextView(this).apply { text = "H₂O Portal · Beispieldaten"; textSize = 20f })
        setContentView(column)
    }
    override fun onResume() { super.onResume(); updates.onResume() }
    override fun onDestroy() { updates.close(); super.onDestroy() }
}

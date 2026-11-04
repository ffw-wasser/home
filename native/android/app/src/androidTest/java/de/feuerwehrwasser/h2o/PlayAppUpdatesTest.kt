package de.feuerwehrwasser.h2o

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.After
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class PlayAppUpdatesTest {
    @After fun clearUpdateFixture() {
        instrumentation.targetContext.getSharedPreferences("h2o-app-updates", android.content.Context.MODE_PRIVATE).edit().clear().commit()
    }
    @Test fun widgetUpdateNoticeKeepsReplyAndErrorPriority() {
        val context = instrumentation.targetContext
        val preferences = context.getSharedPreferences("h2o-app-updates", android.content.Context.MODE_PRIVATE)
        preferences.edit().putInt("widgetVersion", BuildConfig.VERSION_CODE + 1).putLong("widgetCheckedAt", System.currentTimeMillis()).commit()
        for ((fixture, expected) in listOf("sketch-reference" to "App-Update verfügbar", "open" to "Rückmeldung offen", "retry" to "Nicht bestätigt")) {
            val intent = Intent(context, WidgetPreviewActivity::class.java).putExtra("width", 330).putExtra("height", 230).putExtra("fixture", fixture)
            ActivityScenario.launch<WidgetPreviewActivity>(intent).use { scenario ->
                instrumentation.waitForIdleSync()
                scenario.onActivity {
                    assertEquals(expected, it.findViewById<android.widget.TextView>(R.id.widget_status).text.toString())
                    if (fixture == "sketch-reference") {
                        val folder = File(it.getExternalFilesDir(null), "widget-previews").apply { mkdirs() }
                        val view = it.window.decorView
                        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
                        view.draw(Canvas(bitmap))
                        File(folder, "android-widget-app-update.png").outputStream().use { output -> bitmap.compress(Bitmap.CompressFormat.PNG, 100, output) }
                    }
                }
            }
        }
        assertFalse(WidgetAppUpdate.available(context, System.currentTimeMillis() + 25 * 3600000L))
        preferences.edit().putInt("widgetVersion", BuildConfig.VERSION_CODE).commit()
        assertFalse(WidgetAppUpdate.available(context))
    }
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private fun open(fixture: String = "available") = ActivityScenario.launch<AppUpdatePreviewActivity>(
        Intent(instrumentation.targetContext, AppUpdatePreviewActivity::class.java).putExtra("fixture", fixture))

    @Test fun consentAndRestartAreSeparateExplicitActions() {
        open().use { scenario ->
            instrumentation.waitForIdleSync()
            scenario.onActivity { activity ->
                assertEquals(View.VISIBLE, activity.updates.banner.visibility)
                assertTrue("Widget receives the store-confirmed update", WidgetAppUpdate.available(activity))
                assertFalse("Opening H₂O never launches a store dialog", activity.manager.isConfirmationDialogVisible)
                activity.updates.update.performClick()
            }
            instrumentation.waitForIdleSync()
            scenario.onActivity { activity ->
                assertTrue("An explicit tap opens Play's flexible update consent", activity.manager.isConfirmationDialogVisible)
                assertFalse(activity.manager.isImmediateFlowVisible)
                activity.manager.userAcceptsUpdate()
                activity.manager.downloadStarts()
                activity.manager.downloadCompletes()
            }
            instrumentation.waitForIdleSync()
            scenario.onActivity { activity ->
                assertEquals("Jetzt neu starten", activity.updates.update.text.toString())
                assertFalse("Download completion never restarts H₂O automatically", activity.manager.isInstallSplashScreenVisible)
                val folder = File(activity.getExternalFilesDir(null), "widget-previews").apply { mkdirs() }
                val view = activity.window.decorView
                val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
                view.draw(Canvas(bitmap))
                File(folder, "android-update-ready.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            }
            scenario.moveToState(Lifecycle.State.CREATED).moveToState(Lifecycle.State.RESUMED)
            instrumentation.waitForIdleSync()
            scenario.onActivity { activity ->
                assertEquals("Downloaded updates are recovered when returning to H₂O", "Jetzt neu starten", activity.updates.update.text.toString())
                activity.updates.update.performClick()
            }
            instrumentation.waitForIdleSync()
            scenario.onActivity { assertTrue("Restart requires an explicit tap", it.manager.isInstallSplashScreenVisible) }
        }
    }

    @Test fun laterDoesNotPromptAgainOnResume() {
        open().use { scenario ->
            instrumentation.waitForIdleSync()
            scenario.onActivity { it.updates.later.performClick() }
            scenario.moveToState(Lifecycle.State.CREATED).moveToState(Lifecycle.State.RESUMED)
            instrumentation.waitForIdleSync()
            scenario.onActivity {
                assertEquals(View.GONE, it.updates.banner.visibility)
                assertTrue("Postponing the app banner preserves the widget notice", WidgetAppUpdate.available(it))
                assertFalse(it.manager.isConfirmationDialogVisible)
            }
        }
    }

    @Test fun noUpdateAndUnavailablePlayLeaveThePortalUnblocked() {
        for (fixture in listOf("current", "unavailable")) open(fixture).use { scenario ->
            instrumentation.waitForIdleSync()
            scenario.onActivity {
                assertEquals(View.GONE, it.updates.banner.visibility)
                assertFalse("No available build means no widget notice", WidgetAppUpdate.available(it))
                assertFalse(it.manager.isConfirmationDialogVisible)
                assertFalse(it.manager.isInstallSplashScreenVisible)
            }
        }
    }
}

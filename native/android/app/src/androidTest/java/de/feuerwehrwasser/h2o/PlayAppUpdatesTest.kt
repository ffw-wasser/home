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
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class PlayAppUpdatesTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private fun open(fixture: String = "available") = ActivityScenario.launch<AppUpdatePreviewActivity>(
        Intent(instrumentation.targetContext, AppUpdatePreviewActivity::class.java).putExtra("fixture", fixture))

    @Test fun consentAndRestartAreSeparateExplicitActions() {
        open().use { scenario ->
            instrumentation.waitForIdleSync()
            scenario.onActivity { activity ->
                assertEquals(View.VISIBLE, activity.updates.banner.visibility)
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
                assertFalse(it.manager.isConfirmationDialogVisible)
            }
        }
    }

    @Test fun noUpdateAndUnavailablePlayLeaveThePortalUnblocked() {
        for (fixture in listOf("current", "unavailable")) open(fixture).use { scenario ->
            instrumentation.waitForIdleSync()
            scenario.onActivity {
                assertEquals(View.GONE, it.updates.banner.visibility)
                assertFalse(it.manager.isConfirmationDialogVisible)
                assertFalse(it.manager.isInstallSplashScreenVisible)
            }
        }
    }
}

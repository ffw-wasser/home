package de.feuerwehrwasser.h2o
import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters
/** Compatibility tombstone for previously scheduled daily reminders. */
class PortalReminderWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result = Result.success()
}

package io.github.matie.wereadhighlights

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.PeriodicWorkRequest
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.util.concurrent.TimeUnit

class RefreshWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        if (QuoteStore.apiKey(applicationContext) == null) {
            QuoteWidgetProvider.renderAll(applicationContext)
            return Result.success()
        }
        return try {
            QuoteApi.fetch(applicationContext, force = inputData.getBoolean("force", false))
            QuoteWidgetProvider.renderAll(applicationContext)
            Result.success()
        } catch (e: Exception) {
            QuoteStore.saveError(applicationContext, e.message ?: "刷新失败")
            // Keep showing the previous quote on network/API failures.
            QuoteWidgetProvider.renderAll(applicationContext)
            Result.retry()
        }
    }

    companion object {
        private const val PERIODIC = "weread-periodic"
        private const val ONCE = "weread-once"
        private fun constraints() =
            Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        fun schedule(context: Context) {
            val periodic = PeriodicWorkRequest.Builder(
                RefreshWorker::class.java, 4, TimeUnit.HOURS
            ).setConstraints(constraints()).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC, ExistingPeriodicWorkPolicy.KEEP, periodic
            )
        }

        fun refreshNow(context: Context, force: Boolean = false) {
            val oneTime = OneTimeWorkRequest.Builder(RefreshWorker::class.java)
                .setConstraints(constraints())
                .setInputData(workDataOf("force" to force))
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                ONCE, ExistingWorkPolicy.REPLACE, oneTime
            )
        }
    }
}

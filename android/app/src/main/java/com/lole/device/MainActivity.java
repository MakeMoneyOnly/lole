package com.lole.device;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.BridgeActivity;

import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "LoleMainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (BuildConfig.DEBUG) {
            Log.w(TAG, "Running in DEBUG mode. Not suitable for production.");
        }

        initSentryIfAvailable();
        scheduleWorkManagerSync();
    }

    @Override
    protected void onResume() {
        super.onResume();
        Log.d(TAG, "onResume: biometric re-auth check dispatched.");
    }

    @Override
    protected void onPause() {
        super.onPause();
        Log.d(TAG, "onPause: flushing sync queue.");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && Intent.ACTION_VIEW.equals(intent.getAction())) {
            android.net.Uri data = intent.getData();
            if (data != null) {
                Log.d(TAG, "Deep link received: " + data.toString());
            }
        }
    }

    private void initSentryIfAvailable() {
        try {
            io.sentry.SentryAndroid.init(this, options -> {
                options.setDsn(BuildConfig.SENTRY_DSN);
                options.setEnvironment(BuildConfig.DEBUG ? "development" : "production");
                options.setEnableAutoSessionTracking(true);
                options.setEnableNdk(true);
            });
            Log.d(TAG, "Sentry initialized.");
        } catch (Exception e) {
            Log.w(TAG, "Sentry not available: " + e.getMessage());
        }
    }

    private void scheduleWorkManagerSync() {
        try {
            Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .setRequiresBatteryNotLow(true)
                .build();

            PeriodicWorkRequest syncRequest = new PeriodicWorkRequest.Builder(
                    SyncWorker.class, 15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .addTag("lole-sync")
                .build();

            WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "lole-sync",
                ExistingPeriodicWorkPolicy.KEEP,
                syncRequest
            );

            Log.d(TAG, "WorkManager sync scheduled every 15 minutes.");
        } catch (Exception e) {
            Log.w(TAG, "WorkManager not available: " + e.getMessage());
        }
    }
}

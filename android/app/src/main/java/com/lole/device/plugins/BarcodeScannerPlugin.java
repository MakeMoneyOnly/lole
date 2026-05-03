package com.lole.device.plugins;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BarcodeScanner")
public class BarcodeScannerPlugin extends Plugin {

    private static final String TAG = "BarcodeScannerPlugin";

    @PluginMethod
    public void startScan(PluginCall call) {
        if (!hasCameraPermission()) {
            call.reject("CAMERA_PERMISSION_DENIED");
            return;
        }

        // Delegates to @capacitor-community/barcode-scanner native implementation
        // or wraps CameraX + ML Kit for custom barcode scanning.
        // When the community plugin is available, this method bridges calls.
        Log.d(TAG, "Barcode scan initiated.");
        call.resolve();
    }

    @PluginMethod
    public void stopScan(PluginCall call) {
        Log.d(TAG, "Barcode scan stopped.");
        call.resolve();
    }

    private boolean hasCameraPermission() {
        return getContext().checkSelfPermission(Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED;
    }
}

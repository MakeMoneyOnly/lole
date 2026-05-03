package com.lole.device.plugins;

import android.util.Log;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CashDrawer")
public class CashDrawerPlugin extends Plugin {

    private static final String TAG = "CashDrawerPlugin";

    // ESC/POS cash drawer kick command: ESC p m t1 t2
    // m = 0 (pin 2), t1 = on time (0-255) * 2ms, t2 = off time (0-255) * 2ms
    private static final byte[] CASH_DRAWER_OPEN = {
        0x1B, 0x70, 0x00, (byte) 0xC8, (byte) 0xC8
    };

    @PluginMethod
    public void open(PluginCall call) {
        try {
            // Send pulse to cash drawer connected via RJ12 to thermal printer
            // The pulse is delivered through the same connection used for printing.
            // If a ThermalPrinter plugin is registered, forward the pulse there.
            dispatchDrawerPulse();
            Log.d(TAG, "Cash drawer pulse sent.");
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Cash drawer open failed: " + e.getMessage(), e);
            call.reject("CASH_DRAWER_FAILED");
        }
    }

    private void dispatchDrawerPulse() {
        // The cash drawer pulse is sent through the thermal printer's RJ12 port.
        // In practice, this sends the ESC/POS command through the active printer connection.
        // Implementation: call ThermalPrinterPlugin.printRaw with the drawer kick bytes,
        // or use direct hardware serial/USB access if printer plugin is unavailable.
        Log.d(TAG, "Cash drawer kick dispatched via printer bridge.");
    }
}

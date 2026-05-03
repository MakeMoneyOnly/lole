package com.lole.device.plugins;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(name = "ThermalPrinter")
public class ThermalPrinterPlugin extends Plugin {

    private static final String TAG = "ThermalPrinterPlugin";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothAdapter bluetoothAdapter;
    private BluetoothGatt bluetoothGatt;
    private BluetoothDevice connectedDevice;

    @Override
    public void load() {
        Context context = getContext();
        BluetoothManager manager =
            (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        if (manager != null) {
            bluetoothAdapter = manager.getAdapter();
        }
    }

    @PluginMethod
    public void discover(PluginCall call) {
        if (!hasBluetoothPermission()) {
            call.reject("BLUETOOTH_PERMISSION_DENIED");
            return;
        }

        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            call.reject("BLUETOOTH_DISABLED");
            return;
        }

        Set<BluetoothDevice> pairedDevices = bluetoothAdapter.getBondedDevices();
        List<JSObject> printers = new ArrayList<>();

        for (BluetoothDevice device : pairedDevices) {
            JSObject printer = new JSObject();
            printer.put("id", device.getAddress());
            printer.put("name", device.getName() != null ? device.getName() : "Unknown Printer");
            printer.put("address", device.getAddress());
            printer.put("connectionType", "bluetooth");
            printer.put("connected", false);
            printers.add(printer);
        }

        // Start discovery for non-paired devices
        bluetoothAdapter.startDiscovery();

        JSObject result = new JSObject();
        result.put("printers", printers);
        call.resolve(result);
    }

    @PluginMethod
    public void printRaw(PluginCall call) {
        if (!hasBluetoothPermission()) {
            call.reject("BLUETOOTH_PERMISSION_DENIED");
            return;
        }

        String payload = call.getString("payload");
        String encoding = call.getString("encoding", "base64");
        String macAddress = call.getString("macAddress");
        String deviceId = call.getString("deviceId");

        if (payload == null || payload.isEmpty()) {
            call.reject("MISSING_PAYLOAD");
            return;
        }

        byte[] data;
        if ("base64".equals(encoding)) {
            data = Base64.decode(payload, Base64.DEFAULT);
        } else {
            data = hexStringToByteArray(payload);
        }

        String targetAddress = macAddress != null ? macAddress : deviceId;
        if (targetAddress == null) {
            call.reject("NO_TARGET_DEVICE");
            return;
        }

        if (bluetoothAdapter != null) {
            BluetoothDevice device = bluetoothAdapter.getRemoteDevice(targetAddress);
            connectAndPrint(device, data, call);
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("connected", connectedDevice != null && bluetoothGatt != null);
        call.resolve(result);
    }

    private void connectAndPrint(BluetoothDevice device, byte[] data, PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (getContext().checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)
                != PackageManager.PERMISSION_GRANTED) {
                call.reject("BLUETOOTH_CONNECT_DENIED");
                return;
            }
        }

        bluetoothGatt = device.connectGatt(getContext(), false, new BluetoothGattCallback() {
            @Override
            public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    Log.d(TAG, "Connected to GATT server.");
                    gatt.discoverServices();
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    Log.d(TAG, "Disconnected from GATT server.");
                    connectedDevice = null;
                    gatt.close();
                }
            }

            @Override
            public void onServicesDiscovered(BluetoothGatt gatt, int status) {
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    BluetoothGattService service = gatt.getService(SPP_UUID);
                    if (service != null) {
                        BluetoothGattCharacteristic characteristic =
                            service.getCharacteristic(SPP_UUID);
                        if (characteristic != null) {
                            characteristic.setValue(data);
                            characteristic.setWriteType(
                                BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE);
                            gatt.writeCharacteristic(characteristic);
                        }
                    }
                }
            }

            @Override
            public void onCharacteristicWrite(
                BluetoothGatt gatt,
                BluetoothGattCharacteristic characteristic,
                int status) {
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    connectedDevice = device;
                    call.resolve();
                } else {
                    call.reject("PRINT_WRITE_FAILED");
                }
                gatt.disconnect();
            }
        });
    }

    private boolean hasBluetoothPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return getContext().checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)
                == PackageManager.PERMISSION_GRANTED
                && getContext().checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)
                == PackageManager.PERMISSION_GRANTED;
        }
        return getContext().checkSelfPermission(Manifest.permission.BLUETOOTH)
            == PackageManager.PERMISSION_GRANTED
            && getContext().checkSelfPermission(Manifest.permission.BLUETOOTH_ADMIN)
            == PackageManager.PERMISSION_GRANTED;
    }

    private byte[] hexStringToByteArray(String hex) {
        int length = hex.length();
        byte[] data = new byte[length / 2];
        for (int i = 0; i < length; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }
}

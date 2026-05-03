package com.lole.device.plugins;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Enumeration;

@CapacitorPlugin(name = "LanMesh")
public class LanMeshPlugin extends Plugin {

    private static final String TAG = "LanMeshPlugin";
    private static final int KDS_MESH_PORT = 9191;

    @PluginMethod
    public void broadcastKdsUpdate(PluginCall call) {
        try {
            String payload = call.getString("payload");
            if (payload == null) {
                call.reject("MISSING_PAYLOAD");
                return;
            }

            byte[] data = payload.getBytes("UTF-8");
            InetAddress broadcastAddr = getBroadcastAddress();

            if (broadcastAddr != null) {
                DatagramSocket socket = new DatagramSocket();
                socket.setBroadcast(true);
                DatagramPacket packet = new DatagramPacket(
                    data, data.length, broadcastAddr, KDS_MESH_PORT);
                socket.send(packet);
                socket.close();
                Log.d(TAG, "KDS update broadcast to LAN mesh.");
            }

            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "KDS broadcast failed: " + e.getMessage(), e);
            call.reject("KDS_BROADCAST_FAILED");
        }
    }

    @PluginMethod
    public void getLocalIp(PluginCall call) {
        try {
            String ip = getLocalIpAddress();
            JSObject result = new JSObject();
            result.put("ip", ip != null ? ip : "unknown");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("IP_RESOLUTION_FAILED");
        }
    }

    private InetAddress getBroadcastAddress() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();
                if (networkInterface.isLoopback() || !networkInterface.isUp()) {
                    continue;
                }
                for (java.net.InterfaceAddress addr : networkInterface.getInterfaceAddresses()) {
                    InetAddress broadcast = addr.getBroadcast();
                    if (broadcast != null) {
                        return broadcast;
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to get broadcast address: " + e.getMessage());
        }
        return null;
    }

    private String getLocalIpAddress() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();
                if (networkInterface.isLoopback() || !networkInterface.isUp()) {
                    continue;
                }
                Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress addr = addresses.nextElement();
                    if (!addr.isLoopbackAddress() && addr.getAddress().length == 4) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to get local IP: " + e.getMessage());
        }
        return null;
    }
}

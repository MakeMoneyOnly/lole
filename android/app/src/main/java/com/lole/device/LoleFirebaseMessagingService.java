package com.lole.device;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class LoleFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "LoleFCM";

    private static final String CHANNEL_ORDERS = "lole_orders";
    private static final String CHANNEL_KDS = "lole_kds";
    private static final String CHANNEL_SYSTEM = "lole_system";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    @Override
    public void onNewToken(String token) {
        Log.d(TAG, "FCM token refreshed: " + token);
        // Token sent to backend via Capacitor JS bridge or direct POST
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String type = data != null ? data.get("type") : null;

        if (type == null) {
            Log.w(TAG, "Notification missing type field.");
            return;
        }

        String channelId;
        String title;
        String body;

        switch (type) {
            case "order.new":
                channelId = CHANNEL_ORDERS;
                title = "New Order";
                body = data.getOrDefault("summary", "A new order has been placed.");
                break;
            case "order.ready":
                channelId = CHANNEL_ORDERS;
                title = "Order Ready";
                body = data.getOrDefault("summary", "Order is ready for pickup.");
                break;
            case "kds.ticket_updated":
                channelId = CHANNEL_KDS;
                title = "KDS Update";
                body = data.getOrDefault("summary", "Kitchen ticket updated.");
                break;
            case "system.emergency":
                channelId = CHANNEL_SYSTEM;
                title = "Emergency Alert";
                body = data.getOrDefault("summary", "System emergency notification.");
                break;
            default:
                channelId = CHANNEL_SYSTEM;
                title = "Lole";
                body = data.getOrDefault("summary", "New notification.");
                break;
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("notification_type", type);
        for (Map.Entry<String, String> entry : data.entrySet()) {
            intent.putExtra(entry.getKey(), entry.getValue());
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationManager notificationManager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(type.equals("system.emergency")
                ? NotificationCompat.PRIORITY_HIGH
                : NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent);

        int notificationId = data.hashCode();
        notificationManager.notify(notificationId, builder.build());
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

            NotificationChannel ordersChannel = new NotificationChannel(
                CHANNEL_ORDERS, "Orders", NotificationManager.IMPORTANCE_HIGH);
            ordersChannel.setDescription("New order and order status notifications");
            manager.createNotificationChannel(ordersChannel);

            NotificationChannel kdsChannel = new NotificationChannel(
                CHANNEL_KDS, "Kitchen Display", NotificationManager.IMPORTANCE_HIGH);
            kdsChannel.setDescription("Kitchen display system ticket updates");
            manager.createNotificationChannel(kdsChannel);

            NotificationChannel systemChannel = new NotificationChannel(
                CHANNEL_SYSTEM, "System", NotificationManager.IMPORTANCE_DEFAULT);
            systemChannel.setDescription("System alerts and emergency notifications");
            manager.createNotificationChannel(systemChannel);
        }
    }
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    getRegisteredPushToken,
    onPushNotification,
    registerForPushNotifications,
    type PushNotificationPayload,
} from '@/lib/mobile/push-notifications';

interface UsePushNotificationsOptions {
    enabled?: boolean;
    onNotification?: (notification: PushNotificationPayload) => void;
}

interface UsePushNotificationsReturn {
    token: string | null;
    permission: 'granted' | 'denied' | 'prompt' | 'unavailable';
    isRegistered: boolean;
    requestPermission: () => Promise<void>;
}

export function usePushNotifications(
    options: UsePushNotificationsOptions = {}
): UsePushNotificationsReturn {
    const { enabled = true, onNotification } = options;
    const [token, setToken] = useState<string | null>(getRegisteredPushToken());
    const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt' | 'unavailable'>(
        'unavailable'
    );

    useEffect(() => {
        if (!enabled) {
            return;
        }

        if (onNotification) {
            return onPushNotification(onNotification);
        }
    }, [enabled, onNotification]);

    const requestPermission = useCallback(async () => {
        if (!enabled) {
            return;
        }

        const result = await registerForPushNotifications();

        setToken(result.token);
        setPermission(result.permission);
    }, [enabled]);

    useEffect(() => {
        if (enabled) {
            void requestPermission();
        }
    }, [enabled, requestPermission]);

    return {
        token,
        permission,
        isRegistered: permission === 'granted' && token !== null,
        requestPermission,
    };
}

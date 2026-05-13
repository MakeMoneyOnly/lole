import { isCapacitorNativeRuntime } from '@/lib/mobile/capacitor';

export type PushNotificationType =
    | 'order.new'
    | 'order.ready'
    | 'kds.ticket_updated'
    | 'system.emergency';

export interface PushNotificationPayload {
    type: PushNotificationType;
    title: string;
    body: string;
    data?: Record<string, string>;
}

export type PushNotificationHandler = (notification: PushNotificationPayload) => void;

interface PushNotificationsPlugin {
    register: () => Promise<void>;
    requestPermissions: () => Promise<{ receive: 'granted' | 'denied' | 'prompt' }>;
    getDeliveredNotifications: () => Promise<{ notifications: PushNotificationPayload[] }>;
    addListener: (event: string, callback: (data: unknown) => void) => void;
    removeAllListeners: () => Promise<void>;
}

const handlers: PushNotificationHandler[] = [];
let registeredToken: string | null = null;

async function getPushPlugin(): Promise<PushNotificationsPlugin | null> {
    try {
        const importer = new Function('moduleName', 'return import(moduleName);') as (
            value: string
        ) => Promise<{ PushNotifications?: PushNotificationsPlugin }>;
        const mod = await importer('@capacitor/push-notifications');
        return mod?.PushNotifications ?? null;
    } catch {
        return null;
    }
}

export function onPushNotification(handler: PushNotificationHandler): () => void {
    handlers.push(handler);
    return () => {
        const index = handlers.indexOf(handler);
        if (index >= 0) {
            handlers.splice(index, 1);
        }
    };
}

function dispatchNotification(notification: PushNotificationPayload): void {
    for (const handler of handlers) {
        try {
            handler(notification);
        } catch {
            // Handler errors should not break other handlers
        }
    }
}

export async function registerForPushNotifications(): Promise<{
    token: string | null;
    permission: 'granted' | 'denied' | 'prompt' | 'unavailable';
}> {
    if (!isCapacitorNativeRuntime()) {
        return { token: null, permission: 'unavailable' };
    }

    const plugin = await getPushPlugin();
    if (!plugin) {
        return { token: null, permission: 'unavailable' };
    }

    try {
        const permResult = await plugin.requestPermissions();

        if (permResult.receive !== 'granted') {
            return { token: null, permission: permResult.receive };
        }

        await plugin.register();

        plugin.addListener('registration', (data: unknown) => {
            const d = data as { value: string };
            registeredToken = d.value;
            sendTokenToBackend(d.value);
        });

        plugin.addListener('registrationError', (error: unknown) => {
            const e = error as { error: string };
            console.error('[PushNotifications] Registration error:', e.error);
        });

        plugin.addListener('pushNotificationReceived', (notification: unknown) => {
            dispatchNotification(notification as PushNotificationPayload);
        });

        return {
            token: registeredToken,
            permission: 'granted',
        };
    } catch (error) {
        console.error('[PushNotifications] Registration failed:', error);
        return { token: null, permission: 'denied' };
    }
}

async function sendTokenToBackend(token: string): Promise<void> {
    try {
        const deviceToken =
            typeof window !== 'undefined'
                ? window.localStorage.getItem('lole_device_session_v2')
                : null;

        await fetch('/api/v1/merchant/devices/push-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-device-token': deviceToken ?? '',
            },
            body: JSON.stringify({
                push_token: token,
                platform: 'android',
                provider: 'fcm',
            }),
        });
    } catch {
        console.error('[PushNotifications] Failed to send token to backend.');
    }
}

export function getRegisteredPushToken(): string | null {
    return registeredToken;
}

export async function getDeliveredNotifications(): Promise<PushNotificationPayload[]> {
    const plugin = await getPushPlugin();
    if (!plugin) {
        return [];
    }

    try {
        const result = await plugin.getDeliveredNotifications();
        return result.notifications;
    } catch {
        return [];
    }
}

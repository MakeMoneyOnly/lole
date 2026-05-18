import { useEffect } from 'react';
import { getNativeDeviceInfo } from '@/lib/mobile/capacitor';
import { getStoredPrinterSelection } from '@/lib/mobile/device-storage';

interface UseDeviceHeartbeatOptions {
    deviceToken: string | null;
    route: string;
    enabled?: boolean;
    intervalMs?: number;
}

export function useDeviceHeartbeat({
    deviceToken,
    route,
    enabled = true,
    intervalMs = 45_000,
}: UseDeviceHeartbeatOptions) {
    useEffect(() => {
        if (!deviceToken || !enabled) {
            return;
        }

        let cancelled = false;

        const sendHeartbeat = async (): Promise<void> => {
            if (cancelled) {
                return;
            }

            try {
                const [nativeInfo, printerSelection] = await Promise.all([
                    getNativeDeviceInfo(),
                    getStoredPrinterSelection(),
                ]);

                await fetch('/api/v1/merchant/devices/heartbeat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-device-token': deviceToken,
                    },
                    body: JSON.stringify({
                        route,
                        app_mode: window.matchMedia('(display-mode: standalone)').matches
                            ? 'pwa'
                            : 'browser',
                        visibility: document.visibilityState === 'visible' ? 'visible' : 'hidden',
                        battery_percent:
                            nativeInfo.batteryLevel !== undefined &&
                            nativeInfo.batteryLevel !== null
                                ? Math.round(nativeInfo.batteryLevel * 100)
                                : undefined,
                        native_platform: nativeInfo.platform,
                        native_version: nativeInfo.appVersion ?? nativeInfo.osVersion ?? undefined,
                        device_uuid: nativeInfo.uuid ?? undefined,
                        printer: printerSelection ?? undefined,
                    }),
                });
            } catch {
                // Heartbeat failure should never block device workflows.
            }
        };

        void sendHeartbeat();
        const interval = window.setInterval(() => {
            void sendHeartbeat();
        }, intervalMs);

        const onVisibilityChange = (): React.JSX.Element => {
            void sendHeartbeat();
        };

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [deviceToken, enabled, intervalMs, route]);
}

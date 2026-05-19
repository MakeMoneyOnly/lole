'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    evaluateOfflineStaffAccess,
    isGatewayIdentityRevoked,
    resolveOfflineStaffOutagePolicy,
} from '@/lib/auth/offline-authz';
import {
    DeviceProfileSchema,
    getDeviceProfileLabel,
    getDeviceTypeLabel,
    resolveDeviceProfile,
    type DeviceProfile,
} from '@/lib/devices/config';
import { useDeviceHeartbeat } from './useDeviceHeartbeat';
import {
    getStoredDeviceSession,
    storeDeviceSession,
    type StoredDeviceSession,
} from '@/lib/mobile/device-storage';
import { bootstrapGatewayForPairedDevice } from '@/lib/gateway/device-bootstrap';

interface UseManagedDeviceSessionOptions {
    route: string;
    expectedProfiles?: DeviceProfile[];
    requirePaired?: boolean;
}

export function useManagedDeviceSession({
    route,
    expectedProfiles = [],
    requirePaired = false,
}: UseManagedDeviceSessionOptions): {
    loading: boolean;
    session: StoredDeviceSession | null;
    deviceToken: string | null;
    isManaged: boolean;
    resolvedProfile: DeviceProfile;
    hasExpectedProfile: boolean;
    requiresPairing: boolean;
    hasProfileMismatch: boolean;
    isIdentityRevoked: boolean;
    outagePolicy: ReturnType<typeof resolveOfflineStaffOutagePolicy>;
    outageAccess: ReturnType<typeof evaluateOfflineStaffAccess>;
    hasOutageAccess: boolean;
    profileLabel: string;
    typeLabel: string;
} {
    const [session, setSession] = useState<StoredDeviceSession | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            try {
                const storedSession = await getStoredDeviceSession();
                if (!cancelled) {
                    setSession(storedSession);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (
            !session?.device_token ||
            !session.restaurant_id ||
            !session.location_id ||
            session.gateway_bootstrap_status === 'ready'
        ) {
            return;
        }

        let cancelled = false;
        const deviceToken = session.device_token;
        const restaurantId = session.restaurant_id;
        const locationId = session.location_id;

        void (async () => {
            const gatewaySession = await bootstrapGatewayForPairedDevice({
                deviceToken,
                restaurantId,
                locationId,
                preferredBrokerUrl: process.env.NEXT_PUBLIC_LAN_MQTT_URL ?? null,
                fallbackBootstrapUrl: process.env.NEXT_PUBLIC_GATEWAY_BOOTSTRAP_URL ?? null,
            }).catch(() => null);

            if (cancelled || !gatewaySession) {
                return;
            }

            const nextSession: StoredDeviceSession = {
                ...session,
                gateway: gatewaySession,
                gateway_bootstrap_status: 'ready',
            };

            await storeDeviceSession(nextSession);
            if (!cancelled) {
                setSession(nextSession);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        session?.device_token,
        session?.restaurant_id,
        session?.location_id,
        session?.gateway_bootstrap_status,
        session,
    ]);

    const resolvedProfile = useMemo(() => {
        if (DeviceProfileSchema.safeParse(session?.device_profile).success) {
            return session?.device_profile as DeviceProfile;
        }

        return resolveDeviceProfile(
            session?.device_type === 'terminal' ||
                session?.device_type === 'kds' ||
                session?.device_type === 'kiosk'
                ? session.device_type
                : 'pos'
        );
    }, [session]);

    const deviceToken = session?.device_token ?? null;
    const isManaged = Boolean(deviceToken);
    const hasExpectedProfile =
        !session || expectedProfiles.length === 0 || expectedProfiles.includes(resolvedProfile);
    const requiresPairing = requirePaired && !loading && !deviceToken;
    const hasProfileMismatch = Boolean(session) && !hasExpectedProfile;
    const isIdentityRevoked =
        Boolean(session) &&
        (isGatewayIdentityRevoked(session?.metadata ?? null) ||
            session?.gateway_bootstrap_status === 'failed');
    const outagePolicy = useMemo(
        () =>
            resolveOfflineStaffOutagePolicy(session?.metadata ?? null, {
                deviceType:
                    session?.device_type === 'terminal' ||
                    session?.device_type === 'kds' ||
                    session?.device_type === 'kiosk'
                        ? session.device_type
                        : 'pos',
                deviceProfile: resolvedProfile,
            }),
        [resolvedProfile, session?.device_type, session?.metadata]
    );
    const outageAccess = useMemo(
        () =>
            evaluateOfflineStaffAccess({
                policy: outagePolicy,
                isOnline: session?.gateway?.operatingMode === 'online',
                role: resolvedProfile,
            }),
        [outagePolicy, resolvedProfile, session?.gateway?.operatingMode]
    );

    useDeviceHeartbeat({
        deviceToken,
        route,
        enabled: Boolean(deviceToken),
    });

    return {
        loading,
        session,
        deviceToken,
        isManaged,
        resolvedProfile,
        hasExpectedProfile,
        requiresPairing,
        hasProfileMismatch,
        isIdentityRevoked,
        outagePolicy,
        outageAccess,
        hasOutageAccess: outageAccess.allowed && !isIdentityRevoked,
        profileLabel: getDeviceProfileLabel(resolvedProfile),
        typeLabel: getDeviceTypeLabel(session?.device_type),
    };
}

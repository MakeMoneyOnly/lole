import type { GatewaySessionClaims } from '@/lib/auth/gateway-session';
import { logger } from '@/lib/logger';

interface TopicTenant {
    restaurantId: string;
    locationId: string;
}

export function parseTopicTenant(topic: string): TopicTenant | null {
    const parts = topic.split('/');
    if (!topic.startsWith('lole/v1/restaurants/') || parts.length < 7) {
        return null;
    }

    return {
        restaurantId: parts[3],
        locationId: parts[5],
    };
}

export function isSystemTopic(topic: string): boolean {
    const parts = topic.split('/');
    return parts.length >= 8 && parts[6] === 'system';
}

export interface AclDecision {
    allowed: boolean;
    reason: string;
}

export function authorizePublish(topic: string, claims: GatewaySessionClaims | null): AclDecision {
    const tenant = parseTopicTenant(topic);

    if (!tenant) {
        return { allowed: false, reason: `Unknown topic format: ${topic}` };
    }

    if (!claims) {
        if (isSystemTopic(topic)) {
            return {
                allowed: false,
                reason: 'Anonymous clients may not publish to system topics',
            };
        }
        return { allowed: true, reason: 'Anonymous publish allowed to scoped topics' };
    }

    if (claims.restaurantId !== tenant.restaurantId || claims.locationId !== tenant.locationId) {
        return {
            allowed: false,
            reason: `Client ${claims.restaurantId}/${claims.locationId} may not publish to ${tenant.restaurantId}/${tenant.locationId}`,
        };
    }

    if (isSystemTopic(topic) && !claims.authorizations.includes('gateway.bootstrap')) {
        return {
            allowed: false,
            reason: 'Only gateway-privileged clients may publish to system topics',
        };
    }

    return { allowed: true, reason: 'OK' };
}

export function authorizeSubscribe(
    topic: string,
    claims: GatewaySessionClaims | null
): AclDecision {
    const tenant = parseTopicTenant(topic);

    if (!tenant) {
        return { allowed: false, reason: `Unknown topic format: ${topic}` };
    }

    if (!claims) {
        if (isSystemTopic(topic)) {
            return { allowed: true, reason: 'Anonymous subscribe allowed to system topics' };
        }
        return { allowed: true, reason: 'Anonymous subscribe allowed to scoped topics' };
    }

    if (claims.restaurantId !== tenant.restaurantId || claims.locationId !== tenant.locationId) {
        return {
            allowed: false,
            reason: `Client ${claims.restaurantId}/${claims.locationId} may not subscribe to ${tenant.restaurantId}/${tenant.locationId}`,
        };
    }

    return { allowed: true, reason: 'OK' };
}

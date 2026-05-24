/**
 * Security Event Detection and Alerting
 *
 * Addresses SEC-005: Add security event detection alerts
 * Monitors and alerts on suspicious activities
 */

import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import { logger } from '@/lib/logger';

/**
 * Security event types
 */
export type SecurityEventType =
    | 'auth_failure'
    | 'auth_success_new_device'
    | 'rate_limit_exceeded'
    | 'suspicious_order_pattern'
    | 'brute_force_detected'
    | 'invalid_signature_attempt'
    | 'tenant_isolation_violation'
    | 'sensitive_action_blocked';

/**
 * Security event severity levels
 */
export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Security event data structure
 */
export interface SecurityEvent {
    type: SecurityEventType;
    severity: SecurityEventSeverity;
    restaurantId?: string;
    userId?: string;
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, unknown>;
    timestamp: Date;
}

/**
 * Severity thresholds for alerting
 */
const SEVERITY_THRESHOLDS: Record<SecurityEventSeverity, number> = {
    low: 10,
    medium: 5,
    high: 2,
    critical: 1,
};

const EVENT_WINDOW_MINUTES = 15;

/**
 * Log a security event
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.from('audit_logs').insert({
        action: `security:${event.type}`,
        entity_type: 'security_event',
        entity_id: event.userId || 'anonymous',
        restaurant_id: event.restaurantId,
        metadata: {
            type: event.type,
            severity: event.severity,
            ip_address: event.ipAddress,
            user_agent: event.userAgent,
            ...event.metadata,
            timestamp: event.timestamp.toISOString(),
        } as Json,
    });

    if (error) {
        logger.error('Failed to log security event', error);
        return;
    }

    await checkAndTriggerAlert(event);
}

async function checkAndTriggerAlert(event: SecurityEvent): Promise<boolean> {
    const threshold = SEVERITY_THRESHOLDS[event.severity];

    if (event.severity === 'critical') {
        await triggerAlert(event);
        return true;
    }

    const supabase = await createClient();
    const windowStart = new Date(Date.now() - EVENT_WINDOW_MINUTES * 60 * 1000);

    const { count, error } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', `security:${event.type}`)
        .gte('created_at', windowStart.toISOString());

    if (error) {
        logger.error('Failed to count security events', error);
        return false;
    }

    if (count && count >= threshold) {
        await triggerAlert(event, count);
        return true;
    }

    return false;
}

async function triggerAlert(event: SecurityEvent, occurrenceCount?: number): Promise<void> {
    const alertMessage = `SECURITY ALERT: ${event.type} [${event.severity.toUpperCase()}]
    Restaurant: ${event.restaurantId || 'N/A'}
    User: ${event.userId || 'Anonymous'}
    IP: ${event.ipAddress}
    Occurrences: ${occurrenceCount || 1}
    Details: ${JSON.stringify(event.metadata)}`;

    logger.warn(alertMessage);

    const supabase = await createClient();
    await supabase.from('audit_logs').insert({
        action: 'security:alert_triggered',
        entity_type: 'security_alert',
        entity_id: event.userId || event.ipAddress,
        restaurant_id: event.restaurantId,
        metadata: {
            original_event_type: event.type,
            severity: event.severity,
            occurrence_count: occurrenceCount,
            ip_address: event.ipAddress,
        } as Json,
    });
}

/**
 * Detect brute force attempts
 */
export async function detectBruteForce(
    identifier: string,
    action: string,
    maxAttempts: number = 5,
    windowMinutes: number = 15
): Promise<boolean> {
    const supabase = await createClient();
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const { count, error } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', action)
        .eq('entity_id', identifier)
        .gte('created_at', windowStart.toISOString());

    if (error) {
        logger.error('Failed to check brute force', error);
        return false;
    }

    const isBruteForce = count !== null && count >= maxAttempts;

    if (isBruteForce) {
        await logSecurityEvent({
            type: 'brute_force_detected',
            severity: 'high',
            userId: identifier,
            ipAddress: 'unknown',
            userAgent: 'unknown',
            metadata: { action, attempt_count: count },
            timestamp: new Date(),
        });
    }

    return isBruteForce;
}

/**
 * Check for tenant isolation violations
 */
export async function checkTenantIsolation(
    userId: string,
    requestedRestaurantId: string
): Promise<{ valid: boolean; reason?: string }> {
    const supabase = await createClient();

    const { data: staffEntry, error } = await supabase
        .from('restaurant_staff')
        .select('restaurant_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('restaurant_id', requestedRestaurantId)
        .maybeSingle();

    if (error) {
        logger.error('Failed to check tenant isolation', error);
        return { valid: false, reason: 'Failed to verify access' };
    }

    if (!staffEntry) {
        await logSecurityEvent({
            type: 'tenant_isolation_violation',
            severity: 'high',
            userId,
            ipAddress: 'unknown',
            userAgent: 'unknown',
            metadata: { requested_restaurant_id: requestedRestaurantId },
            timestamp: new Date(),
        });

        return { valid: false, reason: 'Access denied to requested restaurant' };
    }

    return { valid: true };
}

/**
 * Log invalid signature attempts
 */
export async function logInvalidSignatureAttempt(
    ipAddress: string,
    userAgent: string,
    details: Record<string, unknown>
): Promise<void> {
    await logSecurityEvent({
        type: 'invalid_signature_attempt',
        severity: 'medium',
        ipAddress,
        userAgent,
        metadata: details,
        timestamp: new Date(),
    });
}

const securityEventsExports = {
    logSecurityEvent,
    detectBruteForce,
    checkTenantIsolation,
    logInvalidSignatureAttempt,
};

export default securityEventsExports;

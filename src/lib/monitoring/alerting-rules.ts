/**
 * Alerting Rules Configuration
 *
 * Defines alerting rules for monitoring dashboards.
 * These rules trigger alerts based on metrics thresholds.
 *
 * @see docs/implementation/observability-setup.md
 */

/**
 * Alert rule definition
 */
export interface AlertRule {
    id: string;
    name: string;
    description: string;
    metric: string;
    condition: 'above' | 'below' | 'equals';
    threshold: number;
    window: string;
    severity: 'critical' | 'warning' | 'info';
    cooldown: number; // minutes
    enabled: boolean;
}

/**
 * SLO target definition
 */
export interface SloTarget {
    endpoint: string;
    method: string;
    latency_p95_ms: number;
    error_rate_percent: number;
    availability_percent: number;
}

/**
 * Predefined alert rules for API reliability
 */
export const API_ALERT_RULES: AlertRule[] = [
    {
        id: 'api-latency-p95-critical',
        name: 'API P95 Latency Critical',
        description: 'Trigger when API P95 latency exceeds 2 seconds',
        metric: 'api.latency.p95',
        condition: 'above',
        threshold: 2000,
        window: '5m',
        severity: 'critical',
        cooldown: 15,
        enabled: true,
    },
    {
        id: 'api-latency-p95-warning',
        name: 'API P95 Latency Warning',
        description: 'Trigger when API P95 latency exceeds 1 second',
        metric: 'api.latency.p95',
        condition: 'above',
        threshold: 1000,
        window: '5m',
        severity: 'warning',
        cooldown: 15,
        enabled: true,
    },
    {
        id: 'api-error-rate-critical',
        name: 'API Error Rate Critical',
        description: 'Trigger when API error rate exceeds 5%',
        metric: 'api.error_rate',
        condition: 'above',
        threshold: 5,
        window: '5m',
        severity: 'critical',
        cooldown: 10,
        enabled: true,
    },
    {
        id: 'api-error-rate-warning',
        name: 'API Error Rate Warning',
        description: 'Trigger when API error rate exceeds 1%',
        metric: 'api.error_rate',
        condition: 'above',
        threshold: 1,
        window: '5m',
        severity: 'warning',
        cooldown: 10,
        enabled: true,
    },
    {
        id: 'api-availability-critical',
        name: 'API Availability Critical',
        description: 'Trigger when API availability drops below 99%',
        metric: 'api.availability',
        condition: 'below',
        threshold: 99,
        window: '5m',
        severity: 'critical',
        cooldown: 10,
        enabled: true,
    },
];

/**
 * Predefined alert rules for business metrics
 */
export const BUSINESS_ALERT_RULES: AlertRule[] = [
    {
        id: 'payment-failure-rate-critical',
        name: 'Payment Failure Rate Critical',
        description: 'Trigger when payment failure rate exceeds 5%',
        metric: 'payment.failure_rate',
        condition: 'above',
        threshold: 5,
        window: '15m',
        severity: 'critical',
        cooldown: 15,
        enabled: true,
    },
    {
        id: 'payment-failure-rate-warning',
        name: 'Payment Failure Rate Warning',
        description: 'Trigger when payment failure rate exceeds 2%',
        metric: 'payment.failure_rate',
        condition: 'above',
        threshold: 2,
        window: '15m',
        severity: 'warning',
        cooldown: 15,
        enabled: true,
    },
    {
        id: 'order-cancellation-rate-warning',
        name: 'Order Cancellation Rate Warning',
        description: 'Trigger when order cancellation rate exceeds 10%',
        metric: 'order.cancellation_rate',
        condition: 'above',
        threshold: 10,
        window: '30m',
        severity: 'warning',
        cooldown: 30,
        enabled: true,
    },
    {
        id: 'active-sessions-low-warning',
        name: 'Active Sessions Low',
        description: 'Trigger when active sessions drop significantly',
        metric: 'sessions.active',
        condition: 'below',
        threshold: 1,
        window: '60m',
        severity: 'info',
        cooldown: 60,
        enabled: false, // Disabled by default as this may be normal off-hours
    },
];

/**
 * Predefined alert rules for infrastructure
 */
export const INFRA_ALERT_RULES: AlertRule[] = [
    {
        id: 'db-connection-pool-critical',
        name: 'Database Connection Pool Critical',
        description: 'Trigger when DB connection pool exceeds 80%',
        metric: 'db.connection_pool',
        condition: 'above',
        threshold: 80,
        window: '5m',
        severity: 'critical',
        cooldown: 10,
        enabled: true,
    },
    {
        id: 'db-connection-pool-warning',
        name: 'Database Connection Pool Warning',
        description: 'Trigger when DB connection pool exceeds 60%',
        metric: 'db.connection_pool',
        condition: 'above',
        threshold: 60,
        window: '10m',
        severity: 'warning',
        cooldown: 15,
        enabled: true,
    },
    {
        id: 'db-latency-critical',
        name: 'Database Latency Critical',
        description: 'Trigger when DB query latency exceeds 500ms',
        metric: 'db.latency.p95',
        condition: 'above',
        threshold: 500,
        window: '5m',
        severity: 'critical',
        cooldown: 10,
        enabled: true,
    },
    {
        id: 'error-spike-critical',
        name: 'Error Spike Critical',
        description: 'Trigger when errors spike significantly',
        metric: 'errors.count',
        condition: 'above',
        threshold: 50,
        window: '5m',
        severity: 'critical',
        cooldown: 15,
        enabled: true,
    },
];

/**
 * SLO targets for key endpoints
 */
export const SLO_TARGETS: SloTarget[] = [
    {
        endpoint: '/api/v1/merchant/core/command-center',
        method: 'GET',
        latency_p95_ms: 500,
        error_rate_percent: 1,
        availability_percent: 99.5,
    },
    {
        endpoint: '/api/v1/merchant/operations/orders',
        method: 'GET',
        latency_p95_ms: 400,
        error_rate_percent: 1,
        availability_percent: 99.5,
    },
    {
        endpoint: '/api/v1/merchant/operations/orders/:id/status',
        method: 'PATCH',
        latency_p95_ms: 300,
        error_rate_percent: 0.5,
        availability_percent: 99.9,
    },
    {
        endpoint: '/api/v1/merchant/operations/payments/initiate',
        method: 'POST',
        latency_p95_ms: 1000,
        error_rate_percent: 2,
        availability_percent: 99,
    },
    {
        endpoint: '/api/v1/merchant/core/tables',
        method: 'GET',
        latency_p95_ms: 300,
        error_rate_percent: 1,
        availability_percent: 99.5,
    },
    {
        endpoint: '/api/v1/system/sync',
        method: 'POST',
        latency_p95_ms: 800,
        error_rate_percent: 1,
        availability_percent: 99.9,
    },
];

/**
 * Get all alert rules
 */
export function getAllAlertRules(): AlertRule[] {
    return [...API_ALERT_RULES, ...BUSINESS_ALERT_RULES, ...INFRA_ALERT_RULES];
}

/**
 * Get enabled alert rules
 */
export function getEnabledAlertRules(): AlertRule[] {
    return getAllAlertRules().filter(rule => rule.enabled);
}

/**
 * Get alert rules by severity
 */
export function getAlertRulesBySeverity(severity: 'critical' | 'warning' | 'info'): AlertRule[] {
    return getEnabledAlertRules().filter(rule => rule.severity === severity);
}

/**
 * Evaluate alert rule against metric value
 */
export function evaluateAlertRule(rule: AlertRule, value: number): boolean {
    switch (rule.condition) {
        case 'above':
            return value > rule.threshold;
        case 'below':
            return value < rule.threshold;
        case 'equals':
            return value === rule.threshold;
        default:
            return false;
    }
}

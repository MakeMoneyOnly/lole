/**
 * Monitoring Module
 *
 * Provides observability utilities for production debugging and alerting.
 * Addresses CRIT-08 from ENTERPRISE_MASTER_BLUEPRINT Section 13.
 *
 * Components:
 * - Sentry context tagging for restaurant-specific error tracking
 * - Telegram alerts for critical production incidents
 * - Health checks for uptime monitoring
 *
 * @see docs/1. Engineering Foundation/0. ENTERPRISE_MASTER_BLUEPRINT.md - Sprint 1.6, 1.7
 */

// Sentry context utilities
export {
    setRestaurantContext,
    setServerRestaurantContext,
    getServerRestaurantId,
    clearRestaurantContext,
    restoreRestaurantContext,
    addOrderBreadcrumb,
    addPaymentBreadcrumb,
    addSyncBreadcrumb,
    type RestaurantContext,
} from './sentry-context';

// Telegram alert system
export {
    sendAlert,
    sendCriticalAlert,
    sendWarningAlert,
    sendInfoAlert,
    Alerts,
    areAlertsEnabled,
    testAlerts,
    type AlertLevel,
    type AlertContext,
} from './alerts';

// Custom metrics tracking
export {
    tracePerformance,
    tracePerformanceSync,
    trackApiMetric,
    trackOrderMetric,
    trackPaymentMetric,
    trackSessionMetric,
    trackDbMetric,
    incrementCounter,
    setGauge,
    recordDistribution,
    METRIC_ACTIONS,
    type ApiMetricParams,
    type OrderMetricParams,
    type PaymentMetricParams,
    type SessionMetricParams,
    type DbMetricParams,
} from './metrics';

// Alerting rules
export {
    API_ALERT_RULES,
    BUSINESS_ALERT_RULES,
    INFRA_ALERT_RULES,
    SLO_TARGETS,
    getAllAlertRules,
    getEnabledAlertRules,
    getAlertRulesBySeverity,
    evaluateAlertRule,
    type AlertRule,
    type SloTarget,
} from './alerting-rules';

// Notification metrics and observability
export {
    recordNotificationSent,
    recordNotificationFailed,
    recordRetryAttempt,
    getNotificationMetrics,
    getDeliveryReport,
    setNotificationContext,
    clearNotificationContext,
    withNotificationMetrics,
    closeMetricsRedis,
    NOTIFICATION_EVENTS,
    type NotificationChannel,
    type ChannelMetrics,
    type NotificationMetrics,
    type MetricParams,
    type DateRange,
    type DeliveryReportEntry,
    type DeliveryReport,
} from './notification-metrics';

// Web Vitals tracking
export {
    getRating,
    formatVitalValue,
    getVitalColor,
    getVitalBgColor,
    observeWebVitals,
    reportWebVital,
    initWebVitalsReporting,
    disconnectObservers,
    WEB_VITALS_THRESHOLDS,
    type WebVitalName,
    type WebVitalMetric,
    type WebVitalsThresholds,
} from './webVitalsTracker';

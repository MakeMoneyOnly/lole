/**
 * Alerts Module
 *
 * Provides alerting capabilities for production monitoring.
 *
 * @see docs/1. Engineering Foundation/0. ENTERPRISE_MASTER_BLUEPRINT.md - Sprint 7.6
 */

export {
    sendAlert,
    sendCriticalAlert,
    sendWarningAlert,
    sendInfoAlert,
    sendEodReport,
    isTelegramConfigured,
    testTelegramConnection,
    type AlertLevel,
    type AlertContext,
} from './telegram';

/**
 * KDS (Kitchen Display System) Constants
 */

export const GUEST_TRACKER_POLL_INTERVAL_MS = 8000;

export const TOPIC_FILTER_TABLES_COMMANDS = '/tables/commands';

export const DEFAULT_LOCATION_ID = 'default-location';

export const KDS_STATUSES = {
    QUEUED: 'queued',
    IN_PROGRESS: 'in_progress',
    ON_HOLD: 'on_hold',
    READY: 'ready',
    RECALLED: 'recalled',
} as const;

export type KdsStatus = (typeof KDS_STATUSES)[keyof typeof KDS_STATUSES];

// Device Pairing Constants
export const PAIRED_CODE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// Device Sync Constants
export const STALE_DEVICE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes without sync

// KDS Default Times
export const DEFAULT_TARGET_COMPLETION_MS = 30 * 60 * 1000; // 30 minutes from now

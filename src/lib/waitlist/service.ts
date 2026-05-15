/**
 * Waitlist Service
 *
 * Service layer for table waitlist management.
 * Handles adding guests to waitlist, position management, notifications, and status updates.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { sendSmsWithRetry } from '@/lib/notifications/retry';
import { checkAndRecord, type NotificationType } from '@/lib/notifications/deduplication';
import { logger } from '@/lib/logger';
import type {
    AddWaitlistParams,
    WaitlistEntry,
    WaitlistStatus,
    NotifyResult,
    UpdateWaitlistStatusParams,
    WaitlistStats,
    TableWaitlistRow,
} from './types';
import { WAITLIST_MESSAGES, WAITLIST_CONFIG } from './types';
import { createHash } from 'crypto';

/**
 * Normalize a database row to WaitlistEntry
 */
function normalizeWaitlistEntry(row: TableWaitlistRow): WaitlistEntry {
    return {
        id: row.id,
        restaurant_id: row.restaurant_id,
        guest_name: row.guest_name ?? '',
        guest_phone: row.guest_phone,
        guest_count: row.guest_count,
        status: row.status,
        position: row.position,
        estimated_wait_minutes: row.estimated_wait_minutes,
        notified_at: row.notified_at,
        seated_at: row.seated_at,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

/**
 * Calculate the next position for a new waitlist entry
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getNextPosition(supabase: any, restaurantId: string): Promise<number> {
    const { data, error } = await supabase
        .from('table_waitlist')
        .select('position')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'waiting')
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        logger.error('[waitlist] Error getting next position', error);
        throw new Error('Failed to calculate waitlist position');
    }

    return data ? data.position + 1 : 1;
}

/**
 * Estimate wait time based on position
 * Uses average table turnover time to estimate
 */
function estimateWaitTimeByPosition(position: number): number {
    if (position <= 0) return 0;

    // Base wait time: position * average wait per party
    // Adjust for typical party sizes
    const baseWait = position * WAITLIST_CONFIG.DEFAULT_WAIT_PER_PERSON;

    // Cap at reasonable maximum (2 hours)
    return Math.min(baseWait, 120);
}

/**
 * Update positions after a guest is seated or cancelled
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recalculatePositions(supabase: any, restaurantId: string): Promise<void> {
    // Get all waiting entries ordered by position
    const { data: entries, error } = await supabase
        .from('table_waitlist')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'waiting')
        .order('position', { ascending: true });

    if (error) {
        logger.error('[waitlist] Error fetching entries for position recalculation', error);
        return;
    }

    // Update positions sequentially
    for (let i = 0; i < (entries?.length ?? 0); i++) {
        const entry = entries![i];
        await supabase
            .from('table_waitlist')
            .update({ position: i + 1 })
            .eq('id', entry.id);
    }
}

/**
 * Generate idempotency key for waitlist notifications
 */
function generateIdempotencyKey(waitlistId: string, notificationType: string): string {
    return createHash('sha256')
        .update(`waitlist:${waitlistId}:${notificationType}:${Date.now()}`)
        .digest('hex')
        .slice(0, 32);
}

/**
 * Add a guest to the waitlist
 */
export async function addToWaitlist(params: AddWaitlistParams): Promise<WaitlistEntry> {
    const supabase = createServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { restaurantId, guestName, guestPhone, guestCount, notes } = params;

    // Validate guest count
    if (
        guestCount < WAITLIST_CONFIG.MIN_GUEST_COUNT ||
        guestCount > WAITLIST_CONFIG.MAX_GUEST_COUNT
    ) {
        throw new Error(
            `Guest count must be between ${WAITLIST_CONFIG.MIN_GUEST_COUNT} and ${WAITLIST_CONFIG.MAX_GUEST_COUNT}`
        );
    }

    // Get next position
    const position = await getNextPosition(db, restaurantId);

    // Estimate wait time
    const estimatedWaitMinutes = estimateWaitTimeByPosition(position);

    // Insert waitlist entry
    const { data, error } = await db
        .from('table_waitlist')
        .insert({
            restaurant_id: restaurantId,
            guest_name: guestName,
            guest_phone: guestPhone,
            guest_count: guestCount,
            status: 'waiting',
            position,
            estimated_wait_minutes: estimatedWaitMinutes,
            notes: notes ?? null,
        })
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, guest_name, guest_phone, guest_count, status, position, estimated_wait_minutes, notified_at, seated_at, notes, created_at, updated_at'
        )
        .single();

    if (error || !data) {
        logger.error('[waitlist] Error adding to waitlist', error);
        throw new Error(error?.message ?? 'Failed to add to waitlist');
    }

    const entry = normalizeWaitlistEntry(data as TableWaitlistRow);

    // Send initial notification (non-blocking)
    sendWaitlistNotification(entry, 'added').catch(err => {
        logger.error('[waitlist] Failed to send initial notification', err);
    });

    return entry;
}

/**
 * Get waitlist entries for a restaurant
 */
export async function getWaitlist(
    restaurantId: string,
    status?: WaitlistStatus
): Promise<WaitlistEntry[]> {
    const supabase = createServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    let query = db
        .from('table_waitlist')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, guest_name, guest_phone, guest_count, status, position, estimated_wait_minutes, notified_at, seated_at, notes, created_at, updated_at'
        )
        .eq('restaurant_id', restaurantId);

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query.order('position', { ascending: true });

    if (error) {
        logger.error('[waitlist] Error fetching waitlist', error);
        throw new Error('Failed to fetch waitlist');
    }

    return ((data ?? []) as TableWaitlistRow[]).map(normalizeWaitlistEntry);
}

/**
 * Get a single waitlist entry by ID
 */
export async function getWaitlistEntry(waitlistId: string): Promise<WaitlistEntry | null> {
    const supabase = createServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data, error } = await db
        .from('table_waitlist')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, guest_name, guest_phone, guest_count, status, position, estimated_wait_minutes, notified_at, seated_at, notes, created_at, updated_at'
        )
        .eq('id', waitlistId)
        .maybeSingle();

    if (error) {
        logger.error('[waitlist] Error fetching waitlist entry', error);
        throw new Error('Failed to fetch waitlist entry');
    }

    if (!data) {
        return null;
    }

    return normalizeWaitlistEntry(data as TableWaitlistRow);
}

/**
 * Get waitlist statistics for a restaurant
 */
export async function getWaitlistStats(restaurantId: string): Promise<WaitlistStats> {
    const supabase = createServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Get count of waiting guests
    const { data: countData, error: countError } = await db
        .from('table_waitlist')
        .select('position, estimated_wait_minutes')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'waiting')
        .order('position', { ascending: false });

    if (countError) {
        logger.error('[waitlist] Error fetching waitlist stats', countError);
        throw new Error('Failed to fetch waitlist statistics');
    }

    const waitingEntries = countData ?? [];
    const waitingCount = waitingEntries.length;

    // Calculate average wait time
    let averageWaitMinutes = 0;
    if (waitingCount > 0) {
        let totalWait = 0;
        for (const entry of waitingEntries) {
            totalWait += entry.estimated_wait_minutes ?? 0;
        }
        averageWaitMinutes = Math.round(totalWait / waitingCount);
    }

    // Estimate turnover rate (tables per hour)
    const turnoverRatePerHour = Math.round(60 / WAITLIST_CONFIG.TABLE_TURNOVER_MINUTES);

    return {
        waitingCount,
        averageWaitMinutes,
        turnoverRatePerHour,
    };
}

/**
 * Notify a guest that their table is ready
 */
export async function notifyGuest(waitlistId: string): Promise<NotifyResult> {
    const supabase = createServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Get the waitlist entry
    const entry = await getWaitlistEntry(waitlistId);
    if (!entry) {
        return {
            success: false,
            waitlistId,
            phone: '',
            message: '',
            error: 'Waitlist entry not found',
        };
    }

    if (entry.status !== 'waiting') {
        return {
            success: false,
            waitlistId,
            phone: entry.guest_phone,
            message: '',
            error: `Cannot notify guest with status: ${entry.status}`,
        };
    }

    // Check for duplicate notification using deduplication
    const notificationType: NotificationType = 'waitlist';
    const dedupeResult = await checkAndRecord({
        guestPhone: entry.guest_phone,
        notificationType,
        relevantId: waitlistId,
    });

    if (dedupeResult.isDuplicate) {
        logger.warn('[waitlist] Duplicate notification detected, skipping', { waitlistId });
        // Still update the status to notified even if it's a duplicate
        await updateStatusInternal(db, waitlistId, 'notified');

        return {
            success: true,
            waitlistId,
            phone: entry.guest_phone,
            message: 'Notification already sent (duplicate)',
        };
    }

    // Send the notification
    const message = interpolateMessage(WAITLIST_MESSAGES.tableReady.en, {
        position: entry.position,
        minutes: entry.estimated_wait_minutes ?? 0,
    });
    const messageAm = interpolateMessage(WAITLIST_MESSAGES.tableReady.am, {
        position: entry.position,
        minutes: entry.estimated_wait_minutes ?? 0,
    });

    const fullMessage = `${message}\n${messageAm}`;
    const idempotencyKey = generateIdempotencyKey(waitlistId, 'table_ready');

    try {
        const result = await sendSmsWithRetry({
            to: entry.guest_phone,
            message: fullMessage,
            restaurantId: entry.restaurant_id,
            idempotencyKey,
            metadata: {
                waitlistId,
                type: 'table_ready',
            },
        });

        // Update status to notified
        await updateStatusInternal(db, waitlistId, 'notified');

        return {
            success: result.success,
            waitlistId,
            phone: entry.guest_phone,
            message,
            error: result.error,
            providerResponse: result.providerResponse,
        };
    } catch (error) {
        logger.error('[waitlist] Error sending notification', error);
        return {
            success: false,
            waitlistId,
            phone: entry.guest_phone,
            message,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Internal function to update waitlist status
 */
async function updateStatusInternal(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    waitlistId: string,
    status: WaitlistStatus
): Promise<void> {
    const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
    };

    if (status === 'notified') {
        updateData.notified_at = new Date().toISOString();
    } else if (status === 'seated') {
        updateData.seated_at = new Date().toISOString();
    }

    const { error } = await supabase.from('table_waitlist').update(updateData).eq('id', waitlistId);

    if (error) {
        logger.error('[waitlist] Error updating status', error);
        throw new Error('Failed to update waitlist status');
    }
}

/**
 * Update waitlist entry status
 */
export async function updateStatus(params: UpdateWaitlistStatusParams): Promise<void> {
    const supabase = createServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { waitlistId, status } = params;

    // Get the entry to check current status
    const entry = await getWaitlistEntry(waitlistId);
    if (!entry) {
        throw new Error('Waitlist entry not found');
    }

    // Update status
    await updateStatusInternal(db, waitlistId, status);

    // Recalculate positions if seated or cancelled
    if (status === 'seated' || status === 'cancelled') {
        await recalculatePositions(db, entry.restaurant_id);
    }

    // Send notification for seated status
    if (status === 'seated') {
        sendSeatedNotification(entry).catch(err => {
            logger.error('[waitlist] Failed to send seated notification', err);
        });
    }
}

/**
 * Send notification when guest is seated
 */
async function sendSeatedNotification(entry: WaitlistEntry): Promise<void> {
    const idempotencyKey = generateIdempotencyKey(entry.id, 'seated');

    const message = WAITLIST_MESSAGES.seated.en;
    const messageAm = WAITLIST_MESSAGES.seated.am;
    const fullMessage = `${message}\n${messageAm}`;

    await sendSmsWithRetry({
        to: entry.guest_phone,
        message: fullMessage,
        restaurantId: entry.restaurant_id,
        idempotencyKey,
        metadata: {
            waitlistId: entry.id,
            type: 'seated',
        },
    });
}

/**
 * Send waitlist notification (internal)
 */
async function sendWaitlistNotification(
    entry: WaitlistEntry,
    type: 'added' | 'table_ready'
): Promise<void> {
    const idempotencyKey = generateIdempotencyKey(entry.id, type);

    const template =
        type === 'added' ? WAITLIST_MESSAGES.addedToQueue : WAITLIST_MESSAGES.tableReady;

    const message = interpolateMessage(template.en, {
        position: entry.position,
        minutes: entry.estimated_wait_minutes ?? 0,
    });
    const messageAm = interpolateMessage(template.am, {
        position: entry.position,
        minutes: entry.estimated_wait_minutes ?? 0,
    });
    const fullMessage = `${message}\n${messageAm}`;

    try {
        await sendSmsWithRetry({
            to: entry.guest_phone,
            message: fullMessage,
            restaurantId: entry.restaurant_id,
            idempotencyKey,
            metadata: {
                waitlistId: entry.id,
                type,
            },
        });
    } catch (error) {
        logger.error('[waitlist] Failed to send notification', error);
    }
}

/**
 * Interpolate message with variables
 */
function interpolateMessage(template: string, vars: { position: number; minutes: number }): string {
    return template
        .replace('{{position}}', String(vars.position))
        .replace('{{minutes}}', String(vars.minutes));
}

/**
 * Remove a guest from the waitlist
 */
export async function removeFromWaitlist(waitlistId: string): Promise<void> {
    const supabase = createServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Get the entry first
    const entry = await getWaitlistEntry(waitlistId);
    if (!entry) {
        throw new Error('Waitlist entry not found');
    }

    // Delete the entry
    const { error } = await db.from('table_waitlist').delete().eq('id', waitlistId);

    if (error) {
        logger.error('[waitlist] Error removing from waitlist', error);
        throw new Error('Failed to remove from waitlist');
    }

    // Recalculate positions
    await recalculatePositions(db, entry.restaurant_id);

    // Send cancellation notification if the entry was waiting
    if (entry.status === 'waiting') {
        sendCancellationNotification(entry).catch(err => {
            logger.error('[waitlist] Failed to send cancellation notification', err);
        });
    }
}

/**
 * Send cancellation notification
 */
async function sendCancellationNotification(entry: WaitlistEntry): Promise<void> {
    const idempotencyKey = generateIdempotencyKey(entry.id, 'cancelled');

    const message = WAITLIST_MESSAGES.cancelled.en;
    const messageAm = WAITLIST_MESSAGES.cancelled.am;
    const fullMessage = `${message}\n${messageAm}`;

    try {
        await sendSmsWithRetry({
            to: entry.guest_phone,
            message: fullMessage,
            restaurantId: entry.restaurant_id,
            idempotencyKey,
            metadata: {
                waitlistId: entry.id,
                type: 'cancelled',
            },
        });
    } catch (error) {
        logger.error('[waitlist] Failed to send cancellation notification', error);
    }
}

/**
 * Get current position in line
 */
export async function getPosition(waitlistId: string): Promise<number> {
    const entry = await getWaitlistEntry(waitlistId);
    if (!entry) {
        throw new Error('Waitlist entry not found');
    }
    return entry.position;
}

/**
 * Estimate wait time in minutes based on position
 */
export async function estimateWaitTime(position: number): Promise<number> {
    return estimateWaitTimeByPosition(position);
}

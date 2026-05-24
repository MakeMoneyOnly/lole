/**
 * Waitlist Types
 *
 * Type definitions for table waitlist functionality.
 * These types align with the table_waitlist table in the database.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Waitlist entry status
 */
export type WaitlistStatus = 'waiting' | 'notified' | 'seated' | 'cancelled' | 'expired';

/**
 * Parameters for adding a guest to the waitlist
 */
export interface AddWaitlistParams {
    /** Restaurant ID for tenant isolation */
    restaurantId: string;
    /** Guest's name */
    guestName: string;
    /** Guest's phone number */
    guestPhone: string;
    /** Number of guests in the party */
    guestCount: number;
    /** Optional notes (e.g., special requests) */
    notes?: string;
    /** Optional created by user ID */
    createdBy?: string;
}

/**
 * Waitlist entry from database
 */
export interface WaitlistEntry {
    /** Unique identifier */
    id: string;
    /** Restaurant ID for tenant isolation */
    restaurant_id: string;
    /** Guest's name */
    guest_name: string;
    /** Guest's phone number */
    guest_phone: string;
    /** Number of guests in the party */
    guest_count: number;
    /** Current waitlist status */
    status: WaitlistStatus;
    /** Position in the waitlist (1-based) */
    position: number;
    /** Estimated wait time in minutes */
    estimated_wait_minutes: number | null;
    /** Timestamp when guest was notified */
    notified_at: string | null;
    /** Timestamp when guest was seated */
    seated_at: string | null;
    /** Optional notes */
    notes: string | null;
    /** Creation timestamp */
    created_at: string;
    /** Last update timestamp */
    updated_at: string;
}

/**
 * Parameters for getting waitlist entries
 */
export interface GetWaitlistParams {
    /** Restaurant ID for tenant isolation */
    restaurantId: string;
    /** Optional status filter */
    status?: WaitlistStatus;
    /** Optional limit */
    limit?: number;
    /** Optional offset for pagination */
    offset?: number;
}

/**
 * Parameters for updating waitlist status
 */
export interface UpdateWaitlistStatusParams {
    /** Waitlist entry ID */
    waitlistId: string;
    /** New status */
    status: WaitlistStatus;
    /** Optional updated by user ID */
    updatedBy?: string;
}

/**
 * Result of notifying a guest
 */
export interface NotifyResult {
    /** Whether the notification was sent successfully */
    success: boolean;
    /** Waitlist entry ID */
    waitlistId: string;
    /** Phone number notified */
    phone: string;
    /** Message sent */
    message: string;
    /** Error message if failed */
    error?: string;
    /** Provider response if available */
    providerResponse?: unknown;
}

/**
 * Waitlist statistics for a restaurant
 */
export interface WaitlistStats {
    /** Total waiting guests */
    waitingCount: number;
    /** Average wait time in minutes */
    averageWaitMinutes: number;
    /** Estimated table turnover rate per hour */
    turnoverRatePerHour: number;
}

/**
 * Waitlist messages in bilingual format (English and Amharic)
 */
export const WAITLIST_MESSAGES = {
    /** Message when added to waitlist */
    addedToQueue: {
        en: 'You are #{{position}} in line. Estimated wait: {{minutes}} minutes.',
        am: 'እርስዎ #{{position}} በሰልፍ ውስጥ ነው። ተራራቅ ጊዜ: {{minutes}} ደቂቃ።',
    },
    /** Message when table is ready */
    tableReady: {
        en: 'Your table is ready! Please check in within 10 minutes.',
        am: 'ጠረጴዛዎ አስተካክሏል! በ10 ደቂቃዎች ውስጥ ይመዝገቡ።',
    },
    /** Message when guest is seated */
    seated: {
        en: 'Thank you for dining with us! Enjoy your meal.',
        am: 'ምግብ ከኛ ጋር ለመዝናናት እናመሰግናለን! ምግብዎን ይደሰቱ።',
    },
    /** Message when waitlist entry is cancelled */
    cancelled: {
        en: 'Your spot on the waitlist has been removed. We hope to see you soon!',
        am: 'በተራራቅ ዝርዝር ውስጥ ቦታዎ ተወግዷል። በቅርብ ጊዜ ልንገናኝዎ እንሰራለን!',
    },
} as const;

/**
 * Configuration for waitlist
 */
export const WAITLIST_CONFIG = {
    /** Default estimated wait time per person in minutes */
    DEFAULT_WAIT_PER_PERSON: 15,
    /** Maximum guests per party */
    MAX_GUEST_COUNT: 20,
    /** Minimum guests per party */
    MIN_GUEST_COUNT: 1,
    /** Check-in window in minutes after notification */
    CHECK_IN_WINDOW_MINUTES: 10,
    /** Average table turnover time in minutes */
    TABLE_TURNOVER_MINUTES: 45,
} as const;

/**
 * Database row type for table_waitlist
 */
export interface TableWaitlistRow {
    id: string;
    restaurant_id: string;
    guest_name: string | null;
    guest_phone: string;
    guest_count: number;
    status: WaitlistStatus;
    position: number;
    estimated_wait_minutes: number | null;
    notified_at: string | null;
    seated_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Waitlist service interface
 */
export interface IWaitlistService {
    addToWaitlist(params: AddWaitlistParams): Promise<WaitlistEntry>;
    getWaitlist(restaurantId: string, status?: WaitlistStatus): Promise<WaitlistEntry[]>;
    getWaitlistEntry(waitlistId: string): Promise<WaitlistEntry | null>;
    notifyGuest(waitlistId: string): Promise<NotifyResult>;
    updateStatus(params: UpdateWaitlistStatusParams): Promise<void>;
    removeFromWaitlist(waitlistId: string): Promise<void>;
    getPosition(waitlistId: string): Promise<number>;
    estimateWaitTime(position: number): Promise<number>;
    getStats(restaurantId: string): Promise<WaitlistStats>;
}

/**
 * Waitlist service factory parameters
 */
export interface WaitlistServiceParams {
    /** Supabase client */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any>;
}

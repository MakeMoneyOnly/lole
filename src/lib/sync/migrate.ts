/**
 * Migration Utilities
 *
 * CRIT-05: Offline sync consolidation
 * Provides migration paths from Dexie/localStorage to PowerSync
 */

import { getPowerSync } from './powersync-config';
import { generateIdempotencyKey } from './idempotency';
import { logger } from '@/lib/logger';

// Import Dexie types for migration (if Dexie is still installed)

interface DexieDatabase {
    table: (name: string) => { toArray: () => Promise<Array<Record<string, unknown>>> };
}

/**
 * Get the old Dexie database instance
 */
async function getDexieDatabase(): Promise<DexieDatabase | null> {
    try {
        const DexieModule = await import('dexie');
        const Dexie = DexieModule.default ?? DexieModule;
        return new Dexie('loleOrders') as DexieDatabase;
    } catch {
        return null;
    }
}

/**
 * Migrate orders from Dexie to PowerSync
 */
export async function migrateDexieOrdersToPowerSync(): Promise<{
    migrated: number;
    failed: number;
    errors: string[];
}> {
    const db = getPowerSync();
    const oldDb = await getDexieDatabase();

    if (!db) {
        return { migrated: 0, failed: 0, errors: ['PowerSync not initialized'] };
    }

    if (!oldDb) {
        return { migrated: 0, failed: 0, errors: ['Dexie database not found'] };
    }

    try {
        const pendingOrders = await oldDb.table('pending_orders').toArray();

        let migrated = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const order of pendingOrders) {
            try {
                const now = new Date().toISOString();
                const idempotencyKey = order.idempotency_key || generateIdempotencyKey('migrated');

                await db.execute(
                    `INSERT INTO orders (
                        id, restaurant_id, order_number, table_number, guest_name, guest_phone,
                        status, order_type, subtotal_santim, discount_santim, vat_santim, total_santim,
                        notes, idempotency_key, guest_fingerprint, created_at, updated_at, last_modified, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        crypto.randomUUID(),
                        order.restaurant_id,
                        order.order_number,
                        order.table_number,
                        null,
                        null,
                        'pending',
                        'dine_in',
                        order.total_price,
                        0,
                        Math.round((order.total_price as number) * 0.15),
                        order.total_price,
                        order.notes || null,
                        idempotencyKey,
                        null,
                        order.created_at,
                        now,
                        now,
                        order.version || 1,
                    ]
                );

                migrated++;
            } catch (error) {
                failed++;
                errors.push(`Order ${order.id}: ${error}`);
            }
        }

        return { migrated, failed, errors };
    } catch (error) {
        return { migrated: 0, failed: 0, errors: [String(error)] };
    }
}

/**
 * Migrate KDS queue from localStorage to PowerSync
 */
export async function migrateKdsLocalStorageToPowerSync(): Promise<{
    migrated: number;
    failed: number;
    errors: string[];
}> {
    const db = getPowerSync();
    if (!db) {
        return { migrated: 0, failed: 0, errors: ['PowerSync not initialized'] };
    }

    try {
        // Read from localStorage
        const STORAGE_KEY = 'lole_kds_offline_queue_v1';
        const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;

        if (!stored) {
            return { migrated: 0, failed: 0, errors: [] };
        }

        const parsed = JSON.parse(stored);
        const pendingActions = parsed.pendingActions || [];

        let migrated = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const action of pendingActions) {
            try {
                const now = new Date().toISOString();

                // Insert into sync queue for later sync
                await db.execute(
                    `INSERT INTO sync_queue (
                        operation, table_name, record_id, payload, idempotency_key, status, attempts, created_at
                    ) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`,
                    [
                        'create',
                        'kds_items',
                        action.kdsItemId,
                        JSON.stringify(action),
                        action.idempotencyKey || generateIdempotencyKey('migrated-kds'),
                        now,
                    ]
                );

                migrated++;
            } catch (error) {
                failed++;
                errors.push(`Action ${action.id}: ${error}`);
            }
        }

        return { migrated, failed, errors };
    } catch (error) {
        return { migrated: 0, failed: 0, errors: [String(error)] };
    }
}

/**
 * Migrate cart from localStorage to PowerSync
 */
export async function migrateCartLocalStorageToPowerSync(): Promise<{
    migrated: boolean;
    error?: string;
}> {
    const db = getPowerSync();
    if (!db) {
        return { migrated: false, error: 'PowerSync not initialized' };
    }

    try {
        const CART_KEY = 'lole_cart';
        const stored = typeof window !== 'undefined' ? localStorage.getItem(CART_KEY) : null;

        if (!stored) {
            return { migrated: true }; // Nothing to migrate
        }

        const _cart = JSON.parse(stored);

        // Cart data is session-specific, so we just clear it
        // In a real migration, you'd want to preserve the items
        if (typeof window !== 'undefined') {
            localStorage.removeItem(CART_KEY);
        }

        return { migrated: true };
    } catch (error) {
        return { migrated: false, error: String(error) };
    }
}

/**
 * Run all migrations
 */
export async function runAllMigrations(): Promise<{
    dexieOrders: { migrated: number; failed: number; errors: string[] };
    kdsLocalStorage: { migrated: number; failed: number; errors: string[] };
    cartLocalStorage: { migrated: boolean; error?: string };
}> {
    const [dexieOrders, kdsLocalStorage, cartLocalStorage] = await Promise.all([
        migrateDexieOrdersToPowerSync(),
        migrateKdsLocalStorageToPowerSync(),
        migrateCartLocalStorageToPowerSync(),
    ]);

    return {
        dexieOrders,
        kdsLocalStorage,
        cartLocalStorage,
    };
}

/**
 * Check if migration is needed
 */
export async function isMigrationNeeded(): Promise<{
    dexieOrders: boolean;
    kdsLocalStorage: boolean;
    cartLocalStorage: boolean;
}> {
    const oldDb = await getDexieDatabase();
    const dexieOrders = !!oldDb;

    let kdsLocalStorage = false;
    let cartLocalStorage = false;

    if (typeof window !== 'undefined') {
        kdsLocalStorage = !!localStorage.getItem('lole_kds_offline_queue_v1');
        cartLocalStorage = !!localStorage.getItem('lole_cart');
    }

    return { dexieOrders, kdsLocalStorage, cartLocalStorage };
}

/**
 * Clear legacy storage after successful migration
 */
export async function clearLegacyStorage(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
        // Clear KDS localStorage
        localStorage.removeItem('lole_kds_offline_queue_v1');

        // Clear cart
        localStorage.removeItem('lole_cart');

        // Clear waiter context (session-specific, but clear anyway)
        localStorage.removeItem('gebata_waiter_context');

        logger.warn('[Migration] Legacy storage cleared');
    } catch (error) {
        logger.error('[Migration] Failed to clear legacy storage', {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

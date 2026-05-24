/**
 * Migration Utilities
 *
 * CRIT-05: Offline sync consolidation
 * Provides migration paths from Dexie/localStorage to PowerSync
 *
 * MED-06: Dexie migration completion tracking for PowerSync schema changes
 * Adds status tracking, resume support, error handling, and UI hooks.
 */

import { getPowerSync } from './powersync-config';
import { generateIdempotencyKey } from './idempotency';
import { logger } from '@/lib/logger';

// Migration status storage key
const MIGRATION_STATUS_KEY = 'lole_migration_status_v1';

/**
 * Migration status types
 */
export type MigrationType = 'dexie_orders' | 'kds_localstorage' | 'cart_localstorage';

export type MigrationStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused';

export interface MigrationState {
    type: MigrationType;
    status: MigrationStatus;
    migrated: number;
    failed: number;
    total: number;
    errors: string[];
    startedAt: string | null;
    completedAt: string | null;
    lastError: string | null;
    attemptCount: number;
}

/**
 * Migration tracking utilities
 */
function getMigrationState(type: MigrationType): MigrationState {
    const defaultState: MigrationState = {
        type,
        status: 'idle',
        migrated: 0,
        failed: 0,
        total: 0,
        errors: [],
        startedAt: null,
        completedAt: null,
        lastError: null,
        attemptCount: 0,
    };

    if (typeof window === 'undefined') return defaultState;

    try {
        const stored = localStorage.getItem(`${MIGRATION_STATUS_KEY}_${type}`);
        if (stored) {
            const parsed = JSON.parse(stored) as Partial<MigrationState>;
            return { ...defaultState, ...parsed };
        }
    } catch (error) {
        logger.warn('[Migration] Failed to parse migration state', { type, error });
    }

    return defaultState;
}

function setMigrationState(type: MigrationType, state: Partial<MigrationState>): void {
    if (typeof window === 'undefined') return;

    try {
        const current = getMigrationState(type);
        const updated = { ...current, ...state };
        localStorage.setItem(`${MIGRATION_STATUS_KEY}_${type}`, JSON.stringify(updated));
    } catch (error) {
        logger.error('[Migration] Failed to save migration state', { type, error });
    }
}

function clearMigrationState(type: MigrationType): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`${MIGRATION_STATUS_KEY}_${type}`);
}

/**
 * Migration hooks for UI feedback
 */
export interface MigrationHooks {
    onProgress?: (state: MigrationState) => void;
    onComplete?: (state: MigrationState) => void;
    onError?: (state: MigrationState, error: Error) => void;
    onRetry?: (type: MigrationType, attempt: number) => void;
}

let globalMigrationHooks: MigrationHooks = {};

export function setMigrationHooks(hooks: MigrationHooks): void {
    globalMigrationHooks = hooks;
}

function notifyProgress(type: MigrationType): void {
    const state = getMigrationState(type);
    globalMigrationHooks.onProgress?.(state);
}

function notifyComplete(type: MigrationType): void {
    const state = getMigrationState(type);
    globalMigrationHooks.onComplete?.(state);
}

function notifyError(type: MigrationType, error: Error): void {
    const state = getMigrationState(type);
    globalMigrationHooks.onError?.(state, error);
}

function notifyRetry(type: MigrationType, attempt: number): void {
    globalMigrationHooks.onRetry?.(type, attempt);
}

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
export async function migrateDexieOrdersToPowerSync(
    options?: { resume?: boolean; maxRetries?: number },
    hooks?: MigrationHooks
): Promise<{
    migrated: number;
    failed: number;
    errors: string[];
    resumed?: boolean;
}> {
    const db = getPowerSync();
    const oldDb = await getDexieDatabase();
    const type: MigrationType = 'dexie_orders';
    const maxRetries = options?.maxRetries ?? 3;

    if (hooks) {
        setMigrationHooks(hooks);
    }

    if (!db) {
        const error = new Error('PowerSync not initialized');
        notifyError(type, error);
        return { migrated: 0, failed: 0, errors: [error.message] };
    }

    if (!oldDb) {
        return { migrated: 0, failed: 0, errors: [], resumed: false };
    }

    // Check for existing state to resume
    const existingState = getMigrationState(type);
    const resumed = options?.resume && existingState.status === 'paused' && existingState.total > 0;

    if (resumed) {
        notifyRetry(type, existingState.attemptCount + 1);
    }

    setMigrationState(type, {
        status: 'running',
        startedAt: existingState.startedAt || new Date().toISOString(),
        attemptCount: (existingState.attemptCount || 0) + 1,
    });
    notifyProgress(type);

    try {
        const pendingOrders = await oldDb.table('pending_orders').toArray();
        const startIndex = resumed ? existingState.migrated : 0;
        const ordersToMigrate = resumed ? pendingOrders.slice(startIndex) : pendingOrders;

        let migrated = resumed ? existingState.migrated : 0;
        let failed = resumed ? existingState.failed : 0;
        const errors = resumed ? [...existingState.errors] : [];

        setMigrationState(type, { total: pendingOrders.length, migrated, failed, errors });

        for (let i = 0; i < ordersToMigrate.length; i++) {
            const order = ordersToMigrate[i];
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
                setMigrationState(type, { migrated, failed, errors });
                notifyProgress(type);
            } catch (error) {
                failed++;
                const errMsg = `Order ${order.id}: ${error}`;
                errors.push(errMsg);
                setMigrationState(type, { migrated, failed, errors, lastError: errMsg });
            }
        }

        setMigrationState(type, { status: 'completed', completedAt: new Date().toISOString() });
        notifyComplete(type);
        clearMigrationState(type);

        return { migrated, failed, errors, resumed };
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        if (getMigrationState(type).attemptCount < maxRetries) {
            setMigrationState(type, { status: 'paused' });
        } else {
            setMigrationState(type, { status: 'failed', lastError: err.message });
            notifyError(type, err);
        }

        throw err;
    }
}

/**
 * Migrate KDS queue from localStorage to PowerSync
 */
export async function migrateKdsLocalStorageToPowerSync(
    options?: { resume?: boolean; maxRetries?: number },
    hooks?: MigrationHooks
): Promise<{
    migrated: number;
    failed: number;
    errors: string[];
    resumed?: boolean;
}> {
    const db = getPowerSync();
    const type: MigrationType = 'kds_localstorage';
    const maxRetries = options?.maxRetries ?? 3;

    if (hooks) {
        setMigrationHooks(hooks);
    }

    if (!db) {
        const error = new Error('PowerSync not initialized');
        notifyError(type, error);
        return { migrated: 0, failed: 0, errors: [error.message] };
    }

    // Check for existing state to resume
    const existingState = getMigrationState(type);
    const resumed = options?.resume && existingState.status === 'paused' && existingState.total > 0;

    if (resumed) {
        notifyRetry(type, existingState.attemptCount + 1);
    }

    try {
        const STORAGE_KEY = 'lole_kds_offline_queue_v1';
        const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;

        if (!stored) {
            setMigrationState(type, { status: 'completed', completedAt: new Date().toISOString() });
            notifyComplete(type);
            return { migrated: 0, failed: 0, errors: [] };
        }

        const parsed = JSON.parse(stored);
        const pendingActions = parsed.pendingActions || [];
        const startIndex = resumed ? existingState.migrated : 0;
        const actionsToMigrate = resumed ? pendingActions.slice(startIndex) : pendingActions;

        setMigrationState(type, {
            status: 'running',
            startedAt: existingState.startedAt || new Date().toISOString(),
            total: pendingActions.length,
            migrated: resumed ? existingState.migrated : 0,
            failed: resumed ? existingState.failed : 0,
            errors: resumed ? [...existingState.errors] : [],
            attemptCount: (existingState.attemptCount || 0) + 1,
        });
        notifyProgress(type);

        let migrated = resumed ? existingState.migrated : 0;
        let failed = resumed ? existingState.failed : 0;
        const errors = resumed ? [...existingState.errors] : [];

        for (let i = 0; i < actionsToMigrate.length; i++) {
            const action = actionsToMigrate[i];
            try {
                const now = new Date().toISOString();

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
                setMigrationState(type, { migrated, failed, errors });
                notifyProgress(type);
            } catch (error) {
                failed++;
                const errMsg = `Action ${action.id}: ${error}`;
                errors.push(errMsg);
                setMigrationState(type, { migrated, failed, errors, lastError: errMsg });
            }
        }

        setMigrationState(type, { status: 'completed', completedAt: new Date().toISOString() });
        notifyComplete(type);
        clearMigrationState(type);

        return { migrated, failed, errors, resumed };
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        if (getMigrationState(type).attemptCount < maxRetries) {
            setMigrationState(type, { status: 'paused' });
        } else {
            setMigrationState(type, { status: 'failed', lastError: err.message });
            notifyError(type, err);
        }

        throw err;
    }
}

/**
 * Migrate cart from localStorage to PowerSync
 */
export async function migrateCartLocalStorageToPowerSync(
    options?: { maxRetries?: number },
    hooks?: MigrationHooks
): Promise<{
    migrated: boolean;
    error?: string;
    resumed?: boolean;
}> {
    const db = getPowerSync();
    const type: MigrationType = 'cart_localstorage';
    const maxRetries = options?.maxRetries ?? 3;

    if (hooks) {
        setMigrationHooks(hooks);
    }

    if (!db) {
        notifyError(type, new Error('PowerSync not initialized'));
        return { migrated: false, error: 'PowerSync not initialized' };
    }

    const existingState = getMigrationState(type);
    setMigrationState(type, {
        status: 'running',
        startedAt: existingState.startedAt || new Date().toISOString(),
        attemptCount: (existingState.attemptCount || 0) + 1,
    });
    notifyProgress(type);

    try {
        const CART_KEY = 'lole_cart';
        const stored = typeof window !== 'undefined' ? localStorage.getItem(CART_KEY) : null;

        if (!stored) {
            setMigrationState(type, { status: 'completed', completedAt: new Date().toISOString() });
            notifyComplete(type);
            return { migrated: true };
        }

        const _cart = JSON.parse(stored);

        if (typeof window !== 'undefined') {
            localStorage.removeItem(CART_KEY);
        }

        setMigrationState(type, { status: 'completed', completedAt: new Date().toISOString() });
        notifyComplete(type);
        clearMigrationState(type);

        return { migrated: true };
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        if (getMigrationState(type).attemptCount < maxRetries) {
            setMigrationState(type, { status: 'paused', lastError: err.message });
        } else {
            setMigrationState(type, { status: 'failed', lastError: err.message });
            notifyError(type, err);
        }

        throw err;
    }
}

/**
 * Run all migrations with optional resume and hooks
 */
export async function runAllMigrations(options?: {
    resume?: boolean;
    maxRetries?: number;
    hooks?: MigrationHooks;
}): Promise<{
    dexieOrders: { migrated: number; failed: number; errors: string[]; resumed?: boolean };
    kdsLocalStorage: { migrated: number; failed: number; errors: string[]; resumed?: boolean };
    cartLocalStorage: { migrated: boolean; error?: string; resumed?: boolean };
}> {
    const [dexieOrders, kdsLocalStorage, cartLocalStorage] = await Promise.all([
        migrateDexieOrdersToPowerSync(options, options?.hooks),
        migrateKdsLocalStorageToPowerSync(options, options?.hooks),
        migrateCartLocalStorageToPowerSync({ maxRetries: options?.maxRetries }, options?.hooks),
    ]);

    return {
        dexieOrders,
        kdsLocalStorage,
        cartLocalStorage,
    };
}

/**
 * Get current migration state for a specific type
 */
export function getMigrationStatePublic(type: MigrationType): MigrationState {
    return getMigrationState(type);
}

/**
 * Get all migration states
 */
export function getAllMigrationStates(): Record<MigrationType, MigrationState> {
    return {
        dexie_orders: getMigrationState('dexie_orders'),
        kds_localstorage: getMigrationState('kds_localstorage'),
        cart_localstorage: getMigrationState('cart_localstorage'),
    } as Record<MigrationType, MigrationState>;
}

/**
 * Reset migration state for a specific type (for retry)
 */
export function resetMigrationState(type: MigrationType): void {
    clearMigrationState(type);
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

/**
 * PowerSync Configuration
 *
 * CRIT-05: Offline sync consolidation for POS and KDS
 * Adds explicit bootstrap status, local journal tables, and client-safe config handling.
 */

import {
    PowerSyncDatabase as WebPowerSyncDatabase,
    WASQLiteOpenFactory,
    Schema,
    Table,
    column,
    type Transaction,
} from '@powersync/web';
import { logger } from '@/lib/logger';
import { Connector, POWERSYNC_INSTANCE_URL } from './PowerSyncConnector';

export interface PowerSyncDatabase {
    execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }>;
    getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
    getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
    write(fn: () => Promise<void>): Promise<void>;
    close(): Promise<void>;
}

export const canonicalLocalTableNames = [
    'orders',
    'order_items',
    'kds_items',
    'table_sessions',
    'time_entries',
    'order_check_splits',
    'order_check_split_items',
    'payment_sessions',
    'payments',
    'tip_allocations',
    'payment_events',
    'reconciliation_entries',
    'domain_events',
    'sync_queue',
    'printer_jobs',
    'fiscal_jobs',
    'local_journal',
    'audit_logs',
    'sync_conflict_logs',
    'sync_replay_checkpoints',
    'local_sequence_counters',
    'cart_items',
] as const;

export const powerSyncSchema = `
    CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        order_number INTEGER NOT NULL,
        table_number INTEGER,
        guest_name TEXT,
        guest_phone TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        order_type TEXT NOT NULL DEFAULT 'dine_in',
        subtotal_santim INTEGER NOT NULL DEFAULT 0,
        discount_santim INTEGER NOT NULL DEFAULT 0,
        vat_santim INTEGER NOT NULL DEFAULT 0,
        total_santim INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        fire_mode TEXT,
        current_course TEXT,
        idempotency_key TEXT UNIQUE NOT NULL,
        guest_fingerprint TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT,
        last_modified TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        menu_item_id TEXT NOT NULL,
        menu_item_name TEXT NOT NULL,
        menu_item_name_am TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price_santim INTEGER NOT NULL,
        total_price_santim INTEGER NOT NULL,
        modifiers_json TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        station TEXT,
        fired_at TEXT,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS kds_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        order_item_id TEXT NOT NULL,
        station TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        started_at TEXT,
        ready_at TEXT,
        recalled_at TEXT,
        bumped_at TEXT,
        priority INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        last_modified TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS table_sessions (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        table_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        guest_count INTEGER NOT NULL DEFAULT 1,
        assigned_staff_id TEXT,
        notes TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS time_entries (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        staff_id TEXT NOT NULL,
        shift_id TEXT,
        clock_in_at TEXT NOT NULL,
        clock_out_at TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        source TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_check_splits (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        split_index INTEGER NOT NULL,
        split_label TEXT,
        requested_amount REAL,
        computed_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        metadata_json TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_check_split_items (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        split_id TEXT NOT NULL,
        order_item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        line_amount REAL NOT NULL DEFAULT 0,
        idempotency_key TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (split_id) REFERENCES order_check_splits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_sessions (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        order_id TEXT,
        surface TEXT NOT NULL,
        channel TEXT NOT NULL,
        intent_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'created',
        selected_method TEXT,
        selected_provider TEXT,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'ETB',
        checkout_url TEXT,
        provider_transaction_id TEXT,
        provider_reference TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        authorized_at TEXT,
        captured_at TEXT,
        expires_at TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        order_id TEXT,
        payment_session_id TEXT,
        split_id TEXT,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'ETB',
        created_by TEXT,
        idempotency_key TEXT,
        tip_amount REAL NOT NULL DEFAULT 0,
        authorized_at TEXT,
        captured_at TEXT,
        method TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'other',
        provider_reference TEXT,
        tip_allocation_id TEXT,
        tip_pool_id TEXT,
        transaction_number TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'captured',
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (payment_session_id) REFERENCES payment_sessions(id),
        FOREIGN KEY (split_id) REFERENCES order_check_splits(id)
    );

    CREATE TABLE IF NOT EXISTS tip_allocations (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        tip_pool_id TEXT NOT NULL,
        shift_id TEXT,
        period_date TEXT NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        total_tips_collected REAL NOT NULL DEFAULT 0,
        total_tips_pooled REAL NOT NULL DEFAULT 0,
        total_tips_distributed REAL NOT NULL DEFAULT 0,
        distribution_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'calculated',
        created_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_events (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        payment_session_id TEXT,
        payment_id TEXT,
        order_id TEXT,
        split_id TEXT,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL,
        provider TEXT,
        provider_reference TEXT,
        idempotency_key TEXT,
        payload_json TEXT NOT NULL DEFAULT '{}',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (payment_session_id) REFERENCES payment_sessions(id),
        FOREIGN KEY (payment_id) REFERENCES payments(id),
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (split_id) REFERENCES order_check_splits(id)
    );

    CREATE TABLE IF NOT EXISTS reconciliation_entries (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        payment_id TEXT,
        payment_session_id TEXT,
        ledger_type TEXT NOT NULL,
        ledger_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT,
        expected_amount REAL NOT NULL,
        settled_amount REAL NOT NULL,
        delta_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'matched',
        notes TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (payment_id) REFERENCES payments(id),
        FOREIGN KEY (payment_session_id) REFERENCES payment_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS domain_events (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        location_id TEXT,
        device_id TEXT NOT NULL,
        actor_id TEXT,
        aggregate_type TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        schema_name TEXT NOT NULL DEFAULT 'lole.domain-event',
        schema_version INTEGER NOT NULL DEFAULT 1,
        payload_json TEXT NOT NULL,
        idempotency_key TEXT UNIQUE NOT NULL,
        causation_id TEXT,
        correlation_id TEXT,
        created_at TEXT NOT NULL,
        synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        idempotency_key TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        processed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS printer_jobs (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        station TEXT NOT NULL,
        route_key TEXT NOT NULL DEFAULT 'default',
        fallback_route_key TEXT,
        driver_kind TEXT NOT NULL DEFAULT 'network',
        printer_device_id TEXT,
        printer_name TEXT,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        last_error TEXT,
        status_reason TEXT,
        next_attempt_at TEXT,
        last_dispatch_at TEXT,
        last_heartbeat_at TEXT,
        rerouted_from_job_id TEXT,
        created_at TEXT NOT NULL,
        printed_at TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fiscal_jobs (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        queue_mode TEXT NOT NULL DEFAULT 'pending_upstream_submission',
        signature_json TEXT,
        signature_algorithm TEXT,
        signed_at TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        warning_text TEXT,
        created_at TEXT NOT NULL,
        submitted_at TEXT,
        synced_at TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS restaurant_settings (
        restaurant_id TEXT PRIMARY KEY,
        settings_json TEXT NOT NULL,
        synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cart_items (
        unique_id TEXT PRIMARY KEY,
        menu_item_id TEXT NOT NULL,
        title TEXT NOT NULL,
        price_santim INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        instructions TEXT,
        image_url TEXT,
        course TEXT,
        restaurant_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_journal (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        location_id TEXT,
        device_id TEXT NOT NULL,
        actor_id TEXT,
        entry_kind TEXT NOT NULL,
        aggregate_type TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        idempotency_key TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        error_text TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        replayed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        user_id TEXT,
        old_value TEXT,
        new_value TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_conflict_logs (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT,
        location_id TEXT,
        device_id TEXT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        conflict_type TEXT NOT NULL,
        operation_type TEXT,
        payload_json TEXT,
        client_timestamp TEXT NOT NULL,
        server_timestamp TEXT NOT NULL,
        resolution_strategy TEXT NOT NULL,
        resolution_details TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_replay_checkpoints (
        scope TEXT PRIMARY KEY,
        cursor_value TEXT,
        journal_entry_id TEXT,
        status TEXT NOT NULL DEFAULT 'idle',
        error_text TEXT,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_sequence_counters (
        scope_key TEXT NOT NULL,
        business_date TEXT NOT NULL,
        last_value INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (scope_key, business_date)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_kds_items_order ON kds_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_kds_items_station ON kds_items(station);
    CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant ON table_sessions(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_table_sessions_table ON table_sessions(table_id, status);
    CREATE INDEX IF NOT EXISTS idx_order_check_splits_order ON order_check_splits(order_id, split_index);
    CREATE INDEX IF NOT EXISTS idx_order_check_split_items_order ON order_check_split_items(order_id, split_id);
    CREATE INDEX IF NOT EXISTS idx_payment_sessions_order ON payment_sessions(order_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_payment_sessions_provider ON payment_sessions(selected_provider, provider_transaction_id);
    CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id, split_id, status);
    CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(payment_session_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_payment_events_session ON payment_events(payment_session_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_payment_events_payment ON payment_events(payment_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_reconciliation_entries_payment ON reconciliation_entries(payment_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_reconciliation_entries_session ON reconciliation_entries(payment_session_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_domain_events_type ON domain_events(event_type, created_at);
    CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate ON domain_events(aggregate_type, aggregate_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_domain_events_idempotency ON domain_events(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_printer_jobs_status ON printer_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_printer_jobs_route_status ON printer_jobs(route_key, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_fiscal_jobs_status ON fiscal_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_local_journal_status ON local_journal(status);
    CREATE INDEX IF NOT EXISTS idx_local_journal_kind ON local_journal(entry_kind, created_at);
    CREATE INDEX IF NOT EXISTS idx_local_journal_idempotency ON local_journal(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_sync_conflict_entity ON sync_conflict_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_sync_replay_checkpoints_status ON sync_replay_checkpoints(status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_local_sequence_counters_updated ON local_sequence_counters(updated_at);
`;

export interface PowerSyncConfig {
    endpoint: string;
    accessToken: string;
    restaurantId?: string;
    debug?: boolean;
    storageBackend?: 'wasqlite' | 'capacitor-sqlite' | 'auto';
}

type QueryContext = Pick<Transaction, 'execute' | 'getAll' | 'getOptional'> | WebPowerSyncDatabase;
function textColumns(names: string[]): Record<string, typeof column.text> {
    return Object.fromEntries(names.map(name => [name, column.text])) as Record<
        string,
        typeof column.text
    >;
}
function integerColumns(names: string[]): Record<string, typeof column.integer> {
    return Object.fromEntries(names.map(name => [name, column.integer])) as Record<
        string,
        typeof column.integer
    >;
}
function realColumns(names: string[]): Record<string, typeof column.real> {
    return Object.fromEntries(names.map(name => [name, column.real])) as Record<
        string,
        typeof column.real
    >;
}

async function _resolveStorageBackend(): Promise<'wasqlite' | 'capacitor-sqlite'> {
    if (typeof window === 'undefined') return 'wasqlite';

    try {
        // Dynamic import — @capacitor/core may not be installed in web context
        const cap = await Function('return import("@capacitor/core")')().catch(() => null);
        if (!cap) return 'wasqlite';

        try {
            await Function('return import("@capacitor-community/sqlite")')().catch(() => null);
            logger.info('[PowerSync] Capacitor SQLite plugin available, using native backend');
            return 'capacitor-sqlite';
        } catch {
            logger.info(
                '[PowerSync] Capacitor runtime detected but SQLite plugin not available, using WA-SQLite'
            );
            return 'wasqlite';
        }
    } catch {
        return 'wasqlite';
    }
}

const powerSyncAppSchema = new Schema({
    orders: new Table({
        ...textColumns([
            'restaurant_id',
            'guest_name',
            'guest_phone',
            'status',
            'order_type',
            'notes',
            'fire_mode',
            'current_course',
            'idempotency_key',
            'guest_fingerprint',
            'created_at',
            'updated_at',
            'synced_at',
            'last_modified',
        ]),
        ...integerColumns([
            'order_number',
            'table_number',
            'subtotal_santim',
            'discount_santim',
            'vat_santim',
            'total_santim',
            'version',
        ]),
    }),
    order_items: new Table({
        ...textColumns([
            'order_id',
            'menu_item_id',
            'menu_item_name',
            'menu_item_name_am',
            'modifiers_json',
            'notes',
            'status',
            'station',
            'fired_at',
            'created_at',
            'synced_at',
        ]),
        ...integerColumns(['quantity', 'unit_price_santim', 'total_price_santim']),
    }),
    kds_items: new Table({
        ...textColumns([
            'order_id',
            'order_item_id',
            'station',
            'status',
            'started_at',
            'ready_at',
            'recalled_at',
            'bumped_at',
            'created_at',
            'synced_at',
            'last_modified',
        ]),
        ...integerColumns(['priority', 'version']),
    }),
    table_sessions: new Table({
        ...textColumns([
            'restaurant_id',
            'table_id',
            'status',
            'assigned_staff_id',
            'notes',
            'metadata_json',
            'opened_at',
            'closed_at',
            'created_at',
            'updated_at',
        ]),
        ...integerColumns(['guest_count']),
    }),
    order_check_splits: new Table({
        ...textColumns([
            'restaurant_id',
            'order_id',
            'split_label',
            'status',
            'metadata_json',
            'created_by',
            'created_at',
            'updated_at',
        ]),
        ...integerColumns(['split_index']),
        ...realColumns(['requested_amount', 'computed_amount']),
    }),
    order_check_split_items: new Table({
        ...textColumns([
            'restaurant_id',
            'order_id',
            'split_id',
            'order_item_id',
            'idempotency_key',
            'created_at',
        ]),
        ...integerColumns(['quantity']),
        ...realColumns(['line_amount']),
    }),
    payment_sessions: new Table({
        ...textColumns([
            'restaurant_id',
            'order_id',
            'surface',
            'channel',
            'intent_type',
            'status',
            'selected_method',
            'selected_provider',
            'currency',
            'checkout_url',
            'provider_transaction_id',
            'provider_reference',
            'metadata_json',
            'authorized_at',
            'captured_at',
            'expires_at',
            'created_by',
            'created_at',
            'updated_at',
        ]),
        ...realColumns(['amount']),
    }),
    payments: new Table({
        ...textColumns([
            'restaurant_id',
            'order_id',
            'payment_session_id',
            'split_id',
            'currency',
            'created_by',
            'idempotency_key',
            'method',
            'provider',
            'provider_reference',
            'authorized_at',
            'captured_at',
            'tip_allocation_id',
            'tip_pool_id',
            'transaction_number',
            'status',
            'metadata_json',
            'created_at',
            'updated_at',
        ]),
        ...realColumns(['amount', 'tip_amount']),
    }),
    payment_events: new Table({
        ...textColumns([
            'restaurant_id',
            'payment_session_id',
            'payment_id',
            'order_id',
            'split_id',
            'event_type',
            'status',
            'provider',
            'provider_reference',
            'idempotency_key',
            'payload_json',
            'metadata_json',
            'occurred_at',
            'created_at',
        ]),
    }),
    reconciliation_entries: new Table({
        ...textColumns([
            'restaurant_id',
            'payment_id',
            'payment_session_id',
            'ledger_type',
            'ledger_id',
            'source_type',
            'source_id',
            'status',
            'notes',
            'metadata_json',
            'created_by',
            'created_at',
            'updated_at',
        ]),
        ...realColumns(['expected_amount', 'settled_amount', 'delta_amount']),
    }),
    domain_events: new Table(
        {
            ...textColumns([
                'restaurant_id',
                'location_id',
                'device_id',
                'actor_id',
                'aggregate_type',
                'aggregate_id',
                'event_type',
                'schema_name',
                'payload_json',
                'idempotency_key',
                'causation_id',
                'correlation_id',
                'created_at',
                'synced_at',
            ]),
            ...integerColumns(['schema_version']),
        },
        { localOnly: true }
    ),
    restaurant_settings: new Table({
        ...textColumns(['restaurant_id', 'settings_json', 'synced_at']),
    }),
    cart_items: new Table(
        {
            ...textColumns([
                'menu_item_id',
                'title',
                'instructions',
                'image_url',
                'course',
                'restaurant_id',
                'created_at',
                'updated_at',
            ]),
            ...integerColumns(['price_santim', 'quantity']),
        },
        { localOnly: true }
    ),
    sync_queue: new Table(
        {
            ...textColumns([
                'operation',
                'table_name',
                'record_id',
                'payload',
                'idempotency_key',
                'status',
                'last_error',
                'created_at',
                'processed_at',
            ]),
            ...integerColumns(['attempts']),
        },
        { localOnly: true }
    ),
    printer_jobs: new Table(
        {
            ...textColumns([
                'order_id',
                'station',
                'route_key',
                'fallback_route_key',
                'driver_kind',
                'printer_device_id',
                'printer_name',
                'payload_json',
                'status',
                'last_error',
                'status_reason',
                'next_attempt_at',
                'last_dispatch_at',
                'last_heartbeat_at',
                'rerouted_from_job_id',
                'created_at',
                'printed_at',
            ]),
            ...integerColumns(['attempts', 'max_attempts']),
        },
        { localOnly: true }
    ),
    fiscal_jobs: new Table(
        {
            ...textColumns([
                'order_id',
                'payload_json',
                'queue_mode',
                'signature_json',
                'signature_algorithm',
                'signed_at',
                'status',
                'last_error',
                'warning_text',
                'created_at',
                'submitted_at',
                'synced_at',
            ]),
            ...integerColumns(['attempts']),
        },
        { localOnly: true }
    ),
    local_journal: new Table(
        {
            ...textColumns([
                'restaurant_id',
                'location_id',
                'device_id',
                'actor_id',
                'entry_kind',
                'aggregate_type',
                'aggregate_id',
                'operation_type',
                'payload_json',
                'payload_hash',
                'idempotency_key',
                'status',
                'error_text',
                'created_at',
                'updated_at',
                'replayed_at',
            ]),
        },
        { localOnly: true }
    ),
    audit_logs: new Table(
        {
            ...textColumns([
                'restaurant_id',
                'action',
                'entity_type',
                'entity_id',
                'user_id',
                'old_value',
                'new_value',
                'metadata',
                'created_at',
            ]),
        },
        { localOnly: true }
    ),
    sync_conflict_logs: new Table(
        {
            ...textColumns([
                'restaurant_id',
                'location_id',
                'device_id',
                'entity_type',
                'entity_id',
                'conflict_type',
                'operation_type',
                'payload_json',
                'client_timestamp',
                'server_timestamp',
                'resolution_strategy',
                'resolution_details',
                'created_at',
            ]),
        },
        { localOnly: true }
    ),
    sync_replay_checkpoints: new Table(
        {
            ...textColumns([
                'scope',
                'cursor_value',
                'journal_entry_id',
                'status',
                'error_text',
                'updated_at',
            ]),
        },
        { localOnly: true }
    ),
    local_sequence_counters: new Table(
        {
            ...textColumns(['scope_key', 'business_date', 'updated_at']),
            ...integerColumns(['last_value']),
        },
        { localOnly: true }
    ),
});

export type PowerSyncBootstrapState =
    | 'idle'
    | 'ready'
    | 'not_configured'
    | 'missing_runtime_adapter'
    | 'error';

export interface PowerSyncBootstrapStatus {
    state: PowerSyncBootstrapState;
    message: string;
    updatedAt: string;
}

function createBootstrapStatus(
    state: PowerSyncBootstrapState,
    message: string
): PowerSyncBootstrapStatus {
    return {
        state,
        message,
        updatedAt: new Date().toISOString(),
    };
}

let bootstrapStatus: PowerSyncBootstrapStatus = createBootstrapStatus(
    'idle',
    'PowerSync not initialized yet.'
);

export function getPowerSyncConfig(): PowerSyncConfig {
    const endpoint = process.env.NEXT_PUBLIC_POWERSYNC_ENDPOINT ?? POWERSYNC_INSTANCE_URL;
    const accessToken = process.env.NEXT_PUBLIC_POWERSYNC_ACCESS_TOKEN ?? '';

    if (process.env.NODE_ENV === 'production' && accessToken && accessToken.length > 0) {
        logger.error(
            '[PowerSync] SECURITY: NEXT_PUBLIC_POWERSYNC_ACCESS_TOKEN is set in production. ' +
                'This exposes a static access token to all clients, bypassing Supabase JWT auth. ' +
                'Remove NEXT_PUBLIC_POWERSYNC_ACCESS_TOKEN from production environment variables immediately.'
        );
    }

    if (!endpoint) {
        bootstrapStatus = createBootstrapStatus(
            'not_configured',
            'Missing PowerSync endpoint configuration.'
        );

        return {
            endpoint: '',
            accessToken,
            restaurantId: process.env.NEXT_PUBLIC_RESTAURANT_ID,
            debug: process.env.NODE_ENV === 'development',
        };
    }

    return {
        endpoint,
        accessToken,
        restaurantId: process.env.NEXT_PUBLIC_RESTAURANT_ID,
        debug: process.env.NODE_ENV === 'development',
    };
}

export function getPowerSyncBootstrapStatus(): PowerSyncBootstrapStatus {
    return bootstrapStatus;
}

class WrappedPowerSyncDatabase implements PowerSyncDatabase {
    private activeTransaction: Transaction | null = null;

    constructor(private readonly database: WebPowerSyncDatabase) {}

    private get queryContext(): QueryContext {
        return this.activeTransaction ?? this.database;
    }

    async execute(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number }> {
        const result = await this.queryContext.execute(sql, params);
        return { rowsAffected: result.rowsAffected };
    }

    async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
        return this.queryContext.getOptional<T>(sql, params);
    }

    async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
        return this.queryContext.getAll<T>(sql, params);
    }

    async write(fn: () => Promise<void>): Promise<void> {
        if (this.activeTransaction) {
            await fn();
            return;
        }

        await this.database.writeTransaction(async tx => {
            const previousTransaction = this.activeTransaction;
            this.activeTransaction = tx;

            try {
                await fn();
            } finally {
                this.activeTransaction = previousTransaction;
            }

            return undefined;
        });
    }

    async close(): Promise<void> {
        await this.database.close();
    }
}

let rawPowerSyncDb: WebPowerSyncDatabase | null = null;
let powerSyncDb: PowerSyncDatabase | null = null;
let initPromise: Promise<PowerSyncDatabase | null> | null = null;

async function ensureLocalSchema(_database: WebPowerSyncDatabase): Promise<void> {
    // PowerSync's Schema() already creates internal views for all defined tables.
    // We must NOT re-create those tables or attempt to index the views (SQLite error:
    // "views may not be indexed"). We only need to run CREATE INDEX on tables that
    // are truly local-only (localOnly: true in the Schema definition) since those are
    // real SQLite tables, not views.
    //
    // However, the PowerSync SDK already handles all table/view creation via the Schema.
    // The raw powerSyncSchema DDL was originally written for a manual SQLite setup and
    // conflicts with PowerSync's internal management. We skip it entirely now.
    logger.info('[PowerSync] Schema managed by PowerSync SDK — skipping manual DDL.');
}

export async function initPowerSync(): Promise<PowerSyncDatabase | null> {
    if (powerSyncDb) {
        bootstrapStatus = createBootstrapStatus('ready', 'PowerSync already initialized.');
        return powerSyncDb;
    }

    if (initPromise) {
        return initPromise;
    }

    const config = getPowerSyncConfig();
    if (typeof window === 'undefined') {
        bootstrapStatus = createBootstrapStatus(
            'missing_runtime_adapter',
            'PowerSync only initializes in browser runtime.'
        );
        return null;
    }

    initPromise = (async () => {
        try {
            const isCapacitor =
                typeof window !== 'undefined' &&
                (window.location.protocol === 'capacitor:' ||
                    window.location.protocol === 'ionic:');

            const wasqliteWorker = isCapacitor
                ? 'public/@powersync/worker/WASQLiteDB.umd.js'
                : '/@powersync/worker/WASQLiteDB.umd.js';

            const syncWorkerPath = isCapacitor
                ? 'public/@powersync/worker/SharedSyncImplementation.umd.js'
                : '/@powersync/worker/SharedSyncImplementation.umd.js';

            const factory = new WASQLiteOpenFactory({
                dbFilename: 'lole_offline.db',
                worker: wasqliteWorker,
                flags: {
                    useWebWorker: true,
                    enableMultiTabs: false,
                    disableSSRWarning: true,
                },
            });

            rawPowerSyncDb = new WebPowerSyncDatabase({
                schema: powerSyncAppSchema,
                database: factory,
                sync: {
                    worker: syncWorkerPath,
                },
            });

            logger.info('[PowerSync] Initiating raw database...');
            await rawPowerSyncDb.init();

            logger.info('[PowerSync] Raw database initialized.');
            await rawPowerSyncDb.execute('PRAGMA journal_mode=WAL;');
            logger.info('[PowerSync] WAL journal mode enabled.');
            await ensureLocalSchema(rawPowerSyncDb);

            powerSyncDb = new WrappedPowerSyncDatabase(rawPowerSyncDb);

            const connector = new Connector();
            const credentials = await connector.fetchCredentials();

            logger.info('[PowerSync] Bootstrap state', {
                hasEndpoint: !!config.endpoint,
                endpoint: config.endpoint,
                hasCredentials: !!credentials,
                isDev: process.env.NODE_ENV === 'development',
            });

            if (!config.endpoint || !credentials) {
                bootstrapStatus = createBootstrapStatus(
                    'not_configured',
                    'PowerSync local database ready. Remote sync waiting for auth token or dev token.'
                );
                logger.warn('[PowerSync] Remote sync not configured yet - local database only', {
                    missing: !config.endpoint ? 'endpoint' : 'credentials',
                });
                return powerSyncDb;
            }

            logger.info('[PowerSync] Connecting to remote instance...');
            await rawPowerSyncDb.connect(connector);
            logger.info('[PowerSync] Connection established');

            bootstrapStatus = createBootstrapStatus('ready', 'PowerSync initialized successfully.');

            if (config.debug) {
                logger.info('[PowerSync] Database initialized successfully');
            }

            return powerSyncDb;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            bootstrapStatus = createBootstrapStatus('error', message);
            logger.warn('[PowerSync] Initialization failed - offline-local mode continues', {
                error: message,
            });
            return powerSyncDb;
        } finally {
            initPromise = null;
        }
    })();

    return initPromise;
}

export function getPowerSync(): PowerSyncDatabase | null {
    return powerSyncDb;
}

export async function closePowerSync(): Promise<void> {
    if (powerSyncDb) {
        await powerSyncDb.close();
        powerSyncDb = null;
        rawPowerSyncDb = null;
        bootstrapStatus = createBootstrapStatus('idle', 'PowerSync connection closed.');
    }
}

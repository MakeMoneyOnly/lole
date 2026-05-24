import type { PowerSyncDatabase } from '@/lib/sync/powersync-config';

export interface OfflineIdentifierContext {
    restaurantId: string;
    locationId: string;
    deviceId: string;
}

function currentBusinessDate(now: Date = new Date()): string {
    return now.toISOString().slice(0, 10).replace(/-/g, '');
}

function numericShard(value: string, modulo: number): number {
    let total = 0;
    for (const char of value) {
        total = (total + char.charCodeAt(0)) % modulo;
    }
    return total;
}

function buildScopeKey(prefix: string, context: OfflineIdentifierContext): string {
    return `${prefix}:${context.restaurantId}:${context.locationId}:${context.deviceId}`;
}

async function reserveSequence(
    db: PowerSyncDatabase,
    scopeKey: string,
    businessDate: string
): Promise<number> {
    let nextValue = 1;

    await db.write(async () => {
        const row = await db.getFirstAsync<{ last_value: number }>(
            `SELECT last_value
             FROM local_sequence_counters
             WHERE scope_key = ? AND business_date = ?`,
            [scopeKey, businessDate]
        );

        nextValue = Number(row?.last_value ?? 0) + 1;
        const nowIso = new Date().toISOString();

        await db.execute(
            `INSERT INTO local_sequence_counters (
                scope_key, business_date, last_value, updated_at
             ) VALUES (?, ?, ?, ?)
             ON CONFLICT(scope_key, business_date)
             DO UPDATE SET last_value = excluded.last_value, updated_at = excluded.updated_at`,
            [scopeKey, businessDate, nextValue, nowIso]
        );
    });

    return nextValue;
}

export async function allocateOfflineOrderNumber(
    db: PowerSyncDatabase,
    context: OfflineIdentifierContext
): Promise<number> {
    const businessDate = currentBusinessDate();
    const shard = numericShard(`${context.locationId}:${context.deviceId}`, 100)
        .toString()
        .padStart(2, '0');
    const sequence = (await reserveSequence(db, buildScopeKey('order', context), businessDate))
        .toString()
        .padStart(4, '0');

    return Number(`${businessDate}${shard}${sequence}`);
}

export async function allocateOfflineReceiptNumber(
    db: PowerSyncDatabase,
    context: OfflineIdentifierContext,
    prefix: 'PAY' | 'RCP' = 'PAY'
): Promise<string> {
    const businessDate = currentBusinessDate();
    const shard = numericShard(`${context.locationId}:${context.deviceId}`, 100)
        .toString()
        .padStart(2, '0');
    const sequence = (
        await reserveSequence(db, buildScopeKey(prefix.toLowerCase(), context), businessDate)
    )
        .toString()
        .padStart(4, '0');

    return `${prefix}-${businessDate}-${shard}-${sequence}`;
}

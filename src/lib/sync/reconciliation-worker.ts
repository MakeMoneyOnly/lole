/**
 * Reconciliation Replay Worker
 *
 * S3-T5: Processes reconciliation_entries locally after sync,
 * matching local settlement records against provider webhook data.
 */

import { getPowerSync } from './powersync-config';

export interface ReconciliationEntry {
    id: string;
    restaurant_id: string;
    payment_id: string | null;
    payment_session_id: string | null;
    ledger_type: string;
    ledger_id: string;
    source_type: string;
    source_id: string | null;
    expected_amount: number;
    settled_amount: number;
    delta_amount: number;
    status: string;
    notes: string | null;
    metadata_json: string;
    created_at: string;
    updated_at: string;
}

export interface ReconciliationResult {
    processed: number;
    matched: number;
    mismatched: number;
    disputed: number;
    errors: string[];
}

export async function processPendingReconciliation(
    limit: number = 50
): Promise<ReconciliationResult> {
    const db = getPowerSync();
    const result: ReconciliationResult = {
        processed: 0,
        matched: 0,
        mismatched: 0,
        disputed: 0,
        errors: [],
    };

    if (!db) {
        result.errors.push('PowerSync not initialized');
        return result;
    }

    try {
        const entries = await db.getAllAsync<ReconciliationEntry>(
            `SELECT * FROM reconciliation_entries
             WHERE status IN ('pending', 'matched')
             ORDER BY created_at ASC
             LIMIT ?`,
            [limit]
        );

        if (!entries || entries.length === 0) {
            return result;
        }

        for (const entry of entries) {
            result.processed++;

            try {
                const delta = Math.abs(Number(entry.delta_amount ?? 0));

                if (delta <= 0.01) {
                    await db.execute(
                        `UPDATE reconciliation_entries
                         SET status = 'verified', updated_at = ?
                         WHERE id = ?`,
                        [new Date().toISOString(), entry.id]
                    );
                    result.matched++;
                } else {
                    await db.execute(
                        `UPDATE reconciliation_entries
                         SET status = ?, notes = ?, updated_at = ?
                         WHERE id = ?`,
                        [
                            delta > 100 ? 'disputed' : 'mismatched',
                            `Local settled=${entry.settled_amount}, expected=${entry.expected_amount}, delta=${entry.delta_amount}`,
                            new Date().toISOString(),
                            entry.id,
                        ]
                    );

                    if (delta > 100) {
                        result.disputed++;
                    } else {
                        result.mismatched++;
                    }
                }
            } catch (entryError) {
                result.errors.push(
                    `Entry ${entry.id}: ${entryError instanceof Error ? entryError.message : 'Unknown error'}`
                );
            }
        }
    } catch (error) {
        result.errors.push(
            `Reconciliation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }

    return result;
}

export async function getReconciliationStats(): Promise<{
    total: number;
    pending: number;
    matched: number;
    mismatched: number;
    disputed: number;
}> {
    const db = getPowerSync();
    if (!db) {
        return { total: 0, pending: 0, matched: 0, mismatched: 0, disputed: 0 };
    }

    const [total, pending, matched, mismatched, disputed] = await Promise.all([
        db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM reconciliation_entries`),
        db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM reconciliation_entries WHERE status = 'pending'`
        ),
        db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM reconciliation_entries WHERE status IN ('matched', 'verified')`
        ),
        db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM reconciliation_entries WHERE status = 'mismatched'`
        ),
        db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM reconciliation_entries WHERE status = 'disputed'`
        ),
    ]);

    return {
        total: (total?.count ?? 0) as number,
        pending: (pending?.count ?? 0) as number,
        matched: (matched?.count ?? 0) as number,
        mismatched: (mismatched?.count ?? 0) as number,
        disputed: (disputed?.count ?? 0) as number,
    };
}

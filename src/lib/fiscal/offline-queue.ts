import { getPowerSync } from '@/lib/sync/powersync-config';
import { appendLocalJournalEntryInDatabase } from '@/lib/journal/local-journal';
import type { LocalFiscalSignatureEnvelope } from '@/lib/fiscal/local-signing';
import {
    submitFiscalTransaction,
    type FiscalSubmissionRequest,
    type FiscalSubmissionResult,
} from '@/lib/fiscal/mor-client';

export type FiscalJobStatus = 'pending' | 'submitted' | 'failed';
export type FiscalQueueMode = 'pending_upstream_submission' | 'local-signing';

export interface FiscalQueueJob {
    id: string;
    order_id: string;
    payload_json: string;
    queue_mode?: FiscalQueueMode;
    signature_json?: string;
    signature_algorithm?: string;
    signed_at?: string;
    status: FiscalJobStatus;
    attempts: number;
    last_error?: string;
    warning_text?: string;
    created_at: string;
    submitted_at?: string;
    synced_at?: string;
}

export async function queueFiscalJob(args: {
    orderId: string;
    payload: Record<string, unknown>;
    warningText?: string | null;
    restaurantId?: string | null;
    locationId?: string | null;
    deviceId?: string | null;
    actorId?: string | null;
    queueMode?: FiscalQueueMode;
    signatureEnvelope?: LocalFiscalSignatureEnvelope | null;
}): Promise<FiscalQueueJob | null> {
    const db = getPowerSync();
    if (!db) {
        return null;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const queueMode = args.queueMode ?? 'pending_upstream_submission';
    const signatureAlgorithm = args.signatureEnvelope?.algorithm ?? null;
    const signedAt = args.signatureEnvelope?.signedAt ?? null;
    const signatureJson = args.signatureEnvelope ? JSON.stringify(args.signatureEnvelope) : null;

    await db.write(async () => {
        await appendLocalJournalEntryInDatabase(db, {
            restaurantId: args.restaurantId ?? 'unknown-restaurant',
            locationId: args.locationId ?? null,
            deviceId: args.deviceId ?? 'unknown-device',
            actorId: args.actorId ?? null,
            entryKind: 'fiscal',
            aggregateType: 'fiscal_receipt',
            aggregateId: args.orderId,
            operationType: 'fiscal.queue',
            payload: {
                job_id: id,
                order_id: args.orderId,
                queue_mode: queueMode,
                signed_at: signedAt,
                warning_text: args.warningText ?? null,
                request: args.payload,
                signature: args.signatureEnvelope ?? null,
            },
            idempotencyKey: `fiscal-job-${id}`,
        });

        await db.execute(
            `INSERT INTO fiscal_jobs (
                id, order_id, payload_json, queue_mode, signature_json, signature_algorithm,
                signed_at, status, attempts, warning_text, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
            [
                id,
                args.orderId,
                JSON.stringify(args.payload),
                queueMode,
                signatureJson,
                signatureAlgorithm,
                signedAt,
                args.warningText ?? null,
                now,
            ]
        );
    });

    return {
        id,
        order_id: args.orderId,
        payload_json: JSON.stringify(args.payload),
        queue_mode: queueMode,
        signature_json: signatureJson ?? undefined,
        signature_algorithm: signatureAlgorithm ?? undefined,
        signed_at: signedAt ?? undefined,
        status: 'pending',
        attempts: 0,
        warning_text: args.warningText ?? undefined,
        created_at: now,
    };
}

export async function getPendingFiscalJobs(limit: number = 20): Promise<FiscalQueueJob[]> {
    const db = getPowerSync();
    if (!db) {
        return [];
    }

    return (
        (await db.getAllAsync<FiscalQueueJob>(
            `SELECT * FROM fiscal_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`,
            [limit]
        )) ?? []
    );
}

export async function markFiscalJobSubmitted(jobId: string): Promise<void> {
    const db = getPowerSync();
    if (!db) {
        return;
    }

    const now = new Date().toISOString();
    await db.execute(
        `UPDATE fiscal_jobs SET status = 'submitted', submitted_at = ?, synced_at = ? WHERE id = ?`,
        [now, now, jobId]
    );
}

export async function markFiscalJobFailed(jobId: string, errorMessage: string): Promise<void> {
    const db = getPowerSync();
    if (!db) {
        return;
    }

    await db.execute(
        `UPDATE fiscal_jobs SET status = 'failed', attempts = attempts + 1, last_error = ? WHERE id = ?`,
        [errorMessage, jobId]
    );
}

export async function replayPendingFiscalJobs(options?: {
    limit?: number;
    submitter?: (request: FiscalSubmissionRequest) => Promise<FiscalSubmissionResult>;
}): Promise<{
    processed: number;
    submitted: number;
    failed: number;
    deferred: number;
}> {
    const jobs = await getPendingFiscalJobs(options?.limit ?? 20);
    const submitter = options?.submitter ?? submitFiscalTransaction;

    let processed = 0;
    let submitted = 0;
    let failed = 0;
    let deferred = 0;

    for (const job of jobs) {
        processed++;

        const payload = JSON.parse(job.payload_json) as FiscalSubmissionRequest;
        try {
            const result = await submitter(payload);
            if (result.mode === 'local') {
                deferred++;
                continue;
            }

            await markFiscalJobSubmitted(job.id);
            const db = getPowerSync();
            if (db) {
                await appendLocalJournalEntryInDatabase(db, {
                    restaurantId: String(payload.restaurant_tin),
                    locationId: null,
                    deviceId: 'fiscal-replay-worker',
                    actorId: 'fiscal-replay-worker',
                    entryKind: 'fiscal',
                    aggregateType: 'fiscal_receipt',
                    aggregateId: job.order_id,
                    operationType: 'fiscal.replayed',
                    payload: {
                        job_id: job.id,
                        transaction_number: result.transaction_number,
                        mode: result.mode,
                    },
                    idempotencyKey: `fiscal-replayed-${job.id}`,
                });
            }
            submitted++;
        } catch (error) {
            await markFiscalJobFailed(
                job.id,
                error instanceof Error ? error.message : String(error)
            );
            failed++;
        }
    }

    return { processed, submitted, failed, deferred };
}

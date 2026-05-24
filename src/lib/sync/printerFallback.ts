/**
 * Gateway-owned printer spooler
 *
 * ENT-027/028/029: local queue, retry/reroute, health, driver contract
 */

import { getPowerSync } from './powersync-config';
import { buildEnqueuePrinterJobCommand } from '@/lib/domain/printer/commands';
import { appendLocalJournalEntryInDatabase } from '@/lib/journal/local-journal';
import { logger } from '@/lib/logger';
import { generateIdempotencyKey } from './idempotency';
import type {
    KdsPrintPayload,
    PrinterDispatchResult,
    PrinterDriverAdapter,
    PrinterDriverKind,
    PrinterHealthSnapshot,
    PrinterRouteIntent,
    PrinterSpoolStatus,
} from '@/lib/printer/contracts';

export type { KdsPrintPayload } from '@/lib/printer/contracts';
export type PrinterJobStatus = PrinterSpoolStatus;

export interface PrinterJob {
    id: string;
    order_id: string;
    station: string;
    route_key: string;
    fallback_route_key?: string | null;
    driver_kind: PrinterDriverKind;
    printer_device_id?: string | null;
    printer_name?: string | null;
    payload_json: string;
    status: PrinterSpoolStatus;
    attempts: number;
    max_attempts: number;
    last_error?: string | null;
    status_reason?: string | null;
    next_attempt_at?: string | null;
    last_dispatch_at?: string | null;
    last_heartbeat_at?: string | null;
    rerouted_from_job_id?: string | null;
    created_at: string;
    printed_at?: string | null;
}

export interface CreatePrinterJobInput {
    orderId: string;
    station: string;
    payload: KdsPrintPayload;
    route?: PrinterRouteIntent;
    driverKind?: PrinterDriverKind;
    maxAttempts?: number;
}

export interface PrinterQueueStats {
    pending: number;
    printing: number;
    completed: number;
    failed: number;
    rerouted: number;
}

export interface PrinterSpoolerStatus {
    stats: PrinterQueueStats;
    printers: PrinterHealthSnapshot[];
    queue: PrinterJob[];
}

export interface ProcessPrintQueueOptions {
    onPrint?: (job: PrinterJob) => Promise<boolean>;
    driver?: PrinterDriverAdapter;
    routeHealth?: Map<string, PrinterHealthSnapshot>;
    now?: string;
}

const DEFAULT_ROUTE_KEY = 'default';
const DEFAULT_DRIVER_KIND: PrinterDriverKind = 'network';
const DEFAULT_MAX_ATTEMPTS = 3;
function getPrinterCommandContext(restaurantId: string): {
    restaurantId: string;
    locationId: string;
    deviceId: string;
    actor: { actorId: string; actorType: 'device' };
} {
    return {
        restaurantId,
        locationId: process.env.NEXT_PUBLIC_LOCATION_ID ?? 'default-location',
        deviceId: process.env.NEXT_PUBLIC_DEVICE_ID ?? 'printer-device',
        actor: {
            actorId: process.env.NEXT_PUBLIC_DEVICE_ID ?? 'printer-device',
            actorType: 'device',
        },
    };
}

function addMinutes(iso: string, minutes: number): string {
    return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function toQueueStats(rows: Array<{ status: string; count: number }>): PrinterQueueStats {
    const base: PrinterQueueStats = {
        pending: 0,
        printing: 0,
        completed: 0,
        failed: 0,
        rerouted: 0,
    };

    for (const row of rows) {
        if (row.status in base) {
            base[row.status as keyof PrinterQueueStats] = Number(row.count ?? 0);
        }
    }

    return base;
}

function normalizeJob(row: Record<string, unknown>): PrinterJob {
    return {
        id: String(row.id),
        order_id: String(row.order_id),
        station: String(row.station),
        route_key: String(row.route_key ?? DEFAULT_ROUTE_KEY),
        fallback_route_key:
            typeof row.fallback_route_key === 'string' ? row.fallback_route_key : null,
        driver_kind:
            row.driver_kind === 'native_bridge' ||
            row.driver_kind === 'bluetooth' ||
            row.driver_kind === 'webhook'
                ? row.driver_kind
                : 'network',
        printer_device_id: typeof row.printer_device_id === 'string' ? row.printer_device_id : null,
        printer_name: typeof row.printer_name === 'string' ? row.printer_name : null,
        payload_json: String(row.payload_json ?? '{}'),
        status:
            row.status === 'printing' ||
            row.status === 'completed' ||
            row.status === 'failed' ||
            row.status === 'rerouted'
                ? row.status
                : 'pending',
        attempts: Number(row.attempts ?? 0),
        max_attempts: Number(row.max_attempts ?? DEFAULT_MAX_ATTEMPTS),
        last_error: typeof row.last_error === 'string' ? row.last_error : null,
        status_reason: typeof row.status_reason === 'string' ? row.status_reason : null,
        next_attempt_at: typeof row.next_attempt_at === 'string' ? row.next_attempt_at : null,
        last_dispatch_at: typeof row.last_dispatch_at === 'string' ? row.last_dispatch_at : null,
        last_heartbeat_at: typeof row.last_heartbeat_at === 'string' ? row.last_heartbeat_at : null,
        rerouted_from_job_id:
            typeof row.rerouted_from_job_id === 'string' ? row.rerouted_from_job_id : null,
        created_at: String(row.created_at),
        printed_at: typeof row.printed_at === 'string' ? row.printed_at : null,
    };
}

async function getAllPrinterJobs(limit = 50): Promise<PrinterJob[]> {
    const db = getPowerSync();
    if (!db) return [];

    const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT *
         FROM printer_jobs
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit]
    );

    return rows.map(normalizeJob);
}

export async function createPrintJob(input: CreatePrinterJobInput): Promise<PrinterJob | null> {
    const db = getPowerSync();
    if (!db) return null;

    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();
    const idempotencyKey = generateIdempotencyKey('printer-enqueue');
    const context = getPrinterCommandContext(input.payload.restaurantId);
    const routeKey = input.route?.routeKey ?? DEFAULT_ROUTE_KEY;
    const command = buildEnqueuePrinterJobCommand(
        context,
        {
            job_id: jobId,
            order_id: input.orderId,
            station: input.station,
            payload: input.payload,
        },
        idempotencyKey
    );

    try {
        await db.write(async () => {
            await appendLocalJournalEntryInDatabase(db, {
                restaurantId: input.payload.restaurantId,
                locationId: context.locationId,
                deviceId: context.deviceId,
                actorId: context.actor.actorId,
                entryKind: 'command',
                aggregateType: 'printer_job',
                aggregateId: jobId,
                operationType: 'printer.enqueue',
                payload: {
                    ...((command as unknown as Record<string, unknown>) ?? {}),
                    route_key: routeKey,
                    fallback_route_key: input.route?.fallbackRouteKey ?? null,
                    driver_kind: input.driverKind ?? DEFAULT_DRIVER_KIND,
                },
                idempotencyKey,
            });

            await db.execute(
                `INSERT INTO printer_jobs (
                    id, order_id, station, route_key, fallback_route_key, driver_kind,
                    printer_device_id, printer_name, payload_json, status, attempts, max_attempts,
                    last_error, status_reason, next_attempt_at, last_dispatch_at, last_heartbeat_at,
                    rerouted_from_job_id, created_at, printed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, NULL)`,
                [
                    jobId,
                    input.orderId,
                    input.station,
                    routeKey,
                    input.route?.fallbackRouteKey ?? null,
                    input.driverKind ?? DEFAULT_DRIVER_KIND,
                    input.route?.preferredDeviceId ?? null,
                    input.route?.preferredPrinterName ?? null,
                    JSON.stringify(input.payload),
                    input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
                    now,
                ]
            );
        });

        return await getPrintJob(jobId);
    } catch (error) {
        logger.error('[PrinterSpooler] Failed to create print job', {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

export async function getPrintJob(jobId: string): Promise<PrinterJob | null> {
    const db = getPowerSync();
    if (!db) return null;

    const row = await db.getFirstAsync<Record<string, unknown>>(
        `SELECT * FROM printer_jobs WHERE id = ?`,
        [jobId]
    );

    return row ? normalizeJob(row) : null;
}

export async function getPendingPrintJobs(limit = 20): Promise<PrinterJob[]> {
    const db = getPowerSync();
    if (!db) return [];

    const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT *
         FROM printer_jobs
         WHERE status = 'pending'
           AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
         ORDER BY created_at ASC
         LIMIT ?`,
        [new Date().toISOString(), limit]
    );

    return rows.map(normalizeJob);
}

export async function getPrintJobsByOrder(orderId: string): Promise<PrinterJob[]> {
    const db = getPowerSync();
    if (!db) return [];

    const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT *
         FROM printer_jobs
         WHERE order_id = ?
         ORDER BY created_at DESC`,
        [orderId]
    );

    return rows.map(normalizeJob);
}

export async function startPrintJob(
    jobId: string,
    now = new Date().toISOString()
): Promise<boolean> {
    const db = getPowerSync();
    if (!db) return false;

    try {
        await db.execute(
            `UPDATE printer_jobs
             SET status = 'printing',
                 attempts = attempts + 1,
                 last_dispatch_at = ?,
                 status_reason = 'dispatching'
             WHERE id = ?`,
            [now, jobId]
        );
        return true;
    } catch (error) {
        logger.error('[PrinterSpooler] Failed to start print job', {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}

export async function completePrintJob(
    jobId: string,
    now = new Date().toISOString()
): Promise<boolean> {
    const db = getPowerSync();
    if (!db) return false;

    try {
        await db.execute(
            `UPDATE printer_jobs
             SET status = 'completed',
                 printed_at = ?,
                 status_reason = 'printed'
             WHERE id = ?`,
            [now, jobId]
        );
        return true;
    } catch (error) {
        logger.error('[PrinterSpooler] Failed to complete print job', {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}

export async function failPrintJob(
    jobId: string,
    error: string,
    input: { now?: string; nextAttemptAt?: string | null; final?: boolean } = {}
): Promise<boolean> {
    const db = getPowerSync();
    if (!db) return false;

    const now = input.now ?? new Date().toISOString();
    const nextAttemptAt = input.final ? null : (input.nextAttemptAt ?? addMinutes(now, 1));
    const nextStatus: PrinterSpoolStatus = input.final ? 'failed' : 'pending';
    const reason = input.final ? 'exhausted_retries' : 'queued_retry';

    try {
        await db.execute(
            `UPDATE printer_jobs
             SET status = ?,
                 last_error = ?,
                 status_reason = ?,
                 next_attempt_at = ?
             WHERE id = ?`,
            [nextStatus, error, reason, nextAttemptAt, jobId]
        );
        return true;
    } catch (err) {
        logger.error('[PrinterSpooler] Failed to mark print job as failed', {
            error: err instanceof Error ? err.message : String(err),
        });
        return false;
    }
}

export async function retryPrintJob(jobId: string): Promise<boolean> {
    const db = getPowerSync();
    if (!db) return false;

    try {
        await db.execute(
            `UPDATE printer_jobs
             SET status = 'pending', last_error = NULL, status_reason = 'manual_retry', next_attempt_at = NULL
             WHERE id = ? AND status IN ('failed', 'rerouted')`,
            [jobId]
        );
        return true;
    } catch (error) {
        logger.error('[PrinterSpooler] Failed to retry print job', {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}

export async function reroutePrintJob(
    job: PrinterJob,
    nextRouteKey: string,
    now = new Date().toISOString()
): Promise<PrinterJob | null> {
    const db = getPowerSync();
    if (!db) return null;

    try {
        await db.write(async () => {
            await db.execute(
                `UPDATE printer_jobs
                 SET status = 'rerouted',
                     status_reason = 'rerouted_to_backup',
                     next_attempt_at = NULL
                 WHERE id = ?`,
                [job.id]
            );

            await db.execute(
                `INSERT INTO printer_jobs (
                    id, order_id, station, route_key, fallback_route_key, driver_kind,
                    printer_device_id, printer_name, payload_json, status, attempts, max_attempts,
                    last_error, status_reason, next_attempt_at, last_dispatch_at, last_heartbeat_at,
                    rerouted_from_job_id, created_at, printed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 'rerouted_backup_queue', NULL, NULL, NULL, ?, ?, NULL)`,
                [
                    crypto.randomUUID(),
                    job.order_id,
                    job.station,
                    nextRouteKey,
                    null,
                    job.driver_kind,
                    job.printer_device_id ?? null,
                    job.printer_name ?? null,
                    job.payload_json,
                    job.attempts,
                    job.max_attempts,
                    job.last_error ?? null,
                    job.id,
                    now,
                ]
            );
        });

        const rows = await db.getAllAsync<Record<string, unknown>>(
            `SELECT *
             FROM printer_jobs
             WHERE rerouted_from_job_id = ?
             ORDER BY created_at DESC
             LIMIT 1`,
            [job.id]
        );

        return rows[0] ? normalizeJob(rows[0]) : null;
    } catch (error) {
        logger.error('[PrinterSpooler] Failed to reroute print job', {
            jobId: job.id,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

export async function recordPrinterHealth(snapshot: PrinterHealthSnapshot): Promise<void> {
    const db = getPowerSync();
    if (!db) return;

    try {
        await db.execute(
            `UPDATE printer_jobs
             SET last_heartbeat_at = ?,
                 printer_name = ?,
                 printer_device_id = ?,
                 status_reason = CASE
                     WHEN status IN ('pending', 'printing') AND ? = 'offline' THEN 'printer_offline'
                     ELSE status_reason
                 END,
                 last_error = CASE
                     WHEN status IN ('pending', 'printing') AND ? = 'offline' THEN COALESCE(last_error, 'Printer offline')
                     ELSE last_error
                 END
             WHERE route_key = ? AND status IN ('pending', 'printing')`,
            [
                snapshot.lastHeartbeatAt ?? new Date().toISOString(),
                snapshot.printerName,
                snapshot.printerDeviceId,
                snapshot.state,
                snapshot.state,
                snapshot.routeKeys[0] ?? DEFAULT_ROUTE_KEY,
            ]
        );
    } catch (error) {
        logger.error('[PrinterSpooler] Failed to record printer health', {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

export async function getPrinterQueueStats(): Promise<PrinterQueueStats> {
    const db = getPowerSync();
    if (!db) {
        return { pending: 0, printing: 0, completed: 0, failed: 0, rerouted: 0 };
    }

    const rows = await db.getAllAsync<{ status: string; count: number }>(
        `SELECT status, COUNT(*) as count FROM printer_jobs GROUP BY status`
    );

    return toQueueStats(rows);
}

export async function readPrinterSpoolerStatus(): Promise<PrinterSpoolerStatus> {
    const db = getPowerSync();
    if (!db) {
        return {
            stats: { pending: 0, printing: 0, completed: 0, failed: 0, rerouted: 0 },
            printers: [],
            queue: [],
        };
    }

    const [statsRows, printerRows, queue] = await Promise.all([
        db.getAllAsync<{ status: string; count: number }>(
            `SELECT status, COUNT(*) as count FROM printer_jobs GROUP BY status`
        ),
        db.getAllAsync<{
            route_key: string;
            printer_device_id: string | null;
            printer_name: string | null;
            driver_kind: PrinterDriverKind;
            last_heartbeat_at: string | null;
            last_error: string | null;
            pending_jobs: number;
            printing_jobs: number;
            failed_jobs: number;
            total_queue_depth: number;
        }>(
            `SELECT
                route_key,
                COALESCE(printer_device_id, route_key) as printer_device_id,
                COALESCE(printer_name, route_key) as printer_name,
                driver_kind,
                MAX(last_heartbeat_at) as last_heartbeat_at,
                MAX(last_error) as last_error,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_jobs,
                SUM(CASE WHEN status = 'printing' THEN 1 ELSE 0 END) as printing_jobs,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
                COUNT(*) as total_queue_depth
             FROM printer_jobs
             GROUP BY route_key, printer_device_id, printer_name, driver_kind
             ORDER BY route_key ASC`
        ),
        getAllPrinterJobs(25),
    ]);

    return {
        stats: toQueueStats(statsRows),
        printers: printerRows.map(row => ({
            printerDeviceId: row.printer_device_id ?? row.route_key,
            printerName: row.printer_name ?? row.route_key,
            driverKind: row.driver_kind ?? DEFAULT_DRIVER_KIND,
            state:
                Number(row.failed_jobs ?? 0) > 0
                    ? 'offline'
                    : Number(row.pending_jobs ?? 0) > 0
                      ? 'degraded'
                      : 'healthy',
            queueDepth: Number(row.total_queue_depth ?? 0),
            failedJobs: Number(row.failed_jobs ?? 0),
            pendingJobs: Number(row.pending_jobs ?? 0),
            printingJobs: Number(row.printing_jobs ?? 0),
            lastHeartbeatAt: row.last_heartbeat_at,
            lastError: row.last_error,
            routeKeys: [row.route_key],
        })),
        queue,
    };
}

export async function clearOldPrintJobs(olderThanDays = 7): Promise<number> {
    const db = getPowerSync();
    if (!db) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db.execute(
        `DELETE FROM printer_jobs WHERE status = 'completed' AND printed_at < ?`,
        [cutoffDate.toISOString()]
    );

    return result.rowsAffected;
}

export async function processPrintQueue(
    options: ProcessPrintQueueOptions
): Promise<{ processed: number; succeeded: number; failed: number; rerouted: number }> {
    const pendingJobs = await getPendingPrintJobs(10);
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let rerouted = 0;
    const now = options.now ?? new Date().toISOString();

    for (const job of pendingJobs) {
        processed++;
        await startPrintJob(job.id, now);

        const routeHealth = options.routeHealth?.get(job.route_key);
        if (routeHealth?.state === 'offline' && job.fallback_route_key) {
            const reroutedJob = await reroutePrintJob(job, job.fallback_route_key, now);
            if (reroutedJob) {
                rerouted++;
                continue;
            }
        }

        let printResult: PrinterDispatchResult;
        if (options.driver) {
            printResult = await options.driver.dispatch({
                jobId: job.id,
                orderId: job.order_id,
                station: job.station,
                routeKey: job.route_key,
                printerDeviceId: job.printer_device_id ?? null,
                printerName: job.printer_name ?? null,
                payloadJson: job.payload_json,
            });
        } else if (options.onPrint) {
            const ok = await options.onPrint(job);
            printResult = {
                ok,
                state: ok ? 'completed' : 'failed',
                driverKind: job.driver_kind,
                printerDeviceId: job.printer_device_id ?? null,
                printerName: job.printer_name ?? null,
                message: ok ? 'printed' : 'Print dispatch failed',
            };
        } else {
            printResult = {
                ok: false,
                state: 'failed',
                driverKind: job.driver_kind,
                printerDeviceId: job.printer_device_id ?? null,
                printerName: job.printer_name ?? null,
                message: 'No printer dispatcher provided',
            };
        }

        if (printResult.ok && printResult.state === 'completed') {
            await completePrintJob(job.id, now);
            succeeded++;
            continue;
        }

        const exhausted = job.attempts + 1 >= job.max_attempts;
        await failPrintJob(job.id, printResult.message ?? 'Print dispatch failed', {
            now,
            final: exhausted,
            nextAttemptAt: exhausted ? null : addMinutes(now, 1),
        });
        failed++;
    }

    return { processed, succeeded, failed, rerouted };
}

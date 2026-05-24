import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
const mockGetAllAsync = vi.fn().mockResolvedValue([]);
const mockWrite = vi.fn(async (fn: () => Promise<unknown>) => fn());
const mockAppendLocalJournalEntryInDatabase = vi.fn().mockResolvedValue(null);
const mockSubmitFiscalTransaction = vi.fn();

const mockGetPowerSync = vi.fn(() => ({
    execute: mockExecute,
    getFirstAsync: vi.fn().mockResolvedValue(null),
    getAllAsync: mockGetAllAsync,
    write: mockWrite,
}));

vi.mock('@/lib/sync/powersync-config', () => ({
    getPowerSync: mockGetPowerSync,
}));

vi.mock('@/lib/journal/local-journal', () => ({
    appendLocalJournalEntryInDatabase: mockAppendLocalJournalEntryInDatabase,
}));

vi.mock('@/lib/fiscal/mor-client', () => ({
    submitFiscalTransaction: mockSubmitFiscalTransaction,
}));

describe('Offline Fiscal Queue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecute.mockResolvedValue({ rowsAffected: 1 });
        mockGetAllAsync.mockResolvedValue([]);
        mockGetPowerSync.mockReturnValue({
            execute: mockExecute,
            getFirstAsync: vi.fn().mockResolvedValue(null),
            getAllAsync: mockGetAllAsync,
            write: mockWrite,
        });
        mockWrite.mockImplementation(async (fn: () => Promise<unknown>) => fn());
        mockSubmitFiscalTransaction.mockReset();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('queueFiscalJob', () => {
        it('should insert a pending fiscal job', async () => {
            const { queueFiscalJob } = await import('../offline-queue');
            const result = await queueFiscalJob({
                orderId: 'order-123',
                payload: { total: 1000, items: [] },
            });

            expect(result).not.toBeNull();
            expect(result!.order_id).toBe('order-123');
            expect(result!.status).toBe('pending');
            expect(result!.attempts).toBe(0);
            expect(result!.id).toBeDefined();
            expect(result!.created_at).toBeDefined();
            expect(mockExecute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO fiscal_jobs'),
                [
                    expect.any(String),
                    'order-123',
                    expect.any(String),
                    'pending_upstream_submission',
                    null,
                    null,
                    null,
                    null,
                    expect.any(String),
                ]
            );
            expect(mockAppendLocalJournalEntryInDatabase.mock.invocationCallOrder[0]).toBeLessThan(
                mockExecute.mock.invocationCallOrder[0]
            );
        });

        it('should include warning text when provided', async () => {
            const { queueFiscalJob } = await import('../offline-queue');
            const result = await queueFiscalJob({
                orderId: 'order-456',
                payload: { total: 500 },
                warningText: 'Stub mode',
            });

            expect(result!.warning_text).toBe('Stub mode');
        });

        it('should store local signing metadata when provided', async () => {
            const { queueFiscalJob } = await import('../offline-queue');
            const result = await queueFiscalJob({
                orderId: 'order-777',
                payload: { total: 777 },
                queueMode: 'local-signing',
                signatureEnvelope: {
                    keyId: 'key-1',
                    algorithm: 'HMAC-SHA256',
                    digest: 'abc',
                    signature: 'def',
                    signedAt: '2026-04-21T00:00:00.000Z',
                },
            });

            expect(result?.queue_mode).toBe('local-signing');
            expect(result?.signature_algorithm).toBe('HMAC-SHA256');
            expect(result?.signed_at).toBe('2026-04-21T00:00:00.000Z');
            expect(mockAppendLocalJournalEntryInDatabase).toHaveBeenCalledOnce();
        });

        it('should return null when PowerSync is not available', async () => {
            mockGetPowerSync.mockReturnValueOnce(
                null as unknown as ReturnType<typeof mockGetPowerSync>
            );

            const { queueFiscalJob } = await import('../offline-queue');
            const result = await queueFiscalJob({
                orderId: 'order-789',
                payload: { total: 200 },
            });

            expect(result).toBeNull();
            expect(mockExecute).not.toHaveBeenCalled();
        });

        it('should serialize payload to JSON', async () => {
            const { queueFiscalJob } = await import('../offline-queue');
            const payload = { total: 1000, items: [{ name: 'test' }] };

            await queueFiscalJob({
                orderId: 'order-json',
                payload,
            });

            const callArgs = mockExecute.mock.calls[0];
            expect(callArgs[1][2]).toBe(JSON.stringify(payload));
        });

        it('should set warning_text to undefined when not provided', async () => {
            const { queueFiscalJob } = await import('../offline-queue');
            const result = await queueFiscalJob({
                orderId: 'order-no-warn',
                payload: { total: 100 },
            });

            expect(result!.warning_text).toBeUndefined();
        });

        it('should set warning_text to undefined when warningText is null', async () => {
            const { queueFiscalJob } = await import('../offline-queue');
            const result = await queueFiscalJob({
                orderId: 'order-null-warn',
                payload: { total: 100 },
                warningText: null,
            });

            expect(result!.warning_text).toBeUndefined();
        });
    });

    describe('getPendingFiscalJobs', () => {
        it('should return pending jobs ordered by created_at', async () => {
            const mockJobs = [
                {
                    id: 'job-1',
                    order_id: 'order-1',
                    payload_json: '{"total":100}',
                    status: 'pending',
                    attempts: 0,
                    created_at: '2024-01-01T10:00:00Z',
                },
                {
                    id: 'job-2',
                    order_id: 'order-2',
                    payload_json: '{"total":200}',
                    status: 'pending',
                    attempts: 1,
                    last_error: 'Network error',
                    created_at: '2024-01-01T11:00:00Z',
                },
            ];
            mockGetAllAsync.mockResolvedValueOnce(mockJobs);

            const { getPendingFiscalJobs } = await import('../offline-queue');
            const result = await getPendingFiscalJobs();

            expect(result).toEqual(mockJobs);
            expect(mockGetAllAsync).toHaveBeenCalledWith(
                expect.stringContaining("status = 'pending'"),
                [20]
            );
        });

        it('should respect limit parameter', async () => {
            mockGetAllAsync.mockResolvedValueOnce([]);

            const { getPendingFiscalJobs } = await import('../offline-queue');
            await getPendingFiscalJobs(50);

            expect(mockGetAllAsync).toHaveBeenCalledWith(expect.any(String), [50]);
        });

        it('should return empty array when PowerSync is not available', async () => {
            mockGetPowerSync.mockReturnValueOnce(
                null as unknown as ReturnType<typeof mockGetPowerSync>
            );

            const { getPendingFiscalJobs } = await import('../offline-queue');
            const result = await getPendingFiscalJobs();

            expect(result).toEqual([]);
        });
    });

    describe('markFiscalJobSubmitted', () => {
        it('should update job status to submitted', async () => {
            const { markFiscalJobSubmitted } = await import('../offline-queue');
            await markFiscalJobSubmitted('job-123');

            expect(mockExecute).toHaveBeenCalledWith(
                expect.stringContaining("status = 'submitted'"),
                expect.arrayContaining([expect.any(String), expect.any(String), 'job-123'])
            );
        });

        it('should set submitted_at and synced_at timestamps', async () => {
            const { markFiscalJobSubmitted } = await import('../offline-queue');
            await markFiscalJobSubmitted('job-456');

            const callArgs = mockExecute.mock.calls[0];
            const now = callArgs[1][0];
            expect(new Date(now).toISOString()).toBe(now);
        });

        it('should do nothing when PowerSync is not available', async () => {
            mockGetPowerSync.mockReturnValueOnce(
                null as unknown as ReturnType<typeof mockGetPowerSync>
            );

            const { markFiscalJobSubmitted } = await import('../offline-queue');
            await markFiscalJobSubmitted('job-789');

            expect(mockExecute).not.toHaveBeenCalled();
        });
    });

    describe('markFiscalJobFailed', () => {
        it('should update status to failed and increment attempts', async () => {
            const { markFiscalJobFailed } = await import('../offline-queue');
            await markFiscalJobFailed('job-fail', 'Network timeout');

            expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining("status = 'failed'"), [
                'Network timeout',
                'job-fail',
            ]);
        });

        it('should store the error message', async () => {
            const { markFiscalJobFailed } = await import('../offline-queue');
            await markFiscalJobFailed('job-err', 'Connection refused');

            const callArgs = mockExecute.mock.calls[0];
            expect(callArgs[1][0]).toBe('Connection refused');
        });

        it('should do nothing when PowerSync is not available', async () => {
            mockGetPowerSync.mockReturnValueOnce(
                null as unknown as ReturnType<typeof mockGetPowerSync>
            );

            const { markFiscalJobFailed } = await import('../offline-queue');
            await markFiscalJobFailed('job-1', 'error');

            expect(mockExecute).not.toHaveBeenCalled();
        });
    });

    describe('FiscalQueueJob type', () => {
        it('should return job with all expected fields', async () => {
            const { queueFiscalJob } = await import('../offline-queue');
            const result = await queueFiscalJob({
                orderId: 'order-typed',
                payload: { total: 500 },
            });

            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('order_id');
            expect(result).toHaveProperty('payload_json');
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('attempts');
            expect(result).toHaveProperty('created_at');
        });
    });

    describe('replayPendingFiscalJobs', () => {
        it('submits pending jobs and marks submitted', async () => {
            mockGetAllAsync.mockResolvedValueOnce([
                {
                    id: 'job-1',
                    order_id: 'order-1',
                    payload_json: JSON.stringify({
                        restaurant_tin: '123',
                        transaction_number: 'TXN-1',
                        occurred_at: '2026-04-21T00:00:00.000Z',
                        items: [],
                        subtotal: 10,
                        tax_total: 1.5,
                        grand_total: 11.5,
                    }),
                    status: 'pending',
                    attempts: 0,
                    created_at: '2026-04-21T00:00:00.000Z',
                },
            ]);
            mockSubmitFiscalTransaction.mockResolvedValueOnce({
                ok: true,
                mode: 'live',
                transaction_number: 'TXN-1',
            });

            const { replayPendingFiscalJobs } = await import('../offline-queue');
            const result = await replayPendingFiscalJobs();

            expect(result).toEqual({
                processed: 1,
                submitted: 1,
                failed: 0,
                deferred: 0,
            });
            expect(mockSubmitFiscalTransaction).toHaveBeenCalledOnce();
        });

        it('defers local-only replay results', async () => {
            mockGetAllAsync.mockResolvedValueOnce([
                {
                    id: 'job-2',
                    order_id: 'order-2',
                    payload_json: JSON.stringify({
                        restaurant_tin: '123',
                        transaction_number: 'TXN-2',
                        occurred_at: '2026-04-21T00:00:00.000Z',
                        items: [],
                        subtotal: 10,
                        tax_total: 1.5,
                        grand_total: 11.5,
                    }),
                    status: 'pending',
                    attempts: 0,
                    created_at: '2026-04-21T00:00:00.000Z',
                },
            ]);
            mockSubmitFiscalTransaction.mockResolvedValueOnce({
                ok: true,
                mode: 'local',
                transaction_number: 'TXN-2',
            });

            const { replayPendingFiscalJobs } = await import('../offline-queue');
            const result = await replayPendingFiscalJobs();

            expect(result.deferred).toBe(1);
        });
    });
});

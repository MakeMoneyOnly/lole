import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PowerSyncDatabase } from '@/lib/sync/powersync-config';

const mockAppendLocalJournalEntryInDatabase = vi.fn().mockResolvedValue(null);

vi.mock('@/lib/journal/local-journal', () => ({
    appendLocalJournalEntryInDatabase: mockAppendLocalJournalEntryInDatabase,
}));

describe('local payment ledger', () => {
    let mockDb: PowerSyncDatabase;
    let executeSpy: ReturnType<typeof vi.fn>;
    let writeSpy: ReturnType<typeof vi.fn>;
    let getAllAsyncSpy: ReturnType<typeof vi.fn>;
    let getFirstAsyncSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        executeSpy = vi.fn().mockResolvedValue({ rowsAffected: 1 });
        writeSpy = vi.fn(async (run: () => Promise<void>) => {
            await run();
        });
        getAllAsyncSpy = vi.fn().mockResolvedValue([]);
        getFirstAsyncSpy = vi.fn().mockResolvedValue(null);

        mockDb = {
            execute: executeSpy as unknown as PowerSyncDatabase['execute'],
            getFirstAsync: getFirstAsyncSpy as unknown as PowerSyncDatabase['getFirstAsync'],
            getAllAsync: getAllAsyncSpy as unknown as PowerSyncDatabase['getAllAsync'],
            write: writeSpy as unknown as PowerSyncDatabase['write'],
            close: vi.fn(),
        };
    });

    it('records journal-first local capture for offline cash settlement', async () => {
        const { recordLocalCapturedPayment } = await import('@/lib/payments/local-ledger');

        const result = await recordLocalCapturedPayment(mockDb, {
            restaurantId: 'rest-1',
            orderId: 'order-1',
            splitId: 'split-1',
            amount: 100,
            method: 'cash',
            provider: 'cash',
            providerReference: 'CASH-1',
            label: 'Guest 1',
            terminalName: 'Terminal 1',
        });

        expect(result.truthState).toBe('local_capture');
        expect(result.truthLabel).toBe('Local Capture');
        expect(result.transactionNumber).toMatch(/^PAY-\d{8}-\d{2}-\d{4}$/);
        expect(writeSpy).toHaveBeenCalledTimes(2);
        expect(mockAppendLocalJournalEntryInDatabase).toHaveBeenCalledTimes(3);
        expect(mockAppendLocalJournalEntryInDatabase.mock.calls[0][1]).toEqual(
            expect.objectContaining({
                entryKind: 'command',
                aggregateType: 'payment_session',
                operationType: 'payment.session_open',
            })
        );
        expect(mockAppendLocalJournalEntryInDatabase.mock.calls[1][1]).toEqual(
            expect.objectContaining({
                entryKind: 'command',
                aggregateType: 'payment',
                operationType: 'payment.capture',
            })
        );
        expect(mockAppendLocalJournalEntryInDatabase.mock.calls[2][1]).toEqual(
            expect.objectContaining({
                entryKind: 'event',
                operationType: 'payment.captured',
            })
        );
        expect(executeSpy).toHaveBeenCalledTimes(5);
        expect(executeSpy.mock.calls[0][0]).toContain('INSERT INTO local_sequence_counters');
        expect(executeSpy.mock.calls[1][0]).toContain('INSERT INTO payment_sessions');
        expect(executeSpy.mock.calls[2][0]).toContain('INSERT INTO payments');
        expect(executeSpy.mock.calls[3][0]).toContain('INSERT INTO payment_events');
        expect(executeSpy.mock.calls[4][0]).toContain('INSERT INTO reconciliation_entries');
    });

    it('records deferred verification for offline chapa settlement', async () => {
        const { recordLocalCapturedPayment } = await import('@/lib/payments/local-ledger');

        const result = await recordLocalCapturedPayment(mockDb, {
            restaurantId: 'rest-1',
            orderId: 'order-1',
            amount: 250,
            method: 'chapa',
            provider: 'chapa',
            providerReference: 'CHAPA-REF-1',
            label: 'Table close',
            verificationMode: 'deferred',
        });

        expect(result.truthState).toBe('pending_verification');
        expect(result.truthLabel).toBe('Pending Verification');
        expect(executeSpy.mock.calls[1][1]).toEqual(
            expect.arrayContaining(['pending_verification'])
        );
        expect(executeSpy.mock.calls[2][1]).toEqual(expect.arrayContaining(['pending']));
        expect(executeSpy.mock.calls[3][1]).toEqual(
            expect.arrayContaining(['payment.verification_pending', 'pending_verification'])
        );
    });

    it('reconciles local payments into verified, failed, duplicate, and manual-review outcomes', async () => {
        getFirstAsyncSpy.mockResolvedValue({
            payment_id: 'payment-1',
            payment_session_id: 'session-1',
            provider_reference: 'REF-1',
            metadata_json: JSON.stringify({ label: 'Guest 1' }),
        });

        const { reconcileLocalPayments } = await import('@/lib/payments/local-ledger');
        const result = await reconcileLocalPayments(mockDb, {
            restaurantId: 'rest-1',
            outcomes: [
                { paymentId: 'payment-1', outcome: 'verified', settledAmount: 100 },
                { paymentId: 'payment-1', outcome: 'failed' },
                { paymentId: 'payment-1', outcome: 'duplicate' },
                { paymentId: 'payment-1', outcome: 'manual_review' },
            ],
        });

        expect(result).toEqual({
            matched: 1,
            rejected: 1,
            duplicate: 1,
            manualReview: 1,
            processedPaymentIds: ['payment-1', 'payment-1', 'payment-1', 'payment-1'],
        });
        expect(mockAppendLocalJournalEntryInDatabase).toHaveBeenCalled();
        expect(executeSpy).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE payment_sessions'),
            expect.any(Array)
        );
        expect(executeSpy).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE payments'),
            expect.any(Array)
        );
        expect(executeSpy).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE reconciliation_entries'),
            expect.any(Array)
        );
        expect(executeSpy).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO payment_events'),
            expect.any(Array)
        );
    });
});

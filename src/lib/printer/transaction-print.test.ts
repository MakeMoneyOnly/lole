import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FiscalSubmissionError } from '@/lib/fiscal/mor-client';
import { handleApprovedTransactionReceipt } from '@/lib/printer/transaction-print';
import { queueFiscalJob } from '@/lib/fiscal/offline-queue';
import { silentPrintReceipt } from '@/lib/printer/silent-print';
import { isMorLiveConfigured, submitFiscalTransaction } from '@/lib/fiscal/mor-client';
import { createPrintJob } from '@/lib/sync/printerFallback';

vi.mock('@/lib/fiscal/offline-queue', () => ({
    queueFiscalJob: vi.fn(),
}));

vi.mock('@/lib/printer/silent-print', () => ({
    silentPrintReceipt: vi.fn(),
}));

vi.mock('@/lib/sync/printerFallback', () => ({
    createPrintJob: vi.fn(),
}));

vi.mock('@/lib/fiscal/mor-client', async importOriginal => {
    const actual = await importOriginal<typeof import('@/lib/fiscal/mor-client')>();
    return {
        ...actual,
        isMorLiveConfigured: vi.fn(),
        submitFiscalTransaction: vi.fn(),
    };
});

describe('handleApprovedTransactionReceipt', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isMorLiveConfigured).mockReturnValue(true);
        vi.mocked(silentPrintReceipt).mockResolvedValue({ ok: true, channel: 'native' });
        vi.mocked(createPrintJob).mockResolvedValue({
            id: 'job-1',
            order_id: 'order-2',
            station: 'receipt',
            route_key: 'receipt-printer',
            payload_json: '{}',
            status: 'pending',
            attempts: 0,
            max_attempts: 3,
            created_at: '2026-04-29T00:00:00.000Z',
        } as never);
    });

    it('blocks receipt printing when live fiscalization fails while online', async () => {
        vi.mocked(submitFiscalTransaction).mockRejectedValue(
            new FiscalSubmissionError('Rejected by MoR', 'rejected', false)
        );

        const result = await handleApprovedTransactionReceipt({
            autoPrint: true,
            orderId: 'order-1',
            transactionNumber: 'TX-1',
            isOnline: true,
            receipt: {
                restaurant_name: 'lole',
                transaction_number: 'TX-1',
                printed_at: '2026-04-03T12:00:00.000Z',
                items: [],
                subtotal: 100,
                total: 115,
            },
            fiscalRequest: {
                restaurant_tin: '123456789',
                transaction_number: 'TX-1',
                occurred_at: '2026-04-03T12:00:00.000Z',
                items: [],
                subtotal: 100,
                tax_total: 15,
                grand_total: 115,
                order_id: 'order-1',
            },
        });

        expect(result).toMatchObject({
            printed: false,
            queuedFiscal: false,
            blocked: true,
        });
        expect(queueFiscalJob).not.toHaveBeenCalled();
        expect(silentPrintReceipt).not.toHaveBeenCalled();
    });

    it('queues fiscal work and prints when the device is offline', async () => {
        vi.mocked(submitFiscalTransaction).mockRejectedValue(
            new FiscalSubmissionError('Network unavailable', 'network', true)
        );

        const result = await handleApprovedTransactionReceipt({
            autoPrint: true,
            orderId: 'order-2',
            transactionNumber: 'TX-2',
            isOnline: false,
            receipt: {
                restaurant_name: 'lole',
                transaction_number: 'TX-2',
                printed_at: '2026-04-03T12:00:00.000Z',
                items: [],
                subtotal: 200,
                total: 230,
            },
            fiscalRequest: {
                restaurant_tin: '123456789',
                transaction_number: 'TX-2',
                occurred_at: '2026-04-03T12:00:00.000Z',
                items: [],
                subtotal: 200,
                tax_total: 30,
                grand_total: 230,
                order_id: 'order-2',
            },
        });

        expect(result).toMatchObject({
            printed: true,
            queuedFiscal: true,
            blocked: false,
            warning: 'Pending fiscalization',
        });
        expect(queueFiscalJob).toHaveBeenCalledOnce();
        expect(silentPrintReceipt).toHaveBeenCalledOnce();
    });

    it('spools receipt to local printer queue when silent print needs browser fallback', async () => {
        vi.mocked(silentPrintReceipt).mockImplementation(
            async (_receipt, _printerSelection, options) => {
                const queued = await options?.queueFallback?.({
                    receipt: {
                        restaurant_name: 'lole',
                        transaction_number: 'TX-3',
                        printed_at: '2026-04-03T12:00:00.000Z',
                        items: [],
                        subtotal: 150,
                        total: 150,
                    },
                    bytes: new Uint8Array([27, 64]),
                    payloadBase64: 'G0A=',
                    printer: null,
                });

                return {
                    ok: queued?.ok ?? false,
                    channel: 'queue' as const,
                    reason: queued?.reason,
                };
            }
        );

        const result = await handleApprovedTransactionReceipt({
            autoPrint: true,
            orderId: 'order-3',
            transactionNumber: 'TX-3',
            receipt: {
                restaurant_name: 'lole',
                transaction_number: 'TX-3',
                printed_at: '2026-04-03T12:00:00.000Z',
                items: [],
                subtotal: 150,
                total: 150,
            },
        });

        expect(result).toMatchObject({
            printed: true,
            blocked: false,
        });
        expect(createPrintJob).toHaveBeenCalledWith(
            expect.objectContaining({
                orderId: 'order-3',
                station: 'receipt',
            })
        );
        expect(vi.mocked(silentPrintReceipt).mock.calls[0]?.[2]).toMatchObject({
            queueFallback: expect.any(Function),
        });
    });
});

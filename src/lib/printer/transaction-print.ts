import { queueFiscalJob } from '@/lib/fiscal/offline-queue';
import {
    FiscalSubmissionError,
    isMorLiveConfigured,
    submitFiscalTransaction,
    type FiscalSubmissionRequest,
} from '@/lib/fiscal/mor-client';
import { silentPrintReceipt } from '@/lib/printer/silent-print';
import type { EscPosReceiptPayload } from '@/lib/printer/escpos';
import { createPrintJob } from '@/lib/sync/printerFallback';

function toNumber(value: unknown): number {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
}

export async function handleApprovedTransactionReceipt(args: {
    autoPrint: boolean;
    orderId?: string | null;
    restaurantId?: string | null;
    transactionNumber: string;
    receipt: EscPosReceiptPayload;
    fiscalRequest?: FiscalSubmissionRequest | null;
    isOnline?: boolean;
}): Promise<{
    printed: boolean;
    queuedFiscal: boolean;
    blocked: boolean;
    warning?: string | null;
}> {
    let warning: string | null = null;
    let queuedFiscal = false;
    let blocked = false;
    const liveFiscalRequired = Boolean(args.fiscalRequest && isMorLiveConfigured());

    if (args.fiscalRequest) {
        try {
            const fiscalResult = await submitFiscalTransaction(args.fiscalRequest);
            args.receipt.fiscal_qr_payload = fiscalResult.qr_payload ?? null;
            if (fiscalResult.warning) {
                warning = fiscalResult.warning;
                args.receipt.fiscal_warning = fiscalResult.warning;
            }
            if (fiscalResult.mode === 'local' && args.orderId) {
                await queueFiscalJob({
                    orderId: args.orderId,
                    payload: { ...args.fiscalRequest },
                    warningText: fiscalResult.warning ?? null,
                    queueMode: 'local-signing',
                    signatureEnvelope: fiscalResult.signatureEnvelope ?? null,
                });
                queuedFiscal = true;
            }
        } catch (error) {
            const offlineFallbackAllowed =
                !liveFiscalRequired ||
                args.isOnline === false ||
                (error instanceof FiscalSubmissionError && error.offlineFallbackAllowed);

            if (!offlineFallbackAllowed) {
                warning = 'Fiscalization failed while online. Receipt printing was blocked.';
                blocked = true;
            } else {
                warning = 'Pending fiscalization';
                args.receipt.fiscal_warning = warning;
                if (args.orderId) {
                    await queueFiscalJob({
                        orderId: args.orderId,
                        payload: { ...args.fiscalRequest },
                        warningText: warning,
                    });
                    queuedFiscal = true;
                }
            }
        }
    }

    if (!args.autoPrint) {
        return {
            printed: false,
            queuedFiscal,
            blocked,
            warning,
        };
    }

    if (blocked) {
        return {
            printed: false,
            queuedFiscal,
            blocked: true,
            warning,
        };
    }

    const result = await silentPrintReceipt(args.receipt, undefined, {
        queueFallback: async ({ printer }) => {
            const job = await createPrintJob({
                orderId: args.orderId ?? args.transactionNumber,
                station: 'receipt',
                route: {
                    routeKey: 'receipt-printer',
                    station: 'receipt',
                    preferredDeviceId: printer?.device_id ?? null,
                    preferredPrinterName: printer?.device_name ?? null,
                },
                payload: {
                    restaurantId:
                        args.restaurantId ??
                        process.env.NEXT_PUBLIC_RESTAURANT_ID ??
                        'default-restaurant',
                    orderId: args.orderId ?? args.transactionNumber,
                    orderNumber:
                        args.receipt.order_label?.replace(/^Order\s+/i, '') ??
                        args.transactionNumber,
                    items: args.receipt.items.map(item => ({
                        name: item.name,
                        quantity: item.quantity,
                        notes: item.notes ?? undefined,
                    })),
                    station: 'receipt',
                    firedAt: new Date().toISOString(),
                    reason: 'receipt_auto_print',
                },
            });

            return {
                ok: Boolean(job),
                reason: job ? 'queued_locally' : 'printer_spool_unavailable',
            };
        },
    });
    return {
        printed: result.ok,
        queuedFiscal,
        blocked: false,
        warning: warning ?? result.reason ?? null,
    };
}

export function buildReceiptFromPaymentPayload(input: {
    restaurantName: string;
    restaurantTin?: string | null;
    transactionNumber: string;
    orderNumber?: string | null;
    paymentLabel?: string | null;
    language?: 'en' | 'am';
    subtotal?: number | null;
    total?: number | null;
    taxSummary?: Array<{ label: string; amount: number }> | null;
    items?: Array<{
        name: string;
        quantity?: number | null;
        unit_price?: number | null;
        total_price?: number | null;
        notes?: string | null;
    }> | null;
}): EscPosReceiptPayload {
    const subtotal = toNumber(input.subtotal ?? input.total);
    const total = toNumber(input.total ?? subtotal);
    return {
        restaurant_name: input.restaurantName,
        restaurant_tin: input.restaurantTin ?? null,
        transaction_number: input.transactionNumber,
        printed_at: new Date().toISOString(),
        order_label: input.orderNumber ? `Order ${input.orderNumber}` : null,
        payment_label: input.paymentLabel ?? null,
        language: input.language ?? 'en',
        items:
            input.items?.map(item => ({
                name: item.name,
                quantity: Math.max(1, toNumber(item.quantity ?? 1)),
                unit_price: toNumber(item.unit_price ?? item.total_price),
                total_price: toNumber(item.total_price ?? item.unit_price),
                notes: item.notes ?? null,
            })) ?? [],
        taxes: input.taxSummary ?? [],
        subtotal,
        total,
        footer_lines: ['lole Restaurant OS', 'All amounts in Ethiopian Birr (Br)'],
    };
}

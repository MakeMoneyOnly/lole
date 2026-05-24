import { describe, expect, it } from 'vitest';
import {
    canonicalizeFiscalPayload,
    digestFiscalPayload,
    signFiscalPayload,
    verifyFiscalPayloadSignature,
} from '@/lib/fiscal/local-signing';

const payload = {
    restaurant_tin: '1234567890',
    transaction_number: 'TXN-001',
    occurred_at: '2026-04-21T08:00:00.000Z',
    subtotal: 100,
    tax_total: 15,
    grand_total: 115,
    order_id: 'order-1',
    items: [{ name: 'Coffee', quantity: 1, unit_price: 100, tax_rate: 0.15, total: 115 }],
};

describe('local-signing', () => {
    it('builds deterministic canonical payload', () => {
        expect(canonicalizeFiscalPayload(payload)).toContain('TXN-001');
        expect(canonicalizeFiscalPayload(payload)).toContain('Coffee');
    });

    it('creates stable digest for same payload', async () => {
        const first = await digestFiscalPayload(payload);
        const second = await digestFiscalPayload(payload);

        expect(first).toBe(second);
    });

    it('signs and verifies payload', async () => {
        const signature = await signFiscalPayload(payload, {
            keyId: 'test-key',
            secret: 'secret-123',
            algorithm: 'HMAC-SHA256',
        });

        await expect(verifyFiscalPayloadSignature(payload, signature, 'secret-123')).resolves.toBe(
            true
        );
    });

    it('rejects wrong secret', async () => {
        const signature = await signFiscalPayload(payload, {
            keyId: 'test-key',
            secret: 'secret-123',
            algorithm: 'HMAC-SHA256',
        });

        await expect(
            verifyFiscalPayloadSignature(payload, signature, 'wrong-secret')
        ).resolves.toBe(false);
    });
});

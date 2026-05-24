import { describe, expect, it } from 'vitest';
import { encodeReceiptToEscPos } from '@/lib/printer/escpos';

describe('escpos encoder', () => {
    it('encodes receipt payloads into binary commands with qr support', async () => {
        const encoded = await encodeReceiptToEscPos({
            restaurant_name: 'lole',
            restaurant_tin: '123456789',
            transaction_number: 'TX-001',
            printed_at: '2026-04-01T00:00:00.000Z',
            items: [
                {
                    name: 'Shiro',
                    quantity: 2,
                    unit_price: 120,
                    total_price: 240,
                },
            ],
            subtotal: 240,
            total: 276,
            taxes: [{ label: 'VAT', amount: 36 }],
            fiscal_qr_payload: 'https://lole.app/fiscal/TX-001',
        });

        expect(encoded).toBeInstanceOf(Uint8Array);
        expect(encoded.length).toBeGreaterThan(50);
        expect(Array.from(encoded)).toContain(0x1d);
    });
});

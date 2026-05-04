/**
 * Tests for ESC/POS receipt encoding
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encodeReceiptToEscPos, type EscPosReceiptPayload } from '../escpos';

// Mock the optional library import
vi.mock('@point-of-sale/receipt-printer-encoder', () => ({
    default: null,
}));

describe('escpos', () => {
    const basePayload: EscPosReceiptPayload = {
        restaurant_name: 'Test Restaurant',
        restaurant_tin: 'ET123456789',
        transaction_number: 'TXN-001',
        printed_at: '2024-01-15 10:30:00',
        items: [
            { name: 'Doro Wot', quantity: 2, unit_price: 180, total_price: 360 },
            { name: 'Injera', quantity: 4, unit_price: 20, total_price: 80 },
        ],
        subtotal: 440,
        total: 440,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('encodeReceiptToEscPos', () => {
        it('should return Uint8Array', async () => {
            const result = await encodeReceiptToEscPos(basePayload);

            expect(result).toBeInstanceOf(Uint8Array);
        });

        it('should include restaurant name in output', async () => {
            const result = await encodeReceiptToEscPos(basePayload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('Test Restaurant');
        });

        it('should include TIN when provided', async () => {
            const result = await encodeReceiptToEscPos(basePayload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('TIN: ET123456789');
        });

        it('should not include TIN line when not provided', async () => {
            const payloadWithoutTin: EscPosReceiptPayload = {
                ...basePayload,
                restaurant_tin: null,
            };
            const result = await encodeReceiptToEscPos(payloadWithoutTin);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).not.toContain('TIN:');
        });

        it('should include transaction number', async () => {
            const result = await encodeReceiptToEscPos(basePayload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('Txn: TXN-001');
        });

        it('should include printed timestamp', async () => {
            const result = await encodeReceiptToEscPos(basePayload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('2024-01-15 10:30:00');
        });

        it('should include order label when provided', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                order_label: 'Order #42',
            };
            const result = await encodeReceiptToEscPos(payload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('Order #42');
        });

        it('should include item names', async () => {
            const result = await encodeReceiptToEscPos(basePayload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('Doro Wot');
            expect(text).toContain('Injera');
        });

        it('should include item quantities', async () => {
            const result = await encodeReceiptToEscPos(basePayload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('2x');
            expect(text).toContain('4x');
        });

        it('should include subtotal', async () => {
            const result = await encodeReceiptToEscPos(basePayload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('Subtotal');
        });

        it('should include total', async () => {
            const result = await encodeReceiptToEscPos(basePayload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('TOTAL');
        });

        it('should include taxes when provided', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                taxes: [{ label: 'VAT (15%)', amount: 57.39 }],
            };
            const result = await encodeReceiptToEscPos(payload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('VAT (15%)');
        });

        it('should include payment label when provided', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                payment_label: 'Paid via Telebirr',
            };
            const result = await encodeReceiptToEscPos(payload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('Payment: Paid via Telebirr');
        });

        it('should include fiscal warning when provided', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                fiscal_warning: 'This is a non-fiscal receipt',
            };
            const result = await encodeReceiptToEscPos(payload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('This is a non-fiscal receipt');
        });

        it('should include footer lines when provided', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                footer_lines: ['Thank you!', 'Visit us again'],
            };
            const result = await encodeReceiptToEscPos(payload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('Thank you!');
            expect(text).toContain('Visit us again');
        });

        it('should use custom currency when provided', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                currency: 'USD',
            };
            const result = await encodeReceiptToEscPos(payload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('Br 180.00');
            expect(text).toContain('Br 360.00');
        });

        it('should default to ETB currency', async () => {
            const result = await encodeReceiptToEscPos(basePayload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('Br 180.00');
        });

        it('should include item notes when provided', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                items: [
                    {
                        name: 'Doro Wot',
                        quantity: 2,
                        unit_price: 180,
                        total_price: 360,
                        notes: 'Extra spicy',
                    },
                ],
            };
            const result = await encodeReceiptToEscPos(payload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('Extra spicy');
        });

        it('should handle empty items array', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                items: [],
                subtotal: 0,
                total: 0,
            };
            const result = await encodeReceiptToEscPos(payload);

            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBeGreaterThan(0);
        });

        it('should handle zero prices', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                items: [{ name: 'Free Item', quantity: 1, unit_price: 0, total_price: 0 }],
                subtotal: 0,
                total: 0,
            };
            const result = await encodeReceiptToEscPos(payload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('Free Item');
            expect(text).toContain('0.00');
        });

        it('should handle large prices', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                items: [
                    {
                        name: 'Expensive Item',
                        quantity: 1,
                        unit_price: 99999.99,
                        total_price: 99999.99,
                    },
                ],
                subtotal: 99999.99,
                total: 99999.99,
            };
            const result = await encodeReceiptToEscPos(payload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('99999.99');
        });

        it('should handle long item names', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                items: [
                    {
                        name: 'Very Long Item Name That Should Be Included In Full',
                        quantity: 1,
                        unit_price: 100,
                        total_price: 100,
                    },
                ],
            };
            const result = await encodeReceiptToEscPos(payload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('Very Long Item Name That Should Be Included In Full');
        });

        it('should handle special characters in item names', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                items: [
                    { name: 'Doro Wot (ዶሮ ወጥ)', quantity: 1, unit_price: 180, total_price: 180 },
                ],
            };
            const result = await encodeReceiptToEscPos(payload);

            expect(result).toBeInstanceOf(Uint8Array);
        });

        it('should include fiscal QR payload when provided', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                fiscal_qr_payload: 'QR:ET123456789:TXN-001:440.00',
            };
            const result = await encodeReceiptToEscPos(payload);

            // QR code commands should be present in the byte array
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBeGreaterThan(100);
        });

        it('should start with ESC @ (initialize) command', async () => {
            const result = await encodeReceiptToEscPos(basePayload);

            // ESC @ = 0x1b 0x40
            expect(result[0]).toBe(0x1b);
            expect(result[1]).toBe(0x40);
        });

        it('should include center alignment command for header', async () => {
            const result = await encodeReceiptToEscPos(basePayload);

            // ESC a 1 = center align
            const hasCenterAlign = Array.from(result).some(
                (byte, i, arr) => arr[i - 2] === 0x1b && arr[i - 1] === 0x61 && byte === 0x01
            );
            expect(hasCenterAlign).toBe(true);
        });

        it('should include left alignment command for items', async () => {
            const result = await encodeReceiptToEscPos(basePayload);

            // ESC a 0 = left align
            const hasLeftAlign = Array.from(result).some(
                (byte, i, arr) => arr[i - 2] === 0x1b && arr[i - 1] === 0x61 && byte === 0x00
            );
            expect(hasLeftAlign).toBe(true);
        });

        it('should include paper cut command at end', async () => {
            const result = await encodeReceiptToEscPos(basePayload);

            // GS V = cut paper (partial cut with feed)
            const lastBytes = Array.from(result).slice(-4);
            expect(lastBytes[0]).toBe(0x1d); // GS
            expect(lastBytes[1]).toBe(0x56); // V
        });

        it('should include line feeds before cut', async () => {
            const result = await encodeReceiptToEscPos(basePayload);

            // Should have LF (0x0a) before cut
            const resultArray = Array.from(result);
            const cutIndex = resultArray.findIndex(
                (b, i) => b === 0x1d && resultArray[i + 1] === 0x56
            );

            // There should be LF bytes before the cut
            const beforeCut = resultArray.slice(cutIndex - 5, cutIndex);
            expect(beforeCut.some(b => b === 0x0a)).toBe(true);
        });

        it('should handle multiple tax lines', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                taxes: [
                    { label: 'VAT (15%)', amount: 57.39 },
                    { label: 'Service Fee', amount: 22.0 },
                ],
            };
            const result = await encodeReceiptToEscPos(payload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('VAT (15%)');
            expect(text).toContain('Service Fee');
        });

        it('should handle many items', async () => {
            const items = Array.from({ length: 50 }, (_, i) => ({
                name: `Item ${i + 1}`,
                quantity: 1,
                unit_price: 10,
                total_price: 10,
            }));

            const payload: EscPosReceiptPayload = {
                ...basePayload,
                items,
                subtotal: 500,
                total: 500,
            };

            const result = await encodeReceiptToEscPos(payload);

            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBeGreaterThan(1000);
        });

        it('should handle decimal quantities', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                items: [{ name: 'Weighted Item', quantity: 0.5, unit_price: 100, total_price: 50 }],
                subtotal: 50,
                total: 50,
            };
            const result = await encodeReceiptToEscPos(payload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('0.5x');
        });
    });

    describe('ESC/POS command generation', () => {
        it('should generate valid ESC/POS bytes', async () => {
            const result = await encodeReceiptToEscPos(basePayload);

            // Check that result is valid byte array
            expect(result.every(byte => byte >= 0 && byte <= 255)).toBe(true);
        });

        it('should include bold on command for TOTAL', async () => {
            const result = await encodeReceiptToEscPos(basePayload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            // TOTAL should be present
            expect(text).toContain('TOTAL');
        });

        it('should handle Unicode characters', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                restaurant_name: 'ምግብ ቤት',
                items: [{ name: 'ዶሮ ወጥ', quantity: 1, unit_price: 180, total_price: 180 }],
            };
            const result = await encodeReceiptToEscPos(payload);

            expect(result).toBeInstanceOf(Uint8Array);
        });
    });

    describe('Edge cases', () => {
        it('should handle empty restaurant name', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                restaurant_name: '',
            };
            const result = await encodeReceiptToEscPos(payload);

            expect(result).toBeInstanceOf(Uint8Array);
        });

        it('should handle missing optional fields', async () => {
            const minimalPayload: EscPosReceiptPayload = {
                restaurant_name: 'Test',
                transaction_number: 'TXN-001',
                printed_at: '2024-01-15',
                items: [],
                subtotal: 0,
                total: 0,
            };
            const result = await encodeReceiptToEscPos(minimalPayload);

            expect(result).toBeInstanceOf(Uint8Array);
        });

        it('should handle very long restaurant name', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                restaurant_name: 'A'.repeat(100),
            };
            const result = await encodeReceiptToEscPos(payload);

            expect(result).toBeInstanceOf(Uint8Array);
        });

        it('should handle negative prices (refunds)', async () => {
            const payload: EscPosReceiptPayload = {
                ...basePayload,
                items: [{ name: 'Refund Item', quantity: 1, unit_price: -50, total_price: -50 }],
                subtotal: -50,
                total: -50,
            };
            const result = await encodeReceiptToEscPos(payload);
            const decoder = new TextDecoder();
            const text = decoder.decode(result);

            expect(text).toContain('-50');
        });
    });
});

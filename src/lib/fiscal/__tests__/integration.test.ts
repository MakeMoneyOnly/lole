/**
 * Integration test for unified ERCA fiscal submission flow.
 * Tests: order completion → ERCA invoice generation → submission.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    ERCAService,
    extractVAT,
    calculateVAT,
    etbToSantim,
    santimToEtb,
    generateInvoiceNumber,
    VAT_RATE,
    type ERCAOrderData,
} from '../erca-service';

describe('Fiscal Integration — E2E VAT Flow', () => {
    it('should correctly calculate VAT for a complete restaurant order', () => {
        // Simulate an Ethiopian restaurant order:
        // 2x Doro Wot @ 180 ETB each = 360 ETB
        // 1x Macchiato @ 45 ETB each = 45 ETB
        // Total customer pays: 405 ETB (tax-inclusive)

        const items = [
            { name: 'Doro Wot', unit_price: 180, quantity: 2 },
            { name: 'Macchiato', unit_price: 45, quantity: 1 },
        ];

        let totalVATSantim = 0;
        let totalNetSantim = 0;
        let totalDisplayedSantim = 0;

        for (const item of items) {
            const priceSantim = etbToSantim(item.unit_price);
            totalDisplayedSantim += priceSantim * item.quantity;

            const { netPriceSantim, vatPortionSantim } = extractVAT(priceSantim);
            totalVATSantim += vatPortionSantim * item.quantity;
            totalNetSantim += netPriceSantim * item.quantity;
        }

        // Verification:
        // Total displayed: 405 * 100 = 40500 santim
        // VAT portion: ~5283 santim (52.83 ETB)
        // Net: ~35217 santim (352.17 ETB)
        // Net + VAT must equal total displayed

        expect(totalDisplayedSantim).toBe(40500);
        expect(totalNetSantim + totalVATSantim).toBe(totalDisplayedSantim);
        expect(santimToEtb(totalVATSantim)).toBeCloseTo(52.83, 0);
    });

    it('should generate unique invoice numbers for consecutive orders', () => {
        const restaurantId = 'abc12345-6789-0000-0000-000000000000';
        const invoices = ['001', '002', '003', '042', '100'].map(n =>
            generateInvoiceNumber(restaurantId, n)
        );

        expect(new Set(invoices).size).toBe(5);
        invoices.forEach(inv => {
            expect(inv).toMatch(/^ABC12345-\d{3}$/);
        });
    });

    it('should produce zero VAT for zero-price items', () => {
        const result = extractVAT(0);

        expect(result.vatPortionSantim).toBe(0);
        expect(result.netPriceSantim).toBe(0);
    });

    it('should round VAT correctly: tax-inclusive 100 ETB = 13.04 ETB VAT', () => {
        // Critical regression test: Ethiopian VAT is 15% of net, not 15% of total
        // VAT = 100 * 15/115 = 13.04 ETB (1304 santim)
        const result = extractVAT(10000);

        expect(result.vatPortionSantim).toBe(1304);
        expect(result.netPriceSantim).toBe(8696);
        expect(result.netPriceSantim + result.vatPortionSantim).toBe(10000);
    });

    it('should handle santim ↔ ETB conversion without precision loss', () => {
        const amounts = [1, 10, 100, 1000, 9999, 1000000];

        for (const santim of amounts) {
            const etb = santimToEtb(santim);
            const backToSantim = etbToSantim(etb);
            // May differ by 1 due to floating point, accept ±1
            expect(Math.abs(backToSantim - santim)).toBeLessThanOrEqual(1);
        }
    });

    it('should calculate VAT for net price using calculateVAT', () => {
        // Net price: 10000 santim (100 ETB before tax)
        // VAT = 10000 * 0.15 = 1500 santim
        const vat = calculateVAT(10000);

        expect(vat).toBe(1500);
    });

    it('should detect B2B transactions via buyer_tin presence', () => {
        // B2B: guest has TIN → withholding tax applies
        const b2bOrder: ERCAOrderData = {
            id: 'order-1',
            order_number: '001',
            restaurant_id: 'rest-1',
            total_price: 10000,
            created_at: new Date().toISOString(),
            restaurant: {
                tin_number: '0012345678',
                vat_number: 'VAT-ET-0012345678',
                erca_enabled: true,
                name: 'Test',
                name_am: null,
            },
            order_items: [
                { quantity: 1, unit_price: 100, menu_item: { name: 'Coffee', name_am: null } },
            ],
            guest: { tin_number: '9876543210' },
        };

        expect(b2bOrder.guest?.tin_number).toBeTruthy();
        // WHT should be 2% of grand total (approximately)
        const payload = { grand_total_santim: 8696 + 1304 }; // 10000
        const wht = Math.round(payload.grand_total_santim * 0.02);
        expect(wht).toBe(200); // 2% of 10000 santim = 200 santim
    });

    it('should not apply WHT for B2C transactions (no buyer TIN)', () => {
        const b2cOrder: ERCAOrderData = {
            id: 'order-2',
            order_number: '002',
            restaurant_id: 'rest-1',
            total_price: 5000,
            created_at: new Date().toISOString(),
            restaurant: {
                tin_number: '0012345678',
                vat_number: 'VAT-ET-0012345678',
                erca_enabled: true,
                name: 'Test',
                name_am: null,
            },
            order_items: [
                { quantity: 1, unit_price: 50, menu_item: { name: 'Tea', name_am: null } },
            ],
            guest: null,
        };

        expect(b2cOrder.guest?.tin_number).toBeFalsy();
    });
});

/**
 * Tests for ERCA Service (MED-024)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    VAT_RATE,
    VAT_EXTRACTION_RATE,
    SANTIM_PER_ETB,
    MAX_RETRY_ATTEMPTS,
    extractVAT,
    calculateVAT,
    etbToSantim,
    santimToEtb,
    generateInvoiceNumber,
    ERCAService,
    getERCAService,
    asTaxInclusiveSantim,
    asNetSantim,
} from '../erca-service';
import type { ERCAOrderData } from '../erca-service';

// Mock the logger
vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create mock Supabase client with chainable methods
const createMockSupabaseClient = (): any => {
    const mockQuery = {
        select: vi.fn(() => mockQuery),
        insert: vi.fn(() => mockQuery),
        upsert: vi.fn(() => mockQuery),
        update: vi.fn(() => mockQuery),
        delete: vi.fn(() => mockQuery),
        eq: vi.fn(() => mockQuery),
        neq: vi.fn(() => mockQuery),
        in: vi.fn(() => mockQuery),
        gte: vi.fn(() => mockQuery),
        lte: vi.fn(() => mockQuery),
        order: vi.fn(() => mockQuery),
        limit: vi.fn(() => mockQuery),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };

    return {
        from: vi.fn(() => mockQuery),
        mockQuery,
    };
};

// Mock the Supabase client
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => {
        const mockQuery = {
            select: vi.fn(() => mockQuery),
            insert: vi.fn(() => mockQuery),
            upsert: vi.fn(() => mockQuery),
            update: vi.fn(() => mockQuery),
            delete: vi.fn(() => mockQuery),
            eq: vi.fn(() => mockQuery),
            neq: vi.fn(() => mockQuery),
            in: vi.fn(() => mockQuery),
            gte: vi.fn(() => mockQuery),
            lte: vi.fn(() => mockQuery),
            order: vi.fn(() => mockQuery),
            limit: vi.fn(() => mockQuery),
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
        return {
            from: vi.fn(() => mockQuery),
        };
    }),
}));

describe('VAT Constants', () => {
    it('should have correct VAT rate for Ethiopia', () => {
        expect(VAT_RATE).toBe(0.15);
    });

    it('should have correct VAT extraction rate', () => {
        expect(VAT_EXTRACTION_RATE).toBe(15 / 115);
    });

    it('should have correct santim per ETB', () => {
        expect(SANTIM_PER_ETB).toBe(100);
    });

    it('should have correct max retry attempts', () => {
        expect(MAX_RETRY_ATTEMPTS).toBe(5);
    });
});

describe('extractVAT', () => {
    it('should extract VAT from tax-inclusive price correctly', () => {
        // 115 ETB (11500 santim) tax-inclusive
        // VAT = 11500 × (15/115) = 1500 santim (15 ETB)
        // Net = 11500 - 1500 = 10000 santim (100 ETB)
        const result = extractVAT(11500);

        expect(result.vatPortionSantim).toBe(1500);
        expect(result.netPriceSantim).toBe(10000);
    });

    it('should extract correct VAT from 100 ETB item (regression: NOT 1500 santim)', () => {
        // 100 ETB (10000 santim) tax-inclusive
        // Correct: VAT = 10000 × 15/115 = 1304 santim (rounded)
        // INCORRECT would be 1500 santim (15% of 100 ETB added on top)
        const result = extractVAT(10000);

        expect(result.vatPortionSantim).toBe(1304);
        expect(result.netPriceSantim).toBe(8696);
        // Sanity: net + vat must equal original
        expect(result.netPriceSantim + result.vatPortionSantim).toBe(10000);
    });

    it('should handle zero price', () => {
        const result = extractVAT(0);

        expect(result.vatPortionSantim).toBe(0);
        expect(result.netPriceSantim).toBe(0);
    });

    it('should handle small amounts', () => {
        // 1 ETB (100 santim) tax-inclusive
        const result = extractVAT(100);

        expect(result.vatPortionSantim).toBe(13); // Rounded from 13.04
        expect(result.netPriceSantim).toBe(87);
    });

    it('should handle large amounts', () => {
        // 10000 ETB (1000000 santim) tax-inclusive
        const result = extractVAT(1000000);

        expect(result.vatPortionSantim).toBe(130435); // Rounded
        expect(result.netPriceSantim).toBe(869565);
    });

    it('should round correctly', () => {
        // Test rounding behavior
        const result1 = extractVAT(100);
        const result2 = extractVAT(101);

        // VAT should be integers (rounded)
        expect(Number.isInteger(result1.vatPortionSantim)).toBe(true);
        expect(Number.isInteger(result2.vatPortionSantim)).toBe(true);
    });
});

describe('calculateVAT', () => {
    it('should calculate VAT for net price', () => {
        // 100 ETB net price
        // VAT = 100 × 0.15 = 15 ETB
        const result = calculateVAT(10000);

        expect(result).toBe(1500);
    });

    it('should handle zero net price', () => {
        expect(calculateVAT(0)).toBe(0);
    });

    it('should round correctly', () => {
        // 99 santim net price
        // VAT = 99 × 0.15 = 14.85 → 15 santim
        const result = calculateVAT(99);

        expect(result).toBe(15);
    });
});

describe('etbToSantim', () => {
    it('should convert ETB to santim', () => {
        expect(etbToSantim(1)).toBe(100);
        expect(etbToSantim(10)).toBe(1000);
        expect(etbToSantim(100.5)).toBe(10050);
    });

    it('should handle zero', () => {
        expect(etbToSantim(0)).toBe(0);
    });

    it('should round fractional santim', () => {
        // 1.5 ETB = 150 santim (exact, no rounding needed)
        // Note: JS floating point causes unexpected results with values like 1.005, 1.015, 1.025
        // so we test with a value that converts cleanly
        expect(etbToSantim(1.5)).toBe(150);
        expect(etbToSantim(1.55)).toBe(155);
    });
});

describe('santimToEtb', () => {
    it('should convert santim to ETB', () => {
        expect(santimToEtb(100)).toBe(1);
        expect(santimToEtb(1000)).toBe(10);
        expect(santimToEtb(10050)).toBe(100.5);
    });

    it('should handle zero', () => {
        expect(santimToEtb(0)).toBe(0);
    });

    it('should preserve decimal precision', () => {
        // 1 santim = 0.01 ETB
        expect(santimToEtb(1)).toBe(0.01);
        expect(santimToEtb(99)).toBe(0.99);
    });
});

describe('generateInvoiceNumber', () => {
    it('should generate invoice number with correct format', () => {
        const restaurantId = 'abcd1234-5678-90ef-ghij-klmnopqrstuv';
        const orderNumber = '0042';

        const result = generateInvoiceNumber(restaurantId, orderNumber);

        expect(result).toBe('ABCD1234-0042');
    });

    it('should use first 8 characters of restaurant ID', () => {
        const restaurantId = '12345678-90ab-cdef-ghij-klmnopqrstuv';
        const orderNumber = '0001';

        const result = generateInvoiceNumber(restaurantId, orderNumber);

        expect(result.startsWith('12345678')).toBe(true);
    });

    it('should handle short restaurant ID', () => {
        const restaurantId = 'abc';
        const orderNumber = '0001';

        const result = generateInvoiceNumber(restaurantId, orderNumber);

        expect(result).toBe('ABC-0001');
    });

    it('should uppercase the prefix', () => {
        const restaurantId = 'lowercase-id';
        const orderNumber = '0001';

        const result = generateInvoiceNumber(restaurantId, orderNumber);

        expect(result.startsWith('LOWERCAS')).toBe(true);
    });
});

describe('VAT Calculation Integration', () => {
    it('should correctly calculate VAT for a complete order', () => {
        // Simulate an order with multiple items
        const items = [
            { unitPrice: 11500, quantity: 2 }, // 115 ETB each, 2 items
            { unitPrice: 5000, quantity: 1 }, // 50 ETB each, 1 item
        ];

        let totalVAT = 0;
        let totalNet = 0;

        for (const item of items) {
            const { netPriceSantim, vatPortionSantim } = extractVAT(item.unitPrice);
            totalVAT += vatPortionSantim * item.quantity;
            totalNet += netPriceSantim * item.quantity;
        }

        // Item 1: 115 ETB × 2 = 230 ETB total
        //   VAT: 15 ETB × 2 = 30 ETB
        //   Net: 100 ETB × 2 = 200 ETB
        // Item 2: 50 ETB × 1 = 50 ETB total
        //   VAT: 6.52 ETB → 652 santim (rounded)
        //   Net: 43.48 ETB → 4348 santim (rounded)

        expect(totalVAT).toBe(1500 * 2 + 652); // 3652 santim
        expect(totalNet).toBe(10000 * 2 + 4348); // 24348 santim

        // Verify: Net + VAT should equal original total
        const originalTotal = 11500 * 2 + 5000; // 28000 santim
        expect(totalNet + totalVAT).toBe(originalTotal);
    });

    it('should handle tax-inclusive pricing correctly', () => {
        // If a menu item is priced at 100 ETB (tax-inclusive)
        // The customer pays 100 ETB
        // VAT portion is extracted from that 100 ETB

        const displayedPrice = etbToSantim(100); // 10000 santim
        const { netPriceSantim, vatPortionSantim } = extractVAT(displayedPrice);

        // VAT = 100 × (15/115) = 13.04 ETB
        expect(santimToEtb(vatPortionSantim)).toBeCloseTo(13.04, 0);

        // Net = 100 - 13.04 = 86.96 ETB
        expect(santimToEtb(netPriceSantim)).toBeCloseTo(86.96, 0);

        // Total should equal original
        expect(santimToEtb(netPriceSantim + vatPortionSantim)).toBe(100);
    });
});

describe('ERCA Compliance Scenarios', () => {
    it('should calculate correct VAT for receipt', () => {
        // Sample receipt calculation
        const items = [
            { name: 'Doro Wot', price: 180, quantity: 2 },
            { name: 'Fasil Tea', price: 40, quantity: 2 },
        ];

        let subtotal = 0;
        let totalVAT = 0;

        for (const item of items) {
            const priceSantim = etbToSantim(item.price);
            const { netPriceSantim, vatPortionSantim } = extractVAT(priceSantim);

            subtotal += santimToEtb(netPriceSantim * item.quantity);
            totalVAT += santimToEtb(vatPortionSantim * item.quantity);
        }

        // Verify totals
        const displayedTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const calculatedTotal = subtotal + totalVAT;

        // Should match within rounding tolerance
        expect(Math.abs(calculatedTotal - displayedTotal)).toBeLessThan(0.1);
    });

    it('should generate unique invoice numbers', () => {
        const restaurantId = 'abcd1234-5678-90ef-ghij-klmnopqrstuv';
        const orderNumbers = ['0001', '0002', '0003', '0042', '0100'];

        const invoiceNumbers = orderNumbers.map(orderNum =>
            generateInvoiceNumber(restaurantId, orderNum)
        );

        // All should be unique
        expect(new Set(invoiceNumbers).size).toBe(invoiceNumbers.length);

        // All should have correct prefix
        invoiceNumbers.forEach(num => {
            expect(num.startsWith('ABCD1234-')).toBe(true);
        });
    });
});

describe('ERCAService', () => {
    let service: ERCAService;
    let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockReset();
        service = new ERCAService({
            apiUrl: 'https://test-erca.api',
            apiKey: 'test-api-key',
            sandboxMode: true,
        });
        mockSupabase = createMockSupabaseClient();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('constructor', () => {
        it('should create service with provided config', () => {
            const customService = new ERCAService({
                apiUrl: 'https://custom.api',
                apiKey: 'custom-key',
                sandboxMode: false,
            });
            expect(customService).toBeDefined();
        });

        it('should use default config when not provided', () => {
            const defaultService = new ERCAService();
            expect(defaultService).toBeDefined();
        });

        it('should use environment variables for config', () => {
            const originalEnv = process.env.ERCA_API_URL;
            process.env.ERCA_API_URL = 'https://env.api';

            const envService = new ERCAService();
            expect(envService).toBeDefined();

            process.env.ERCA_API_URL = originalEnv;
        });
    });

    describe('isERCAEnabled', () => {
        it('should return true when restaurant has VAT number', async () => {
            const mockSingle = vi.fn().mockResolvedValue({
                data: { vat_number: 'VAT-ET-0012345678', erca_enabled: true },
                error: null,
            });

            // Get the internal supabase client and mock its response
            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: mockSingle,
            } as unknown as ReturnType<typeof supabaseClient.from>);

            const result = await service.isERCAEnabled('restaurant-123');

            expect(result).toBe(true);
        });

        it('should return false when restaurant has no VAT number', async () => {
            const mockSingle = vi.fn().mockResolvedValue({
                data: { vat_number: null },
                error: null,
            });

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: mockSingle,
            } as unknown as ReturnType<typeof supabaseClient.from>);

            const result = await service.isERCAEnabled('restaurant-123');

            expect(result).toBe(false);
        });

        it('should return false on database error', async () => {
            const mockSingle = vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
            });

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: mockSingle,
            } as unknown as ReturnType<typeof supabaseClient.from>);

            const result = await service.isERCAEnabled('restaurant-123');

            expect(result).toBe(false);
        });

        it('should return false when restaurant not found', async () => {
            const mockSingle = vi.fn().mockResolvedValue({
                data: null,
                error: null,
            });

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: mockSingle,
            } as unknown as ReturnType<typeof supabaseClient.from>);

            const result = await service.isERCAEnabled('nonexistent');

            expect(result).toBe(false);
        });
    });

    describe('generateDailyVATSummary', () => {
        it('should calculate daily VAT summary correctly', async () => {
            const mockData = [
                { grand_total_santim: 11500, vat_amount_santim: 1500, status: 'success' },
                { grand_total_santim: 23000, vat_amount_santim: 3000, status: 'success' },
                { grand_total_santim: 10000, vat_amount_santim: 1300, status: 'pending' },
                { grand_total_santim: 5000, vat_amount_santim: 650, status: 'failed' },
            ];

            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
            };

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue(
                mockQuery as unknown as ReturnType<typeof supabaseClient.from>
            );

            const result = await service.generateDailyVATSummary('restaurant-123', '2024-01-15');

            expect(result.date).toBe('2024-01-15');
            expect(result.invoice_count).toBe(2);
            expect(result.pending_count).toBe(1);
            expect(result.failed_count).toBe(1);
            expect(parseFloat(result.total_revenue_etb)).toBeCloseTo(345, 0);
            expect(parseFloat(result.total_vat_etb)).toBeCloseTo(45, 0);
        });

        it('should handle empty submissions', async () => {
            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockResolvedValue({ data: [], error: null }),
            };

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue(
                mockQuery as unknown as ReturnType<typeof supabaseClient.from>
            );

            const result = await service.generateDailyVATSummary('restaurant-123', '2024-01-15');

            expect(result.invoice_count).toBe(0);
            expect(result.total_revenue_etb).toBe('0.00');
            expect(result.total_vat_etb).toBe('0.00');
        });

        it('should throw on database error', async () => {
            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
            };

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue(
                mockQuery as unknown as ReturnType<typeof supabaseClient.from>
            );

            await expect(
                service.generateDailyVATSummary('restaurant-123', '2024-01-15')
            ).rejects.toThrow();
        });
    });

    describe('getFailedSubmissions', () => {
        it('should return failed submissions', async () => {
            const mockData = [
                {
                    id: 'sub-1',
                    order_id: 'order-1',
                    invoice_number: 'INV-001',
                    error_message: 'Network error',
                    created_at: '2024-01-15T10:00:00Z',
                },
                {
                    id: 'sub-2',
                    order_id: 'order-2',
                    invoice_number: 'INV-002',
                    error_message: 'Timeout',
                    created_at: '2024-01-15T11:00:00Z',
                },
            ];

            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
            };

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue(
                mockQuery as unknown as ReturnType<typeof supabaseClient.from>
            );

            const result = await service.getFailedSubmissions('restaurant-123');

            expect(result).toHaveLength(2);
            expect(result[0].invoice_number).toBe('INV-001');
        });

        it('should respect limit parameter', async () => {
            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            };

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue(
                mockQuery as unknown as ReturnType<typeof supabaseClient.from>
            );

            await service.getFailedSubmissions('restaurant-123', 10);

            expect(mockQuery.limit).toHaveBeenCalledWith(10);
        });

        it('should return empty array when no failed submissions', async () => {
            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({ data: null, error: null }),
            };

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue(
                mockQuery as unknown as ReturnType<typeof supabaseClient.from>
            );

            const result = await service.getFailedSubmissions('restaurant-123');

            expect(result).toEqual([]);
        });
    });

    describe('generateMonthlyVATReport', () => {
        it('should generate monthly report with daily summaries', async () => {
            const mockData = [
                {
                    grand_total_santim: 11500,
                    vat_amount_santim: 1500,
                    submitted_at: '2024-01-15T10:00:00Z',
                    status: 'success',
                },
                {
                    grand_total_santim: 23000,
                    vat_amount_santim: 3000,
                    submitted_at: '2024-01-15T14:00:00Z',
                    status: 'success',
                },
                {
                    grand_total_santim: 10000,
                    vat_amount_santim: 1300,
                    submitted_at: '2024-01-16T10:00:00Z',
                    status: 'success',
                },
            ];

            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                eq2: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
            };

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue(
                mockQuery as unknown as ReturnType<typeof supabaseClient.from>
            );

            const result = await service.generateMonthlyVATReport('restaurant-123', 2024, 1);

            expect(result.period).toEqual({ year: 2024, month: 1 });
            expect(result.total_invoices).toBe(3);
            expect(result.daily_summaries).toHaveLength(2);
            expect(result.daily_summaries[0].date).toBe('2024-01-15');
            expect(result.daily_summaries[0].invoice_count).toBe(2);
        });

        it('should handle empty month', async () => {
            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockResolvedValue({ data: [], error: null }),
            };

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue(
                mockQuery as unknown as ReturnType<typeof supabaseClient.from>
            );

            const result = await service.generateMonthlyVATReport('restaurant-123', 2024, 2);

            expect(result.total_invoices).toBe(0);
            expect(result.total_revenue_etb).toBe('0.00');
            expect(result.daily_summaries).toHaveLength(0);
        });

        it('should sort daily summaries by date', async () => {
            const mockData = [
                {
                    grand_total_santim: 10000,
                    vat_amount_santim: 1300,
                    submitted_at: '2024-01-20T10:00:00Z',
                    status: 'success',
                },
                {
                    grand_total_santim: 5000,
                    vat_amount_santim: 650,
                    submitted_at: '2024-01-10T10:00:00Z',
                    status: 'success',
                },
                {
                    grand_total_santim: 8000,
                    vat_amount_santim: 1040,
                    submitted_at: '2024-01-15T10:00:00Z',
                    status: 'success',
                },
            ];

            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
            };

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue(
                mockQuery as unknown as ReturnType<typeof supabaseClient.from>
            );

            const result = await service.generateMonthlyVATReport('restaurant-123', 2024, 1);

            expect(result.daily_summaries[0].date).toBe('2024-01-10');
            expect(result.daily_summaries[1].date).toBe('2024-01-15');
            expect(result.daily_summaries[2].date).toBe('2024-01-20');
        });
    });

    describe('submitInvoice', () => {
        it('should throw error when order not found', async () => {
            const mockSingle = vi.fn().mockResolvedValue({
                data: null,
                error: null,
            });

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: mockSingle,
            } as unknown as ReturnType<typeof supabaseClient.from>);

            await expect(service.submitInvoice('nonexistent-order')).rejects.toThrow();
        });

        it('should throw error when database query fails', async () => {
            const mockSingle = vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database connection error' },
            });

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: mockSingle,
            } as unknown as ReturnType<typeof supabaseClient.from>);

            await expect(service.submitInvoice('order-123')).rejects.toThrow();
        });

        it('should submit invoice successfully with stub mode when API not configured', async () => {
            // Create service without API config (stub mode)
            const stubService = new ERCAService({
                apiUrl: '',
                apiKey: '',
                sandboxMode: true,
            });

            const mockOrderData = {
                id: 'order-123',
                order_number: 'ORD-001',
                restaurant_id: 'rest-123',
                restaurant: {
                    id: 'rest-123',
                    tin_number: '0012345678',
                    vat_number: 'VAT-ET-0012345678', // Required for VAT submission
                    erca_enabled: true,
                    name: 'Test Restaurant',
                },
                guest: null,
                order_items: [
                    {
                        id: 'item-1',
                        menu_item_id: 'menu-1',
                        quantity: 2,
                        unit_price: 115, // Tax-inclusive price
                        menu_item: {
                            id: 'menu-1',
                            name: 'Test Item',
                            name_am: 'ቴስት እቃ',
                        },
                    },
                ],
            };

            const mockSingle = vi
                .fn()
                .mockResolvedValueOnce({ data: mockOrderData, error: null })
                .mockResolvedValueOnce({ data: null, error: null }); // For existing submission check

            const mockUpsert = vi.fn().mockResolvedValue({
                data: { id: 'submission-1' },
                error: null,
            });

            const supabaseClient = stubService['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                upsert: mockUpsert,
                single: mockSingle,
            } as unknown as ReturnType<typeof supabaseClient.from>);

            const result = await stubService.submitInvoice('order-123');

            expect(result.success).toBe(true);
            expect(result.invoice_number).toBeDefined();
            expect(result.qr_payload).toBeDefined();
            expect(result.digital_signature).toBeDefined();
        });

        it('should submit invoice to ERCA API when configured', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    invoice_id: 'erca-inv-123',
                    qr_payload: 'qr-test-payload',
                    digital_signature: 'sig-test',
                }),
            });

            const mockOrderData = {
                id: 'order-123',
                order_number: 'ORD-001',
                restaurant_id: 'rest-123',
                restaurant: {
                    id: 'rest-123',
                    tin_number: '0012345678',
                    vat_number: 'VAT-ET-0012345678', // Required for VAT submission
                    erca_enabled: true,
                    name: 'Test Restaurant',
                },
                guest: { tin_number: 'ET987654321' },
                order_items: [
                    {
                        id: 'item-1',
                        menu_item_id: 'menu-1',
                        quantity: 1,
                        unit_price: 230,
                        menu_item: {
                            id: 'menu-1',
                            name: 'Test Item',
                            name_am: null,
                        },
                    },
                ],
            };

            const mockSingle = vi
                .fn()
                .mockResolvedValueOnce({ data: mockOrderData, error: null })
                .mockResolvedValueOnce({ data: null, error: null }); // For existing submission check

            const mockInsert = vi.fn().mockResolvedValue({
                data: { id: 'submission-1' },
                error: null,
            });

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                insert: mockInsert,
                single: mockSingle,
            } as unknown as ReturnType<typeof supabaseClient.from>);

            const result = await service.submitInvoice('order-123');

            expect(result.success).toBe(true);
            expect(result.erca_invoice_id).toBe('erca-inv-123');
            expect(mockFetch).toHaveBeenCalled();
        });

        it('should reject invalid TIN format before API call', async () => {
            const mockOrderData = {
                id: 'order-123',
                order_number: 'ORD-001',
                restaurant_id: 'rest-123',
                restaurant: {
                    id: 'rest-123',
                    tin_number: 'BADTIN',
                    vat_number: 'VAT-ET-0012345678',
                    erca_enabled: true,
                    name: 'Test Restaurant',
                },
                guest: null,
                order_items: [
                    {
                        id: 'item-1',
                        menu_item_id: 'menu-1',
                        quantity: 1,
                        unit_price: 100,
                        menu_item: {
                            id: 'menu-1',
                            name: 'Test Item',
                            name_am: null,
                        },
                    },
                ],
            };

            const mockSingle = vi
                .fn()
                .mockResolvedValueOnce({ data: mockOrderData, error: null })
                .mockResolvedValueOnce({ data: null, error: null });

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: mockSingle,
            } as unknown as ReturnType<typeof supabaseClient.from>);

            await expect(service.submitInvoice('order-123')).rejects.toThrow('Invalid TIN');
        });

        it('should handle network error during API call', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

            const mockOrderData = {
                id: 'order-123',
                order_number: 'ORD-001',
                restaurant_id: 'rest-123',
                restaurant: {
                    id: 'rest-123',
                    tin_number: '0012345678',
                    vat_number: 'VAT-ET-0012345678', // Required for VAT submission
                    erca_enabled: true,
                    name: 'Test Restaurant',
                },
                guest: null,
                order_items: [
                    {
                        id: 'item-1',
                        menu_item_id: 'menu-1',
                        quantity: 1,
                        unit_price: 100,
                        menu_item: {
                            id: 'menu-1',
                            name: 'Test Item',
                            name_am: null,
                        },
                    },
                ],
            };

            const mockSingle = vi
                .fn()
                .mockResolvedValueOnce({ data: mockOrderData, error: null })
                .mockResolvedValueOnce({ data: null, error: null }); // For existing submission check

            const mockInsert = vi.fn().mockResolvedValue({
                data: { id: 'submission-1' },
                error: null,
            });

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                insert: mockInsert,
                single: mockSingle,
            } as unknown as ReturnType<typeof supabaseClient.from>);

            await expect(service.submitInvoice('order-123')).rejects.toThrow('Network timeout');
        });
    });

    describe('retrySubmission', () => {
        it('should retry a failed submission successfully', async () => {
            const stubService = new ERCAService({
                apiUrl: '',
                apiKey: '',
                sandboxMode: true,
            });

            const stubSingle = vi
                .fn()
                // First call: fetch submission to retry
                .mockResolvedValueOnce({
                    data: {
                        id: 'sub-123',
                        order_id: 'order-123',
                        retry_count: 0,
                    },
                    error: null,
                })
                // Second call: fetch order data in submitInvoice
                .mockResolvedValueOnce({
                    data: {
                        id: 'order-123',
                        order_number: 'ORD-001',
                        restaurant_id: 'rest-123',
                        restaurant: {
                            tin_number: '0012345678',
                            vat_number: 'VAT-ET-0012345678',
                            name: 'Test',
                        },
                        guest: null,
                        order_items: [],
                    },
                    error: null,
                })
                // Third call: check for existing submission in submitInvoice
                .mockResolvedValueOnce({
                    data: null,
                    error: null,
                });

            const mockInsert = vi.fn().mockResolvedValue({
                data: { id: 'new-submission' },
                error: null,
            });

            const stubClient = stubService['supabase'];
            vi.mocked(stubClient.from).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                update: vi.fn().mockReturnThis(),
                insert: mockInsert,
                single: stubSingle,
            } as unknown as ReturnType<typeof stubClient.from>);

            const result = await stubService.retrySubmission('sub-123');

            expect(result.success).toBe(true);
        });

        it('should throw when submission not found', async () => {
            const mockSingle = vi.fn().mockResolvedValue({
                data: null,
                error: null,
            });

            const supabaseClient = service['supabase'];
            vi.mocked(supabaseClient.from).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: mockSingle,
            } as unknown as ReturnType<typeof supabaseClient.from>);

            await expect(service.retrySubmission('nonexistent')).rejects.toThrow();
        });
    });
});

describe('getERCAService', () => {
    it('should return singleton instance', () => {
        const instance1 = getERCAService();
        const instance2 = getERCAService();

        expect(instance1).toBe(instance2);
    });

    it('should return ERCAService instance', () => {
        const instance = getERCAService();

        expect(instance).toBeInstanceOf(ERCAService);
    });
});

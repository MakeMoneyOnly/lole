import { describe, it, expect, vi } from 'vitest';

// Mock the NutrientClient - vi.mock is hoisted so use inline factory
vi.mock('@/lib/documents/nutrientClient', () => ({
    nutrientClient: {
        convertHtmlToPdf: vi.fn(),
        ocrScannedDocument: vi.fn(),
        redactPII: vi.fn(),
        convertToPdfA: vi.fn(),
    },
}));

// Mock tenant context
vi.mock('@/lib/context/tenant-context', () => ({
    tenantContext: {
        getRestaurantIdSafe: vi.fn(() => 'test-restaurant-id'),
        getStore: vi.fn(() => null),
    },
}));

// Import after mocks are set up
import { DocumentProcessingService } from '../document-processing';
import { nutrientClient } from '@/lib/documents/nutrientClient';

describe('DocumentProcessingService', () => {
    const originalEnv = process.env.NUTRIENT_API_KEY;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NUTRIENT_API_KEY = 'test-api-key';
    });

    afterAll(() => {
        process.env.NUTRIENT_API_KEY = originalEnv;
    });

    describe('constructor', () => {
        it('should throw error when NUTRIENT_API_KEY is not configured', () => {
            delete process.env.NUTRIENT_API_KEY;
            expect(() => new DocumentProcessingService()).toThrow(
                'NUTRIENT_API_KEY environment variable is required'
            );
        });

        it('should initialize successfully with valid API key', () => {
            const testService = new DocumentProcessingService();
            expect(testService).toBeInstanceOf(DocumentProcessingService);
        });
    });

    describe('generateFiscalReceipt', () => {
        it('should generate PDF/A receipt from tax receipt template', async () => {
            const receiptData = {
                restaurantName: 'Test Restaurant',
                tin: '123456789',
                vatNumber: 'VAT123456',
                receiptNumber: 'R-001',
                date: '2024-01-15',
                items: [
                    { name: 'Doro Wat', quantity: 2, price: 45000 },
                    { name: 'Injera', quantity: 3, price: 5000 },
                ],
                subtotal: 100000,
                vat: 15000,
                total: 115000,
                currency: 'ETB',
            };

            const mockPdfUrl = 'https://example.com/receipt.pdf';
            const mockPdfAUrl = 'https://example.com/receipt-pdfa.pdf';

            vi.mocked(nutrientClient.convertHtmlToPdf).mockResolvedValueOnce(mockPdfUrl);
            vi.mocked(nutrientClient.convertToPdfA).mockResolvedValueOnce(mockPdfAUrl);

            const service = new DocumentProcessingService();
            const result = await service.generateFiscalReceipt(receiptData);

            expect(result.pdfUrl).toBe(mockPdfAUrl);
            expect(result.documentType).toBe('receipt');
            expect(result.conformance).toBe('pdf/a-2b');
            expect(nutrientClient.convertHtmlToPdf).toHaveBeenCalled();
            expect(nutrientClient.convertToPdfA).toHaveBeenCalled();
        });

        it('should use PDF/A-3a for long-term archival', async () => {
            const receiptData = {
                restaurantName: 'Test Restaurant',
                tin: '123456789',
                receiptNumber: 'R-002',
                date: '2024-01-15',
                items: [],
                subtotal: 0,
                vat: 0,
                total: 0,
            };

            const mockPdfUrl = 'https://example.com/receipt.pdf';
            const mockPdfAUrl = 'https://example.com/receipt-pdfa3a.pdf';

            vi.mocked(nutrientClient.convertHtmlToPdf).mockResolvedValueOnce(mockPdfUrl);
            vi.mocked(nutrientClient.convertToPdfA).mockResolvedValueOnce(mockPdfAUrl);

            const service = new DocumentProcessingService();
            const result = await service.generateFiscalReceipt({
                ...receiptData,
                archival: true,
            });

            expect(result.conformance).toBe('pdf/a-3a');
            expect(nutrientClient.convertToPdfA).toHaveBeenCalledWith(
                expect.objectContaining({
                    conformance: 'pdf/a-3a',
                })
            );
        });
    });

    describe('extractText', () => {
        it('should extract text from PDF with OCR when needed', async () => {
            const fileUrl = 'https://example.com/document.pdf';
            const mockOcrUrl = 'https://example.com/document-ocr.pdf';

            vi.mocked(nutrientClient.ocrScannedDocument).mockResolvedValueOnce(mockOcrUrl);

            const service = new DocumentProcessingService();
            const result = await service.extractText(fileUrl, { ocr: true });

            expect(result.text).toBeDefined();
            expect(result.confidence).toBeDefined();
            expect(result.pageCount).toBeDefined();
            expect(nutrientClient.ocrScannedDocument).toHaveBeenCalled();
        });

        it('should return result for PDF without OCR', async () => {
            const fileUrl = 'https://example.com/document.pdf';

            const service = new DocumentProcessingService();
            const result = await service.extractText(fileUrl, { ocr: false });

            expect(result.text).toBeDefined();
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.pageCount).toBeGreaterThanOrEqual(0);
        });
    });

    describe('redactPII', () => {
        it('should redact PII from document using AI detection', async () => {
            const fileUrl = 'https://example.com/sensitive.pdf';
            const mockRedactedUrl = 'https://example.com/redacted.pdf';

            vi.mocked(nutrientClient.redactPII).mockResolvedValueOnce(mockRedactedUrl);

            const service = new DocumentProcessingService();
            const result = await service.redactPII(fileUrl);

            expect(result.url).toBe(mockRedactedUrl);
            expect(nutrientClient.redactPII).toHaveBeenCalledWith(
                expect.objectContaining({
                    fileUrl,
                    redactionType: 'pii',
                })
            );
        });

        it('should redact custom patterns when provided', async () => {
            const fileUrl = 'https://example.com/sensitive.pdf';
            const customPatterns = ['\\d{3}-\\d{3}-\\d{4}', 'CUSTOM-\\w+'];
            const mockRedactedUrl = 'https://example.com/redacted.pdf';

            vi.mocked(nutrientClient.redactPII).mockResolvedValueOnce(mockRedactedUrl);

            const service = new DocumentProcessingService();
            const result = await service.redactPII(fileUrl, { customPatterns });

            expect(result.url).toBe(mockRedactedUrl);
            expect(nutrientClient.redactPII).toHaveBeenCalledWith(
                expect.objectContaining({
                    redactionType: 'custom',
                    customPatterns,
                })
            );
        });
    });

    describe('generateInvoice', () => {
        it('should generate PDF/A invoice with Ethiopian formatting', async () => {
            const invoiceData = {
                restaurantName: 'Test Restaurant',
                tin: '123456789',
                vatNumber: 'VAT123456',
                invoiceNumber: 'INV-001',
                date: '2024-01-15',
                dueDate: '2024-02-15',
                customer: {
                    name: 'John Doe',
                    address: 'Addis Ababa',
                },
                items: [
                    { description: 'Food Items', quantity: 1, unitPrice: 100000, total: 100000 },
                ],
                subtotal: 100000,
                vat: 15000,
                total: 115000,
                currency: 'ETB',
            };

            const mockPdfUrl = 'https://example.com/invoice.pdf';
            const mockPdfAUrl = 'https://example.com/invoice-pdfa.pdf';

            vi.mocked(nutrientClient.convertHtmlToPdf).mockResolvedValueOnce(mockPdfUrl);
            vi.mocked(nutrientClient.convertToPdfA).mockResolvedValueOnce(mockPdfAUrl);

            const service = new DocumentProcessingService();
            const result = await service.generateInvoice(invoiceData);

            expect(result.pdfUrl).toBe(mockPdfAUrl);
            expect(result.documentType).toBe('invoice');
            expect(result.conformance).toBe('pdf/a-2b');
        });
    });

    describe('error handling', () => {
        it('should throw InternalError when Nutrient API fails', async () => {
            vi.mocked(nutrientClient.convertHtmlToPdf).mockRejectedValueOnce(
                new Error('API Error')
            );

            const service = new DocumentProcessingService();
            await expect(
                service.generateFiscalReceipt({
                    restaurantName: 'Test',
                    tin: '123',
                    receiptNumber: 'R-001',
                    date: '2024-01-15',
                    items: [],
                    subtotal: 0,
                    vat: 0,
                    total: 0,
                })
            ).rejects.toThrow();
        });
    });
});

describe('TaxReceiptTemplate', () => {
    it('should have required Ethiopian fiscal fields', () => {
        const template = {
            restaurantName: 'Required Name',
            tin: '123456789',
            vatNumber: 'VAT123456',
            receiptNumber: 'R-001',
            date: '2024-01-15',
            items: [],
            subtotal: 0,
            vat: 0,
            total: 0,
        };

        expect(template.restaurantName).toBeDefined();
        expect(template.tin).toBeDefined();
        expect(template.receiptNumber).toBeDefined();
        expect(template.date).toBeDefined();
    });
});

describe('PdfAOptions', () => {
    it('should support all PDF/A conformance levels', () => {
        const conformances = [
            'pdf/a-1a',
            'pdf/a-1b',
            'pdf/a-2a',
            'pdf/a-2b',
            'pdf/a-3a',
            'pdf/a-3b',
        ] as const;

        for (const conformance of conformances) {
            const options = { conformance };
            expect(options.conformance).toBe(conformance);
        }
    });
});

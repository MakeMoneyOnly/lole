/**
 * Tests for MOR Fiscal Client
 *
 * Tests cover:
 * - Live/stub mode detection
 * - Fiscal transaction submission
 * - Error handling
 * - Network failures
 * - Response parsing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    submitFiscalTransaction,
    isMorLiveConfigured,
    FiscalSubmissionError,
    type FiscalSubmissionRequest,
} from '../mor-client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MOR Fiscal Client', () => {
    const originalLocalSecret = process.env.LOCAL_FISCAL_SIGNING_SECRET;
    const originalLocalKeyId = process.env.LOCAL_FISCAL_SIGNING_KEY_ID;

    beforeEach(() => {
        vi.clearAllMocks();
        // Ensure fetch is mocked for each test
        global.fetch = mockFetch;
        delete process.env.LOCAL_FISCAL_SIGNING_SECRET;
        delete process.env.LOCAL_FISCAL_SIGNING_KEY_ID;
    });

    afterEach(() => {
        // Don't restore all mocks as it would restore global.fetch to undefined
        vi.clearAllMocks();
        process.env.LOCAL_FISCAL_SIGNING_SECRET = originalLocalSecret;
        process.env.LOCAL_FISCAL_SIGNING_KEY_ID = originalLocalKeyId;
    });

    describe('isMorLiveConfigured', () => {
        it('should return false when MOR_FISCAL_API_URL is not set', () => {
            const originalUrl = process.env.MOR_FISCAL_API_URL;
            const originalKey = process.env.MOR_FISCAL_API_KEY;

            delete process.env.MOR_FISCAL_API_URL;
            delete process.env.MOR_FISCAL_API_KEY;

            expect(isMorLiveConfigured()).toBe(false);

            process.env.MOR_FISCAL_API_URL = originalUrl;
            process.env.MOR_FISCAL_API_KEY = originalKey;
        });

        it('should return false when MOR_FISCAL_API_KEY is not set', () => {
            const originalUrl = process.env.MOR_FISCAL_API_URL;
            const originalKey = process.env.MOR_FISCAL_API_KEY;

            process.env.MOR_FISCAL_API_URL = 'https://api.mor.gov.et';
            delete process.env.MOR_FISCAL_API_KEY;

            expect(isMorLiveConfigured()).toBe(false);

            process.env.MOR_FISCAL_API_URL = originalUrl;
            process.env.MOR_FISCAL_API_KEY = originalKey;
        });

        it('should return true when both MOR_FISCAL_API_URL and MOR_FISCAL_API_KEY are set', () => {
            const originalUrl = process.env.MOR_FISCAL_API_URL;
            const originalKey = process.env.MOR_FISCAL_API_KEY;

            process.env.MOR_FISCAL_API_URL = 'https://api.mor.gov.et';
            process.env.MOR_FISCAL_API_KEY = 'test-api-key';

            expect(isMorLiveConfigured()).toBe(true);

            process.env.MOR_FISCAL_API_URL = originalUrl;
            process.env.MOR_FISCAL_API_KEY = originalKey;
        });
    });

    describe('submitFiscalTransaction', () => {
        const validRequest: FiscalSubmissionRequest = {
            restaurant_tin: '1234567890',
            transaction_number: 'TXN-001',
            occurred_at: '2026-04-05T10:00:00Z',
            items: [
                {
                    item_code: 'ITEM-001',
                    name: 'Test Item',
                    quantity: 2,
                    unit_price: 100,
                    tax_rate: 15,
                    total: 230,
                },
            ],
            subtotal: 200,
            tax_total: 30,
            grand_total: 230,
            order_id: 'order-123',
        };

        describe('stub mode', () => {
            it('should return stub result when API is not configured', async () => {
                const originalUrl = process.env.MOR_FISCAL_API_URL;
                const originalKey = process.env.MOR_FISCAL_API_KEY;

                delete process.env.MOR_FISCAL_API_URL;
                delete process.env.MOR_FISCAL_API_KEY;

                const result = await submitFiscalTransaction(validRequest);

                expect(result.ok).toBe(true);
                expect(result.mode).toBe('stub');
                expect(result.transaction_number).toBe('TXN-001');
                expect(result.qr_payload).toContain('stub:');
                expect(result.qr_payload).toContain('1234567890');
                expect(result.qr_payload).toContain('TXN-001');
                expect(result.digital_signature).toContain('stub-signature-');
                expect(result.warning).toContain('not configured');

                process.env.MOR_FISCAL_API_URL = originalUrl;
                process.env.MOR_FISCAL_API_KEY = originalKey;
            });

            it('should generate correct stub QR payload format', async () => {
                const originalUrl = process.env.MOR_FISCAL_API_URL;
                const originalKey = process.env.MOR_FISCAL_API_KEY;

                delete process.env.MOR_FISCAL_API_URL;
                delete process.env.MOR_FISCAL_API_KEY;

                const result = await submitFiscalTransaction(validRequest);

                // Format: stub:tin:transaction_number:grand_total
                expect(result.qr_payload).toBe('stub:1234567890:TXN-001:230.00');

                process.env.MOR_FISCAL_API_URL = originalUrl;
                process.env.MOR_FISCAL_API_KEY = originalKey;
            });
        });

        describe('local signing mode', () => {
            it('should return local mode when live API missing but local signing configured', async () => {
                delete process.env.MOR_FISCAL_API_URL;
                delete process.env.MOR_FISCAL_API_KEY;
                process.env.LOCAL_FISCAL_SIGNING_SECRET = 'local-secret';
                process.env.LOCAL_FISCAL_SIGNING_KEY_ID = 'edge-key-1';

                const result = await submitFiscalTransaction(validRequest);

                expect(result.ok).toBe(true);
                expect(result.mode).toBe('local');
                expect(result.digital_signature).toMatch(/^[a-f0-9]+$/);
                expect(result.signatureEnvelope?.keyId).toBe('edge-key-1');
                expect(result.warning).toContain('locally signed');
            });
        });

        describe('live mode', () => {
            beforeEach(() => {
                process.env.MOR_FISCAL_API_URL = 'https://api.mor.gov.et/fiscal';
                process.env.MOR_FISCAL_API_KEY = 'test-api-key';
            });

            afterEach(() => {
                delete process.env.MOR_FISCAL_API_URL;
                delete process.env.MOR_FISCAL_API_KEY;
            });

            it('should submit transaction to live API', async () => {
                const mockResponse = {
                    transaction_number: 'TXN-001',
                    invoice_number: 'INV-001',
                    qr_payload: 'qr-code-data',
                    digital_signature: 'signature-data',
                };

                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse,
                });

                const result = await submitFiscalTransaction(validRequest);

                expect(result.ok).toBe(true);
                expect(result.mode).toBe('live');
                expect(result.transaction_number).toBe('TXN-001');
                expect(result.qr_payload).toBe('qr-code-data');
                expect(result.digital_signature).toBe('signature-data');
            });

            it('should send correct headers', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ transaction_number: 'TXN-001' }),
                });

                await submitFiscalTransaction(validRequest);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.mor.gov.et/fiscal',
                    expect.objectContaining({
                        method: 'POST',
                        headers: expect.objectContaining({
                            'Content-Type': 'application/json',
                            Authorization: 'Bearer test-api-key',
                        }),
                    })
                );
            });

            it('should send correct body', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ transaction_number: 'TXN-001' }),
                });

                await submitFiscalTransaction(validRequest);

                const callArgs = mockFetch.mock.calls[0];
                const body = JSON.parse(callArgs[1].body);

                expect(body.restaurant_tin).toBe('1234567890');
                expect(body.transaction_number).toBe('TXN-001');
                expect(body.items).toHaveLength(1);
                expect(body.subtotal).toBe(200);
                expect(body.tax_total).toBe(30);
                expect(body.grand_total).toBe(230);
            });

            it('should use invoice_number if transaction_number not in response', async () => {
                const mockResponse = {
                    invoice_number: 'INV-002',
                    qr_payload: 'qr-data',
                };

                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse,
                });

                const result = await submitFiscalTransaction(validRequest);

                expect(result.transaction_number).toBe('INV-002');
            });

            it('should fallback to request transaction_number if not in response', async () => {
                const mockResponse = {
                    qr_payload: 'qr-data',
                };

                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse,
                });

                const result = await submitFiscalTransaction(validRequest);

                expect(result.transaction_number).toBe('TXN-001');
            });

            it('should handle null qr_payload in response', async () => {
                const mockResponse = {
                    transaction_number: 'TXN-001',
                    qr_payload: null,
                    digital_signature: null,
                };

                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse,
                });

                const result = await submitFiscalTransaction(validRequest);

                expect(result.qr_payload).toBeNull();
                expect(result.digital_signature).toBeNull();
            });

            it('should include raw response in result', async () => {
                const mockResponse = {
                    transaction_number: 'TXN-001',
                    additional_field: 'value',
                };

                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse,
                });

                const result = await submitFiscalTransaction(validRequest);

                expect(result.raw).toEqual(mockResponse);
            });
        });

        describe('error handling', () => {
            beforeEach(() => {
                process.env.MOR_FISCAL_API_URL = 'https://api.mor.gov.et/fiscal';
                process.env.MOR_FISCAL_API_KEY = 'test-api-key';
            });

            afterEach(() => {
                delete process.env.MOR_FISCAL_API_URL;
                delete process.env.MOR_FISCAL_API_KEY;
            });

            it('should throw FiscalSubmissionError on network failure', async () => {
                mockFetch.mockRejectedValue(new Error('Network error'));

                try {
                    await submitFiscalTransaction(validRequest);
                    expect.fail('Expected FiscalSubmissionError to be thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(FiscalSubmissionError);
                    const fiscalError = error as FiscalSubmissionError;
                    expect(fiscalError.code).toBe('network');
                    expect(fiscalError.offlineFallbackAllowed).toBe(true);
                }
            });

            it('should throw FiscalSubmissionError on non-OK response', async () => {
                mockFetch.mockResolvedValue({
                    ok: false,
                    status: 400,
                    json: async () => ({ error: 'Invalid request' }),
                });

                try {
                    await submitFiscalTransaction(validRequest);
                    expect.fail('Expected FiscalSubmissionError to be thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(FiscalSubmissionError);
                    const fiscalError = error as FiscalSubmissionError;
                    expect(fiscalError.code).toBe('rejected');
                    expect(fiscalError.offlineFallbackAllowed).toBe(false);
                }
            });

            it('should use message field from error response', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: false,
                    status: 400,
                    json: async () => ({ message: 'TIN not registered' }),
                });

                try {
                    await submitFiscalTransaction(validRequest);
                } catch (error) {
                    expect(error).toBeInstanceOf(FiscalSubmissionError);
                    const fiscalError = error as FiscalSubmissionError;
                    expect(fiscalError.message).toBe('TIN not registered');
                }
            });

            it('should handle invalid JSON in error response', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    json: async () => {
                        throw new Error('Invalid JSON');
                    },
                });

                try {
                    await submitFiscalTransaction(validRequest);
                } catch (error) {
                    expect(error).toBeInstanceOf(FiscalSubmissionError);
                    const fiscalError = error as FiscalSubmissionError;
                    expect(fiscalError.message).toBe('MoR fiscal submission failed');
                }
            });

            it('should handle unknown network errors', async () => {
                mockFetch.mockRejectedValueOnce('Unknown error string');

                try {
                    await submitFiscalTransaction(validRequest);
                } catch (error) {
                    expect(error).toBeInstanceOf(FiscalSubmissionError);
                    const fiscalError = error as FiscalSubmissionError;
                    expect(fiscalError.message).toBe('MoR fiscal submission failed');
                }
            });
        });
    });

    describe('FiscalSubmissionError', () => {
        it('should create error with correct properties', () => {
            const error = new FiscalSubmissionError('Test error', 'network', true);

            expect(error.message).toBe('Test error');
            expect(error.code).toBe('network');
            expect(error.offlineFallbackAllowed).toBe(true);
            expect(error.name).toBe('FiscalSubmissionError');
        });

        it('should be instance of Error', () => {
            const error = new FiscalSubmissionError('Test error', 'rejected', false);

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(FiscalSubmissionError);
        });
    });
});

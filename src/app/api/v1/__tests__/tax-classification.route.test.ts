/**
 * Tests for Tax Classification API
 */

import { describe, expect, it, beforeEach, beforeAll, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
    info: vi.fn(),
    error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        info: mocks.info,
        error: mocks.error,
    },
}));

// Dynamic import after mocks are set up
let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
    const mod = await import('@/app/api/v1/tax/classification/route');
    POST = mod.POST;
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe('Tax Classification API', () => {
    describe('POST /api/v1/tax/classification', () => {
        it('classifies restaurant transaction as VAT', async () => {
            const response = await POST(
                new NextRequest('http://localhost/api/v1/tax/classification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        description: 'Restaurant lunch',
                        amount: 100,
                        currency: 'ETB',
                        date: new Date().toISOString(),
                    }),
                })
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.data.classification.category).toBe('VAT');
            expect(body.data.classification.applicableRate).toBe(0.15);
            expect(body.data.classification.isTaxable).toBe(true);
        });

        it('classifies salary as income tax', async () => {
            const response = await POST(
                new NextRequest('http://localhost/api/v1/tax/classification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        description: 'Monthly salary payment',
                        amount: 5000,
                        currency: 'USD',
                        date: new Date().toISOString(),
                    }),
                })
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.data.classification.category).toBe('INCOME_TAX');
        });

        it('classifies office rent as operating expense', async () => {
            const response = await POST(
                new NextRequest('http://localhost/api/v1/tax/classification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        description: 'Office rent payment',
                        amount: 2000,
                        currency: 'USD',
                        date: new Date().toISOString(),
                    }),
                })
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.data.classification.category).toBe('OPERATING_EXPENSE');
            expect(body.data.classification.isTaxable).toBe(false);
        });

        it('returns 400 for missing required fields', async () => {
            const response = await POST(
                new NextRequest('http://localhost/api/v1/tax/classification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        description: '',
                        amount: -100,
                    }),
                })
            );

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error.code).toBe('VALIDATION_ERROR');
        });

        it('returns 400 for invalid date format', async () => {
            const response = await POST(
                new NextRequest('http://localhost/api/v1/tax/classification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        description: 'Test transaction',
                        amount: 100,
                        currency: 'USD',
                        date: 'invalid-date',
                    }),
                })
            );

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error.code).toBe('VALIDATION_ERROR');
        });

        it('uses default currency when not provided', async () => {
            const response = await POST(
                new NextRequest('http://localhost/api/v1/tax/classification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        description: 'Restaurant meal',
                        amount: 100,
                        date: new Date().toISOString(),
                    }),
                })
            );

            expect(response.status).toBe(200);
        });
    });
});

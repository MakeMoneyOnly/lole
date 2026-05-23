/**
 * Tax Classification API
 * Classifies transactions into VAT, Income Tax, Social Security, Operating Expense buckets
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getTaxClassifier } from '@/lib/fiscal/tax-classifier';
import { apiError, apiSuccess, handleApiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const ClassificationRequestSchema = z.object({
    description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
    amount: z.number().positive('Amount must be positive'),
    currency: z.string().max(3, 'Invalid currency code').default('ETB'),
    date: z.string().datetime('Invalid date format').or(z.date()),
    vendor: z.string().max(200).optional(),
    countryCode: z.string().length(3).optional(),
});

export async function POST(request: NextRequest): Promise<Response> {
    try {
        const body = await request.json();

        const parsed = ClassificationRequestSchema.safeParse(body);
        if (!parsed.success) {
            return apiError(
                'Invalid request payload',
                400,
                'VALIDATION_ERROR',
                parsed.error.flatten()
            );
        }

        const classifier = getTaxClassifier(parsed.data.countryCode);
        const result = classifier.classify({
            description: parsed.data.description,
            amount: parsed.data.amount,
            currency: parsed.data.currency,
            date:
                parsed.data.date instanceof Date
                    ? parsed.data.date.toISOString()
                    : parsed.data.date,
            vendor: parsed.data.vendor,
            countryCode: parsed.data.countryCode,
        });

        logger.info('Tax classification completed', {
            description: parsed.data.description,
            category: result.category,
            rate: result.applicableRate,
        });

        return apiSuccess({
            classification: {
                category: result.category,
                categoryLabel: result.categoryLabel,
                applicableRate: result.applicableRate,
                rateLabel: result.rateLabel,
                isTaxable: result.isTaxable,
            },
            auditTrail: result.auditTrail,
        });
    } catch (error) {
        logger.error('Tax classification failed', { error });
        return handleApiError(error, {
            operation: 'tax-classification.POST',
        });
    }
}

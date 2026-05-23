import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const testLogger = logger.child('n8n-test');

export async function GET(request: NextRequest): Promise<Response> {
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
    testLogger.info('n8n webhook test endpoint called', { requestId });

    try {
        const baseUrl = process.env.N8N_BASE_URL || 'http://localhost:5678';
        const webhookPath = process.env.N8N_WEBHOOK_PATH || '/webhook';

        return apiSuccess({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            config: {
                baseUrl,
                webhookPath,
            },
        });
    } catch (error) {
        testLogger.error('Health check failed', error, { requestId });
        return apiError('Health check failed', 500, 'HEALTH_CHECK_FAILED', undefined, {
            operation: 'n8n-test-health',
        });
    }
}

export async function POST(request: NextRequest): Promise<Response> {
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

    try {
        const body = await request.json().catch(() => ({}));
        testLogger.info('n8n webhook test POST received', { requestId, body });

        return apiSuccess({
            status: 'ok',
            message: 'Test webhook endpoint is working',
            received: body,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        testLogger.error('Test webhook error', error, { requestId });
        return apiError('Test failed', 500, 'TEST_FAILED', undefined, {
            operation: 'n8n-test-post',
        });
    }
}
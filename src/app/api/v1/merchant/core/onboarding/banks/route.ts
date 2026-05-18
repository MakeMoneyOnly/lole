import { apiError, apiSuccess } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { listChapaBanks, isChapaConfigured } from '@/lib/services/chapaService';
import { logger } from '@/lib/logger';

const log = logger.child('merchant-core-onboarding/banks');

export async function GET(request: Request): Promise<Response> {
    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return apiError('Unauthorized', 401);
    }

    // Check if Chapa is configured
    if (!isChapaConfigured()) {
        log.warn('Chapa is not configured', { reason: 'CHAPA_SECRET_KEY missing or invalid' });
        return apiSuccess({
            banks: [],
            directory_unavailable: true,
            error: 'Chapa API key not configured',
        });
    }

    try {
        const banks = await listChapaBanks();
        log.info('Successfully fetched banks from Chapa', { count: banks.length });
        return apiSuccess({ banks });
    } catch (error) {
        log.error('Failed to load settlement banks from Chapa', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return apiSuccess({
            banks: [],
            directory_unavailable: true,
            error: errorMessage,
        });
    }
}









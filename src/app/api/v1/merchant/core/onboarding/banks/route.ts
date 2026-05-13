import { apiError, apiSuccess } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { listChapaBanks, isChapaConfigured } from '@/lib/services/chapaService';

export async function GET() {
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
        console.warn('Chapa is not configured - CHAPA_SECRET_KEY missing or invalid');
        return apiSuccess({
            banks: [],
            directory_unavailable: true,
            error: 'Chapa API key not configured',
        });
    }

    try {
        const banks = await listChapaBanks();
        console.warn(`Successfully fetched ${banks.length} banks from Chapa`);
        return apiSuccess({ banks });
    } catch (error) {
        console.error('Failed to load settlement banks from Chapa:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return apiSuccess({
            banks: [],
            directory_unavailable: true,
            error: errorMessage,
        });
    }
}

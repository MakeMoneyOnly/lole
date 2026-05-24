import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { apiError } from '@/lib/api/response';

type PilotPhase = 'p0' | 'p1' | 'p2';

export interface MerchantAuthResult {
    ok: true;
    supabase: SupabaseClient<Database>;
    restaurantId: string;
    user: User;
}

export interface MerchantAuthFailure {
    ok: false;
    response: ReturnType<typeof apiError>;
}

export type MerchantAuthResponse = MerchantAuthResult | MerchantAuthFailure;

export interface RequireMerchantAuthOptions {
    requirePilot?: boolean;
    pilotPhase?: PilotPhase;
    method?: string;
}

export async function requireMerchantAuth(
    request: Request,
    options?: RequireMerchantAuthOptions
): Promise<MerchantAuthResponse> {
    const authResult = await getAuthenticatedUser();

    if (!authResult.ok) {
        return { ok: false as const, response: authResult.response };
    }

    const { user, supabase } = authResult;
    const pilotPhase = options?.pilotPhase ?? 'p0';

    const contextResult = await getAuthorizedRestaurantContext(user.id, { phase: pilotPhase });

    if (!contextResult.ok) {
        return { ok: false as const, response: contextResult.response };
    }

    const { restaurantId } = contextResult;

    return {
        ok: true as const,
        supabase,
        restaurantId,
        user,
    };
}

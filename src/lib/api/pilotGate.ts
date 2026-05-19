import { apiError } from '@/lib/api/response';
import {
    isPilotMutationBlockEnabled,
    isPilotRolloutEnabled,
    isRestaurantInPilotCohort,
} from '@/lib/config/pilotRollout';

type PilotPhase = 'p0' | 'p1' | 'p2';

function isMutationMethod(method?: string): boolean {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes((method ?? '').toUpperCase());
}

export function enforcePilotAccess(
    restaurantId: string,
    method?: string,
    options?: { phase?: PilotPhase }
): ReturnType<typeof apiError> | null {
    const phase = options?.phase ?? 'p0';
    if (!isPilotRolloutEnabled(phase)) {
        return null;
    }

    if (!isRestaurantInPilotCohort(restaurantId)) {
        return apiError(
            'Feature not enabled for this restaurant during pilot rollout',
            403,
            'FEATURE_NOT_ENABLED_FOR_RESTAURANT',
            { restaurant_id: restaurantId }
        );
    }

    if (isPilotMutationBlockEnabled() && isMutationMethod(method)) {
        return apiError('Pilot mutation block is enabled', 503, 'PILOT_MUTATION_BLOCK_ENABLED');
    }

    return null;
}

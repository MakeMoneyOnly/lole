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

export interface PilotGateOptions {
    phase?: PilotPhase;
    method?: string;
}

export function enforcePilotAccess(
    restaurantId: string,
    options?: PilotGateOptions
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

    if (options?.method && isPilotMutationBlockEnabled() && isMutationMethod(options.method)) {
        return apiError('Pilot mutation block is enabled', 503, 'PILOT_MUTATION_BLOCK_ENABLED');
    }

    return null;
}

export function checkPilotAccessSync(restaurantId: string, phase: PilotPhase = 'p0'): boolean {
    if (!isPilotRolloutEnabled(phase)) {
        return true;
    }
    return isRestaurantInPilotCohort(restaurantId);
}

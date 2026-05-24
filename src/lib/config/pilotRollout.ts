function parseCsv(value: string): string[] {
    return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

type PilotPhase = 'p0' | 'p1' | 'p2';

function parseBooleanFlag(value: string | undefined): boolean {
    return String(value ?? 'false').toLowerCase() === 'true';
}

export function isPilotRolloutEnabled(phase: PilotPhase = 'p0'): boolean {
    if (phase === 'p2') {
        return (
            parseBooleanFlag(process.env.ENABLE_P2_PILOT_ROLLOUT) ||
            parseBooleanFlag(process.env.ENABLE_P1_PILOT_ROLLOUT) ||
            parseBooleanFlag(process.env.ENABLE_P0_PILOT_ROLLOUT)
        );
    }
    if (phase === 'p1') {
        return (
            parseBooleanFlag(process.env.ENABLE_P1_PILOT_ROLLOUT) ||
            parseBooleanFlag(process.env.ENABLE_P0_PILOT_ROLLOUT)
        );
    }
    return parseBooleanFlag(process.env.ENABLE_P0_PILOT_ROLLOUT);
}

export function isPilotMutationBlockEnabled(): boolean {
    return String(process.env.PILOT_BLOCK_MUTATIONS ?? 'false').toLowerCase() === 'true';
}

export function getPilotRestaurantAllowlist(): Set<string> {
    return new Set(parseCsv(process.env.PILOT_RESTAURANT_IDS ?? ''));
}

export function isRestaurantInPilotCohort(restaurantId: string): boolean {
    const allowlist = getPilotRestaurantAllowlist();
    return allowlist.has(restaurantId);
}

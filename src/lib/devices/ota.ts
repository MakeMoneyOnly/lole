import type { OtaStatus } from '@/lib/devices/config';

export function normalizeAppVersion(value?: string | null): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
}

export function resolveOtaStatus(args: {
    currentVersion?: string | null;
    targetVersion?: string | null;
    existingStatus?: OtaStatus | null;
}): OtaStatus {
    const currentVersion = normalizeAppVersion(args.currentVersion);
    const targetVersion = normalizeAppVersion(args.targetVersion);

    if (!targetVersion) {
        return currentVersion ? 'current' : (args.existingStatus ?? 'current');
    }

    if (!currentVersion) {
        return args.existingStatus === 'failed' ? 'failed' : 'queued';
    }

    if (currentVersion === targetVersion) {
        return 'current';
    }

    if (args.existingStatus === 'failed') {
        return 'failed';
    }

    if (args.existingStatus === 'queued' || args.existingStatus === 'installing') {
        return 'installing';
    }

    return 'outdated';
}

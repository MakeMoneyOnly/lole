import type { OfflineOrder } from './offline-order-manager';

export interface ConflictRecord {
    id: string;
    order_id: string;
    local_version: number;
    remote_version: number;
    local_modified_at: string;
    remote_modified_at: string;
    resolution: 'local_wins' | 'remote_wins' | 'manual_merge';
    resolved_at: string;
    details: Record<string, unknown>;
}

const CONFLICTS_KEY = 'lole_sync_conflicts_v1';

function readConflicts(): ConflictRecord[] {
    if (typeof window === 'undefined') {
        return [];
    }
    try {
        const raw = window.localStorage.getItem(CONFLICTS_KEY);
        return raw ? (JSON.parse(raw) as ConflictRecord[]) : [];
    } catch {
        return [];
    }
}

function writeConflicts(conflicts: ConflictRecord[]): void {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        window.localStorage.setItem(CONFLICTS_KEY, JSON.stringify(conflicts));
    } catch {
        console.error('[ConflictResolver] Failed to persist conflicts.');
    }
}

export function getConflictLogs(orderId?: string): ConflictRecord[] {
    const conflicts = readConflicts();
    if (orderId) {
        return conflicts.filter(c => c.order_id === orderId);
    }
    return conflicts;
}

export function resolveOrderConflict(
    local: OfflineOrder,
    remote: { version: number; modified_at: string; modified_by: string }
): { winner: 'local' | 'remote'; conflict: ConflictRecord } {
    const conflictId = `conflict_${Date.now()}_${local.id}`;
    const resolvedAt = new Date().toISOString();

    let winner: 'local' | 'remote';

    if (local.version > remote.version) {
        winner = 'local';
    } else if (remote.version > local.version) {
        winner = 'remote';
    } else if (local.modified_at > remote.modified_at) {
        winner = 'local';
    } else {
        winner = 'remote';
    }

    const conflict: ConflictRecord = {
        id: conflictId,
        order_id: local.id,
        local_version: local.version,
        remote_version: remote.version,
        local_modified_at: local.modified_at,
        remote_modified_at: remote.modified_at,
        resolution: winner === 'local' ? 'local_wins' : 'remote_wins',
        resolved_at: resolvedAt,
        details: {
            local_status: local.status,
            local_modified_by: local.modified_by,
            remote_modified_by: remote.modified_by,
        },
    };

    const conflicts = readConflicts();
    conflicts.push(conflict);
    writeConflicts(conflicts);

    return { winner, conflict };
}

export function compareOrderVersions(
    local: OfflineOrder,
    remote: { version: number; modified_at: string }
): 'local_newer' | 'remote_newer' | 'equal' {
    if (local.version > remote.version) {
        return 'local_newer';
    }
    if (remote.version > local.version) {
        return 'remote_newer';
    }
    if (local.modified_at > remote.modified_at) {
        return 'local_newer';
    }
    if (remote.modified_at > local.modified_at) {
        return 'remote_newer';
    }
    return 'equal';
}

export async function mergeOrders(
    local: OfflineOrder,
    remote: OfflineOrder
): Promise<OfflineOrder> {
    const merged = { ...local };

    // Last-write-wins for scalar fields: higher version wins
    if (remote.version > local.version) {
        merged.status = remote.status;
        merged.total_santim = remote.total_santim;
        merged.payload = remote.payload;
        merged.version = remote.version;
        merged.modified_at = remote.modified_at;
        merged.modified_by = remote.modified_by;
    } else if (remote.version === local.version && remote.modified_at > local.modified_at) {
        merged.status = remote.status;
        merged.total_santim = remote.total_santim;
        merged.payload = remote.payload;
        merged.modified_at = remote.modified_at;
        merged.modified_by = remote.modified_by;
    }

    // If remote deleted the order but local has modifications, undelete + apply local changes
    if (remote.deleted && !local.deleted) {
        merged.deleted = false;
        merged.version = Math.max(local.version, remote.version) + 1;
        merged.modified_at = new Date().toISOString();
    }

    // If both deleted, keep deleted
    if (remote.deleted && local.deleted) {
        merged.deleted = true;
        merged.version = Math.max(local.version, remote.version);
    }

    return merged;
}

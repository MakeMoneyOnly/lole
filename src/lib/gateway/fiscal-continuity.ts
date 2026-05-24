import { logger } from '@/lib/logger';

export interface LocalReceipt {
    id: string;
    restaurantId: string;
    locationId: string;
    serial: number;
    signedHash: string;
    signedAt: string;
    morStatus: 'pending' | 'submitted' | 'acknowledged';
    morQueueId?: string;
}

interface PersistedChainState {
    lastSerial: number;
    lastReceiptHash: string | null;
    previousReceiptHash: string | null;
}

const STORAGE_PREFIX = 'lole_fiscal_chain_';

export class FiscalContinuityService {
    private lastSerial: number;
    private lastReceiptHash: string | null;
    private previousReceiptHash: string | null;
    private restaurantId: string;

    constructor(restaurantId: string, initialSerial = 1) {
        this.restaurantId = restaurantId;
        const saved = this.loadState();
        this.lastSerial = saved?.lastSerial ?? initialSerial;
        this.lastReceiptHash = saved?.lastReceiptHash ?? null;
        this.previousReceiptHash = saved?.previousReceiptHash ?? null;

        if (saved) {
            logger.info('[Fiscal] Restored receipt chain from storage', {
                restaurantId,
                serial: this.lastSerial,
                hashPrefix: saved.lastReceiptHash?.slice(0, 16),
            });
        }
    }

    getNextSerial(): number {
        return this.lastSerial;
    }

    async signLocally(receipt: {
        id: string;
        restaurantId: string;
        locationId: string;
    }): Promise<LocalReceipt> {
        const serial = this.lastSerial++;
        const signedAt = new Date().toISOString();

        const chainSegment = this.previousReceiptHash ? `|prev:${this.previousReceiptHash}` : '';
        const payload = `${receipt.id}:${serial}:${signedAt}${chainSegment}`;
        const signedHash = await this.hashWithSHA256(payload);

        this.previousReceiptHash = signedHash;
        this.lastReceiptHash = signedHash;
        this.saveState();

        const record: LocalReceipt = {
            ...receipt,
            serial,
            signedHash,
            signedAt,
            morStatus: 'pending',
        };

        logger.info('[Fiscal] Locally signed receipt', {
            serial,
            receiptId: receipt.id,
            hashPrefix: signedHash.slice(0, 16),
        });

        return record;
    }

    queueForMor(receipt: LocalReceipt): LocalReceipt {
        return {
            ...receipt,
            morStatus: 'submitted',
            morQueueId: crypto.randomUUID(),
        };
    }

    getLastReceiptHash(): string | null {
        return this.lastReceiptHash;
    }

    private getStorageKey(): string {
        return `${STORAGE_PREFIX}${this.restaurantId}`;
    }

    private loadState(): PersistedChainState | null {
        try {
            const raw = localStorage.getItem(this.getStorageKey());
            if (!raw) return null;
            return JSON.parse(raw) as PersistedChainState;
        } catch {
            logger.warn('[Fiscal] Failed to load chain state from storage');
            return null;
        }
    }

    private saveState(): void {
        try {
            const state: PersistedChainState = {
                lastSerial: this.lastSerial,
                lastReceiptHash: this.lastReceiptHash,
                previousReceiptHash: this.previousReceiptHash,
            };
            localStorage.setItem(this.getStorageKey(), JSON.stringify(state));
        } catch (err) {
            logger.error('[Fiscal] Failed to persist chain state', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    private async hashWithSHA256(input: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

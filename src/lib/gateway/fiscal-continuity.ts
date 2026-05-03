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

export class FiscalContinuityService {
    private lastSerial: number;
    private lastReceiptHash: number | null;

    constructor(initialSerial = 1) {
        this.lastSerial = initialSerial;
        this.lastReceiptHash = null;
    }

    getNextSerial(): number {
        return this.lastSerial;
    }

    signLocally(receipt: { id: string; restaurantId: string; locationId: string }): LocalReceipt {
        const serial = this.lastSerial++;
        const signedAt = new Date().toISOString();

        const payload = `${receipt.id}:${serial}:${signedAt}`;
        const signedHash = this.hashString(payload);

        this.lastReceiptHash = signedHash;

        const record: LocalReceipt = {
            ...receipt,
            serial,
            signedHash: String(signedHash),
            signedAt,
            morStatus: 'pending',
        };

        logger.info('[Fiscal] Locally signed receipt', {
            serial,
            receiptId: receipt.id,
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

    getLastReceiptHash(): number | null {
        return this.lastReceiptHash;
    }

    private hashString(input: string): number {
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const chr = input.charCodeAt(i);
            hash = ((hash << 5) - hash + chr) | 0;
        }
        return hash;
    }
}

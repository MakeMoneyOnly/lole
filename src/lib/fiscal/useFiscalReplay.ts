/**
 * Fiscal replay hook.
 * Listens for network reconnection and triggers offline queue replay.
 * Used in POS/kiosk clients to ensure offline-fiscalized receipts get submitted.
 */
import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

export function useFiscalReplay(enabled: boolean = true): void {
    const replayInProgress = useRef(false);

    useEffect(() => {
        if (!enabled) return;

        const handleOnline = async (): Promise<void> => {
            if (replayInProgress.current) return;
            replayInProgress.current = true;

            try {
                const response = await fetch('/api/v1/system/jobs/fiscal/replay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });

                if (response.ok) {
                    const body = await response.json();
                    if (body.data?.replayed > 0) {
                        logger.info('[Fiscal] Replayed pending jobs on reconnect', {
                            replayed: body.data.replayed,
                        });
                    }
                }
            } catch (err) {
                logger.error('[Fiscal] Replay on reconnect failed', {
                    error: err instanceof Error ? err.message : String(err),
                });
            } finally {
                replayInProgress.current = false;
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [enabled]);
}

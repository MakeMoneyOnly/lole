// Cart Domain - Repository Layer
// Database access layer - PowerSync queries only, no business logic
import { getPowerSync, PowerSyncDatabase } from '@/lib/sync/powersync-config';
import { logger } from '@/lib/logger';
import type { CartItem } from './service';

export class CartRepository {
    private db: PowerSyncDatabase | null = null;

    private getDb(): PowerSyncDatabase | null {
        if (!this.db) {
            this.db = getPowerSync();
        }
        return this.db;
    }

    /**
     * Load cart items from PowerSync
     * Returns empty array if PowerSync is not available or on error
     */
    async loadCartFromPowerSync(): Promise<CartItem[]> {
        const db = this.getDb();
        if (!db) return [];

        try {
            const rows = await db.getAllAsync<{
                unique_id: string;
                menu_item_id: string;
                title: string;
                price_santim: number;
                quantity: number;
                instructions: string | null;
                image_url: string | null;
                course: string | null;
            }>(`SELECT * FROM cart_items ORDER BY created_at ASC`);

            if (!rows || rows.length === 0) return [];

            return rows.map(row => ({
                uniqueId: row.unique_id,
                menuItemId: row.menu_item_id,
                title: row.title,
                price: row.price_santim,
                quantity: row.quantity,
                instructions: row.instructions ?? undefined,
                image: row.image_url ?? undefined,
                course: row.course ?? undefined,
            }));
        } catch (err) {
            logger.warn('[cart/repository] PowerSync read failed', {
                error: err instanceof Error ? err.message : String(err),
            });
            return [];
        }
    }

    /**
     * Sync cart items to PowerSync
     * Replaces all existing cart items with the provided items
     */
    async syncCartToPowerSync(items: CartItem[]): Promise<void> {
        const db = this.getDb();
        if (!db) return;

        try {
            await db.execute(`DELETE FROM cart_items`);

            const now = new Date().toISOString();
            for (const item of items) {
                await db.execute(
                    `INSERT INTO cart_items (unique_id, menu_item_id, title, price_santim, quantity, instructions, image_url, course, restaurant_id, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        item.uniqueId,
                        item.menuItemId,
                        item.title,
                        Math.round(item.price),
                        item.quantity,
                        item.instructions ?? null,
                        item.image ?? null,
                        item.course ?? null,
                        null,
                        now,
                        now,
                    ]
                );
            }
        } catch (err) {
            logger.warn('[cart/repository] PowerSync sync failed', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    /**
     * Clear all cart items from PowerSync
     */
    async clearCartFromPowerSync(): Promise<void> {
        const db = this.getDb();
        if (!db) return;

        try {
            await db.execute(`DELETE FROM cart_items`);
        } catch (err) {
            logger.warn('[cart/repository] PowerSync clear failed', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    /**
     * Check if PowerSync is available
     */
    isAvailable(): boolean {
        return this.getDb() !== null;
    }
}

export const cartRepository = new CartRepository();

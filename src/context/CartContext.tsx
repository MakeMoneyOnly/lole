'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useHaptic } from '@/hooks/useHaptic';
import { getPowerSync } from '@/lib/sync/powersync-config';
import { logger } from '@/lib/logger';

export interface CartItem {
    menuItemId: string;
    uniqueId: string;
    title: string;
    price: number;
    quantity: number;
    instructions?: string;
    image?: string;
    course?: string;
}

interface CartContextType {
    items: CartItem[];
    addToCart: (item: Omit<CartItem, 'uniqueId'>) => void;
    removeFromCart: (uniqueId: string) => void;
    updateQuantity: (uniqueId: string, delta: number) => void;
    updateInstructions: (uniqueId: string, instructions: string) => void;
    clearCart: () => void;
    total: number;
    count: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = 'lole-cart';

function loadCartFromLocalStorage(): CartItem[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveCartToLocalStorage(items: CartItem[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
        // Storage full or unavailable — cart lives in-memory
    }
}

async function syncCartToPowerSync(items: CartItem[]): Promise<void> {
    const db = getPowerSync();
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
        logger.warn('[CartContext] PowerSync sync failed, localStorage fallback active', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

async function loadCartFromPowerSync(): Promise<CartItem[]> {
    const db = getPowerSync();
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
        logger.warn('[CartContext] PowerSync read failed, using localStorage', {
            error: err instanceof Error ? err.message : String(err),
        });
        return [];
    }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const { trigger } = useHaptic();

    useEffect(() => {
        async function load() {
            const psItems = await loadCartFromPowerSync();
            if (psItems.length > 0) {
                setItems(psItems);
                saveCartToLocalStorage(psItems);
                return;
            }
            const localItems = loadCartFromLocalStorage();
            if (localItems.length > 0) {
                setItems(localItems);
                syncCartToPowerSync(localItems);
            }
        }
        load();
    }, []);

    useEffect(() => {
        saveCartToLocalStorage(items);
        syncCartToPowerSync(items);
    }, [items]);

    const addToCart = (newItem: Omit<CartItem, 'uniqueId'>) => {
        trigger('success');
        setItems(prev => {
            // Check if exact item already exists (same ID and instructions)
            const existingIndex = prev.findIndex(
                item =>
                    item.menuItemId === newItem.menuItemId &&
                    item.instructions === newItem.instructions
            );

            if (existingIndex >= 0) {
                // Update quantity - create new object to avoid mutation
                const updated = [...prev];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    quantity: updated[existingIndex].quantity + newItem.quantity,
                };
                return updated;
            }

            // Add new item
            return [...prev, { ...newItem, uniqueId: crypto.randomUUID() }];
        });
    };

    const removeFromCart = (uniqueId: string) => {
        trigger('medium');
        setItems(prev => prev.filter(item => item.uniqueId !== uniqueId));
    };

    const updateQuantity = (uniqueId: string, delta: number) => {
        trigger('soft');
        setItems(prev =>
            prev
                .map(item => {
                    if (item.uniqueId === uniqueId) {
                        const newQuantity = Math.max(0, item.quantity + delta);
                        return { ...item, quantity: newQuantity };
                    }
                    return item;
                })
                .filter(item => item.quantity > 0)
        );
    };

    const updateInstructions = (uniqueId: string, instructions: string) => {
        setItems(prev =>
            prev.map(item => (item.uniqueId === uniqueId ? { ...item, instructions } : item))
        );
    };

    const clearCart = () => {
        setItems([]);
        localStorage.removeItem(STORAGE_KEY);
        const db = getPowerSync();
        if (db) {
            db.execute(`DELETE FROM cart_items`).catch(() => {});
        }
    };

    const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const count = items.reduce((acc, item) => acc + item.quantity, 0);

    return (
        <CartContext.Provider
            value={{
                items,
                addToCart,
                removeFromCart,
                updateQuantity,
                updateInstructions,
                clearCart,
                total,
                count,
            }}
        >
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}

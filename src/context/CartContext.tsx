'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useHaptic } from '@/hooks/useHaptic';
import { cartService, cartRepository, type CartItem } from '@/domains/cart';
import type { CartTotals } from '@/domains/cart';

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

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const { trigger } = useHaptic();

    useEffect(() => {
        async function load() {
            const psItems = await cartRepository.loadCartFromPowerSync();
            if (psItems.length > 0) {
                setItems(psItems);
                saveCartToLocalStorage(psItems);
                return;
            }
            const localItems = loadCartFromLocalStorage();
            if (localItems.length > 0) {
                setItems(localItems);
                cartRepository.syncCartToPowerSync(localItems);
            }
        }
        load();
    }, []);

    useEffect(() => {
        saveCartToLocalStorage(items);
        cartRepository.syncCartToPowerSync(items);
    }, [items]);

    const addToCart = (newItem: Omit<CartItem, 'uniqueId'>) => {
        trigger('success');
        setItems(prev => cartService.addItem(prev, newItem));
    };

    const removeFromCart = (uniqueId: string) => {
        trigger('medium');
        setItems(prev => cartService.removeItem(prev, uniqueId));
    };

    const updateQuantity = (uniqueId: string, delta: number) => {
        trigger('soft');
        setItems(prev => cartService.updateQuantity(prev, uniqueId, delta));
    };

    const updateInstructions = (uniqueId: string, instructions: string) => {
        setItems(prev => cartService.updateInstructions(prev, uniqueId, instructions));
    };

    const clearCart = () => {
        setItems([]);
        localStorage.removeItem(STORAGE_KEY);
        cartRepository.clearCartFromPowerSync();
    };

    const { total, count }: CartTotals = cartService.calculateTotals(items);

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

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FoodItem } from '@/types';

interface CartItem extends FoodItem {
    quantity: number;
    instructions?: string;
}

interface CartState {
    items: CartItem[];
    addItem: (item: FoodItem, quantity: number, instructions?: string) => void;
    removeItem: (itemId: string) => void;
    updateQuantity: (itemId: string, quantity: number) => void;
    clearCart: () => void;
    subtotal: () => number;
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            addItem: (item, quantity, instructions) =>
                set(state => {
                    const existing = state.items.find(i => i.id === item.id);
                    if (existing) {
                        return {
                            items: state.items.map(i =>
                                i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i
                            ),
                        };
                    }
                    return { items: [...state.items, { ...item, quantity, instructions }] };
                }),
            removeItem: itemId =>
                set(state => ({
                    items: state.items.filter(i => i.id !== itemId),
                })),
            updateQuantity: (itemId, quantity) =>
                set(state => ({
                    items: state.items.map(i => (i.id === itemId ? { ...i, quantity } : i)),
                })),
            clearCart: () => set({ items: [] }),
            subtotal: () => get().items.reduce((acc, item) => acc + item.price * item.quantity, 0),
        }),
        {
            name: 'lole-cart-storage',
        }
    )
);

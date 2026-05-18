// Cart Domain - Service Layer
// Business logic layer - cart operations and calculations

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

export interface AddToCartInput {
    menuItemId: string;
    title: string;
    price: number;
    quantity?: number;
    instructions?: string;
    image?: string;
    course?: string;
}

export interface CartTotals {
    total: number;
    count: number;
}

export class CartService {
    /**
     * Add an item to the cart
     * If an identical item exists (same menuItemId and instructions), increment quantity
     */
    addItem(
        items: CartItem[],
        newItem: Omit<AddToCartInput, 'quantity'> & { quantity?: number }
    ): CartItem[] {
        const existingIndex = items.findIndex(
            item =>
                item.menuItemId === newItem.menuItemId && item.instructions === newItem.instructions
        );

        if (existingIndex >= 0) {
            const updated = [...items];
            updated[existingIndex] = {
                ...updated[existingIndex],
                quantity: updated[existingIndex].quantity + (newItem.quantity ?? 1),
            };
            return updated;
        }

        return [
            ...items,
            { ...newItem, quantity: newItem.quantity ?? 1, uniqueId: crypto.randomUUID() },
        ];
    }

    /**
     * Remove an item from the cart by uniqueId
     */
    removeItem(items: CartItem[], uniqueId: string): CartItem[] {
        return items.filter(item => item.uniqueId !== uniqueId);
    }

    /**
     * Update quantity by delta (can be positive or negative)
     * Items with quantity <= 0 are removed
     */
    updateQuantity(items: CartItem[], uniqueId: string, delta: number): CartItem[] {
        return items
            .map(item => {
                if (item.uniqueId === uniqueId) {
                    const newQuantity = Math.max(0, item.quantity + delta);
                    return { ...item, quantity: newQuantity };
                }
                return item;
            })
            .filter(item => item.quantity > 0);
    }

    /**
     * Update special instructions for an item
     */
    updateInstructions(items: CartItem[], uniqueId: string, instructions: string): CartItem[] {
        return items.map(item => (item.uniqueId === uniqueId ? { ...item, instructions } : item));
    }

    /**
     * Clear all items from the cart
     */
    clearCart(): CartItem[] {
        return [];
    }

    /**
     * Calculate cart totals
     */
    calculateTotals(items: CartItem[]): CartTotals {
        const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
        const count = items.reduce((acc, item) => acc + item.quantity, 0);
        return { total, count };
    }
}

export const cartService = new CartService();

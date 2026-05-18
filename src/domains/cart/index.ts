/**
 * Cart domain exports
 * @module domains/cart
 */

// Service
export { CartService, cartService } from './service';
export type { CartItem, AddToCartInput, CartTotals } from './service';

// Repository
export { CartRepository, cartRepository } from './repository';

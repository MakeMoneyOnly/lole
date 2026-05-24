/**
 * Guests domain exports
 * @module domains/guests
 */

// Repository
export { GuestsRepository, guestsRepository } from './repository';
export type { GuestRow, GuestListOptions } from './repository';

// Service
export {
    GuestsService,
    guestsService,
    calculateLoyaltyTier,
    calculateLoyaltyPoints,
} from './service';
export type { CreateGuestInput, UpdateGuestInput } from './service';

// Resolvers
export { guestsResolvers } from './resolvers';

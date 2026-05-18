// GraphQL Context Types
// Types for the GraphQL request context

import { DataLoaders } from './dataloaders';
import type { StaffRole } from '@/types/status';

export interface GraphQLContext {
    token: string | null;
    guestSession: string | null;
    user: {
        id: string;
        restaurantId?: string;
        role?: StaffRole;
    } | null;
    /** DataLoaders for N+1 query prevention - created per-request */
    dataLoaders: DataLoaders;
}

export interface StaffContext extends GraphQLContext {
    user: {
        id: string;
        restaurantId: string;
        role: StaffRole;
    };
}

export interface GuestContext extends GraphQLContext {
    guestSession: string;
    user: null;
}

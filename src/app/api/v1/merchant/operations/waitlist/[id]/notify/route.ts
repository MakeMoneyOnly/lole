/**
 * Waitlist Notify API Route
 *
 * Endpoint for notifying a guest that their table is ready.
 * - POST /api/waitlist/:id/notify
 */

import { notifyEntry } from '@/features/operations/waitlist/api';

/**
 * POST /api/waitlist/:id/notify
 * Notify a guest that their table is ready
 */
export const POST = notifyEntry;

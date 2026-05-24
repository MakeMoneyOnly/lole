/**
 * Waitlist API Routes
 *
 * RESTful endpoints for table waitlist management.
 * - POST /api/waitlist - Add guest to waitlist
 * - GET /api/waitlist - List waitlist entries (staff)
 */

import { listWaitlist, createEntry } from '@/features/operations/waitlist/api';

/**
 * GET /api/waitlist
 * List waitlist entries for a restaurant
 */
export const GET = listWaitlist;

/**
 * POST /api/waitlist
 * Add a guest to the waitlist
 */
export const POST = createEntry;

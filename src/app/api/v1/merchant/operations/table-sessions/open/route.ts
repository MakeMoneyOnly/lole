/**
 * Table Sessions Open Route
 *
 * Opens a new table session.
 * - POST /api/v1/merchant/operations/table-sessions/open
 */

import { openSession } from '@/features/operations/table-sessions/api';

/**
 * POST /api/v1/merchant/operations/table-sessions/open
 * Open a new table session
 */
export const POST = openSession;

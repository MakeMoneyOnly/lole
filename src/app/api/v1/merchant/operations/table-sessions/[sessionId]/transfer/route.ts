/**
 * Table Sessions Transfer Route
 *
 * Transfers a table session to another table.
 * - POST /api/v1/merchant/operations/table-sessions/[sessionId]/transfer
 */

import { transferSession } from '@/features/operations/table-sessions/api';

/**
 * POST /api/v1/merchant/operations/table-sessions/[sessionId]/transfer
 * Transfer a table session to another table
 */
export const POST = transferSession;

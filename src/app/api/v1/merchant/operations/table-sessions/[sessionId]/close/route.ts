/**
 * Table Sessions Close Route
 *
 * Closes an open table session.
 * - POST /api/v1/merchant/operations/table-sessions/[sessionId]/close
 */

import { closeSession } from '@/features/operations/table-sessions/api';

/**
 * POST /api/v1/merchant/operations/table-sessions/[sessionId]/close
 * Close an open table session
 */
export const POST = closeSession;

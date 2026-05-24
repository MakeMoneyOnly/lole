/**
 * Service Request API Route
 *
 * Updates a service request status.
 * - PATCH /api/v1/merchant/operations/service-requests/[requestId]
 */

import { updateRequest } from '@/features/operations/service-requests/api';

/**
 * PATCH /api/v1/merchant/operations/service-requests/[requestId]
 * Update service request status
 */
export const PATCH = updateRequest;

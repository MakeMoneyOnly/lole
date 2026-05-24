import { z } from 'zod';

const TableSessionStatusEnum = z.enum(['open', 'closed', 'transferred']);

export const OpenTableSessionSchema = z.object({
    restaurantId: z.string().uuid(),
    tableId: z.string().uuid(),
    guestCount: z.number().int().positive().max(50).default(1),
    assignedStaffId: z.string().uuid().optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
});

export type OpenTableSessionCommand = z.infer<typeof OpenTableSessionSchema>;

export const CloseTableSessionSchema = z.object({
    restaurantId: z.string().uuid(),
    sessionId: z.string().uuid(),
    notes: z.string().max(500).optional().nullable(),
});

export type CloseTableSessionCommand = z.infer<typeof CloseTableSessionSchema>;

export const TransferTableSessionSchema = z.object({
    restaurantId: z.string().uuid(),
    sessionId: z.string().uuid(),
    toTableId: z.string().uuid(),
    notes: z.string().max(500).optional().nullable(),
});

export type TransferTableSessionCommand = z.infer<typeof TransferTableSessionSchema>;

export const TableSessionResponseSchema = z.object({
    id: z.string().uuid(),
    restaurant_id: z.string().uuid(),
    table_id: z.string().uuid(),
    guest_count: z.number().int(),
    assigned_staff_id: z.string().uuid().nullable(),
    status: TableSessionStatusEnum,
    notes: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    opened_at: z.string().datetime(),
    closed_at: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
});

export type TableSessionResponse = z.infer<typeof TableSessionResponseSchema>;

export { TableSessionStatusEnum };

import { z } from 'zod';

const WaitlistStatusEnum = z.enum(['waiting', 'notified', 'seated', 'cancelled', 'expired']);

export const ListWaitlistQuerySchema = z.object({
    restaurantId: z.string().uuid(),
    status: WaitlistStatusEnum.optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).default(50),
    offset: z.coerce.number().int().nonnegative().default(0),
});

export type ListWaitlistQuery = z.infer<typeof ListWaitlistQuerySchema>;

export const CreateWaitlistEntrySchema = z.object({
    restaurantId: z.string().uuid(),
    guestName: z.string().trim().min(1).max(120),
    guestPhone: z.string().regex(/^(\+?251|0)?[9]\d{8}$/),
    guestCount: z.number().int().min(1).max(20).default(1),
    notes: z.string().trim().max(500).optional(),
});

export type CreateWaitlistEntryCommand = z.infer<typeof CreateWaitlistEntrySchema>;

export const NotifyWaitlistEntrySchema = z.object({
    restaurantId: z.string().uuid(),
    entryId: z.string().uuid(),
    staffId: z.string().uuid(),
});

export type NotifyWaitlistEntryCommand = z.infer<typeof NotifyWaitlistEntrySchema>;

export const WaitlistEntryResponseSchema = z.object({
    id: z.string().uuid(),
    restaurant_id: z.string().uuid(),
    guest_name: z.string(),
    guest_phone: z.string(),
    guest_count: z.number().int(),
    status: WaitlistStatusEnum,
    position: z.number().int().optional(),
    estimated_wait_minutes: z.number().int().optional(),
    notes: z.string().nullable(),
    created_at: z.string().datetime(),
    notified_at: z.string().datetime().nullable(),
    seated_at: z.string().datetime().nullable(),
});

export type WaitlistEntryResponse = z.infer<typeof WaitlistEntryResponseSchema>;

export { WaitlistStatusEnum };

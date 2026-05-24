import { z } from 'zod';

const TipPoolStatusEnum = z.enum(['active', 'inactive', 'archived']);
const TipPoolTypeEnum = z.enum(['percentage', 'fixed_amount']);
const TipPoolCalculationEnum = z.enum(['tips', 'total']);
const AllocationModeEnum = z.enum(['shift', 'daily', 'weekly']);

export const ListTipPoolsQuerySchema = z.object({
    restaurantId: z.string().uuid(),
});

export type ListTipPoolsQuery = z.infer<typeof ListTipPoolsQuerySchema>;

export const TipPoolShareSchema = z.object({
    role: z.enum([
        'server',
        'bartender',
        'host',
        'busser',
        'kitchen',
        'manager',
        'cook',
        'barista',
    ]),
    percentage: z.number().int().min(0).max(10000),
});

export type TipPoolShare = z.infer<typeof TipPoolShareSchema>;

export const CreateTipPoolCommandSchema = z.object({
    restaurantId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    nameAm: z.string().trim().max(120).optional().nullable(),
    description: z.string().trim().max(500).optional().nullable(),
    isActive: z.boolean().optional().default(true),
    poolType: TipPoolTypeEnum.default('percentage'),
    poolValue: z.number().int().min(0).default(0),
    calculatedFrom: TipPoolCalculationEnum.default('tips'),
    validFrom: z.string().datetime().optional().nullable(),
    validUntil: z.string().datetime().optional().nullable(),
    allocationMode: AllocationModeEnum.default('shift'),
    shares: z.array(TipPoolShareSchema).min(1),
});

export type CreateTipPoolCommand = z.infer<typeof CreateTipPoolCommandSchema>;

export const TipPoolResponseSchema = z.object({
    id: z.string().uuid(),
    restaurant_id: z.string().uuid(),
    name: z.string(),
    name_am: z.string().nullable(),
    description: z.string().nullable(),
    is_active: z.boolean(),
    pool_type: TipPoolTypeEnum,
    pool_value: z.number().int(),
    calculated_from: TipPoolCalculationEnum,
    valid_from: z.string().datetime().nullable(),
    valid_until: z.string().datetime().nullable(),
    allocation_mode: AllocationModeEnum,
    created_by: z.string().uuid(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
});

export type TipPoolResponse = z.infer<typeof TipPoolResponseSchema>;

export const AllocateTipPoolCommandSchema = z.object({
    restaurantId: z.string().uuid(),
    staffId: z.string().uuid(),
    tipPoolId: z.string().uuid(),
    periodDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    shiftId: z.string().uuid().optional(),
    totalTipsCollected: z.number().int().min(0),
    totalBillAmount: z.number().int().min(0).optional(),
});

export type AllocateTipPoolCommand = z.infer<typeof AllocateTipPoolCommandSchema>;

export const TipAllocationResponseSchema = z.object({
    id: z.string().uuid(),
    restaurant_id: z.string().uuid(),
    tip_pool_id: z.string().uuid(),
    shift_id: z.string().uuid().nullable(),
    period_date: z.string(),
    period_start: z.string().datetime(),
    period_end: z.string().datetime(),
    total_tips_collected: z.number().int(),
    total_tips_pooled: z.number().int(),
    total_tips_distributed: z.number().int(),
    distribution: z.array(
        z.object({
            role: z.string(),
            amount: z.number().int(),
        })
    ),
    status: z.enum(['calculated', 'distributed', 'cancelled']),
    created_by: z.string().uuid(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
});

export type TipAllocationResponse = z.infer<typeof TipAllocationResponseSchema>;

export { TipPoolStatusEnum, TipPoolTypeEnum, TipPoolCalculationEnum, AllocationModeEnum };

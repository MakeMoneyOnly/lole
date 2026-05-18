import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { verifySignedQRCode } from '@/lib/security/hmac';

export const GuestContextSchema = z.object({
    slug: z.string().trim().min(1, 'Restaurant slug is required').max(120),
    table: z.string().trim().min(1, 'Table is required').max(20),
    sig: z
        .string()
        .trim()
        .regex(/^[a-f0-9]{64}$/i, 'Invalid QR signature format'),
    exp: z.coerce.number().int().positive('Invalid QR expiration timestamp'),
});

export type GuestContextInput = z.infer<typeof GuestContextSchema>;

export interface ResolvedGuestContext {
    restaurantId: string;
    tableId: string;
    tableNumber: string;
    slug: string;
    signature: string;
    expiresAt: number;
}

type GuestContextResult =
    | { valid: true; data: ResolvedGuestContext }
    | { valid: false; reason: string; status: number };

export async function resolveGuestContext(
    supabase: SupabaseClient<Database>,
    input: unknown
): Promise<GuestContextResult> {
    const parsed = GuestContextSchema.safeParse(input);
    if (!parsed.success) {
        return { valid: false, reason: 'Invalid guest context payload', status: 400 };
    }

    const { slug, table, sig, exp } = parsed.data;

    const signatureCheck = verifySignedQRCode(slug, table, sig, exp);
    if (!signatureCheck.valid) {
        return { valid: false, reason: signatureCheck.reason ?? 'Invalid QR code', status: 403 };
    }

    const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id, slug, is_active')
        .ilike('slug', slug)
        .maybeSingle();

    if (restaurantError) {
        return { valid: false, reason: 'Failed to resolve restaurant context', status: 500 };
    }

    if (!restaurant || restaurant.is_active === false) {
        return { valid: false, reason: 'Restaurant not found or inactive', status: 404 };
    }

    const { data: tableRow, error: tableError } = await supabase
        .from('tables')
        .select('id, table_number, restaurant_id, is_active')
        .eq('restaurant_id', restaurant.id)
        .eq('table_number', table)
        .maybeSingle();

    if (tableError) {
        return { valid: false, reason: 'Failed to resolve table context', status: 500 };
    }

    if (!tableRow || tableRow.is_active === false) {
        return { valid: false, reason: 'Table not found or inactive', status: 404 };
    }

    return {
        valid: true,
        data: {
            restaurantId: restaurant.id,
            tableId: tableRow.id,
            tableNumber: tableRow.table_number,
            slug,
            signature: sig,
            expiresAt: exp,
        },
    };
}

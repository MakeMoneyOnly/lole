import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import {
    createChapaSubaccount,
    isChapaConfigured,
    listChapaBanks,
    maskSettlementAccountNumber,
} from '@/lib/services/chapaService';

export interface OnboardingPayload {
    full_name: string;
    restaurant_name: string;
    location: string;
    contact_phone?: string;
    description?: string;
    brand_color?: string;
    cuisine_type?: string;
    settlement_bank_code: string;
    settlement_account_name: string;
    settlement_account_number: string;
}

const HOSTED_CHECKOUT_FEE_PERCENTAGE = 0.03;

function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

function normalizePayoutStatus(params: {
    subaccountId?: string | null;
    providerStatus?: string | null;
    providerMessage?: string | null;
}) {
    const subaccountId = String(params.subaccountId ?? '').trim();
    const providerStatus = String(params.providerStatus ?? '')
        .trim()
        .toLowerCase();
    const providerMessage = String(params.providerMessage ?? '')
        .trim()
        .toLowerCase();
    const haystack = `${providerStatus} ${providerMessage}`;

    if (subaccountId) {
        if (
            haystack.includes('approved') ||
            haystack.includes('verified') ||
            haystack.includes('active') ||
            providerStatus === 'success'
        ) {
            return 'active';
        }

        return 'pending_review';
    }

    if (haystack.includes('exist')) {
        return 'pending_review';
    }

    return 'verification_required';
}

export async function POST(req: NextRequest) {
    const supabase = await createClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
        return apiError('Unauthorized', 401);
    }

    let body: OnboardingPayload;
    try {
        body = (await req.json()) as OnboardingPayload;
    } catch {
        return apiError('Invalid request body', 400);
    }

    const {
        full_name,
        restaurant_name,
        location,
        contact_phone,
        description,
        brand_color,
        cuisine_type,
        settlement_bank_code,
        settlement_account_name,
        settlement_account_number,
    } = body;

    if (!full_name?.trim()) return apiError('Owner name is required', 400);
    if (!restaurant_name?.trim()) return apiError('Restaurant name is required', 400);
    if (!location?.trim()) return apiError('Location is required', 400);
    if (!settlement_bank_code?.trim()) return apiError('Payout destination is required', 400);
    if (!settlement_account_name?.trim()) {
        return apiError('Payout account or wallet name is required', 400);
    }
    if (!settlement_account_number?.trim()) {
        return apiError('Payout account or wallet number is required', 400);
    }
    if (!isChapaConfigured()) {
        return apiError(
            'Chapa is not configured. Add CHAPA_SECRET_KEY before onboarding merchants.',
            503,
            'CHAPA_NOT_CONFIGURED'
        );
    }

    const supportedBanks = await listChapaBanks();
    const selectedBank = supportedBanks.find(bank => bank.code === settlement_bank_code.trim());

    if (!selectedBank) {
        return apiError(
            "Choose a supported payout destination from Chapa's live directory.",
            400,
            'UNSUPPORTED_SETTLEMENT_BANK'
        );
    }

    const settlementBankName = selectedBank.name;

    const { data: existingStaff } = await supabase
        .from('restaurant_staff')
        .select('restaurant_id')
        .eq('user_id', user.id)
        .eq('role', 'owner')
        .maybeSingle();

    const existingRestaurant = existingStaff?.restaurant_id
        ? await supabase
              .from('restaurants')
              .select(
                  'id, chapa_subaccount_id, chapa_subaccount_status, chapa_subaccount_provisioned_at'
              )
              .eq('id', existingStaff.restaurant_id)
              .maybeSingle()
        : null;

    let baseSlug = slugify(restaurant_name);
    if (!baseSlug) baseSlug = 'restaurant';

    const { data: existingSlugs } = await supabase
        .from('restaurants')
        .select('slug')
        .like('slug', `${baseSlug}%`);

    let slug = baseSlug;
    if (existingSlugs && existingSlugs.length > 0) {
        slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    let restaurantId: string;
    let activeSubaccountId =
        existingRestaurant?.data?.chapa_subaccount_status === 'active'
            ? existingRestaurant.data.chapa_subaccount_id
            : null;

    const baseRestaurantPayload: Record<string, unknown> = {
        name: restaurant_name.trim(),
        slug,
        location: location.trim(),
        contact_phone: contact_phone?.trim() || null,
        contact_email: user.email,
        description: description?.trim() || `Welcome to ${restaurant_name.trim()}!`,
        brand_color: brand_color || '#0D3B40',
        is_active: true,
        onboarding_completed: false,
        chapa_subaccount_id: activeSubaccountId,
        chapa_subaccount_status: activeSubaccountId ? 'active' : 'provisioning',
        chapa_subaccount_last_error: null,
        chapa_subaccount_provisioned_at:
            activeSubaccountId && existingRestaurant?.data?.chapa_subaccount_provisioned_at
                ? existingRestaurant.data.chapa_subaccount_provisioned_at
                : null,
        chapa_settlement_bank_code: settlement_bank_code.trim(),
        chapa_settlement_bank_name: settlementBankName,
        chapa_settlement_account_name: settlement_account_name.trim(),
        chapa_settlement_account_number_masked: maskSettlementAccountNumber(
            settlement_account_number.trim()
        ),
        platform_fee_percentage: HOSTED_CHECKOUT_FEE_PERCENTAGE,
        hosted_checkout_fee_percentage: HOSTED_CHECKOUT_FEE_PERCENTAGE,
        settings: {
            branding: {
                primary_color: brand_color || '#0D3B40',
                secondary_color: '#ffffff',
            },
            cuisine_type: cuisine_type || null,
            currency: 'ETB',
            enable_ordering: true,
            telegram_chat_id: null,
            telegram_bot_token: null,
            telegram_kitchen_chat_id: null,
            telegram_bar_chat_id: null,
        },
    };

    if (existingStaff?.restaurant_id) {
        const { data: updated, error: updateError } = await supabase
            .from('restaurants')
            .update(baseRestaurantPayload as never)
            .eq('id', existingStaff.restaurant_id)
            .select('id, chapa_subaccount_id, chapa_subaccount_status')
            .single();

        if (updateError || !updated) {
            console.error('Restaurant update failed:', updateError);
            return apiError('Failed to update restaurant', 500);
        }

        restaurantId = updated.id;
        if (updated.chapa_subaccount_status === 'active' && updated.chapa_subaccount_id) {
            activeSubaccountId = updated.chapa_subaccount_id;
        }
    } else {
        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .insert(baseRestaurantPayload as never)
            .select('id, chapa_subaccount_id, chapa_subaccount_status')
            .single();

        if (restaurantError || !restaurant) {
            console.error('Restaurant creation failed:', restaurantError);
            return apiError('Failed to create restaurant', 500);
        }

        await supabase.from('restaurant_staff').insert({
            user_id: user.id,
            restaurant_id: restaurant.id,
            role: 'owner',
            is_active: true,
        });

        restaurantId = restaurant.id;
    }

    let payoutStatus = activeSubaccountId ? 'active' : 'pending_review';
    let payoutError: string | null = null;
    let provisionedAt =
        activeSubaccountId && existingRestaurant?.data?.chapa_subaccount_provisioned_at
            ? existingRestaurant.data.chapa_subaccount_provisioned_at
            : null;

    if (!activeSubaccountId) {
        try {
            const subaccount = await createChapaSubaccount({
                business_name: restaurant_name.trim(),
                account_name: settlement_account_name.trim(),
                bank_code: settlement_bank_code.trim(),
                account_number: settlement_account_number.trim(),
                split_type: 'percentage',
                split_value: HOSTED_CHECKOUT_FEE_PERCENTAGE,
            });

            const subaccountId = subaccount.data?.id?.trim();
            if (subaccountId) {
                activeSubaccountId = subaccountId;
                provisionedAt = new Date().toISOString();
            }

            payoutStatus = normalizePayoutStatus({
                subaccountId,
                providerStatus: subaccount.status,
                providerMessage: subaccount.message,
            });
            payoutError =
                payoutStatus === 'active'
                    ? null
                    : subaccount.message || 'Payout destination is waiting for Chapa review.';
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Unknown Chapa subaccount provisioning error';

            payoutStatus = normalizePayoutStatus({
                subaccountId: activeSubaccountId,
                providerMessage: message,
            });
            payoutError = message;
        }
    }

    const { error: finalizeError } = await supabase
        .from('restaurants')
        .update({
            onboarding_completed: true,
            chapa_subaccount_id: activeSubaccountId,
            chapa_subaccount_status: payoutStatus,
            chapa_subaccount_last_error: payoutError,
            chapa_subaccount_provisioned_at: provisionedAt,
        } as never)
        .eq('id', restaurantId);

    if (finalizeError) {
        return apiError(
            'Failed to finalize restaurant onboarding',
            500,
            'RESTAURANT_FINALIZE_FAILED',
            finalizeError.message
        );
    }

    await supabase.auth.updateUser({
        data: { full_name: full_name.trim() },
    });

    return apiSuccess({
        restaurant_id: restaurantId,
        restaurant_slug: slug,
        payout_status: payoutStatus,
        payout_setup_message:
            payoutStatus === 'active'
                ? 'Payout destination connected.'
                : 'Restaurant is live. Payouts stay locked until Chapa review is completed.',
    });
}

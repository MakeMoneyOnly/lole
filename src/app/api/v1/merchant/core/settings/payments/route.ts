import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';

export const dynamic = 'force-dynamic';
import {
    createChapaSubaccount,
    isChapaConfigured,
    listChapaBanks,
    maskSettlementAccountNumber,
} from '@/lib/services/chapaService';

const HOSTED_CHECKOUT_FEE_PERCENTAGE = 0.03;

const PaymentSettingsSchema = z.object({
    settlement_bank_code: z.string().trim().min(1),
    settlement_account_name: z.string().trim().min(1),
    settlement_account_number: z.string().trim().max(30).optional().default(''),
});

type RestaurantPaymentRecord = {
    name: string;
    chapa_settlement_bank_code: string | null;
    chapa_settlement_bank_name: string | null;
    chapa_settlement_account_name: string | null;
    chapa_settlement_account_number_masked: string | null;
    chapa_subaccount_id: string | null;
    chapa_subaccount_status: string | null;
    chapa_subaccount_last_error: string | null;
    chapa_subaccount_provisioned_at: string | null;
    platform_fee_percentage: number | null;
    hosted_checkout_fee_percentage: number | null;
};

const PAYMENT_SETTINGS_SELECT = [
    'name',
    'chapa_settlement_bank_code',
    'chapa_settlement_bank_name',
    'chapa_settlement_account_name',
    'chapa_settlement_account_number_masked',
    'chapa_subaccount_id',
    'chapa_subaccount_status',
    'chapa_subaccount_last_error',
    'chapa_subaccount_provisioned_at',
    'platform_fee_percentage',
    'hosted_checkout_fee_percentage',
].join(', ');

function resolveHostedCheckoutFeePercentage(restaurant: RestaurantPaymentRecord) {
    if (typeof restaurant.hosted_checkout_fee_percentage === 'number') {
        return restaurant.hosted_checkout_fee_percentage;
    }

    if (typeof restaurant.platform_fee_percentage === 'number') {
        return restaurant.platform_fee_percentage;
    }

    return HOSTED_CHECKOUT_FEE_PERCENTAGE;
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

    console.warn('normalizePayoutStatus called with:', {
        subaccountId,
        providerStatus,
        providerMessage,
        haystack,
    });

    // Check for success indicators in status or message
    const isSuccess =
        providerStatus === 'success' ||
        providerStatus === 'active' ||
        haystack.includes('success') ||
        haystack.includes('created successfully') ||
        haystack.includes('approved') ||
        haystack.includes('verified') ||
        haystack.includes('subaccount created');

    if (isSuccess) {
        console.warn('normalizePayoutStatus: returning active (success detected)');
        return 'active';
    }

    // If we have a subaccount ID, the account was created successfully
    if (subaccountId) {
        console.warn('normalizePayoutStatus: returning active (subaccount ID present)');
        return 'active';
    }

    // If account already exists - this is actually a success case
    if (haystack.includes('exist') || haystack.includes('already')) {
        console.warn('normalizePayoutStatus: returning active (already exists)');
        return 'active';
    }

    // Only return verification_required if there's an actual error message
    if (providerMessage && !isSuccess) {
        console.warn('normalizePayoutStatus: returning failed (error message present)');
        return 'failed';
    }

    console.warn('normalizePayoutStatus: returning not_configured');
    return 'not_configured';
}

function serializePaymentSettings(restaurant: RestaurantPaymentRecord) {
    const status = String(restaurant.chapa_subaccount_status ?? '').trim() || 'not_configured';

    return {
        provider: 'chapa' as const,
        provider_available: isChapaConfigured(),
        settlement_bank_code: restaurant.chapa_settlement_bank_code ?? '',
        settlement_bank_name: restaurant.chapa_settlement_bank_name ?? '',
        settlement_account_name: restaurant.chapa_settlement_account_name ?? '',
        settlement_account_number_masked: restaurant.chapa_settlement_account_number_masked ?? '',
        settlement_status: status,
        subaccount_id: restaurant.chapa_subaccount_id ?? null,
        last_error: restaurant.chapa_subaccount_last_error ?? null,
        provisioned_at: restaurant.chapa_subaccount_provisioned_at ?? null,
        hosted_checkout_fee_percentage: resolveHostedCheckoutFeePercentage(restaurant),
    };
}

export async function GET() {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const { data, error } = await context.supabase
        .from('restaurants')
        .select(PAYMENT_SETTINGS_SELECT)
        .eq('id', context.restaurantId)
        .single();

    if (error || !data) {
        return apiError(
            'Failed to fetch payment settings',
            500,
            'PAYMENT_SETTINGS_FETCH_FAILED',
            error?.message ?? 'Restaurant not found'
        );
    }

    return apiSuccess(serializePaymentSettings(data as unknown as RestaurantPaymentRecord));
}

export async function PATCH(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const parsed = await parseJsonBody(request, PaymentSettingsSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { data: restaurant, error: fetchError } = await context.supabase
        .from('restaurants')
        .select(PAYMENT_SETTINGS_SELECT)
        .eq('id', context.restaurantId)
        .single();

    if (fetchError || !restaurant) {
        return apiError(
            'Failed to fetch current payment settings',
            500,
            'PAYMENT_SETTINGS_FETCH_FAILED',
            fetchError?.message ?? 'Restaurant not found'
        );
    }

    const current = restaurant as unknown as RestaurantPaymentRecord;
    const nextBankCode = parsed.data.settlement_bank_code.trim();
    const nextAccountName = parsed.data.settlement_account_name.trim();
    const providedAccountNumber = parsed.data.settlement_account_number.replace(/\s+/g, '').trim();

    const currentBankCode = String(current.chapa_settlement_bank_code ?? '').trim();
    const currentAccountName = String(current.chapa_settlement_account_name ?? '').trim();
    const currentSubaccountId = String(current.chapa_subaccount_id ?? '').trim();

    // Check if account details actually changed
    // Note: providedAccountNumber will be empty if the user didn't change the masked number
    const accountDetailsChanged =
        currentBankCode !== nextBankCode || currentAccountName !== nextAccountName;

    // Only need provisioning if:
    // 1. We don't have a subaccount ID yet, OR
    // 2. Account details changed AND user provided a new account number
    const needsProvisioning =
        currentSubaccountId.length === 0 ||
        (accountDetailsChanged && providedAccountNumber.length > 0) ||
        (!accountDetailsChanged &&
            providedAccountNumber.length > 0 &&
            !providedAccountNumber.includes('*'));

    if (accountDetailsChanged && providedAccountNumber.length === 0) {
        return apiError(
            'Enter the full payout account or wallet number to change the payout destination.',
            400,
            'SETTLEMENT_ACCOUNT_NUMBER_REQUIRED'
        );
    }

    let nextBankName = String(current.chapa_settlement_bank_name ?? '').trim();

    try {
        const supportedBanks = await listChapaBanks();
        const selectedBank = supportedBanks.find(bank => bank.code === nextBankCode);

        if (selectedBank) {
            nextBankName = selectedBank.name;
        } else {
            return apiError(
                "Choose a supported payout destination from Chapa's live directory.",
                400,
                'UNSUPPORTED_SETTLEMENT_BANK'
            );
        }
    } catch {
        nextBankName = nextBankName || '';
    }

    if (!needsProvisioning) {
        const { data: updated, error: updateError } = await context.supabase
            .from('restaurants')
            .update({
                chapa_settlement_bank_code: nextBankCode,
                chapa_settlement_bank_name: nextBankName,
                chapa_settlement_account_name: nextAccountName,
                chapa_subaccount_last_error: null,
                platform_fee_percentage: HOSTED_CHECKOUT_FEE_PERCENTAGE,
                hosted_checkout_fee_percentage: HOSTED_CHECKOUT_FEE_PERCENTAGE,
            })
            .eq('id', context.restaurantId)
            .select(PAYMENT_SETTINGS_SELECT)
            .single();

        if (updateError || !updated) {
            return apiError(
                'Failed to update payment settings',
                500,
                'PAYMENT_SETTINGS_UPDATE_FAILED',
                updateError?.message ?? 'Unknown update error'
            );
        }

        return apiSuccess(serializePaymentSettings(updated as unknown as RestaurantPaymentRecord));
    }

    if (providedAccountNumber.length === 0) {
        return apiError(
            'Enter the full payout account or wallet number to finish payout setup.',
            400,
            'SETTLEMENT_ACCOUNT_NUMBER_REQUIRED'
        );
    }

    if (!isChapaConfigured()) {
        return apiError(
            'Chapa is not configured. Add CHAPA_SECRET_KEY before saving payout accounts.',
            503,
            'CHAPA_NOT_CONFIGURED'
        );
    }

    let nextSubaccountId = currentSubaccountId || null;
    let nextStatus = current.chapa_subaccount_status?.trim() || 'provisioning';
    let nextLastError: string | null = null;
    let nextProvisionedAt = current.chapa_subaccount_provisioned_at ?? null;

    try {
        const subaccount = await createChapaSubaccount({
            business_name: current.name.trim(),
            account_name: nextAccountName,
            bank_code: nextBankCode,
            account_number: providedAccountNumber,
            split_type: 'percentage',
            split_value: HOSTED_CHECKOUT_FEE_PERCENTAGE,
        });

        console.warn('Chapa subaccount response:', JSON.stringify(subaccount, null, 2));

        const returnedSubaccountId = subaccount.data?.id?.trim();
        if (returnedSubaccountId) {
            nextSubaccountId = returnedSubaccountId;
            nextProvisionedAt = new Date().toISOString();
        }

        // Check if the response indicates success
        const isSuccess =
            subaccount.status === 'success' ||
            String(subaccount.status).toLowerCase() === 'success' ||
            String(subaccount.message).toLowerCase().includes('success') ||
            String(subaccount.message).toLowerCase().includes('created');

        if (isSuccess) {
            nextStatus = 'active';
            nextProvisionedAt = new Date().toISOString();
            nextLastError = null;
            // If we got a subaccount ID, use it
            if (returnedSubaccountId) {
                nextSubaccountId = returnedSubaccountId;
            }
        } else {
            nextStatus = normalizePayoutStatus({
                subaccountId: returnedSubaccountId,
                providerStatus: subaccount.status,
                providerMessage: subaccount.message,
            });
            nextLastError =
                nextStatus === 'active'
                    ? null
                    : subaccount.message || 'Payout destination is waiting for Chapa review.';
        }
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unknown Chapa subaccount provisioning error';
        nextStatus = normalizePayoutStatus({
            subaccountId: nextSubaccountId,
            providerMessage: message,
        });
        nextLastError = message;
    }

    console.warn('Saving to database:', {
        restaurantId: context.restaurantId,
        nextBankCode,
        nextBankName,
        nextAccountName,
        nextSubaccountId,
        nextStatus,
        nextLastError,
        nextProvisionedAt,
    });

    const { data: updated, error: updateError } = await context.supabase
        .from('restaurants')
        .update({
            chapa_settlement_bank_code: nextBankCode,
            chapa_settlement_bank_name: nextBankName,
            chapa_settlement_account_name: nextAccountName,
            chapa_settlement_account_number_masked:
                maskSettlementAccountNumber(providedAccountNumber),
            chapa_subaccount_id: nextSubaccountId,
            chapa_subaccount_status: nextStatus,
            chapa_subaccount_last_error: nextLastError,
            chapa_subaccount_provisioned_at: nextProvisionedAt,
            platform_fee_percentage: HOSTED_CHECKOUT_FEE_PERCENTAGE,
            hosted_checkout_fee_percentage: HOSTED_CHECKOUT_FEE_PERCENTAGE,
        })
        .eq('id', context.restaurantId)
        .select(PAYMENT_SETTINGS_SELECT)
        .single();

    if (updateError || !updated) {
        console.error('Database update error:', updateError);
        return apiError(
            'Failed to update payment settings',
            500,
            'PAYMENT_SETTINGS_UPDATE_FAILED',
            updateError?.message ?? 'Unknown update error'
        );
    }

    const updatedRecord = updated as unknown as RestaurantPaymentRecord;
    console.warn('Database updated successfully. New values:', {
        chapa_subaccount_status: updatedRecord.chapa_subaccount_status,
        chapa_settlement_bank_code: updatedRecord.chapa_settlement_bank_code,
        chapa_settlement_account_name: updatedRecord.chapa_settlement_account_name,
    });

    return apiSuccess(serializePaymentSettings(updatedRecord));
}

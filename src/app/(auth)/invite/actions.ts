'use server';

import { createClient } from '@/lib/supabase/server';
import { createAuditedServiceRoleClient } from '@/lib/supabase/service-role';
import { revalidatePath } from 'next/cache';
import { verifyOrigin } from '@/lib/security/csrf';

export async function acceptInvite(code: string) {
    // CSRF Protection - verify origin before processing
    await verifyOrigin();

    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return { error: 'You must be logged in to accept an invite.' };
    }

    // 1. Fetch the invite
    // HIGH-013: Explicit column selection
    const { data: invite, error: inviteError } = await supabase
        .from('staff_invites')
        .select('id, restaurant_id, role, status, expires_at')
        .eq('code', code)
        .single();

    if (inviteError || !invite) {
        return { error: 'Invalid or expired invite code.' };
    }

    if (invite.status !== 'pending') {
        return { error: 'This invite has already been used.' };
    }

    if (new Date(invite.expires_at) < new Date()) {
        return { error: 'This invite has expired.' };
    }

    // 2. Add to restaurant_staff
    // Check if already a member?
    const { data: existingStaff } = await supabase
        .from('restaurant_staff')
        .select('id')
        .eq('restaurant_id', invite.restaurant_id)
        .eq('user_id', user.id)
        .single();

    if (existingStaff) {
        // Already a member? Maybe update role?
        // For now, let's just say "You are already a member".
        // Or update role if that was the intent.
        // Let's assume we update role if different?
        // But usually we just return success or error.
        return { error: 'You are already a staff member of this restaurant.' };
    }

    // HIGH-010: Use audited service role client for staff insertion
    const adminClient = createAuditedServiceRoleClient('invite-actions', {
        userId: user.id,
        restaurantId: invite.restaurant_id,
    });
    const { error: insertError } = await adminClient.from('restaurant_staff').insert({
        restaurant_id: invite.restaurant_id,
        user_id: user.id,
        role: invite.role,
        is_active: true,
        // invited_by: invite.created_by -- if we had this col
    });

    if (insertError) {
        console.error('Failed to add staff member:', insertError);
        return { error: 'Failed to join restaurant. Please try again.' };
    }

    // 3. Update invite status
    await supabase
        .from('staff_invites')
        .update({ status: 'accepted' }) // or 'used'
        .eq('id', invite.id);

    // 4. Return success (client handles navigation)
    revalidatePath('/', 'layout');
    return { success: true };
}

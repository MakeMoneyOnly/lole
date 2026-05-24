'use server';

import { createClient } from '@/lib/supabase/server';
import { createAuditedServiceRoleClient } from '@/lib/supabase/service-role';
import { verifyOrigin } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';

const log = logger.child('auth:join');

// Role-based redirect map
const ROLE_REDIRECTS: Record<string, string> = {
    kitchen: '/kds',
    waiter: '/waiter',
    runner: '/waiter',
    bar: '/bar',
    manager: '/merchant',
    admin: '/merchant',
    owner: '/merchant',
};

interface ProvisionResult {
    success?: boolean;
    error?: string;
    redirectTo: string;
}

export async function provisionDevice(data: {
    code: string;
    password: string; // Used to create the auth user
    deviceName: string;
}): Promise<ProvisionResult> {
    // CSRF Protection - verify origin before processing
    await verifyOrigin();

    const supabase = await createClient();
    // HIGH-010: Use audited service role client for device provisioning
    const adminClient = createAuditedServiceRoleClient('device-provisioning');

    try {
        // 1. Verify Invite Code
        // HIGH-013: Explicit column selection
        const { data: invite, error: inviteError } = await adminClient
            .from('staff_invites')
            .select('id, restaurant_id, email, role, status')
            .eq('code', data.code) // Query by the Invite Code (token), not the ID
            // In a real production app, we'd use a separate secure token, but ID is okay for MVP if UUID
            .single();

        if (inviteError || !invite) {
            return { error: 'Invalid or expired provisioning code', redirectTo: '/login' };
        }

        if (invite.status === 'accepted') {
            return { error: 'Link already used', redirectTo: '/login' };
        }

        // 2. Check if User Exists (by email in invite)
        // If invite has an email, try to find user. If not, we might create a "Device User"
        // For this MVP, we assume invite has Email.
        const email =
            invite.email ??
            `device-${String(invite.role)}-${String(invite.id).slice(0, 8)}@provisioned.lole.local`;

        // 3. Create Auth User (or Sign In if we had password, but here we arc Creating)
        // We use Admin API to creating user without email confirmation for device setup speed
        const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
            email: email,
            password: data.password,
            email_confirm: true,
            user_metadata: {
                full_name: data.deviceName,
                is_device: true,
                provisioned_from_invite: true,
                provisioned_role: invite.role,
            },
        });

        if (createError) {
            if (/already exists/i.test(createError.message ?? '')) {
                return {
                    error: 'This access identity already exists. Please use the login screen.',
                    redirectTo: '/login',
                };
            }
            return { error: `Setup Failed: ${createError.message}`, redirectTo: '/login' };
        }

        if (!authUser.user) {
            return { error: 'Failed to create device identity', redirectTo: '/login' };
        }

        // 4. Link to Restaurant (Insert into restaurant_staff)
        const { error: linkError } = await adminClient.from('restaurant_staff').insert({
            restaurant_id: invite.restaurant_id,
            user_id: authUser.user.id,
            role: invite.role,
            is_active: true,
        });

        if (linkError) {
            // Rollback user creation? For now, just error.
            return { error: 'Failed to link device to restaurant', redirectTo: '/login' };
        }

        // 5. Mark Invite Accepted
        await adminClient.from('staff_invites').update({ status: 'accepted' }).eq('id', invite.id);

        // 6. Define Redirect
        const target = ROLE_REDIRECTS[invite.role] || '/merchant/onboarding/staff';

        // 7. Auto-Login the Session (We can't do this easily from Server Action for a NEW user created via Admin API)
        // Workaround: We return success, Client side uses `signInWithPassword` immediately?
        // OR: We use `signInWithPassword` here to get a session, and set cookies?

        // Let's try to sign in to set the cookie on this response
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email,
            password: data.password,
        });

        if (signInError) {
            return {
                error: 'Setup complete, but auto-login failed. Please log in manually.',
                redirectTo: '/login',
            };
        }

        return { success: true, redirectTo: `${target}?restaurantId=${invite.restaurant_id}` };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Server provisioning failed';
        log.error('Provisioning Error', e);
        return { error: message, redirectTo: '/login' };
    }
}

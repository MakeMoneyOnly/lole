import { randomUUID } from 'crypto';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { resend, EMAIL_FROM } from '@/lib/email/client';
import { StaffInviteEmail } from '@/lib/email/templates/staff-invite';

const InviteStaffSchema = z.object({
    email: z.string().email().optional().nullable(),
    role: z.enum(['owner', 'admin', 'manager', 'kitchen', 'waiter', 'bar']),
    label: z.string().trim().min(2).max(120).optional().nullable(),
});

export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const parsed = await parseJsonBody(request, InviteStaffSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const code = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await context.supabase
        .from('staff_invites')
        .insert({
            code,
            email: parsed.data.email ?? null,
            role: parsed.data.role,
            restaurant_id: context.restaurantId,
            created_by: auth.user.id,
            expires_at: expiresAt,
            status: 'pending',
        })
        // HIGH-013: Explicit column selection
        .select(
            'id, code, email, role, restaurant_id, created_by, expires_at, status, pin_code, created_at, updated_at'
        )
        .single();

    if (error) {
        return apiError(
            'Failed to create staff invite',
            500,
            'STAFF_INVITE_CREATE_FAILED',
            error.message
        );
    }

    // Fetch restaurant name for the email
    const { data: restaurant } = await context.supabase
        .from('restaurants')
        .select('name')
        .eq('id', context.restaurantId)
        .single();

    const inviteQuery = new URLSearchParams({ code, role: parsed.data.role });
    if (parsed.data.label) {
        inviteQuery.set('label', parsed.data.label);
    }
    const { getAppUrl } = await import('@/lib/config/env');
    const inviteUrl = `${getAppUrl()}/auth/join?${inviteQuery.toString()}`;
    let emailSent = false;

    if (parsed.data.email && resend) {
        console.warn('Attempting to send email to:', parsed.data.email);
        try {
            const { data: emailData, error: emailError } = await resend.emails.send({
                from: EMAIL_FROM,
                to: parsed.data.email,
                subject: `Provision access for ${restaurant?.name ?? 'lole'}`,
                html: StaffInviteEmail({
                    inviteUrl,
                    restaurantName: restaurant?.name ?? 'lole',
                    role: parsed.data.role,
                }),
            });

            if (emailError) {
                console.error('Resend API returned error:', emailError);
            } else {
                console.warn('Email sent successfully:', emailData);
                emailSent = true;
            }
        } catch (emailError) {
            console.error('Failed to send invite email:', emailError);
            // We don't fail the request if email fails, but we'll flag it in the response
        }
    } else {
        console.warn(
            'Skipping email: Email provided?',
            Boolean(parsed.data.email),
            'Resend client ready?',
            Boolean(resend)
        );
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'staff_invite_created',
        entity_type: 'staff_invite',
        entity_id: data.id,
        metadata: {
            role: parsed.data.role,
            has_email: Boolean(parsed.data.email),
            email_sent: emailSent,
            label: parsed.data.label ?? null,
        },
        new_value: {
            status: data.status,
            expires_at: data.expires_at,
        },
    });

    return apiSuccess(
        {
            invite: data,
            invite_url: inviteUrl,
            email_sent: emailSent,
        },
        201
    );
}

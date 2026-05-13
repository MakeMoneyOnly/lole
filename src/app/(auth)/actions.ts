'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { checkServerActionRateLimit } from '@/lib/security';
import { verifyOrigin } from '@/lib/security/csrf';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    restaurantName: z
        .string()
        .trim()
        .min(2)
        .max(120)
        .optional()
        .or(z.literal(''))
        .transform(value => (value ? value : undefined)),
});

export async function login(prevState: unknown, formData: FormData) {
    // CSRF Protection - verify origin before processing
    await verifyOrigin();

    // Check rate limit for auth actions (login)
    const rateLimit = await checkServerActionRateLimit('auth');
    if (!rateLimit.allowed) {
        return { error: `Too many login attempts. Please wait ${rateLimit.retryAfter} seconds.` };
    }

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const validatedFields = loginSchema.safeParse({
        email,
        password,
    });

    if (!validatedFields.success) {
        return { error: 'Invalid fields' };
    }

    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/', 'layout');
    redirect('/auth/post-login');
}

export async function signup(prevState: unknown, formData: FormData) {
    // CSRF Protection - verify origin before processing
    await verifyOrigin();

    // Check rate limit for auth actions (signup)
    const rateLimit = await checkServerActionRateLimit('auth');
    if (!rateLimit.allowed) {
        return { error: `Too many signup attempts. Please wait ${rateLimit.retryAfter} seconds.` };
    }

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const restaurantName = (formData.get('restaurant_name') as string | null) ?? '';

    const validatedFields = signupSchema.safeParse({
        email,
        password,
        restaurantName,
    });

    if (!validatedFields.success) {
        return { error: 'Invalid fields' };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
        email: validatedFields.data.email,
        password: validatedFields.data.password,
        options: {
            data: {
                restaurant_name: validatedFields.data.restaurantName || undefined,
            },
        },
    });

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/', 'layout');

    if (data.session) {
        redirect('/auth/post-login');
    }

    return { error: null, message: 'Account created. Check your email to confirm sign-up.' };
}

export async function logout() {
    // CSRF Protection - verify origin before processing
    await verifyOrigin();

    const supabase = await createClient();
    await supabase.auth.signOut();
    revalidatePath('/', 'layout');
    redirect('/');
}

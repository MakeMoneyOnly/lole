import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
// For dev env, we might not have a key, so we handle that gracefully if needed.
// Ideally, env vars are enforced at startup.

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'; // Fallback for testing

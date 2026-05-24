/**
 * Derive the canonical base URL for QR codes.
 *
 * Priority order:
 * 1. On Vercel: always use the PRODUCTION domain (VERCEL_PROJECT_PRODUCTION_URL)
 *    so QR codes are stable and point to the live site — not an ephemeral preview URL.
 * 2. Locally: use request headers (host/x-forwarded-host) → localhost:3000.
 *
 * Why not preview URLs for QR codes?
 * - Preview deployments have Vercel Authentication enabled by default.
 * - Even if disabled, preview URLs are ephemeral and change with each deployment.
 * - Guests scan QR codes in the real world — they must reach the production app.
 *
 * HIGH-008: Host header validation is now performed via buildSafeUrl()
 */
import { buildSafeUrl } from '@/lib/security/host-validation';

export function getRequestOrigin(request: Request): string {
    // Use the secure URL builder which validates hosts
    return buildSafeUrl(request);
}

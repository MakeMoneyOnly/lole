import { describe, it, expect, vi } from 'vitest';
import {
    setDeviceTokenCookies,
    verifyDeviceTokenFromRequest,
    DeviceMetadata,
} from '../device-token-cookies';
import { createHmac } from 'crypto';

// Mock next/headers
vi.mock('next/headers', () => {
    const mockSet = vi.fn();
    return {
        cookies: vi.fn().mockResolvedValue({
            set: mockSet,
        }),
    };
});

describe('device-token-cookies', () => {
    describe('setDeviceTokenCookies', () => {
        it('should set token, metadata, and signature cookies', async () => {
            const token = 'test-token-123';
            const metadata: DeviceMetadata = {
                restaurant_id: 'resto-1',
                device_type: 'pos',
            };

            await setDeviceTokenCookies(token, metadata);

            const { cookies } = await import('next/headers');
            const cookieStore = await cookies();
            expect(cookieStore.set).toHaveBeenCalledTimes(3);
            expect(cookieStore.set).toHaveBeenCalledWith(
                'geb_device_token',
                token,
                expect.any(Object)
            );
            expect(cookieStore.set).toHaveBeenCalledWith(
                'geb_device_token_metadata',
                JSON.stringify(metadata),
                expect.any(Object)
            );
            expect(cookieStore.set).toHaveBeenCalledWith(
                'geb_device_token_signature',
                expect.any(String),
                expect.any(Object)
            );
        });
    });

    describe('verifyDeviceTokenFromRequest', () => {
        const TOKEN_SIGNATURE_SECRET =
            process.env.DEVICE_TOKEN_SIGNATURE_SECRET ||
            process.env.AUTH_SECRET ||
            'development-secret-change-in-production';

        it('should return valid=false when no cookie header is present', () => {
            const request = new Request('http://localhost');
            const result = verifyDeviceTokenFromRequest(request);
            expect(result.valid).toBe(false);
        });

        it('should return valid=false when missing required cookies', () => {
            const request = new Request('http://localhost', {
                headers: {
                    cookie: 'geb_device_token=foo;',
                },
            });
            const result = verifyDeviceTokenFromRequest(request);
            expect(result.valid).toBe(false);
        });

        it('should return valid=false when signature is invalid', () => {
            const token = 'test-token';
            const metadataStr = JSON.stringify({ restaurant_id: '1' });

            const request = new Request('http://localhost', {
                headers: {
                    cookie: `geb_device_token=${token}; geb_device_token_metadata=${metadataStr}; geb_device_token_signature=invalid_sig`,
                },
            });

            const result = verifyDeviceTokenFromRequest(request);
            expect(result.valid).toBe(false);
        });

        it('should return valid=false when metadata is invalid JSON', () => {
            const token = 'test-token';
            const metadataStr = 'invalid-json';
            const signature = createHmac('sha256', TOKEN_SIGNATURE_SECRET)
                .update(`${token}:${metadataStr}`)
                .digest('hex');

            const request = new Request('http://localhost', {
                headers: {
                    cookie: `geb_device_token=${token}; geb_device_token_metadata=${metadataStr}; geb_device_token_signature=${signature}`,
                },
            });

            const result = verifyDeviceTokenFromRequest(request);
            expect(result.valid).toBe(false);
        });

        it('should return valid=true with token and metadata for valid cookies', () => {
            const token = 'test-token';
            const metadata = { restaurant_id: '1' };
            const metadataStr = JSON.stringify(metadata);
            const signature = createHmac('sha256', TOKEN_SIGNATURE_SECRET)
                .update(`${token}:${metadataStr}`)
                .digest('hex');

            const request = new Request('http://localhost', {
                headers: {
                    cookie: `geb_device_token=${token}; geb_device_token_metadata=${metadataStr}; geb_device_token_signature=${signature}`,
                },
            });

            const result = verifyDeviceTokenFromRequest(request);
            expect(result.valid).toBe(true);
            expect(result.token).toBe(token);
            expect(result.metadata).toEqual(metadata);
        });
    });
});

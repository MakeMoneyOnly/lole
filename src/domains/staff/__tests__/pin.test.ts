import { describe, expect, it } from 'vitest';
import {
    buildStaffSessionExpiry,
    hashStaffPin,
    isHashedStaffPin,
    verifyStoredStaffPin,
    hashStaffPinBcrypt,
    isBcryptHashedPin,
    verifyStoredStaffPinBcrypt,
} from '../pin';

describe('staff PIN helpers', () => {
    it('hashes PINs into deterministic non-plaintext values', () => {
        const hashed = hashStaffPin('1234');

        expect(hashed).not.toBe('1234');
        expect(hashed).toMatch(/^h1:[a-f0-9]{64}$/);
        expect(hashStaffPin('1234')).toBe(hashed);
        expect(hashStaffPin('4321')).not.toBe(hashed);
    });

    it('recognizes hashed PIN format and verifies legacy/plaintext values', () => {
        const hashed = hashStaffPin('1234');

        expect(isHashedStaffPin(hashed)).toBe(true);
        expect(isHashedStaffPin('1234')).toBe(false);
        expect(verifyStoredStaffPin(hashed, '1234')).toBe(true);
        expect(verifyStoredStaffPin('1234', '1234')).toBe(true);
        expect(verifyStoredStaffPin(hashed, '9999')).toBe(false);
    });

    it('builds future waiter session expiry timestamps', () => {
        const issuedAt = '2026-04-28T10:00:00.000Z';

        expect(buildStaffSessionExpiry(issuedAt, 60)).toBe('2026-04-28T11:00:00.000Z');
    });

    describe('bcrypt PIN hashing', () => {
        it('hashes PINs with bcrypt work factor >= 10', async () => {
            const hashed = await hashStaffPinBcrypt('1234');

            expect(hashed).not.toBe('1234');
            expect(hashed).toMatch(/^\$2[aby]\$1[0-9]{1}\$.{53}$/);
            expect(await hashStaffPinBcrypt('1234')).not.toBe(hashed);
        });

        it('recognizes bcrypt PIN format', async () => {
            const validHash = await hashStaffPinBcrypt('1234');
            expect(isBcryptHashedPin(validHash)).toBe(true);
            expect(isBcryptHashedPin('h1:abc123')).toBe(false);
            expect(isBcryptHashedPin('plaintext')).toBe(false);
        });

        it('verifies bcrypt PINs correctly', async () => {
            const hashed = await hashStaffPinBcrypt('1234');

            expect(await verifyStoredStaffPinBcrypt(hashed, '1234')).toBe(true);
            expect(await verifyStoredStaffPinBcrypt(hashed, '9999')).toBe(false);
        });

        it('supports dual verification - legacy HMAC and bcrypt', async () => {
            const legacyHashed = hashStaffPin('1234');
            const bcryptHashed = await hashStaffPinBcrypt('1234');

            expect(await verifyStoredStaffPinBcrypt(legacyHashed, '1234')).toBe(true);
            expect(await verifyStoredStaffPinBcrypt(bcryptHashed, '1234')).toBe(true);
            expect(await verifyStoredStaffPinBcrypt(legacyHashed, '9999')).toBe(false);
            expect(await verifyStoredStaffPinBcrypt(bcryptHashed, '9999')).toBe(false);
        });
    });
});

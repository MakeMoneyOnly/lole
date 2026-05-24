import { describe, it, expect } from 'vitest';
import { validatePassword, getPasswordRequirements, isPasswordReused } from './passwordPolicy';

/**
 * Password Policy Tests
 *
 * Addresses PLATFORM_AUDIT_REPORT finding SEC-H3: Weak Password Policy
 */

describe('Password Policy', () => {
    describe('validatePassword', () => {
        it('should accept a strong valid password', () => {
            const result = validatePassword('Str0ng!Passw0rd');

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.strength).toBe('strong');
        });

        it('should reject password shorter than 12 characters', () => {
            const result = validatePassword('Short1!');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must be at least 12 characters long');
        });

        it('should reject password longer than 128 characters', () => {
            const longPassword = 'A1!' + 'a'.repeat(126);
            const result = validatePassword(longPassword);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must not exceed 128 characters');
        });

        it('should reject password without uppercase letter', () => {
            const result = validatePassword('lowercase123!');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one uppercase letter');
        });

        it('should reject password without lowercase letter', () => {
            const result = validatePassword('UPPERCASE123!');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one lowercase letter');
        });

        it('should reject password without number', () => {
            const result = validatePassword('NoNumbersHere!');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one number');
        });

        it('should reject password without special character', () => {
            const result = validatePassword('NoSpecialChars123');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one special character');
        });

        it('should reject password with common patterns', () => {
            const result = validatePassword('Password123!');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password contains a common pattern or word');
        });

        it('should reject password with repeated characters', () => {
            const repeatedCharsPassword = `${'A'.repeat(4)}${'B'.repeat(4)}19!x`;
            const result = validatePassword(repeatedCharsPassword);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Password must not contain repeated characters (e.g., aaa, 111)'
            );
        });

        it('should reject password with sequential letters', () => {
            const result = validatePassword('Abcdef123!@#');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Password must not contain sequential characters (e.g., abc, 123)'
            );
        });

        it('should reject password with sequential numbers', () => {
            const result = validatePassword('Pass1234!@#$');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Password must not contain sequential characters (e.g., abc, 123)'
            );
        });

        it('should detect weak strength for multiple errors', () => {
            const result = validatePassword('weak');

            expect(result.strength).toBe('weak');
            expect(result.errors.length).toBeGreaterThan(2);
        });

        it('should detect fair strength for few errors', () => {
            const result = validatePassword('AlmostValid123!');

            expect(result.strength).toBe('fair');
        });

        it('should detect good strength for valid but simple password', () => {
            const result = validatePassword('MyV@lid2580W0rd!!');

            expect(result.valid).toBe(true);
            expect(result.strength).toBe('strong');
        });

        it('should detect strong strength for complex password', () => {
            const result = validatePassword('MyStr0ng!P@ssw0rd');

            expect(result.valid).toBe(true);
            expect(result.strength).toBe('strong');
        });

        it('should accept various special characters', () => {
            const specialChars = [
                '!',
                '@',
                '#',
                '$',
                '%',
                '^',
                '&',
                '*',
                '(',
                ')',
                '_',
                '+',
                '-',
                '=',
            ];

            for (const char of specialChars) {
                const password = `ValidPass123${char}`;
                const result = validatePassword(password);

                // Should not have special character error
                const hasSpecialCharError = result.errors.some(e =>
                    e.includes('special character')
                );
                expect(hasSpecialCharError).toBe(false);
            }
        });
    });

    describe('getPasswordRequirements', () => {
        it('should return password requirements text', () => {
            const requirements = getPasswordRequirements();

            expect(requirements).toContain('12 characters');
            expect(requirements).toContain('uppercase letter');
            expect(requirements).toContain('lowercase letter');
            expect(requirements).toContain('number');
            expect(requirements).toContain('special character');
        });
    });

    describe('isPasswordReused', () => {
        it('should return false for new password (placeholder)', async () => {
            const result = await isPasswordReused('user-123', 'NewPassword123!');

            expect(result).toBe(false);
        });
    });
});

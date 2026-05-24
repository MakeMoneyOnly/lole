/**
 * Password Policy Enforcement
 *
 * Addresses PLATFORM_AUDIT_REPORT finding SEC-H3: Weak Password Policy
 * Implements strong password requirements for agency admin users
 */

export interface PasswordValidationResult {
    valid: boolean;
    errors: string[];
    strength: 'weak' | 'fair' | 'good' | 'strong';
}

/**
 * Validate password against security policy
 * Requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * - No common patterns (123, abc, qwerty)
 * - No repeated characters (aaa, 111)
 */
export function validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];

    // Length check
    if (password.length < 12) {
        errors.push('Password must be at least 12 characters long');
    }

    if (password.length > 128) {
        errors.push('Password must not exceed 128 characters');
    }

    // Character type checks
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    // Common patterns check
    const commonPatterns = [
        '123',
        'abc',
        'qwerty',
        'password',
        'admin',
        'letmein',
        'welcome',
        'monkey',
        'dragon',
        'master',
        'hello',
    ];

    const lowerPassword = password.toLowerCase();
    for (const pattern of commonPatterns) {
        if (lowerPassword.includes(pattern)) {
            errors.push('Password contains a common pattern or word');
            break;
        }
    }

    // Repeated characters check (3+ same characters in a row)
    const repeatedCharPattern = /(.)\1{2,}/;
    if (repeatedCharPattern.test(password)) {
        errors.push('Password must not contain repeated characters (e.g., aaa, 111)');
    }

    // Sequential characters check
    if (hasSequentialChars(password)) {
        errors.push('Password must not contain sequential characters (e.g., abc, 123)');
    }

    // Calculate strength
    const strength = calculatePasswordStrength(password, errors.length);

    return {
        valid: errors.length === 0,
        errors,
        strength,
    };
}

/**
 * Check for sequential characters (abc, 123, etc.)
 */
function hasSequentialChars(password: string): boolean {
    const lower = password.toLowerCase();

    // Check for sequential letters
    for (let i = 0; i < lower.length - 2; i++) {
        const char1 = lower.charCodeAt(i);
        const char2 = lower.charCodeAt(i + 1);
        const char3 = lower.charCodeAt(i + 2);

        if (char2 === char1 + 1 && char3 === char2 + 1) {
            return true;
        }
    }

    // Check for sequential numbers
    for (let i = 0; i < password.length - 2; i++) {
        const num1 = parseInt(password[i]);
        const num2 = parseInt(password[i + 1]);
        const num3 = parseInt(password[i + 2]);

        if (!isNaN(num1) && !isNaN(num2) && !isNaN(num3)) {
            if (num2 === num1 + 1 && num3 === num2 + 1) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Calculate password strength score
 */
function calculatePasswordStrength(
    password: string,
    errorCount: number
): 'weak' | 'fair' | 'good' | 'strong' {
    if (errorCount > 2) return 'weak';
    if (errorCount > 0) return 'fair';

    let score = 0;

    // Length bonus
    if (password.length >= 16) score += 2;
    else if (password.length >= 12) score += 1;

    // Character variety bonus
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    // Extra variety
    if ((password.match(/[A-Z]/g) || []).length >= 2) score += 1;
    if ((password.match(/[^A-Za-z0-9]/g) || []).length >= 2) score += 1;

    if (score >= 6) return 'strong';
    if (score >= 4) return 'good';
    return 'fair';
}

/**
 * Generate password requirements message
 */
export function getPasswordRequirements(): string {
    return `Password must:
• Be at least 12 characters long
• Contain at least one uppercase letter (A-Z)
• Contain at least one lowercase letter (a-z)
• Contain at least one number (0-9)
• Contain at least one special character (!@#$%^&*)
• Not contain common words or patterns
• Not contain sequential characters (abc, 123)`;
}

/**
 * Check if password has been used recently
 * (In production, this would check against a history table)
 */
export async function isPasswordReused(_userId: string, _newPassword: string): Promise<boolean> {
    // This is a placeholder - in production, hash the password
    // and compare against stored password history
    // For now, we return false (no reuse detected)
    return false;
}

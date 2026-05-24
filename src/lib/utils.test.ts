import { describe, it, expect } from 'vitest';
import { cn, formatCurrency, isRemoteOrDataImageSrc } from './utils';

describe('cn', () => {
    it('should merge class names', () => {
        expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
        expect(cn('base', true && 'included', false && 'excluded')).toBe('base included');
    });

    it('should merge tailwind classes correctly', () => {
        expect(cn('p-4', 'p-2')).toBe('p-2');
    });

    it('should handle undefined and null values', () => {
        expect(cn('base', undefined, null, 'end')).toBe('base end');
    });

    it('should handle empty input', () => {
        expect(cn()).toBe('');
    });
});

describe('formatCurrency', () => {
    it('should format ETB currency by default', () => {
        const result = formatCurrency(1000);
        expect(result).toContain('1,000');
        expect(result).toMatch(/Br\./);
    });

    it('should format with no decimal places by default', () => {
        const result = formatCurrency(1234.56);
        expect(result).toContain('1,235');
    });

    it('should handle zero amount', () => {
        const result = formatCurrency(0);
        expect(result).toContain('0');
    });

    it('should handle negative amounts', () => {
        const result = formatCurrency(-500);
        expect(result).toContain('500');
        expect(result).toContain('-');
    });

    it('should format USD currency', () => {
        const result = formatCurrency(100, 'USD');
        expect(result).toContain('$');
        expect(result).toContain('100');
    });
});

describe('isRemoteOrDataImageSrc', () => {
    it('should return true for data URLs', () => {
        expect(isRemoteOrDataImageSrc('data:image/png;base64,abc123')).toBe(true);
    });

    it('should return false for local paths starting with /', () => {
        expect(isRemoteOrDataImageSrc('/images/logo.png')).toBe(false);
    });

    it('should return false for relative paths', () => {
        expect(isRemoteOrDataImageSrc('./images/logo.png')).toBe(false);
        expect(isRemoteOrDataImageSrc('images/logo.png')).toBe(false);
    });

    it('should return false for whitelisted supabase domain', () => {
        expect(isRemoteOrDataImageSrc('https://axuegixbqsvztdraenkz.supabase.co/image.jpg')).toBe(
            false
        );
    });

    it('should return false for whitelisted pravatar domain', () => {
        expect(isRemoteOrDataImageSrc('https://i.pravatar.cc/150')).toBe(false);
    });

    it('should return true for non-whitelisted remote URLs', () => {
        expect(isRemoteOrDataImageSrc('https://example.com/image.jpg')).toBe(true);
    });

    it('should return true for http URLs', () => {
        expect(isRemoteOrDataImageSrc('http://example.com/image.jpg')).toBe(true);
    });

    it('should handle URLs with whitespace', () => {
        expect(isRemoteOrDataImageSrc('  https://example.com/image.jpg  ')).toBe(true);
    });

    it('should handle invalid URLs gracefully', () => {
        expect(isRemoteOrDataImageSrc('https://[invalid-url')).toBe(true);
    });
});

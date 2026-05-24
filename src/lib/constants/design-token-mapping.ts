/**
 * DESIGN TOKEN MAPPING
 *
 * This file provides the mapping from hard-coded values to design tokens
 * Use this reference when updating components to use design tokens
 *
 * Reference: SKILLS/enterprise/design-system-engineer/SKILL.md
 */

// ═════════════════════════════════════════════════════════════════════════════
// COLOR TOKEN MAPPINGS
// ═════════════════════════════════════════════════════════════════════════════

export const colorMappings = {
    // Primary Brand Colors
    '#A81818': 'var(--brand-accent)',
    '#8B1313': 'var(--brand-accent-dark)',
    '#FDF2F2': 'var(--brand-accent-light)',

    // Secondary Brand Colors
    '#E0F2E9': 'var(--brand-mint)',
    '#C8E6D5': 'var(--brand-mint-dark)',
    '#1848A8': 'var(--brand-blue)',
    '#E8F0FE': 'var(--brand-blue-light)',
    '#F2C94C': 'var(--brand-yellow)',
    '#E5B93C': 'var(--brand-yellow-dark)',

    // Semantic Colors
    '#10B981': 'var(--semantic-success)',
    '#ECFDF5': 'var(--semantic-success-light)',
    '#F59E0B': 'var(--semantic-warning)',
    '#FFFBEB': 'var(--semantic-warning-light)',
    '#EF4444': 'var(--semantic-error)',
    '#FEF2F2': 'var(--semantic-error-light)',
    '#3B82F6': 'var(--semantic-info)',
    '#EFF6FF': 'var(--semantic-info-light)',

    // Text Colors
    '#1A1A1A': 'var(--text-primary)',
    '#666666': 'var(--text-secondary)',
    '#9CA3AF': 'var(--text-muted)',
    '#FFFFFF': 'var(--text-inverse)',

    // Surface Colors
    '#FAFAFA': 'var(--surface-page)',
    '#E5E5E5': 'var(--surface-border)',
    '#F5F5F5': 'var(--surface-hover)',
    '#F8F8F8': 'var(--surface-elevated)',
} as const;

// ═════════════════════════════════════════════════════════════════════════════
// SHADOW TOKEN MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

export const shadowMappings = {
    '0 1px 2px rgba(0, 0, 0, 0.04)': 'var(--shadow-sm)',
    '0 2px 8px rgba(0, 0, 0, 0.06)': 'var(--shadow-md)',
    '0 4px 16px rgba(0, 0, 0, 0.08)': 'var(--shadow-lg)',
    '0 8px 30px rgba(0, 0, 0, 0.12)': 'var(--shadow-xl)',
    '0 10px 30px rgba(0, 0, 0, 0.15)': 'var(--shadow-float)',
    '0 4px 16px rgba(168, 24, 24, 0.2)': 'var(--shadow-crimson)',
    '0 2px 8px rgba(168, 24, 24, 0.25)': 'var(--shadow-crimson)',
    '0 4px 12px rgba(168, 26, 25, 0.25)': 'var(--shadow-crimson)',
    '0 10px 40px -10px #A8181840': 'var(--shadow-crimson)',
} as const;

// ═════════════════════════════════════════════════════════════════════════════
// SPACING TOKEN MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

export const spacingMappings = {
    '4px': 'var(--space-1)',
    '8px': 'var(--space-2)',
    '12px': 'var(--space-3)',
    '16px': 'var(--space-4)',
    '20px': 'var(--space-5)',
    '24px': 'var(--space-6)',
    '32px': 'var(--space-8)',
    '40px': 'var(--space-10)',
    '48px': 'var(--space-12)',
    '64px': 'var(--space-16)',
} as const;

// ═════════════════════════════════════════════════════════════════════════════
// BORDER RADIUS TOKEN MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

export const radiusMappings = {
    '6px': 'var(--radius-sm)',
    '8px': 'var(--radius-md)',
    '12px': 'var(--radius-lg)',
    '16px': 'var(--radius-xl)',
    '24px': 'var(--radius-2xl)',
    '32px': 'var(--radius-2xl)',
    '9999px': 'var(--radius-full)',
} as const;

// ═════════════════════════════════════════════════════════════════════════════
// TYPOGRAPHY TOKEN MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

export const typographyMappings = {
    '48px': 'var(--text-hero)',
    '36px': 'var(--text-h1)',
    '28px': 'var(--text-h2)',
    '22px': 'var(--text-h3)',
    '18px': 'var(--text-h4)',
    '16px': 'var(--text-body)',
    '14px': 'var(--text-body-sm)',
    '12px': 'var(--text-caption)',
    '11px': 'var(--text-label)',
} as const;

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENT-SPECIFIC MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Button Component Token Mappings
 */
export const buttonTokenMappings = {
    // Primary variant
    primary: {
        background: 'var(--brand-accent)',
        hoverBackground: 'var(--brand-accent-dark)',
        shadow: 'var(--shadow-crimson)',
        hoverShadow: '0 4px 12px rgba(168, 24, 24, 0.35)',
        focusRing: 'var(--brand-accent)',
    },
    // Secondary variant
    secondary: {
        background: 'var(--surface-card)',
        hoverBackground: 'var(--surface-hover)',
        border: 'var(--surface-border)',
        hoverBorder: 'var(--text-muted)',
    },
    // Ghost variant
    ghost: {
        background: 'transparent',
        hoverBackground: 'var(--surface-hover)',
        color: 'var(--text-secondary)',
        hoverColor: 'var(--text-primary)',
    },
    // Accent variant
    accent: {
        background: 'var(--brand-yellow)',
        hoverBackground: 'var(--brand-yellow-dark)',
    },
    // Danger variant
    danger: {
        background: 'var(--semantic-error)',
        hoverBackground: '#DC2626',
    },
} as const;

/**
 * Card Component Token Mappings
 */
export const cardTokenMappings = {
    default: {
        background: 'var(--surface-card)',
        border: 'var(--surface-border)',
        shadow: 'var(--shadow-sm)',
        hoverShadow: 'var(--shadow-lg)',
        radius: 'var(--radius-lg)',
    },
    elevated: {
        background: 'var(--surface-card)',
        shadow: 'var(--shadow-lg)',
        radius: 'var(--radius-lg)',
    },
    hero: {
        background: 'var(--brand-accent)',
        shadow: 'var(--shadow-crimson)',
        radius: 'var(--radius-xl)',
    },
} as const;

/**
 * Badge Component Token Mappings
 */
export const badgeTokenMappings = {
    success: {
        background: 'var(--semantic-success-light)',
        color: 'var(--semantic-success)',
    },
    warning: {
        background: 'var(--semantic-warning-light)',
        color: 'var(--semantic-warning)',
    },
    error: {
        background: 'var(--semantic-error-light)',
        color: 'var(--semantic-error)',
    },
    primary: {
        background: 'var(--brand-accent-light)',
        color: 'var(--brand-accent)',
    },
    neutral: {
        background: 'var(--surface-elevated)',
        color: 'var(--text-secondary)',
    },
} as const;

/**
 * KDS (Kitchen Display System) Status Mappings
 */
export const kdsStatusMappings = {
    pending: {
        background: 'var(--surface-elevated)',
        color: 'var(--text-secondary)',
        border: 'var(--surface-border)',
    },
    acknowledged: {
        background: 'var(--brand-mint)',
        color: 'var(--brand-accent)',
        border: 'var(--brand-mint-dark)',
    },
    preparing: {
        background: 'var(--brand-accent-light)',
        color: 'var(--brand-accent)',
        border: 'var(--brand-accent)',
    },
    ready: {
        background: 'var(--semantic-success-light)',
        color: 'var(--semantic-success)',
        border: 'var(--semantic-success)',
    },
    served: {
        background: 'var(--surface-elevated)',
        color: 'var(--text-muted)',
        border: 'var(--surface-border)',
    },
    cancelled: {
        background: 'var(--semantic-error-light)',
        color: 'var(--semantic-error)',
        border: 'var(--semantic-error)',
    },
} as const;

// ═════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert a hard-coded color to design token
 * @param color - Hard-coded hex color
 * @returns Design token or original color if not found
 */
export function mapColorToToken(color: string): string {
    return colorMappings[color as keyof typeof colorMappings] || color;
}

/**
 * Convert a hard-coded shadow to design token
 * @param shadow - Hard-coded shadow value
 * @returns Design token or original shadow if not found
 */
export function mapShadowToToken(shadow: string): string {
    return shadowMappings[shadow as keyof typeof shadowMappings] || shadow;
}

/**
 * Convert a hard-coded spacing to design token
 * @param spacing - Hard-coded spacing value
 * @returns Design token or original spacing if not found
 */
export function mapSpacingToToken(spacing: string): string {
    return spacingMappings[spacing as keyof typeof spacingMappings] || spacing;
}

/**
 * Convert a hard-coded radius to design token
 * @param radius - Hard-coded radius value
 * @returns Design token or original radius if not found
 */
export function mapRadiusToToken(radius: string): string {
    return radiusMappings[radius as keyof typeof radiusMappings] || radius;
}

/**
 * Convert a hard-coded font size to design token
 * @param fontSize - Hard-coded font size
 * @returns Design token or original font size if not found
 */
export function mapTypographyToToken(fontSize: string): string {
    return typographyMappings[fontSize as keyof typeof typographyMappings] || fontSize;
}

// ═════════════════════════════════════════════════════════════════════════════
// ACCESSIBILITY TOKENS
// ═══════════════════════════════════════════════════════════════════════════

export const accessibilityTokens = {
    minTouchTarget: '44px',
    comfortableTouchTarget: '48px',
    focusRingWidth: '3px',
    focusRingOffset: '2px',
    focusRingStyle: 'solid',
} as const;

// ═════════════════════════════════════════════════════════════════════════════
// EXPORT ALL MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

export const designTokenMappings = {
    colors: colorMappings,
    shadows: shadowMappings,
    spacing: spacingMappings,
    radius: radiusMappings,
    typography: typographyMappings,
    components: {
        button: buttonTokenMappings,
        card: cardTokenMappings,
        badge: badgeTokenMappings,
        kds: kdsStatusMappings,
    },
    accessibility: accessibilityTokens,
    utilities: {
        mapColorToToken,
        mapShadowToToken,
        mapSpacingToToken,
        mapRadiusToToken,
        mapTypographyToToken,
    },
} as const;

export default designTokenMappings;

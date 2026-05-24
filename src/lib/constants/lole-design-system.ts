/**
 * lole DESIGN SYSTEM v5.0
 * Bespoke component system for maximum control
 *
 * Brand Colors (from Guest Menu):
 * - Crimson: #A81818 (Primary brand)
 * - Mint: #E0F2E9 (Secondary/backgrounds)
 * - Blue: #1848A8 (Accents)
 * - Yellow: #F2C94C (Highlights/CTAs)
 *
 * Typography: Inter (400, 500, 600, 700, 900)
 * Style: Sequence-inspired with lole brand identity
 */

// ═══════════════════════════════════════════════════════════════════════════════
// BRAND COLORS - From Guest Menu
// ═══════════════════════════════════════════════════════════════════════════════

export const colors = {
    brand: {
        crimson: '#A81818',
        crimsonDark: '#8B1313',
        crimsonLight: '#FDF2F2',
        mint: '#E0F2E9',
        mintDark: '#C8E6D5',
        blue: '#1848A8',
        blueLight: '#E8F0FE',
        yellow: '#F2C94C',
        yellowDark: '#E5B93C',
    },

    // Semantic colors
    semantic: {
        success: '#10B981',
        successLight: '#ECFDF5',
        warning: '#F59E0B',
        warningLight: '#FFFBEB',
        error: '#EF4444',
        errorLight: '#FEF2F2',
        info: '#3B82F6',
        infoLight: '#EFF6FF',
    },

    // Text colors
    text: {
        primary: '#1A1A1A',
        secondary: '#666666',
        muted: '#9CA3AF',
        inverse: '#FFFFFF',
    },

    // Surface colors
    surface: {
        page: '#FAFAFA',
        card: '#FFFFFF',
        input: '#FFFFFF',
        border: '#E5E5E5',
        hover: '#F5F5F5',
        elevated: '#F8F8F8',
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPOGRAPHY - Inter
// ═══════════════════════════════════════════════════════════════════════════════

export const typography = {
    fontFamily: {
        sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        serif: "'Playfair Display', Georgia, serif",
    },

    weights: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        black: 900,
    },

    sizes: {
        hero: { size: '48px', lineHeight: '1.1', letterSpacing: '-0.02em', weight: 900 },
        h1: { size: '36px', lineHeight: '1.2', letterSpacing: '-0.02em', weight: 700 },
        h2: { size: '28px', lineHeight: '1.3', letterSpacing: '-0.01em', weight: 600 },
        h3: { size: '22px', lineHeight: '1.4', letterSpacing: '0', weight: 600 },
        h4: { size: '18px', lineHeight: '1.5', letterSpacing: '0', weight: 500 },
        body: { size: '16px', lineHeight: '1.6', letterSpacing: '0', weight: 400 },
        bodySm: { size: '14px', lineHeight: '1.5', letterSpacing: '0', weight: 400 },
        caption: { size: '12px', lineHeight: '1.4', letterSpacing: '0.02em', weight: 500 },
        label: { size: '11px', lineHeight: '1.4', letterSpacing: '0.05em', weight: 600 },
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SPACING
// ═══════════════════════════════════════════════════════════════════════════════

export const spacing = {
    0: '0',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// BORDER RADIUS - Sequence-inspired rounded corners
// ═══════════════════════════════════════════════════════════════════════════════

export const radius = {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    full: '9999px',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SHADOWS - Refined elevation
// ═══════════════════════════════════════════════════════════════════════════════

export const shadows = {
    sm: '0 1px 2px rgba(0, 0, 0, 0.04)',
    md: '0 2px 8px rgba(0, 0, 0, 0.06)',
    lg: '0 4px 16px rgba(0, 0, 0, 0.08)',
    xl: '0 8px 30px rgba(0, 0, 0, 0.12)',
    float: '0 10px 30px rgba(0, 0, 0, 0.15)',
    crimson: '0 4px 16px rgba(168, 24, 24, 0.2)',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const transitions = {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    spring: '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT STYLES - Bespoke definitions
// ═══════════════════════════════════════════════════════════════════════════════

export const components = {
    // Button variants
    button: {
        primary: {
            base: `bg-[${colors.brand.crimson}] text-white rounded-[${radius.md}] font-medium`,
            hover: `hover:bg-[${colors.brand.crimsonDark}] hover:shadow-[${shadows.crimson}]`,
            active: `active:scale-[0.98]`,
            padding: `${spacing[3]} ${spacing[5]}`,
        },
        secondary: {
            base: `bg-white text-[${colors.text.primary}] border border-[${colors.surface.border}] rounded-[${radius.md}]`,
            hover: `hover:bg-[${colors.surface.hover}] hover:border-[${colors.text.muted}]`,
            active: `active:bg-[${colors.surface.elevated}]`,
            padding: `${spacing[3]} ${spacing[5]}`,
        },
        ghost: {
            base: `bg-transparent text-[${colors.text.secondary}] rounded-[${radius.md}]`,
            hover: `hover:bg-[${colors.surface.hover}] hover:text-[${colors.text.primary}]`,
            active: `active:bg-[${colors.surface.elevated}]`,
            padding: `${spacing[3]} ${spacing[4]}`,
        },
        accent: {
            base: `bg-[${colors.brand.yellow}] text-[${colors.text.primary}] rounded-[${radius.md}] font-medium`,
            hover: `hover:bg-[${colors.brand.yellowDark}]`,
            active: `active:scale-[0.98]`,
            padding: `${spacing[3]} ${spacing[5]}`,
        },
    },

    // Card variants
    card: {
        default: {
            base: `bg-white rounded-[${radius.lg}] border border-[${colors.surface.border}]`,
            shadow: shadows.sm,
            padding: spacing[6],
        },
        elevated: {
            base: `bg-white rounded-[${radius.lg}]`,
            shadow: shadows.lg,
            padding: spacing[6],
        },
        hero: {
            base: `bg-[${colors.brand.crimson}] rounded-[${radius.xl}] text-white`,
            shadow: shadows.crimson,
            padding: spacing[8],
        },
        mint: {
            base: `bg-[${colors.brand.mint}] rounded-[${radius.lg}]`,
            shadow: shadows.sm,
            padding: spacing[6],
        },
    },

    // Badge variants
    badge: {
        success: {
            base: `bg-[${colors.semantic.successLight}] text-[${colors.semantic.success}] rounded-[${radius.sm}]`,
            padding: `${spacing[1]} ${spacing[3]}`,
        },
        warning: {
            base: `bg-[${colors.semantic.warningLight}] text-[${colors.semantic.warning}] rounded-[${radius.sm}]`,
            padding: `${spacing[1]} ${spacing[3]}`,
        },
        error: {
            base: `bg-[${colors.semantic.errorLight}] text-[${colors.semantic.error}] rounded-[${radius.sm}]`,
            padding: `${spacing[1]} ${spacing[3]}`,
        },
        primary: {
            base: `bg-[${colors.brand.crimsonLight}] text-[${colors.brand.crimson}] rounded-[${radius.sm}]`,
            padding: `${spacing[1]} ${spacing[3]}`,
        },
        neutral: {
            base: `bg-[${colors.surface.elevated}] text-[${colors.text.secondary}] rounded-[${radius.sm}]`,
            padding: `${spacing[1]} ${spacing[3]}`,
        },
    },

    // Input styles
    input: {
        base: `w-full bg-white border border-[${colors.surface.border}] rounded-[${radius.md}] text-[${colors.text.primary}]`,
        focus: `focus:border-[${colors.brand.crimson}] focus:ring-2 focus:ring-[${colors.brand.crimsonLight}]`,
        placeholder: `placeholder:text-[${colors.text.muted}]`,
        padding: `${spacing[3]} ${spacing[4]}`,
    },

    // Sidebar styles
    sidebar: {
        width: '260px',
        collapsedWidth: '80px',
        background: 'white',
        border: `border-r border-[${colors.surface.border}]`,
        activeItem: `bg-[${colors.brand.crimsonLight}] text-[${colors.brand.crimson}]`,
        hoverItem: `hover:bg-[${colors.surface.hover}] hover:text-[${colors.text.primary}]`,
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// KDS SPECIFIC
// ═══════════════════════════════════════════════════════════════════════════════

export const kds = {
    statusColors: {
        pending: {
            bg: colors.surface.elevated,
            text: colors.text.secondary,
            border: colors.surface.border,
        },
        acknowledged: {
            bg: colors.brand.mint,
            text: colors.brand.crimson,
            border: colors.brand.mintDark,
        },
        preparing: {
            bg: colors.brand.crimsonLight,
            text: colors.brand.crimson,
            border: colors.brand.crimson,
        },
        ready: {
            bg: colors.semantic.successLight,
            text: colors.semantic.success,
            border: colors.semantic.success,
        },
        served: {
            bg: colors.surface.elevated,
            text: colors.text.muted,
            border: colors.surface.border,
        },
        cancelled: {
            bg: colors.semantic.errorLight,
            text: colors.semantic.error,
            border: colors.semantic.error,
        },
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT COMPLETE DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

export const loleDesignSystem = {
    colors,
    typography,
    spacing,
    radius,
    shadows,
    transitions,
    components,
    kds,
} as const;

export default loleDesignSystem;

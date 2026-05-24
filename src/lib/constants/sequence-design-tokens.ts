/**
 * lole DESIGN SYSTEM TOKENS v4.0
 * Premium enterprise dashboard design system
 *
 * Color Scheme: Red (#E53935), Yellow (#FFC107), White
 * Typography: Inter (300-400 weights)
 * Style: Sequence-inspired with modern polish
 */

// ═══════════════════════════════════════════════════════════════════════════════
// BRAND COLORS
// ═══════════════════════════════════════════════════════════════════════════════

export const brandColors = {
    primary: {
        DEFAULT: '#E53935', // Vibrant red
        dark: '#C62828', // Darker red for hover
        light: '#FFEBEE', // Light red background
        50: '#FFEBEE',
        100: '#FFCDD2',
        200: '#EF9A9A',
        300: '#E57373',
        400: '#EF5350',
        500: '#E53935',
        600: '#C62828',
        700: '#B71C1C',
        800: '#8B0000',
        900: '#5C0000',
    },
    accent: {
        DEFAULT: '#FFC107', // Warm yellow
        light: '#FFF8E1', // Light yellow background
        dark: '#FFA000',
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SEMANTIC COLORS
// ═══════════════════════════════════════════════════════════════════════════════

export const semanticColors = {
    success: {
        DEFAULT: '#10B981',
        light: 'rgba(16, 185, 129, 0.1)',
        dark: '#047857',
    },
    warning: {
        DEFAULT: '#FFC107',
        light: 'rgba(255, 193, 7, 0.1)',
        dark: '#FFA000',
    },
    error: {
        DEFAULT: '#E53935',
        light: 'rgba(229, 57, 53, 0.1)',
        dark: '#C62828',
    },
    info: {
        DEFAULT: '#3B82F6',
        light: 'rgba(59, 130, 246, 0.1)',
        dark: '#1D4ED8',
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TEXT COLORS
// ═══════════════════════════════════════════════════════════════════════════════

export const textColors = {
    primary: '#1A1A1A', // Near black
    secondary: '#666666', // Medium gray
    muted: '#9CA3AF', // Light gray
    inverse: '#FFFFFF', // White
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SURFACE COLORS
// ═══════════════════════════════════════════════════════════════════════════════

export const surfaceColors = {
    pageBg: '#FAFAFA', // Off-white page background
    card: '#FFFFFF', // Pure white cards
    input: '#FFFFFF', // White inputs
    border: '#E5E5E5', // Subtle borders
    hover: '#F5F5F5', // Hover state
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPOGRAPHY - INTER (Light weights for modern feel)
// ═══════════════════════════════════════════════════════════════════════════════

export const typography = {
    fontFamily: {
        base: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        mono: "'SF Mono', Monaco, 'Cascadia Code', monospace",
    },
    weights: {
        light: 300,
        regular: 400,
        medium: 500,
    },
    scale: {
        h1: {
            fontSize: '40px',
            lineHeight: '1.2',
            letterSpacing: '-0.02em',
            fontWeight: 400,
        },
        h2: {
            fontSize: '28px',
            lineHeight: '1.3',
            letterSpacing: '-0.01em',
            fontWeight: 400,
        },
        h3: {
            fontSize: '22px',
            lineHeight: '1.4',
            letterSpacing: '0',
            fontWeight: 400,
        },
        h4: {
            fontSize: '16px',
            lineHeight: '1.5',
            letterSpacing: '0',
            fontWeight: 500,
        },
        body: {
            fontSize: '14px',
            lineHeight: '1.6',
            letterSpacing: '0',
            fontWeight: 400,
        },
        bodySm: {
            fontSize: '13px',
            lineHeight: '1.5',
            letterSpacing: '0',
            fontWeight: 400,
        },
        small: {
            fontSize: '12px',
            lineHeight: '1.5',
            letterSpacing: '0',
            fontWeight: 400,
        },
        caption: {
            fontSize: '11px',
            lineHeight: '1.4',
            letterSpacing: '0.05em',
            fontWeight: 500,
            textTransform: 'uppercase' as const,
        },
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SPACING SYSTEM (8px base)
// ═══════════════════════════════════════════════════════════════════════════════

export const spacing = {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
    xxxl: '64px',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// BORDER RADIUS
// ═══════════════════════════════════════════════════════════════════════════════

export const radii = {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '20px',
    full: '9999px',
    circle: '50%',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SHADOWS - Refined, subtle elevation
// ═══════════════════════════════════════════════════════════════════════════════

export const shadows = {
    sm: '0 1px 2px rgba(0, 0, 0, 0.04)',
    md: '0 2px 8px rgba(0, 0, 0, 0.06)',
    lg: '0 4px 16px rgba(0, 0, 0, 0.08)',
    xl: '0 8px 30px rgba(0, 0, 0, 0.12)',
    inner: 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
    card: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)',
    cardHover: '0 8px 24px rgba(0, 0, 0, 0.08)',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Z-INDEX SCALE
// ═══════════════════════════════════════════════════════════════════════════════

export const zIndex = {
    base: 0,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// GRID SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

export const grid = {
    columns: 12,
    gutter: '24px',
    maxWidth: '1440px',
    sidebarWidth: '260px',
    sidebarCollapsed: '80px',
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
// GRADIENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const gradients = {
    hero: 'linear-gradient(135deg, #E53935 0%, #EF5350 100%)',
    heroSubtle: 'linear-gradient(135deg, rgba(229, 57, 53, 0.1) 0%, rgba(239, 83, 80, 0.05) 100%)',
    card: 'linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)',
    shimmer: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

export const componentTokens = {
    button: {
        primary: {
            background: brandColors.primary.DEFAULT,
            color: textColors.inverse,
            borderRadius: radii.md,
            padding: `${spacing.sm} ${spacing.md}`,
            fontWeight: typography.weights.medium,
            hoverBackground: brandColors.primary.dark,
        },
        secondary: {
            background: surfaceColors.card,
            border: `1px solid ${surfaceColors.border}`,
            color: textColors.primary,
            borderRadius: radii.md,
            padding: `${spacing.sm} ${spacing.md}`,
            hoverBackground: surfaceColors.hover,
        },
        ghost: {
            background: 'transparent',
            color: textColors.secondary,
            borderRadius: radii.md,
            padding: `${spacing.sm} ${spacing.md}`,
            hoverBackground: surfaceColors.hover,
        },
        accent: {
            background: brandColors.accent.DEFAULT,
            color: '#1A1A1A',
            borderRadius: radii.md,
            padding: `${spacing.sm} ${spacing.md}`,
            fontWeight: typography.weights.medium,
            hoverBackground: brandColors.accent.dark,
        },
    },
    card: {
        default: {
            background: surfaceColors.card,
            borderRadius: radii.lg,
            boxShadow: shadows.card,
            padding: spacing.lg,
        },
        hero: {
            background: gradients.hero,
            borderRadius: radii.xl,
            color: textColors.inverse,
            padding: spacing.xl,
        },
        elevated: {
            background: surfaceColors.card,
            borderRadius: radii.lg,
            boxShadow: shadows.lg,
            padding: spacing.lg,
        },
    },
    badge: {
        success: {
            background: semanticColors.success.light,
            color: semanticColors.success.DEFAULT,
            padding: '3px 10px',
            borderRadius: radii.sm,
            fontSize: typography.scale.small.fontSize,
            fontWeight: typography.weights.medium,
        },
        pending: {
            background: 'rgba(255, 193, 7, 0.1)',
            color: '#FFA000',
            padding: '3px 10px',
            borderRadius: radii.sm,
            fontSize: typography.scale.small.fontSize,
            fontWeight: typography.weights.medium,
        },
        error: {
            background: semanticColors.error.light,
            color: semanticColors.error.DEFAULT,
            padding: '3px 10px',
            borderRadius: radii.sm,
            fontSize: typography.scale.small.fontSize,
            fontWeight: typography.weights.medium,
        },
    },
    input: {
        default: {
            background: surfaceColors.input,
            border: `1px solid ${surfaceColors.border}`,
            borderRadius: radii.md,
            padding: `${spacing.sm} ${spacing.md}`,
            fontSize: typography.scale.body.fontSize,
            focusBorder: brandColors.primary.DEFAULT,
            focusRing: `0 0 0 3px rgba(229, 57, 53, 0.1)`,
        },
    },
    sidebar: {
        width: grid.sidebarWidth,
        collapsedWidth: grid.sidebarCollapsed,
        background: surfaceColors.card,
        borderRight: `1px solid ${surfaceColors.border}`,
        padding: spacing.md,
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// KDS SPECIFIC TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

export const kdsTokens = {
    status: {
        pending: {
            background: '#F5F5F5',
            color: '#666666',
            border: '#E5E5E5',
        },
        acknowledged: {
            background: 'rgba(255, 193, 7, 0.1)',
            color: '#FFA000',
            border: '#FFC107',
        },
        preparing: {
            background: 'rgba(229, 57, 53, 0.1)',
            color: '#E53935',
            border: '#EF5350',
        },
        ready: {
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#10B981',
            border: '#34D399',
        },
        served: {
            background: '#F5F5F5',
            color: '#9CA3AF',
            border: '#E5E5E5',
        },
        cancelled: {
            background: 'rgba(229, 57, 53, 0.1)',
            color: '#E53935',
            border: '#EF5350',
        },
    },
    card: {
        borderRadius: radii.lg,
        padding: spacing.lg,
        shadow: shadows.md,
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT ALL TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

export const sequenceDesignTokens = {
    colors: {
        brand: brandColors,
        semantic: semanticColors,
        text: textColors,
        surface: surfaceColors,
    },
    typography,
    spacing,
    radii,
    shadows,
    gradients,
    zIndex,
    grid,
    transitions,
    components: componentTokens,
    kds: kdsTokens,
} as const;

export default sequenceDesignTokens;

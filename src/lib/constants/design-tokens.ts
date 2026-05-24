/**
 * ENTERPRISE DESIGN TOKENS
 * lole - Restaurant Operating System v2.0
 *
 * Unified design system for Agency Admin, Merchant Dashboard, and KDS
 * Based on WCAG 2.1 AA compliance standards
 */

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

export const colors = {
    primary: {
        DEFAULT: '#A81818',
        dark: '#8B1313',
        light: '#FDF2F2',
        50: '#FDF2F2',
        100: '#FCE5E5',
        200: '#F9CCCC',
        300: '#F4A3A3',
        400: '#ED6B6B',
        500: '#E53E3E',
        600: '#A81818',
        700: '#8B1313',
        800: '#6B1010',
        900: '#4A0C0C',
    },
    neutral: {
        900: '#111827',
        800: '#1F2937',
        700: '#374151',
        600: '#4B5563',
        500: '#6B7280',
        400: '#9CA3AF',
        300: '#D1D5DB',
        200: '#E5E7EB',
        100: '#F3F4F6',
        50: '#F9FAFB',
        0: '#FFFFFF',
    },
    semantic: {
        success: {
            DEFAULT: '#10B981',
            light: '#ECFDF5',
            dark: '#047857',
        },
        warning: {
            DEFAULT: '#F59E0B',
            light: '#FFFBEB',
            dark: '#B45309',
        },
        error: {
            DEFAULT: '#EF4444',
            light: '#FEF2F2',
            dark: '#B91C1C',
        },
        info: {
            DEFAULT: '#3B82F6',
            light: '#EFF6FF',
            dark: '#1D4ED8',
        },
    },
    kds: {
        pending: {
            DEFAULT: '#6B7280',
            light: '#F3F4F6',
        },
        acknowledged: {
            DEFAULT: '#3B82F6',
            light: '#EFF6FF',
        },
        preparing: {
            DEFAULT: '#F59E0B',
            light: '#FFFBEB',
        },
        ready: {
            DEFAULT: '#A81818',
            light: '#FDF2F2',
        },
        served: {
            DEFAULT: '#10B981',
            light: '#ECFDF5',
        },
        cancelled: {
            DEFAULT: '#EF4444',
            light: '#FEF2F2',
        },
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SPACING SYSTEM (4px base grid)
// ═══════════════════════════════════════════════════════════════════════════════

export const spacing = {
    0: '0px',
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
    20: '80px',
    24: '96px',
    32: '128px',
    40: '160px',
    48: '192px',
    56: '224px',
    64: '256px',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// BORDER RADIUS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

export const radius = {
    none: '0px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '20px',
    '3xl': '24px',
    full: '9999px',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPOGRAPHY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

export const typography = {
    fontFamily: {
        sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        mono: "'JetBrains Mono', 'Fira Code', monospace",
    },
    fontSize: {
        display: { size: '32px', weight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' },
        h1: { size: '24px', weight: 600, lineHeight: 1.3, letterSpacing: '-0.01em' },
        h2: { size: '20px', weight: 600, lineHeight: 1.4, letterSpacing: '0' },
        h3: { size: '18px', weight: 600, lineHeight: 1.4, letterSpacing: '0' },
        title: { size: '16px', weight: 600, lineHeight: 1.5, letterSpacing: '0' },
        body: { size: '14px', weight: 400, lineHeight: 1.6, letterSpacing: '0' },
        bodySm: { size: '13px', weight: 400, lineHeight: 1.5, letterSpacing: '0' },
        caption: { size: '12px', weight: 500, lineHeight: 1.4, letterSpacing: '0.01em' },
        micro: { size: '11px', weight: 600, lineHeight: 1.3, letterSpacing: '0.05em' },
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SHADOW SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

export const shadows = {
    none: 'none',
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 6px -1px rgba(0,0,0,0.1)',
    lg: '0 10px 15px -3px rgba(0,0,0,0.1)',
    xl: '0 20px 25px -5px rgba(0,0,0,0.1)',
    focus: '0 0 0 3px rgba(168,24,24,0.15)',
    focusError: '0 0 0 3px rgba(239,68,68,0.15)',
    focusSuccess: '0 0 0 3px rgba(16,185,129,0.15)',
    focusInfo: '0 0 0 3px rgba(59,130,246,0.15)',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

export const animation = {
    duration: {
        fast: '100ms',
        normal: '150ms',
        slow: '200ms',
        slower: '300ms',
        slowest: '400ms',
    },
    easing: {
        default: 'cubic-bezier(0.4, 0, 0.2, 1)',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Z-INDEX SCALE
// ═══════════════════════════════════════════════════════════════════════════════

export const zIndex = {
    hide: -1,
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1100,
    banner: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    skipLink: 1600,
    toast: 1700,
    tooltip: 1800,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// BREAKPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

export const breakpoints = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// ACCESSIBILITY
// ═══════════════════════════════════════════════════════════════════════════════

export const accessibility = {
    minTouchTarget: '44px',
    comfortableTouchTarget: '48px',
    focusRing: {
        width: '3px',
        offset: '2px',
        style: 'solid',
    },
    reducedMotion: {
        query: '(prefers-reduced-motion: reduce)',
    },
    screenReaderOnly: {
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: '0',
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const layout = {
    sidebar: {
        width: '240px',
        collapsedWidth: '64px',
    },
    header: {
        height: '64px',
    },
    page: {
        maxWidth: '1440px',
        padding: {
            mobile: '16px',
            tablet: '24px',
            desktop: '32px',
        },
    },
    card: {
        gridGap: '24px',
        minWidth: '280px',
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT-SPECIFIC TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

export const components = {
    button: {
        padding: {
            sm: '8px 12px',
            md: '10px 16px',
            lg: '12px 24px',
        },
        // WCAG 2.1 AA: Minimum touch target is 44x44px (Guideline 2.5.5)
        // All heights meet or exceed this requirement
        height: {
            sm: '44px', // Minimum compliant touch target
            md: '48px', // Comfortable default
            lg: '56px', // Prominent action
        },
        iconSize: {
            sm: '14px',
            md: '16px',
            lg: '20px',
        },
    },
    input: {
        height: {
            sm: '32px',
            md: '40px',
            lg: '48px',
        },
        padding: {
            sm: '8px 12px',
            md: '10px 14px',
            lg: '12px 16px',
        },
    },
    card: {
        padding: {
            compact: '12px 16px',
            default: '20px',
            elevated: '24px',
        },
    },
    badge: {
        padding: '4px 10px',
        height: '24px',
    },
    table: {
        rowHeight: '56px',
        headerHeight: '48px',
        cellPadding: '16px',
    },
    modal: {
        maxWidth: {
            sm: '400px',
            md: '500px',
            lg: '600px',
            xl: '800px',
            full: '100vw',
        },
        padding: '24px',
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════════

export const statusColors = {
    order: {
        pending: colors.kds.pending,
        acknowledged: colors.kds.acknowledged,
        preparing: colors.kds.preparing,
        ready: colors.kds.ready,
        served: colors.kds.served,
        cancelled: colors.kds.cancelled,
    },
    restaurant: {
        operational: colors.semantic.success,
        warning: colors.semantic.warning,
        critical: colors.semantic.error,
        offline: colors.neutral[400],
    },
    alert: {
        info: colors.semantic.info,
        success: colors.semantic.success,
        warning: colors.semantic.warning,
        error: colors.semantic.error,
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETE DESIGN TOKENS EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const designTokens = {
    colors,
    spacing,
    radius,
    typography,
    shadows,
    animation,
    zIndex,
    breakpoints,
    accessibility,
    layout,
    components,
    statusColors,
} as const;

export default designTokens;

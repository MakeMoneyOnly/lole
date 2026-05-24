/**
 * lole BRAND IDENTITY & DESIGN SYSTEM
 * Hospitality Operating System - Built for Speed & Resilience
 */

// Brand Strategy
export const BRAND_PURPOSE =
    'To provide the invisible, bulletproof infrastructure that powers the heartbeat of hospitality. lole exists to eliminate operational chaos, allowing restaurateurs to focus on the art of service rather than the friction of technology.';

export const MISSION_STATEMENT =
    'To empower hospitality businesses with a unified, resilient, and intelligent operating system that optimizes every touchpoint—from the kitchen line to the customer’s table.';

export const VISION_STATEMENT =
    'To be the global standard for hospitality infrastructure, starting in Africa, where every restaurant runs on a frictionless, data-driven ecosystem.';

export const CORE_VALUES = {
    OPERATIONAL_INTEGRITY:
        'Our systems are built for 100% uptime. Reliability is our primary product.',
    COGNITIVE_CLARITY:
        'We minimize noise. Our UI provides the exact information needed at the exact moment it is required.',
    HIGH_VELOCITY_EFFICIENCY:
        'Every tap is a cost. We optimize workflows to save seconds that turn into hours over a month.',
    EMPOWERMENT_THROUGH_DATA:
        "We don't just process orders; we provide the insights that help owners reclaim their margins.",
};

// Brand Positioning
export const BRAND_POSITIONING = {
    CATEGORY: 'Restaurant Operating System (ROS) / Hospitality Tech',
    TARGET: 'Ambitious café chains, high-volume dining, and multi-branch hospitality groups',
    DIFFERENTIATION:
        "lole is not a 'tool'; it is the nervous system. We win by offering deep vertical integration (Consumer > KDS > POS > Admin) on a single, resilient enterprise-grade light-themed architecture.",
};

// Brand Personality
export const BRAND_PERSONALITY = {
    CONFIDENT: 'Authority-led and decisive',
    CALM: "Designed to be a 'cool' presence in a 'hot' kitchen environment",
    DEPENDABLE: 'The tool that never breaks',
    MODERN: 'Tech-forward and globally competitive',
    PRECISE: 'Engineering-grade accuracy in all data reporting',
};

// Visual Identity - The lole Volt Palette
// Visual Identity - Cafe Lucia Enterprise Palette
export const lole_COLORS = {
    PRIMARY: {
        hex: '#A81818', // Crimson Red
        rgb: '168, 24, 24',
        usage: 'Primary Action / Brand',
    },
    SECONDARY: {
        hex: '#F2C94C', // Gold/Amber (kept for accents)
        rgb: '242, 201, 76',
        usage: 'Secondary / Highlights',
    },
    SURFACE: {
        hex: '#FFFFFF',
        rgb: '255, 255, 255',
        usage: 'Background',
    },
    SURFACE_MUTED: {
        hex: '#F9FAFB', // Gray-50
        rgb: '249, 250, 251',
        usage: 'Secondary Background',
    },
    SUCCESS: {
        hex: '#10B981', // Emerald 500
        rgb: '16, 185, 129',
        usage: 'Success',
    },
    WARNING: {
        hex: '#F59E0B',
        rgb: '245, 158, 11',
        usage: 'Warning',
    },
    ERROR: {
        hex: '#EF4444',
        rgb: '239, 68, 68',
        usage: 'Error',
    },
    TEXT_PRIMARY: {
        hex: '#111827', // Gray-900
        rgb: '17, 24, 39',
        usage: 'Headings',
    },
    TEXT_SECONDARY: {
        hex: '#6B7280', // Gray-500
        rgb: '107, 114, 128',
        usage: 'Body',
    },
};

// Typography Hierarchy
export const TYPOGRAPHY = {
    HEADLINES: {
        font: 'Plus Jakarta Sans',
        weight: 'Extra Bold (800)',
        description: 'Modern, geometric, and high-impact',
    },
    UI_BODY: {
        font: 'Inter',
        weight: 'Regular (400), Medium (500), SemiBold (600)',
        description: 'Optimized for readability on screens',
    },
    NUMERIC_DATA: {
        font: 'JetBrains Mono',
        weight: 'Medium (500)',
        description: 'Mandatory for prices, timers, and quantities to ensure tabular alignment',
    },
};

// UI Principles
export const UI_PRINCIPLES = {
    SPEED_OVER_DECORATION:
        'Prioritize instant loading and fast tap-responses over transition animations',
    CONFIDENCE_OVER_FLASH: 'Use solid borders and high-density data',
    CALM_DURING_CHAOS: 'Reduce cognitive load with a clean, high-contrast light-themed interface',
    BEAUTY_WITH_PURPOSE: 'Every visual element must serve a functional goal',
};

// Standardized Badge System
export const BADGE_TYPES = {
    FASTING: {
        background: 'rgba(16, 185, 129, 0.1)',
        color: '#166534',
        border: 'rgba(16, 185, 129, 0.2)',
    },
    SPICY: {
        background: 'rgba(255, 69, 58, 0.15)',
        color: '#FF453A',
        border: 'rgba(255, 69, 58, 0.3)',
    },
    SOLD_OUT: {
        background: 'rgba(255, 255, 255, 0.05)',
        color: '#AEAEB2',
        border: 'rgba(255, 255, 255, 0.1)',
    },
    CHEF_SPECIAL: {
        background: 'rgba(168, 24, 24, 0.1)',
        color: '#A81818',
        border: 'rgba(168, 24, 24, 0.2)',
    },
};

// Messaging Pillars
export const MESSAGING_PILLARS = {
    TOTAL_VISIBILITY: 'Know your numbers, your tables, and your kitchen in real-time',
    ENGINEERED_FOR_SPEED: 'Reduced taps, faster turns, higher margins',
    RESILIENT_INFRASTRUCTURE: 'Built to stay online when the rush hits',
};

// Sample Copy for different contexts
export const SAMPLE_COPY = {
    WEBSITE_HERO: 'The Operating System for Modern Hospitality',
    EMPTY_STATE: 'Your heat-map will appear here once orders start flowing',
    SYSTEM_ALERT: 'Connection Lost. Retrying in 3s...',
    TAGLINE: 'lole: Built for the Rush. Scaled for the Future.',
};

// Brand Voice Guidelines
export const BRAND_VOICE = {
    STYLE: 'Operational Minimalism',
    DESCRIPTION:
        'We speak with the brevity of a Head Chef and the clarity of a Software Engineer. No fluff. No puns.',
    TONE: 'Confident, Calm, Dependable, Modern, Precise',
};

// Interface-Specific Guidelines
export const INTERFACE_GUIDELINES = {
    MOBILE_MENU: {
        style: 'Visual, engaging, high-quality food imagery',
        typography: 'Refined typography',
        background: 'Dark obsidian background',
        finish: 'High-quality print-ready design',
    },
    ADMIN_DASHBOARD: {
        style: 'Enterprise light theme with high-density data',
        focus: 'Net Revenue and Top Sellers',
        approach: 'Remove decorative elements, prioritize data clarity',
    },
    KITCHEN_DISPLAY: {
        style: 'Stark, high-contrast design',
        typography: 'Large text for readability',
        notifications: 'Loud notifications for new orders',
        priority: 'Time elapsed as most prominent element',
    },
};

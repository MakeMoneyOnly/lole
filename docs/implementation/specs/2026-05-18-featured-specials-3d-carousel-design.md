# Design Specification: Featured Specials 3D Coverflow Carousel

**Author**: Antigravity  
**Status**: Draft (Approved)  
**Date**: May 18, 2026  
**Version**: 1.0.0

---

## 1. Executive Summary

This document specifies the high-fidelity integration of a 3D coverflow carousel for the **Featured Specials** section of the Lole Guest Menu. By migrating from the static horizontal scrolling container to an immersive, mobile-optimized 3D coverflow mechanism (leveraging Swiper.js and Framer Motion), we deliver an enterprise-grade, premium visual identity for QR Dine-in and Online ordering guests in Ethiopia ("Resilience by Design").

---

## 2. Goals & Non-Goals

### 2.1 Goals

- **Immersive 3D Experience**: Implement smooth, hardware-accelerated 3D coverflow transition effect where the active featured card is centered, and adjacent cards are scaled down and positioned in depth.
- **Mobile-First Touch Ergonomics**: Native-like touch swipe gestures without visual navigation buttons, customized strictly for mobile viewports.
- **Zero Layout Shift (CLS)**: Safeguard Next.js server-side rendering (SSR) hydration, guaranteeing zero Cumulative Layout Shift when the interactive carousel mounts in the browser.
- **Enterprise Architecture**: Strict isolation of concerns into a dedicated, reusable component conforming to Lole's Coding Standards.

### 2.2 Non-Goals

- Modifying the structure or presentation layer of the `GuestMenuRecommendedCard` component itself.
- Integrating external APIs or altering data-fetching paradigms within the Guest Menu hook architecture.

---

## 3. Technology Stack & Dependencies

- **Core Framework**: Next.js 16 (App Router) / React 19 / TypeScript 5.
- **Styling & System**: Tailwind CSS 4, Vanilla CSS injection.
- **Animation Layer**: Framer Motion 12.
- **Carousel Engine**: Swiper 11.
- **Icons**: Lucide React.

---

## 4. Detailed Component Design

### 4.1 Naming & Location

- **Component Name**: `GuestMenuFeaturedSpecialsCarousel`
- **Path**: [src/components/guest-menu/GuestMenuFeaturedSpecialsCarousel.tsx](file:///c:/Users/user/Desktop/lole/src/components/guest-menu/GuestMenuFeaturedSpecialsCarousel.tsx)

### 4.2 Component API (Props Interface)

```typescript
import { MenuItem } from '@/app/(guest)/[slug]/menu-client';

export interface GuestMenuFeaturedSpecialsCarouselProps {
    /** List of featured specials menu items fetched from the database */
    items: MenuItem[];
    /** Callback executed when a card is selected (opens detail drawer) */
    onSelect: (item: MenuItem) => void;
    /** Callback executed when the primary action (add to cart) is triggered */
    onAddToCart: (item: MenuItem) => void;
    /** Whether to show premium pagination indicators below the carousel. Defaults to true. */
    showPagination?: boolean;
    /** Enable autoplay loop for featured items. Defaults to false. */
    autoplay?: boolean;
    /** Enable infinite loop. Defaults to true. */
    loop?: boolean;
}
```

### 4.3 Swiper Engine Configuration

The carousel configuration is fine-tuned to fit the mobile screen width perfectly, featuring:

- `slidesPerView={1.3}` or `slidesPerView="auto"` (centered) to showcase peeking side cards.
- `coverflowEffect`:
    - `rotate: 0` (flat rotation to ensure clear text readability on slanted viewports).
    - `stretch: -16` (negative horizontal margin to draw peeking cards closer).
    - `depth: 100` (Z-index translation depth).
    - `modifier: 2` (scales the depth transition intensity).
    - `scale: 0.9` (beautifully scales inactive cards down to 90% size).

---

## 5. Hydration & Performance Strategy

To support Next.js App Router and React 19, we must address potential hydration mismatches since Swiper's client-side slide initialization can alter the HTML structure:

1.  **Hydration Guard**: The component will render a clean skeleton or placeholder during server-side compilation, and swap to the fully active interactive Swiper carousel once mounted on the client:
    ```typescript
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);
    ```
2.  **Zero Layout Shift**: The placeholder skeleton matches the exact height (`340px`) of the active Swiper instance to avoid visual jumping.

---

## 6. Visual Theme Alignment (Lole Enterprise)

- **Active Bullet Color**: High-contrast **Lole Lime** (`#DDF853`).
- **Inactive Bullet Color**: Translucent Carbon Grey (`rgba(26, 28, 30, 0.25)`).
- **Transitions**: Smooth, cubic-bezier timing curves (`cubic-bezier(0.25, 1, 0.5, 1)`) for card transitions and Swiper animations.

---

## 7. Definition of Done

- **Correctness**: 3D coverflow displays active cards in focus, inactive cards in background.
- **Hydration**: Zero console errors or hydration warnings in development/production builds.
- **Typing**: 100% type-safety without `any` assertions.
- **Responsiveness**: Tested on simulated mobile viewports.

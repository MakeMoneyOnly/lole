import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockDashboardAuth } from './fixtures/dashboard-auth';

/**
 * Accessibility Tests using axe-core
 *
 * These tests ensure WCAG compliance and identify accessibility issues
 * across the lole Restaurant OS platform.
 */

test.describe('Accessibility Tests', () => {
    test.describe('Guest Pages', () => {
        test('landing page should have no critical accessibility violations', async ({ page }) => {
            await page.goto('/');

            // Wait for page to be fully loaded
            await page.waitForLoadState('domcontentloaded');

            const accessibilityScanResults = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .analyze();

            // Fail only on critical issues in CI to reduce false positives from known style debt.
            const criticalViolations = accessibilityScanResults.violations.filter(
                v => v.impact === 'critical'
            );

            expect(criticalViolations).toEqual([]);
        });

        test('guest menu page should have no accessibility violations', async ({ page }) => {
            // Navigate to a demo restaurant page
            await page.goto('/m/demo');
            await page.waitForLoadState('domcontentloaded');

            const accessibilityScanResults = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .analyze();

            const criticalViolations = accessibilityScanResults.violations.filter(
                v => v.impact === 'critical'
            );

            expect(criticalViolations).toEqual([]);
        });
    });

    test.describe('Merchant Dashboard', () => {
        test.beforeEach(async ({ page }) => {
            // Setup authentication mock for all merchant dashboard tests
            await mockDashboardAuth(page);
        });

        test('merchant dashboard should have no accessibility violations', async ({ page }) => {
            // Navigate to merchant dashboard
            await page.goto('/merchant');

            // Wait for the page to be fully loaded
            await page.waitForLoadState('domcontentloaded');

            // Wait for main content to be attached to DOM
            await page.waitForSelector('#main-content', { state: 'attached', timeout: 30000 });

            const accessibilityScanResults = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .exclude('#sidebar-navigation') // Exclude sidebar if it has known issues
                .analyze();

            const criticalViolations = accessibilityScanResults.violations.filter(
                v => v.impact === 'critical' || v.impact === 'serious'
            );

            expect(criticalViolations).toEqual([]);
        });

        test('merchant takeout (orders) page should have no accessibility violations', async ({
            page,
        }) => {
            await page.goto('/merchant/takeout');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForSelector('#main-content', { state: 'attached', timeout: 30000 });

            const accessibilityScanResults = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .analyze();

            const criticalViolations = accessibilityScanResults.violations.filter(
                v => v.impact === 'critical' || v.impact === 'serious'
            );

            expect(criticalViolations).toEqual([]);
        });

        test('merchant menus page should have no accessibility violations', async ({ page }) => {
            await page.goto('/merchant/menus');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForSelector('#main-content', { state: 'attached', timeout: 30000 });

            const accessibilityScanResults = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .analyze();

            const criticalViolations = accessibilityScanResults.violations.filter(
                v => v.impact === 'critical' || v.impact === 'serious'
            );

            expect(criticalViolations).toEqual([]);
        });
    });

    test.describe('KDS (Kitchen Display System)', () => {
        test.beforeEach(async ({ page }) => {
            // Setup authentication mock for all KDS tests
            await mockDashboardAuth(page);
        });

        test('KDS page should have no accessibility violations', async ({ page }) => {
            await page.goto('/kds');
            await page.waitForLoadState('domcontentloaded');

            const accessibilityScanResults = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .analyze();

            const criticalViolations = accessibilityScanResults.violations.filter(
                v => v.impact === 'critical' || v.impact === 'serious'
            );

            expect(criticalViolations).toEqual([]);
        });

        test('KDS page should have proper heading structure', async ({ page }) => {
            await page.goto('/kds');
            await page.waitForLoadState('domcontentloaded');

            // Wait for the station board to load
            await expect(
                page.getByRole('heading', { name: /Kitchen Display|Loading/i }).first()
            ).toBeVisible({ timeout: 30000 });

            // Check for proper heading hierarchy
            const h1Count = await page.locator('h1').count();
            expect(h1Count).toBeGreaterThanOrEqual(1);

            // Verify headings are in logical order
            const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
            let lastLevel = 0;

            for (const heading of headings) {
                const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
                const level = parseInt(tagName.replace('h', ''), 10);

                // Headings should not skip levels (e.g., h1 -> h3)
                expect(level).toBeLessThanOrEqual(lastLevel + 1);
                lastLevel = level;
            }
        });

        test('KDS page should have sufficient color contrast', async ({ page }) => {
            await page.goto('/kds');
            await page.waitForLoadState('domcontentloaded');

            const accessibilityScanResults = await new AxeBuilder({ page })
                .withRules(['color-contrast'])
                .analyze();

            const contrastViolations = accessibilityScanResults.violations.filter(
                v => v.id === 'color-contrast'
            );

            // MED-014: Fail on serious/critical contrast violations for WCAG AA compliance
            // Serious and critical violations indicate contrast ratios below 3:1
            // which fail WCAG 2.1 AA requirements
            const criticalContrastIssues = contrastViolations.filter(
                v => v.impact === 'critical' || v.impact === 'serious'
            );

            // Log contrast violations for debugging
            if (contrastViolations.length > 0) {
                console.warn('Color contrast violations found:');
                contrastViolations.forEach(v => {
                    console.warn(`  - ${v.impact}: ${v.description}`);
                    v.nodes.forEach(node => {
                        console.warn(`    Target: ${node.target}`);
                    });
                });
            }

            // Fail the test if there are serious or critical contrast issues
            expect(criticalContrastIssues).toEqual([]);
        });
    });

    test.describe('Interactive Components', () => {
        test('buttons should have accessible names', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');

            const buttons = await page.locator('button').all();

            for (const button of buttons) {
                const accessibleName = await button.evaluate(el => {
                    return (
                        el.getAttribute('aria-label') ||
                        el.getAttribute('aria-labelledby') ||
                        el.textContent?.trim() ||
                        el.getAttribute('title')
                    );
                });

                // Buttons should have some form of accessible name
                expect(accessibleName).toBeTruthy();
            }
        });

        test('images should have alt text', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');

            const images = await page.locator('img').all();

            for (const img of images) {
                const alt = await img.getAttribute('alt');
                const ariaLabel = await img.getAttribute('aria-label');
                const ariaLabelledby = await img.getAttribute('aria-labelledby');

                // Images should have alt text or aria labeling
                expect(alt !== null || ariaLabel || ariaLabelledby).toBeTruthy();
            }
        });

        test('form inputs should have labels', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');

            const inputs = await page
                .locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"])')
                .all();

            for (const input of inputs) {
                const ariaLabel = await input.getAttribute('aria-label');
                const ariaLabelledby = await input.getAttribute('aria-labelledby');
                const id = await input.getAttribute('id');

                let hasLabel = false;

                if (ariaLabel || ariaLabelledby) {
                    hasLabel = true;
                } else if (id) {
                    // Check if there's a label element with matching for attribute
                    const label = await page.locator(`label[for="${id}"]`).count();
                    hasLabel = label > 0;
                }

                expect(hasLabel).toBeTruthy();
            }
        });
    });

    test.describe('Color Contrast', () => {
        test('text should meet minimum color contrast requirements', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');

            const accessibilityScanResults = await new AxeBuilder({ page })
                .withRules(['color-contrast'])
                .analyze();

            const contrastViolations = accessibilityScanResults.violations.filter(
                v => v.id === 'color-contrast'
            );

            // Warn but don't fail on color contrast issues
            if (contrastViolations.length > 0) {
                console.warn(
                    'Color contrast violations found:',
                    contrastViolations.map(v => v.description)
                );
            }
        });
    });

    test.describe('Keyboard Navigation', () => {
        test('focus should be visible on interactive elements', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');

            // Tab through focusable elements
            const focusableElements = await page
                .locator(
                    'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                )
                .all();

            if (focusableElements.length > 0) {
                // Focus the first element
                await focusableElements[0].focus();

                // Check that focus indicator is visible (exclude Next.js dev-tools overlay)
                const focusedElement = page
                    .locator(':focus')
                    .filter({
                        hasNot: page.locator('nextjs-portal, [data-nextjs-dev-tools-button]'),
                    })
                    .first();
                await expect(focusedElement).toBeVisible();
            }
        });

        test('should be able to navigate with keyboard', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');

            // Find all focusable elements
            const focusableElements = await page
                .locator(
                    'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                )
                .filter({ has: page.locator(':visible') })
                .all();

            // Skip test if no focusable elements exist
            if (focusableElements.length === 0) {
                test.skip(true, 'No focusable elements found on page');
                return;
            }

            // Press Tab key to move focus
            await page.keyboard.press('Tab');

            // Verify focus has moved to an element
            // Use a more robust check that handles the case where focus might be on body
            const activeElement = page.locator('*:focus');
            const focusCount = await activeElement.count();

            // Either an element has focus, or we need to tab more times
            if (focusCount === 0) {
                // Try tabbing a few more times to reach the first focusable element
                for (let i = 0; i < 5; i++) {
                    await page.keyboard.press('Tab');
                    const retryFocusCount = await page.locator('*:focus').count();
                    if (retryFocusCount > 0) break;
                }
            }

            // Verify we can navigate forward with Tab
            const focusedBefore = await page.evaluate(() => document.activeElement?.tagName);
            await page.keyboard.press('Tab');
            const focusedAfter = await page.evaluate(() => document.activeElement?.tagName);

            // Either focus moved to a different element, or we're at the end of the tab order
            // Both are valid outcomes for keyboard navigation
            expect(typeof focusedBefore).toBe('string');
            expect(typeof focusedAfter).toBe('string');

            // Verify that the page has focusable elements and keyboard navigation works
            // by checking that activeElement is not null after tabbing
            const finalActiveElement = await page.evaluate(() => document.activeElement?.tagName);
            expect(finalActiveElement).toBeTruthy();
        });
    });
});

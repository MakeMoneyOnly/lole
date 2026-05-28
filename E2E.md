[WebServer] }
·××F······°××F°°××F××F·××F××F××F×°°°°×°°°°F°°°°°××F××F××F°°°°°°°°°°°°°

1.  [chromium] › e2e/accessibility.spec.ts:133:13 › Accessibility Tests › KDS (Kitchen Display System) › KDS page should have proper heading structure
    TimeoutError: page.waitForSelector: Timeout 30000ms exceeded.
    Call log:
    - waiting for locator('h1')
      136 |
      137 | // Wait for the station board to load
         > 138 | await page.waitForSelector('h1', { state: 'attached', timeout: 30000 });
                      |                        ^
        139 |
        140 | // Check for proper heading hierarchy
        141 | const h1Count = await page.locator('h1').count();
        at /home/runner/work/lole/lole/e2e/accessibility.spec.ts:138:24
        Error Context: test-results/accessibility-Accessibilit-d3bc1-ve-proper-heading-structure-chromium/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        TimeoutError: page.waitForSelector: Timeout 30000ms exceeded.
        Call log:
    - waiting for locator('h1')
      136 |
      137 | // Wait for the station board to load
         > 138 | await page.waitForSelector('h1', { state: 'attached', timeout: 30000 });
                      |                        ^
        139 |
        140 | // Check for proper heading hierarchy
        141 | const h1Count = await page.locator('h1').count();
        at /home/runner/work/lole/lole/e2e/accessibility.spec.ts:138:24
        Error Context: test-results/accessibility-Accessibilit-d3bc1-ve-proper-heading-structure-chromium-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/accessibility-Accessibilit-d3bc1-ve-proper-heading-structure-chromium-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/accessibility-Accessibilit-d3bc1-ve-proper-heading-structure-chromium-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        TimeoutError: page.waitForSelector: Timeout 30000ms exceeded.
        Call log:
    - waiting for locator('h1')
      136 |
      137 | // Wait for the station board to load
         > 138 | await page.waitForSelector('h1', { state: 'attached', timeout: 30000 });
                      |                        ^
        139 |
        140 | // Check for proper heading hierarchy
        141 | const h1Count = await page.locator('h1').count();
        at /home/runner/work/lole/lole/e2e/accessibility.spec.ts:138:24
        Error Context: test-results/accessibility-Accessibilit-d3bc1-ve-proper-heading-structure-chromium-retry2/error-context.md
2.  [chromium] › e2e/channels-health-delivery-ack.spec.ts:74:9 › Channels health and delivery acknowledge flow › renders channel health and acknowledges an external order
    Error: expect(locator).toBeVisible() failed
    Locator: getByRole('heading', { name: /Takeout & Delivery/i })
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found
    Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: /Takeout & Delivery/i })
      186 | await page.goto('/merchant/takeout');
      187 |
         > 188 | await expect(page.getByRole('heading', { name: /Takeout & Delivery/i })).toBeVisible();
                      |                                                                                  ^
        189 | await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
        190 | await expect(page.getByRole('button', { name: 'Availability' })).toBeVisible();
        191 | await expect(page.getByRole('button', { name: 'Partner Status' })).toBeVisible();
        at /home/runner/work/lole/lole/e2e/channels-health-delivery-ack.spec.ts:188:82
        Error Context: test-results/channels-health-delivery-a-cf6cb-nowledges-an-external-order-chromium/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: /Takeout & Delivery/i })
        Expected: visible
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: /Takeout & Delivery/i })
      186 | await page.goto('/merchant/takeout');
      187 |
         > 188 | await expect(page.getByRole('heading', { name: /Takeout & Delivery/i })).toBeVisible();
                      |                                                                                  ^
        189 | await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
        190 | await expect(page.getByRole('button', { name: 'Availability' })).toBeVisible();
        191 | await expect(page.getByRole('button', { name: 'Partner Status' })).toBeVisible();
        at /home/runner/work/lole/lole/e2e/channels-health-delivery-ack.spec.ts:188:82
        Error Context: test-results/channels-health-delivery-a-cf6cb-nowledges-an-external-order-chromium-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/channels-health-delivery-a-cf6cb-nowledges-an-external-order-chromium-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/channels-health-delivery-a-cf6cb-nowledges-an-external-order-chromium-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: /Takeout & Delivery/i })
        Expected: visible
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: /Takeout & Delivery/i })
      186 | await page.goto('/merchant/takeout');
      187 |
         > 188 | await expect(page.getByRole('heading', { name: /Takeout & Delivery/i })).toBeVisible();
                      |                                                                                  ^
        189 | await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
        190 | await expect(page.getByRole('button', { name: 'Availability' })).toBeVisible();
        191 | await expect(page.getByRole('button', { name: 'Partner Status' })).toBeVisible();
        at /home/runner/work/lole/lole/e2e/channels-health-delivery-ack.spec.ts:188:82
        Error Context: test-results/channels-health-delivery-a-cf6cb-nowledges-an-external-order-chromium-retry2/error-context.md
3.  [chromium] › e2e/example.spec.ts:4:9 › Core web journeys › landing page renders hero and routes merchant CTA to login
    Error: expect(locator).toBeAttached() failed
    Locator: locator('h1').first()
    Expected: attached
    Timeout: 5000ms
    Error: element(s) not found
    Call log:
    - Expect "toBeAttached" with timeout 5000ms
    - waiting for locator('h1').first()
      7 | await expect(page).toHaveTitle(/lole/i);
      8 | // Heading h1 contains nested span so check visible text across the element
         > 9 | await expect(page.locator('h1').first()).toBeAttached();
                     |                                                  ^
        10 |
        11 | // Verify the Sign In link href points to /login (link contract check)
        12 | const signInLink = page.getByRole('link', { name: /^Log in$/ }).first();
        at /home/runner/work/lole/lole/e2e/example.spec.ts:9:50
        Error Context: test-results/example-Core-web-journeys--99068-outes-merchant-CTA-to-login-chromium/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeAttached() failed
        Locator: locator('h1').first()
        Expected: attached
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeAttached" with timeout 5000ms
    - waiting for locator('h1').first()
      7 | await expect(page).toHaveTitle(/lole/i);
      8 | // Heading h1 contains nested span so check visible text across the element
         > 9 | await expect(page.locator('h1').first()).toBeAttached();
                     |                                                  ^
        10 |
        11 | // Verify the Sign In link href points to /login (link contract check)
        12 | const signInLink = page.getByRole('link', { name: /^Log in$/ }).first();
        at /home/runner/work/lole/lole/e2e/example.spec.ts:9:50
        Error Context: test-results/example-Core-web-journeys--99068-outes-merchant-CTA-to-login-chromium-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/example-Core-web-journeys--99068-outes-merchant-CTA-to-login-chromium-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/example-Core-web-journeys--99068-outes-merchant-CTA-to-login-chromium-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeAttached() failed
        Locator: locator('h1').first()
        Expected: attached
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeAttached" with timeout 5000ms
    - waiting for locator('h1').first()
      7 | await expect(page).toHaveTitle(/lole/i);
      8 | // Heading h1 contains nested span so check visible text across the element
         > 9 | await expect(page.locator('h1').first()).toBeAttached();
                     |                                                  ^
        10 |
        11 | // Verify the Sign In link href points to /login (link contract check)
        12 | const signInLink = page.getByRole('link', { name: /^Log in$/ }).first();
        at /home/runner/work/lole/lole/e2e/example.spec.ts:9:50
        Error Context: test-results/example-Core-web-journeys--99068-outes-merchant-CTA-to-login-chromium-retry2/error-context.md
4.  [chromium] › e2e/example.spec.ts:22:9 › Core web journeys › login page supports password visibility toggle and sign-up navigation
    Error: expect(locator).toHaveAttribute(expected) failed
    Locator: locator('input[placeholder="Enter your password"]')
    Expected: "text"
    Received: "password"
    Timeout: 5000ms
    Call log:
    - Expect "toHaveAttribute" with timeout 5000ms
    - waiting for locator('input[placeholder="Enter your password"]')
      9 × locator resolved to <input value="" required="" type="password" placeholder="Enter your password" class="font-manrope focus:border-brand-accent focus:ring-brand-accent/5 focus:shadow-brand-accent/10 w-full rounded-xl border border-black/15 bg-white px-12 py-3.5 pr-14 text-base font-medium text-black transition-all outline-none placeholder:text-black/30 focus:shadow-lg focus:ring-4"/> - unexpected value "password"
      30 | await passwordInput.fill('secretpassword');
      31 | await page.getByLabel('Toggle password visibility').click();
         > 32 | await expect(passwordInput).toHaveAttribute('type', 'text');
                     |                                     ^
        33 |
        34 | // Verify the Sign Up link exists and points to /signup
        35 | const signUpLink = page.getByRole('link', { name: /^Sign Up$/i }).first();
        at /home/runner/work/lole/lole/e2e/example.spec.ts:32:37
        Error Context: test-results/example-Core-web-journeys--dd1ee-ggle-and-sign-up-navigation-chromium/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toHaveAttribute(expected) failed
        Locator: locator('input[placeholder="Enter your password"]')
        Expected: "text"
        Received: "password"
        Timeout: 5000ms
        Call log:
    - Expect "toHaveAttribute" with timeout 5000ms
    - waiting for locator('input[placeholder="Enter your password"]')
      9 × locator resolved to <input value="" required="" type="password" placeholder="Enter your password" class="font-manrope focus:border-brand-accent focus:ring-brand-accent/5 focus:shadow-brand-accent/10 w-full rounded-xl border border-black/15 bg-white px-12 py-3.5 pr-14 text-base font-medium text-black transition-all outline-none placeholder:text-black/30 focus:shadow-lg focus:ring-4"/> - unexpected value "password"
      30 | await passwordInput.fill('secretpassword');
      31 | await page.getByLabel('Toggle password visibility').click();
         > 32 | await expect(passwordInput).toHaveAttribute('type', 'text');
                     |                                     ^
        33 |
        34 | // Verify the Sign Up link exists and points to /signup
        35 | const signUpLink = page.getByRole('link', { name: /^Sign Up$/i }).first();
        at /home/runner/work/lole/lole/e2e/example.spec.ts:32:37
        Error Context: test-results/example-Core-web-journeys--dd1ee-ggle-and-sign-up-navigation-chromium-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/example-Core-web-journeys--dd1ee-ggle-and-sign-up-navigation-chromium-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/example-Core-web-journeys--dd1ee-ggle-and-sign-up-navigation-chromium-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toHaveAttribute(expected) failed
        Locator: locator('input[placeholder="Enter your password"]')
        Expected: "text"
        Received: "password"
        Timeout: 5000ms
        Call log:
    - Expect "toHaveAttribute" with timeout 5000ms
    - waiting for locator('input[placeholder="Enter your password"]')
      9 × locator resolved to <input value="" required="" type="password" placeholder="Enter your password" class="font-manrope focus:border-brand-accent focus:ring-brand-accent/5 focus:shadow-brand-accent/10 w-full rounded-xl border border-black/15 bg-white px-12 py-3.5 pr-14 text-base font-medium text-black transition-all outline-none placeholder:text-black/30 focus:shadow-lg focus:ring-4"/> - unexpected value "password"
      30 | await passwordInput.fill('secretpassword');
      31 | await page.getByLabel('Toggle password visibility').click();
         > 32 | await expect(passwordInput).toHaveAttribute('type', 'text');
                     |                                     ^
        33 |
        34 | // Verify the Sign Up link exists and points to /signup
        35 | const signUpLink = page.getByRole('link', { name: /^Sign Up$/i }).first();
        at /home/runner/work/lole/lole/e2e/example.spec.ts:32:37
        Error Context: test-results/example-Core-web-journeys--dd1ee-ggle-and-sign-up-navigation-chromium-retry2/error-context.md
5.  [chromium] › e2e/guest-signed-qr-order.spec.ts:4:9 › Signed QR to guest order flow › validates signed QR context and submits guest order
    Error: expect(locator).toBeVisible() failed
    Locator: getByText('Scan Burger')
    Expected: visible
    Timeout: 15000ms
    Error: element(s) not found
    Call log:
    - Expect "toBeVisible" with timeout 15000ms
    - waiting for getByText('Scan Burger')
      106 | }
      107 | // Wait for menu items to load after context is established
         > 108 | await expect(page.getByText('Scan Burger')).toBeVisible({ timeout: 15000 });
                      |                                                     ^
        109 |
        110 | await page.getByText('Scan Burger').first().click();
        111 | await page.getByRole('button', { name: 'Add to Order' }).click();
        at /home/runner/work/lole/lole/e2e/guest-signed-qr-order.spec.ts:108:53
        Error Context: test-results/guest-signed-qr-order-Sign-c24aa-ext-and-submits-guest-order-chromium/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByText('Scan Burger')
        Expected: visible
        Timeout: 15000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 15000ms
    - waiting for getByText('Scan Burger')
      106 | }
      107 | // Wait for menu items to load after context is established
         > 108 | await expect(page.getByText('Scan Burger')).toBeVisible({ timeout: 15000 });
                      |                                                     ^
        109 |
        110 | await page.getByText('Scan Burger').first().click();
        111 | await page.getByRole('button', { name: 'Add to Order' }).click();
        at /home/runner/work/lole/lole/e2e/guest-signed-qr-order.spec.ts:108:53
        Error Context: test-results/guest-signed-qr-order-Sign-c24aa-ext-and-submits-guest-order-chromium-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/guest-signed-qr-order-Sign-c24aa-ext-and-submits-guest-order-chromium-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/guest-signed-qr-order-Sign-c24aa-ext-and-submits-guest-order-chromium-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByText('Scan Burger')
        Expected: visible
        Timeout: 15000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 15000ms
    - waiting for getByText('Scan Burger')
      106 | }
      107 | // Wait for menu items to load after context is established
         > 108 | await expect(page.getByText('Scan Burger')).toBeVisible({ timeout: 15000 });
                      |                                                     ^
        109 |
        110 | await page.getByText('Scan Burger').first().click();
        111 | await page.getByRole('button', { name: 'Add to Order' }).click();
        at /home/runner/work/lole/lole/e2e/guest-signed-qr-order.spec.ts:108:53
        Error Context: test-results/guest-signed-qr-order-Sign-c24aa-ext-and-submits-guest-order-chromium-retry2/error-context.md
6.  [chromium] › e2e/guests-directory-profile.spec.ts:74:9 › Guests directory and profile flows › loads guest directory, opens profile drawer, and saves updates
    Error: expect(locator).toBeVisible() failed
    Locator: getByRole('heading', { name: /Guests/i })
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found
    Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: /Guests/i })
      173 | await page.goto('/merchant/guests');
      174 |
         > 175 | await expect(page.getByRole('heading', { name: /Guests/i })).toBeVisible();
                      |                                                                      ^
        176 | await expect(
        177 | page.getByRole('button', { name: /Open guest profile for Selam Guest/i })
        178 | ).toBeVisible();
        at /home/runner/work/lole/lole/e2e/guests-directory-profile.spec.ts:175:70
        Error Context: test-results/guests-directory-profile-G-920bd-le-drawer-and-saves-updates-chromium/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: /Guests/i })
        Expected: visible
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: /Guests/i })
      173 | await page.goto('/merchant/guests');
      174 |
         > 175 | await expect(page.getByRole('heading', { name: /Guests/i })).toBeVisible();
                      |                                                                      ^
        176 | await expect(
        177 | page.getByRole('button', { name: /Open guest profile for Selam Guest/i })
        178 | ).toBeVisible();
        at /home/runner/work/lole/lole/e2e/guests-directory-profile.spec.ts:175:70
        Error Context: test-results/guests-directory-profile-G-920bd-le-drawer-and-saves-updates-chromium-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/guests-directory-profile-G-920bd-le-drawer-and-saves-updates-chromium-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/guests-directory-profile-G-920bd-le-drawer-and-saves-updates-chromium-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: /Guests/i })
        Expected: visible
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: /Guests/i })
      173 | await page.goto('/merchant/guests');
      174 |
         > 175 | await expect(page.getByRole('heading', { name: /Guests/i })).toBeVisible();
                      |                                                                      ^
        176 | await expect(
        177 | page.getByRole('button', { name: /Open guest profile for Selam Guest/i })
        178 | ).toBeVisible();
        at /home/runner/work/lole/lole/e2e/guests-directory-profile.spec.ts:175:70
        Error Context: test-results/guests-directory-profile-G-920bd-le-drawer-and-saves-updates-chromium-retry2/error-context.md
7.  [chromium] › e2e/kds-operational-flow.spec.ts:74:9 › KDS queue to handoff flow › ingests queue, runs station prep, and completes expeditor handoff
    Error: expect(locator).toBeVisible() failed
    Locator: getByRole('heading', { name: /Kitchen Display/i })
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found
    Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: /Kitchen Display/i })
      301 |
      302 | await page.goto('/kds?restaurantId=rest-1');
         > 303 | await expect(page.getByRole('heading', { name: /Kitchen Display/i })).toBeVisible();
                      |                                                                               ^
        304 | await expect(page.getByText('Table 12')).toBeVisible();
        305 | await expect(page.getByText('1x Burger')).toBeVisible();
        306 |
        at /home/runner/work/lole/lole/e2e/kds-operational-flow.spec.ts:303:79
        Error Context: test-results/kds-operational-flow-KDS-q-112c4-completes-expeditor-handoff-chromium/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: /Kitchen Display/i })
        Expected: visible
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: /Kitchen Display/i })
      301 |
      302 | await page.goto('/kds?restaurantId=rest-1');
         > 303 | await expect(page.getByRole('heading', { name: /Kitchen Display/i })).toBeVisible();
                      |                                                                               ^
        304 | await expect(page.getByText('Table 12')).toBeVisible();
        305 | await expect(page.getByText('1x Burger')).toBeVisible();
        306 |
        at /home/runner/work/lole/lole/e2e/kds-operational-flow.spec.ts:303:79
        Error Context: test-results/kds-operational-flow-KDS-q-112c4-completes-expeditor-handoff-chromium-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/kds-operational-flow-KDS-q-112c4-completes-expeditor-handoff-chromium-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/kds-operational-flow-KDS-q-112c4-completes-expeditor-handoff-chromium-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: /Kitchen Display/i })
        Expected: visible
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: /Kitchen Display/i })
      301 |
      302 | await page.goto('/kds?restaurantId=rest-1');
         > 303 | await expect(page.getByRole('heading', { name: /Kitchen Display/i })).toBeVisible();
                      |                                                                               ^
        304 | await expect(page.getByText('Table 12')).toBeVisible();
        305 | await expect(page.getByText('1x Burger')).toBeVisible();
        306 |
        at /home/runner/work/lole/lole/e2e/kds-operational-flow.spec.ts:303:79
        Error Context: test-results/kds-operational-flow-KDS-q-112c4-completes-expeditor-handoff-chromium-retry2/error-context.md
8.  [chromium] › e2e/merchant-dashboard-audit.spec.ts:21:9 › Merchant Dashboard full-session audit › navigates all core merchant tabs and validates page intent
    Error: expect(locator).toBeVisible() failed
    Locator: getByRole('heading', { name: /^(Good (morning|afternoon|evening)|Welcome),/i })
    Expected: visible
    Timeout: 15000ms
    Error: element(s) not found
    Call log:
    - Expect "toBeVisible" with timeout 15000ms
    - waiting for getByRole('heading', { name: /^(Good (morning|afternoon|evening)|Welcome),/i })
      at page-objects/merchant-dashboard.po.ts:37
      35 | name: /^(Good (morning|afternoon|evening)|Welcome),/i,
      36 | })
         > 37 | ).toBeVisible({
                     |           ^
        38 | timeout: 15_000,
        39 | });
        40 | }
        at MerchantShellPage.gotoDashboard (/home/runner/work/lole/lole/e2e/page-objects/merchant-dashboard.po.ts:37:11)
        at /home/runner/work/lole/lole/e2e/merchant-dashboard-audit.spec.ts:23:9
        Error Context: test-results/merchant-dashboard-audit-M-ec616-s-and-validates-page-intent-chromium/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: /^(Good (morning|afternoon|evening)|Welcome),/i })
        Expected: visible
        Timeout: 15000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 15000ms
    - waiting for getByRole('heading', { name: /^(Good (morning|afternoon|evening)|Welcome),/i })
      at page-objects/merchant-dashboard.po.ts:37
      35 | name: /^(Good (morning|afternoon|evening)|Welcome),/i,
      36 | })
         > 37 | ).toBeVisible({
                     |           ^
        38 | timeout: 15_000,
        39 | });
        40 | }
        at MerchantShellPage.gotoDashboard (/home/runner/work/lole/lole/e2e/page-objects/merchant-dashboard.po.ts:37:11)
        at /home/runner/work/lole/lole/e2e/merchant-dashboard-audit.spec.ts:23:9
        Error Context: test-results/merchant-dashboard-audit-M-ec616-s-and-validates-page-intent-chromium-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/merchant-dashboard-audit-M-ec616-s-and-validates-page-intent-chromium-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/merchant-dashboard-audit-M-ec616-s-and-validates-page-intent-chromium-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: /^(Good (morning|afternoon|evening)|Welcome),/i })
        Expected: visible
        Timeout: 15000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 15000ms
    - waiting for getByRole('heading', { name: /^(Good (morning|afternoon|evening)|Welcome),/i })
      at page-objects/merchant-dashboard.po.ts:37
      35 | name: /^(Good (morning|afternoon|evening)|Welcome),/i,
      36 | })
         > 37 | ).toBeVisible({
                     |           ^
        38 | timeout: 15_000,
        39 | });
        40 | }
        at MerchantShellPage.gotoDashboard (/home/runner/work/lole/lole/e2e/page-objects/merchant-dashboard.po.ts:37:11)
        at /home/runner/work/lole/lole/e2e/merchant-dashboard-audit.spec.ts:23:9
        Error Context: test-results/merchant-dashboard-audit-M-ec616-s-and-validates-page-intent-chromium-retry2/error-context.md
9.  [chromium] › e2e/p1-localization-accessibility.spec.ts:77:9 › P1 localization and accessibility regression › guests screen keeps locale formatting and labeled controls
    Error: expect(locator).toBeVisible() failed
    Locator: getByRole('heading', { name: 'Guests', exact: true })
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found
    Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: 'Guests', exact: true })
      140 | await page.goto('/merchant/guests');
      141 |
         > 142 | await expect(page.getByRole('heading', { name: 'Guests', exact: true })).toBeVisible();
                      |                                                                                  ^
        143 | await expect(page.getByLabel('Search guests by name')).toBeVisible();
        144 | await expect(page.getByText('English')).toBeVisible();
        145 | await expect(page.getByText(/ETB/).first()).toBeVisible();
        at /home/runner/work/lole/lole/e2e/p1-localization-accessibility.spec.ts:142:82
        Error Context: test-results/p1-localization-accessibil-8b4c7-atting-and-labeled-controls-chromium/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: 'Guests', exact: true })
        Expected: visible
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: 'Guests', exact: true })
      140 | await page.goto('/merchant/guests');
      141 |
         > 142 | await expect(page.getByRole('heading', { name: 'Guests', exact: true })).toBeVisible();
                      |                                                                                  ^
        143 | await expect(page.getByLabel('Search guests by name')).toBeVisible();
        144 | await expect(page.getByText('English')).toBeVisible();
        145 | await expect(page.getByText(/ETB/).first()).toBeVisible();
        at /home/runner/work/lole/lole/e2e/p1-localization-accessibility.spec.ts:142:82
        Error Context: test-results/p1-localization-accessibil-8b4c7-atting-and-labeled-controls-chromium-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/p1-localization-accessibil-8b4c7-atting-and-labeled-controls-chromium-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/p1-localization-accessibil-8b4c7-atting-and-labeled-controls-chromium-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: 'Guests', exact: true })
        Expected: visible
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: 'Guests', exact: true })
      140 | await page.goto('/merchant/guests');
      141 |
         > 142 | await expect(page.getByRole('heading', { name: 'Guests', exact: true })).toBeVisible();
                      |                                                                                  ^
        143 | await expect(page.getByLabel('Search guests by name')).toBeVisible();
        144 | await expect(page.getByText('English')).toBeVisible();
        145 | await expect(page.getByText(/ETB/).first()).toBeVisible();
        at /home/runner/work/lole/lole/e2e/p1-localization-accessibility.spec.ts:142:82
        Error Context: test-results/p1-localization-accessibil-8b4c7-atting-and-labeled-controls-chromium-retry2/error-context.md
10. [chromium] › e2e/p1-localization-accessibility.spec.ts:155:9 › P1 localization and accessibility regression › channels screen keeps labeled controls and table semantics
    Error: expect(locator).toBeVisible() failed
    Locator: getByRole('heading', { name: 'Channels', exact: true })
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found
    Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: 'Channels', exact: true })
      230 | await page.goto('/merchant/channels');
      231 |
         > 232 | await expect(page.getByRole('heading', { name: 'Channels', exact: true })).toBeVisible();
                      |                                                                                    ^
        233 | await expect(page.getByLabel('Connect Provider')).toBeVisible();
        234 | await expect(page.getByLabel('Provider display name')).toBeVisible();
        235 | await expect(page.getByLabel('External Orders')).toBeVisible();
        at /home/runner/work/lole/lole/e2e/p1-localization-accessibility.spec.ts:232:84
        Error Context: test-results/p1-localization-accessibil-d29b7-ontrols-and-table-semantics-chromium/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: 'Channels', exact: true })
        Expected: visible
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: 'Channels', exact: true })
      230 | await page.goto('/merchant/channels');
      231 |
         > 232 | await expect(page.getByRole('heading', { name: 'Channels', exact: true })).toBeVisible();
                      |                                                                                    ^
        233 | await expect(page.getByLabel('Connect Provider')).toBeVisible();
        234 | await expect(page.getByLabel('Provider display name')).toBeVisible();
        235 | await expect(page.getByLabel('External Orders')).toBeVisible();
        at /home/runner/work/lole/lole/e2e/p1-localization-accessibility.spec.ts:232:84
        Error Context: test-results/p1-localization-accessibil-d29b7-ontrols-and-table-semantics-chromium-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/p1-localization-accessibil-d29b7-ontrols-and-table-semantics-chromium-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/p1-localization-accessibil-d29b7-ontrols-and-table-semantics-chromium-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: 'Channels', exact: true })
        Expected: visible
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: 'Channels', exact: true })
      230 | await page.goto('/merchant/channels');
      231 |
         > 232 | await expect(page.getByRole('heading', { name: 'Channels', exact: true })).toBeVisible();
                      |                                                                                    ^
        233 | await expect(page.getByLabel('Connect Provider')).toBeVisible();
        234 | await expect(page.getByLabel('Provider display name')).toBeVisible();
        235 | await expect(page.getByLabel('External Orders')).toBeVisible();
        at /home/runner/work/lole/lole/e2e/p1-localization-accessibility.spec.ts:232:84
        Error Context: test-results/p1-localization-accessibil-d29b7-ontrols-and-table-semantics-chromium-retry2/error-context.md
11. [chromium] › e2e/p2-loyalty-gift-card.spec.ts:12:9 › P2 loyalty and gift-card redemption › renders loyalty programs, issues a gift card, and redeems it
    Error: expect(locator).toBeVisible() failed
    Locator: getByRole('heading', { name: 'Guests', exact: true })
    Expected: visible
    Timeout: 15000ms
    Error: element(s) not found
    Call log:
    - Expect "toBeVisible" with timeout 15000ms
    - waiting for getByRole('heading', { name: 'Guests', exact: true })
      163 |
      164 | // Wait for the main Guests heading to confirm page loaded
         > 165 | await expect(page.getByRole('heading', { name: 'Guests', exact: true })).toBeVisible({
                      |                                                                                  ^
        166 | timeout: 15000,
        167 | });
        168 |
        at /home/runner/work/lole/lole/e2e/p2-loyalty-gift-card.spec.ts:165:82
        Error Context: test-results/p2-loyalty-gift-card-P2-lo-9f551--a-gift-card-and-redeems-it-chromium/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: 'Guests', exact: true })
        Expected: visible
        Timeout: 15000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 15000ms
    - waiting for getByRole('heading', { name: 'Guests', exact: true })
      163 |
      164 | // Wait for the main Guests heading to confirm page loaded
         > 165 | await expect(page.getByRole('heading', { name: 'Guests', exact: true })).toBeVisible({
                      |                                                                                  ^
        166 | timeout: 15000,
        167 | });
        168 |
        at /home/runner/work/lole/lole/e2e/p2-loyalty-gift-card.spec.ts:165:82
        Error Context: test-results/p2-loyalty-gift-card-P2-lo-9f551--a-gift-card-and-redeems-it-chromium-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/p2-loyalty-gift-card-P2-lo-9f551--a-gift-card-and-redeems-it-chromium-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/p2-loyalty-gift-card-P2-lo-9f551--a-gift-card-and-redeems-it-chromium-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: 'Guests', exact: true })
        Expected: visible
        Timeout: 15000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 15000ms
    - waiting for getByRole('heading', { name: 'Guests', exact: true })
      163 |
      164 | // Wait for the main Guests heading to confirm page loaded
         > 165 | await expect(page.getByRole('heading', { name: 'Guests', exact: true })).toBeVisible({
                      |                                                                                  ^
        166 | timeout: 15000,
        167 | });
        168 |
        at /home/runner/work/lole/lole/e2e/p2-loyalty-gift-card.spec.ts:165:82
        Error Context: test-results/p2-loyalty-gift-card-P2-lo-9f551--a-gift-card-and-redeems-it-chromium-retry2/error-context.md
12. [firefox] › e2e/accessibility.spec.ts:133:13 › Accessibility Tests › KDS (Kitchen Display System) › KDS page should have proper heading structure
    TimeoutError: page.waitForSelector: Timeout 30000ms exceeded.
    Call log:
    - waiting for locator('h1')
      136 |
      137 | // Wait for the station board to load
         > 138 | await page.waitForSelector('h1', { state: 'attached', timeout: 30000 });
                      |                        ^
        139 |
        140 | // Check for proper heading hierarchy
        141 | const h1Count = await page.locator('h1').count();
        at /home/runner/work/lole/lole/e2e/accessibility.spec.ts:138:24
        Error Context: test-results/accessibility-Accessibilit-d3bc1-ve-proper-heading-structure-firefox/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        TimeoutError: page.waitForSelector: Timeout 30000ms exceeded.
        Call log:
    - waiting for locator('h1')
      136 |
      137 | // Wait for the station board to load
         > 138 | await page.waitForSelector('h1', { state: 'attached', timeout: 30000 });
                      |                        ^
        139 |
        140 | // Check for proper heading hierarchy
        141 | const h1Count = await page.locator('h1').count();
        at /home/runner/work/lole/lole/e2e/accessibility.spec.ts:138:24
        Error Context: test-results/accessibility-Accessibilit-d3bc1-ve-proper-heading-structure-firefox-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/accessibility-Accessibilit-d3bc1-ve-proper-heading-structure-firefox-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/accessibility-Accessibilit-d3bc1-ve-proper-heading-structure-firefox-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        TimeoutError: page.waitForSelector: Timeout 30000ms exceeded.
        Call log:
    - waiting for locator('h1')
      136 |
      137 | // Wait for the station board to load
         > 138 | await page.waitForSelector('h1', { state: 'attached', timeout: 30000 });
                      |                        ^
        139 |
        140 | // Check for proper heading hierarchy
        141 | const h1Count = await page.locator('h1').count();
        at /home/runner/work/lole/lole/e2e/accessibility.spec.ts:138:24
        Error Context: test-results/accessibility-Accessibilit-d3bc1-ve-proper-heading-structure-firefox-retry2/error-context.md
13. [firefox] › e2e/channels-health-delivery-ack.spec.ts:74:9 › Channels health and delivery acknowledge flow › renders channel health and acknowledges an external order
    Error: expect(locator).toBeVisible() failed
    Locator: getByRole('heading', { name: /Takeout & Delivery/i })
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found
    Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: /Takeout & Delivery/i })
      186 | await page.goto('/merchant/takeout');
      187 |
         > 188 | await expect(page.getByRole('heading', { name: /Takeout & Delivery/i })).toBeVisible();
                      |                                                                                  ^
        189 | await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
        190 | await expect(page.getByRole('button', { name: 'Availability' })).toBeVisible();
        191 | await expect(page.getByRole('button', { name: 'Partner Status' })).toBeVisible();
        at /home/runner/work/lole/lole/e2e/channels-health-delivery-ack.spec.ts:188:82
        Error Context: test-results/channels-health-delivery-a-cf6cb-nowledges-an-external-order-firefox/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: /Takeout & Delivery/i })
        Expected: visible
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: /Takeout & Delivery/i })
      186 | await page.goto('/merchant/takeout');
      187 |
         > 188 | await expect(page.getByRole('heading', { name: /Takeout & Delivery/i })).toBeVisible();
                      |                                                                                  ^
        189 | await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
        190 | await expect(page.getByRole('button', { name: 'Availability' })).toBeVisible();
        191 | await expect(page.getByRole('button', { name: 'Partner Status' })).toBeVisible();
        at /home/runner/work/lole/lole/e2e/channels-health-delivery-ack.spec.ts:188:82
        Error Context: test-results/channels-health-delivery-a-cf6cb-nowledges-an-external-order-firefox-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/channels-health-delivery-a-cf6cb-nowledges-an-external-order-firefox-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/channels-health-delivery-a-cf6cb-nowledges-an-external-order-firefox-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: /Takeout & Delivery/i })
        Expected: visible
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: /Takeout & Delivery/i })
      186 | await page.goto('/merchant/takeout');
      187 |
         > 188 | await expect(page.getByRole('heading', { name: /Takeout & Delivery/i })).toBeVisible();
                      |                                                                                  ^
        189 | await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
        190 | await expect(page.getByRole('button', { name: 'Availability' })).toBeVisible();
        191 | await expect(page.getByRole('button', { name: 'Partner Status' })).toBeVisible();
        at /home/runner/work/lole/lole/e2e/channels-health-delivery-ack.spec.ts:188:82
        Error Context: test-results/channels-health-delivery-a-cf6cb-nowledges-an-external-order-firefox-retry2/error-context.md
14. [firefox] › e2e/example.spec.ts:4:9 › Core web journeys › landing page renders hero and routes merchant CTA to login
    Error: expect(locator).toBeAttached() failed
    Locator: locator('h1').first()
    Expected: attached
    Timeout: 5000ms
    Error: element(s) not found
    Call log:
    - Expect "toBeAttached" with timeout 5000ms
    - waiting for locator('h1').first()
      7 | await expect(page).toHaveTitle(/lole/i);
      8 | // Heading h1 contains nested span so check visible text across the element
         > 9 | await expect(page.locator('h1').first()).toBeAttached();
                     |                                                  ^
        10 |
        11 | // Verify the Sign In link href points to /login (link contract check)
        12 | const signInLink = page.getByRole('link', { name: /^Log in$/ }).first();
        at /home/runner/work/lole/lole/e2e/example.spec.ts:9:50
        Error Context: test-results/example-Core-web-journeys--99068-outes-merchant-CTA-to-login-firefox/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeAttached() failed
        Locator: locator('h1').first()
        Expected: attached
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeAttached" with timeout 5000ms
    - waiting for locator('h1').first()
      7 | await expect(page).toHaveTitle(/lole/i);
      8 | // Heading h1 contains nested span so check visible text across the element
         > 9 | await expect(page.locator('h1').first()).toBeAttached();
                     |                                                  ^
        10 |
        11 | // Verify the Sign In link href points to /login (link contract check)
        12 | const signInLink = page.getByRole('link', { name: /^Log in$/ }).first();
        at /home/runner/work/lole/lole/e2e/example.spec.ts:9:50
        Error Context: test-results/example-Core-web-journeys--99068-outes-merchant-CTA-to-login-firefox-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/example-Core-web-journeys--99068-outes-merchant-CTA-to-login-firefox-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/example-Core-web-journeys--99068-outes-merchant-CTA-to-login-firefox-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeAttached() failed
        Locator: locator('h1').first()
        Expected: attached
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeAttached" with timeout 5000ms
    - waiting for locator('h1').first()
      7 | await expect(page).toHaveTitle(/lole/i);
      8 | // Heading h1 contains nested span so check visible text across the element
         > 9 | await expect(page.locator('h1').first()).toBeAttached();
                     |                                                  ^
        10 |
        11 | // Verify the Sign In link href points to /login (link contract check)
        12 | const signInLink = page.getByRole('link', { name: /^Log in$/ }).first();
        at /home/runner/work/lole/lole/e2e/example.spec.ts:9:50
        Error Context: test-results/example-Core-web-journeys--99068-outes-merchant-CTA-to-login-firefox-retry2/error-context.md
15. [firefox] › e2e/example.spec.ts:22:9 › Core web journeys › login page supports password visibility toggle and sign-up navigation
    Error: expect(locator).toHaveAttribute(expected) failed
    Locator: locator('input[placeholder="Enter your password"]')
    Expected: "text"
    Received: "password"
    Timeout: 5000ms
    Call log:
    - Expect "toHaveAttribute" with timeout 5000ms
    - waiting for locator('input[placeholder="Enter your password"]')
      9 × locator resolved to <input value="" required="" type="password" placeholder="Enter your password" class="font-manrope focus:border-brand-accent focus:ring-brand-accent/5 focus:shadow-brand-accent/10 w-full rounded-xl border border-black/15 bg-white px-12 py-3.5 pr-14 text-base font-medium text-black transition-all outline-none placeholder:text-black/30 focus:shadow-lg focus:ring-4"/> - unexpected value "password"
      30 | await passwordInput.fill('secretpassword');
      31 | await page.getByLabel('Toggle password visibility').click();
         > 32 | await expect(passwordInput).toHaveAttribute('type', 'text');
                     |                                     ^
        33 |
        34 | // Verify the Sign Up link exists and points to /signup
        35 | const signUpLink = page.getByRole('link', { name: /^Sign Up$/i }).first();
        at /home/runner/work/lole/lole/e2e/example.spec.ts:32:37
        Error Context: test-results/example-Core-web-journeys--dd1ee-ggle-and-sign-up-navigation-firefox/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toHaveAttribute(expected) failed
        Locator: locator('input[placeholder="Enter your password"]')
        Expected: "text"
        Received: "password"
        Timeout: 5000ms
        Call log:
    - Expect "toHaveAttribute" with timeout 5000ms
    - waiting for locator('input[placeholder="Enter your password"]')
      9 × locator resolved to <input value="" required="" type="password" placeholder="Enter your password" class="font-manrope focus:border-brand-accent focus:ring-brand-accent/5 focus:shadow-brand-accent/10 w-full rounded-xl border border-black/15 bg-white px-12 py-3.5 pr-14 text-base font-medium text-black transition-all outline-none placeholder:text-black/30 focus:shadow-lg focus:ring-4"/> - unexpected value "password"
      30 | await passwordInput.fill('secretpassword');
      31 | await page.getByLabel('Toggle password visibility').click();
         > 32 | await expect(passwordInput).toHaveAttribute('type', 'text');
                     |                                     ^
        33 |
        34 | // Verify the Sign Up link exists and points to /signup
        35 | const signUpLink = page.getByRole('link', { name: /^Sign Up$/i }).first();
        at /home/runner/work/lole/lole/e2e/example.spec.ts:32:37
        Error Context: test-results/example-Core-web-journeys--dd1ee-ggle-and-sign-up-navigation-firefox-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/example-Core-web-journeys--dd1ee-ggle-and-sign-up-navigation-firefox-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/example-Core-web-journeys--dd1ee-ggle-and-sign-up-navigation-firefox-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toHaveAttribute(expected) failed
        Locator: locator('input[placeholder="Enter your password"]')
        Expected: "text"
        Received: "password"
        Timeout: 5000ms
        Call log:
    - Expect "toHaveAttribute" with timeout 5000ms
    - waiting for locator('input[placeholder="Enter your password"]')
      9 × locator resolved to <input value="" required="" type="password" placeholder="Enter your password" class="font-manrope focus:border-brand-accent focus:ring-brand-accent/5 focus:shadow-brand-accent/10 w-full rounded-xl border border-black/15 bg-white px-12 py-3.5 pr-14 text-base font-medium text-black transition-all outline-none placeholder:text-black/30 focus:shadow-lg focus:ring-4"/> - unexpected value "password"
      30 | await passwordInput.fill('secretpassword');
      31 | await page.getByLabel('Toggle password visibility').click();
         > 32 | await expect(passwordInput).toHaveAttribute('type', 'text');
                     |                                     ^
        33 |
        34 | // Verify the Sign Up link exists and points to /signup
        35 | const signUpLink = page.getByRole('link', { name: /^Sign Up$/i }).first();
        at /home/runner/work/lole/lole/e2e/example.spec.ts:32:37
        Error Context: test-results/example-Core-web-journeys--dd1ee-ggle-and-sign-up-navigation-firefox-retry2/error-context.md
16. [firefox] › e2e/guest-signed-qr-order.spec.ts:4:9 › Signed QR to guest order flow › validates signed QR context and submits guest order
    Error: expect(locator).toBeVisible() failed
    Locator: getByText('Scan Burger')
    Expected: visible
    Timeout: 15000ms
    Error: element(s) not found
    Call log:
    - Expect "toBeVisible" with timeout 15000ms
    - waiting for getByText('Scan Burger')
      106 | }
      107 | // Wait for menu items to load after context is established
         > 108 | await expect(page.getByText('Scan Burger')).toBeVisible({ timeout: 15000 });
                      |                                                     ^
        109 |
        110 | await page.getByText('Scan Burger').first().click();
        111 | await page.getByRole('button', { name: 'Add to Order' }).click();
        at /home/runner/work/lole/lole/e2e/guest-signed-qr-order.spec.ts:108:53
        Error Context: test-results/guest-signed-qr-order-Sign-c24aa-ext-and-submits-guest-order-firefox/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByText('Scan Burger')
        Expected: visible
        Timeout: 15000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 15000ms
    - waiting for getByText('Scan Burger')
      106 | }
      107 | // Wait for menu items to load after context is established
         > 108 | await expect(page.getByText('Scan Burger')).toBeVisible({ timeout: 15000 });
                      |                                                     ^
        109 |
        110 | await page.getByText('Scan Burger').first().click();
        111 | await page.getByRole('button', { name: 'Add to Order' }).click();
        at /home/runner/work/lole/lole/e2e/guest-signed-qr-order.spec.ts:108:53
        Error Context: test-results/guest-signed-qr-order-Sign-c24aa-ext-and-submits-guest-order-firefox-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/guest-signed-qr-order-Sign-c24aa-ext-and-submits-guest-order-firefox-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/guest-signed-qr-order-Sign-c24aa-ext-and-submits-guest-order-firefox-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByText('Scan Burger')
        Expected: visible
        Timeout: 15000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 15000ms
    - waiting for getByText('Scan Burger')
      106 | }
      107 | // Wait for menu items to load after context is established
         > 108 | await expect(page.getByText('Scan Burger')).toBeVisible({ timeout: 15000 });
                      |                                                     ^
        109 |
        110 | await page.getByText('Scan Burger').first().click();
        111 | await page.getByRole('button', { name: 'Add to Order' }).click();
        at /home/runner/work/lole/lole/e2e/guest-signed-qr-order.spec.ts:108:53
        Error Context: test-results/guest-signed-qr-order-Sign-c24aa-ext-and-submits-guest-order-firefox-retry2/error-context.md
17. [firefox] › e2e/guests-directory-profile.spec.ts:74:9 › Guests directory and profile flows › loads guest directory, opens profile drawer, and saves updates
    Error: expect(locator).toBeVisible() failed
    Locator: getByRole('heading', { name: /Guests/i })
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found
    Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: /Guests/i })
      173 | await page.goto('/merchant/guests');
      174 |
         > 175 | await expect(page.getByRole('heading', { name: /Guests/i })).toBeVisible();
                      |                                                                      ^
        176 | await expect(
        177 | page.getByRole('button', { name: /Open guest profile for Selam Guest/i })
        178 | ).toBeVisible();
        at /home/runner/work/lole/lole/e2e/guests-directory-profile.spec.ts:175:70
        Error Context: test-results/guests-directory-profile-G-920bd-le-drawer-and-saves-updates-firefox/error-context.md
        Retry #1 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: /Guests/i })
        Expected: visible
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: /Guests/i })
      173 | await page.goto('/merchant/guests');
      174 |
         > 175 | await expect(page.getByRole('heading', { name: /Guests/i })).toBeVisible();
                      |                                                                      ^
        176 | await expect(
        177 | page.getByRole('button', { name: /Open guest profile for Selam Guest/i })
        178 | ).toBeVisible();
        at /home/runner/work/lole/lole/e2e/guests-directory-profile.spec.ts:175:70
        Error Context: test-results/guests-directory-profile-G-920bd-le-drawer-and-saves-updates-firefox-retry1/error-context.md
        attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
        test-results/guests-directory-profile-G-920bd-le-drawer-and-saves-updates-firefox-retry1/trace.zip
        Usage:
        pnpm exec playwright show-trace test-results/guests-directory-profile-G-920bd-le-drawer-and-saves-updates-firefox-retry1/trace.zip
        ────────────────────────────────────────────────────────────────────────────────────────────────
        Retry #2 ───────────────────────────────────────────────────────────────────────────────────────
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('heading', { name: /Guests/i })
        Expected: visible
        Timeout: 5000ms
        Error: element(s) not found
        Call log:
    - Expect "toBeVisible" with timeout 5000ms
    - waiting for getByRole('heading', { name: /Guests/i })
      173 | await page.goto('/merchant/guests');
      174 |
         > 175 | await expect(page.getByRole('heading', { name: /Guests/i })).toBeVisible();
                      |                                                                      ^
        176 | await expect(
        177 | page.getByRole('button', { name: /Open guest profile for Selam Guest/i })

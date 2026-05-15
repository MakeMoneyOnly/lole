# Payment Direction

Yes, a Terminal is different from the current waiter POS, but for lole it does not need Toast-style proprietary hardware in v1. The right Ethiopia-tailored model is:

- **Guest QR / Guest Menu**: guest-led mobile payment on their own phone.
- **Online ordering**: prepaid digital checkout before order acceptance.
- **Waiter POS**: staff-led order taking plus assisted payment collection.
- **Terminal**: a dedicated settlement-first screen or tablet mode for cashier/checkout, not necessarily separate hardware.

That matches the PRD direction: guest QR users should select a payment method, online ordering should take digital payment up front, and waiter POS should support cash plus Telebirr/Chapa with webhook confirmation.

## What's Already Covered

Already present in Tasks.md or TOAST_FEATURE_AUDIT.md:

- Webhooks and payment confirmation flow
- Split payments
- Contactless payments
- Digital wallets
- Tip-on-device
- Telebirr/Chapa as strategic payment rails
- Hardware/terminal parity gaps

Not explicitly planned enough yet:

- Guest Menu payment-method selector by channel
- QR dine-in pay now vs open tab vs pay later
- Receipt QR closeout flow
- A real Terminal mode/workspace
- Unified payment session/payment intent model across guest, online, and POS
- Provider routing rules like Telebirr first, Chapa fallback, cash always
- Assisted digital payment flow from waiter POS without dedicated card hardware

## Execution Plan

1. **Stabilize the payment core.**
   Add the missing DB/payment state support, finish live Chapa end-to-end, and bring Telebirr to the same webhook-confirmed state.

2. **Introduce a unified payments domain.**
   Create a single payment session model shared by guest QR, online ordering, waiter POS, and terminal, so every flow uses the same lifecycle: `initiated -> pending_provider -> paid/failed/cancelled`.

3. **Build channel-specific UX.**
   For online ordering, require prepayment. For guest QR, support pay now, pay at counter, and later open tab. For waiter POS, support full/split payment capture with cash, Telebirr, and Chapa.

4. **Add Ethiopia-first provider routing.**
   Make Telebirr the primary local-wallet rail where supported, Chapa the broader hosted checkout fallback, and cash always available on staff-operated flows.

5. **Define Terminal as a software mode first.**
   Do not block on special hardware. Build a dedicated checkout surface for cashier/host settlement on any Android tablet, separate from waiter order-taking UX.

6. **Add Toast-inspired advanced flows in the right order.**
   After core reliability is stable, add open-tab/preauth for QR dine-in, receipt QR payment, tip prompts, digital wallets where provider capability exists, and only then contactless/NFC hardware work.

7. **Close the operational loop.**
   Add payment analytics by method/channel, failed-payment recovery, reconciliation hooks, and ERCA-triggered post-payment automation.

If you want, I can take the next implementation step and wire the Guest QR dine-in flow to support real payment method selection instead of only the online storefront path.

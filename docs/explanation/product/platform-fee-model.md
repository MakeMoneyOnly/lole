# lole Platform Fee Model

**Audited and Revised for Addis Ababa operations**

## Verdict

This was not implementation-ready as written.

The original draft had the right strategic direction, but it mixed together four different concerns:

1. Merchant pricing
2. Payment-provider cost
3. Merchant settlement routing
4. Guest checkout choice

If we implemented it as-is, we would create the wrong product contract in Merchant Settings, Guest Menu, Online Ordering, Waiter POS, and Terminal.

## What Was Wrong

### 1. One universal "platform fee" is too blunt

The draft treated `platform_fee_percentage` like a single truth for the whole business. That is too simplistic.

lole will have different commercial behaviors across:

- Chapa-hosted guest checkout
- Staff-collected cash
- Waiter-assisted settlement
- Terminal checkout
- Future provider-specific rails

A single fee field can exist temporarily in code, but it should be treated as a transitional implementation detail, not the final pricing model.

### 2. It assumed every digital payment uses the same split behavior

That is not true operationally.

For v1, we only have strong product evidence for:

- Chapa-hosted payments that can use a lole-managed merchant subaccount

We do not have the same certainty for:

- Telebirr direct flows
- wallet-based settlement destinations
- manual provider-to-lole-to-merchant settlement loops

So the model must not promise that every digital payment follows the same settlement path.

### 3. It mixed guest payment methods with merchant payout setup

These are separate concerns:

- `Guest payment method`: what the customer uses at checkout
- `Merchant payout destination`: where merchant funds settle

The product must never imply that selecting Telebirr, card, or Chapa at checkout changes the merchant payout destination.

### 4. It treated estimated provider fees as if they were system truth

Provider fees should not be modeled as fixed assumptions in the core calculation engine.

We need to distinguish between:

- `quoted or estimated fee` for UX preview
- `contracted fee rule` for pricing policy
- `actual provider fee charged` for reconciliation and reporting

Only the actual fee belongs in final financial reporting.

### 5. It overfit Toast's monetization without enough Ethiopia-specific guardrails

Toast is useful inspiration, but lole operates in a different environment:

- smaller average ticket sizes
- lower pricing tolerance
- higher cash usage
- unstable connectivity
- mixed bank and wallet expectations

So we should copy Toast's structure, not Toast's fee shape.

## Revised North-Star Model

lole should monetize with four separate layers.

### 1. Software plan fee

Monthly per-location SaaS fee.

Examples:

- Starter
- Growth
- Professional
- Enterprise

This pays for POS, KDS, table service, reporting, staff tools, and reliability.

### 2. Hosted checkout fee

A lole fee applied only when lole initiates and manages the digital checkout flow.

For v1 this means:

- Chapa-hosted guest payments

It should not be described in the UI as a fee on every payment in the restaurant.

### 3. Provider fee passthrough or embedded margin

This is the processor cost. It may vary by provider, contract, payment method, and channel.

We should store actual provider fees once available, and use estimates only for previews.

### 4. Optional service fees

Add-on monetization later:

- online ordering package
- SMS updates
- loyalty
- delivery dispatch
- instant settlement
- financing
- premium support

This is much closer to the Toast pattern than trying to maximize the checkout fee alone.

## Recommended V1 Commercial Policy

### V1 pricing posture

Keep the launch model simple and transparent:

- `Monthly plan fee`: fixed per restaurant location
- `Hosted checkout fee`: only on Chapa-hosted guest payments
- `Cash`: no processor fee, no hosted checkout fee
- `Manual staff settlement`: no hosted checkout fee unless lole launches the digital flow

### V1 field mapping

Current code has:

- `restaurants.platform_fee_percentage`

For now, interpret that field as:

- `hosted_checkout_fee_percentage`

Do not describe it in UI or docs as a universal fee on all digital payments.

## Product Policy By Surface

### Merchant Onboarding and Merchant Settings

Collect only the merchant payout bank account that Chapa supports for settlement subaccount creation.

Rules:

- Show supported banks only
- Do not show wallet rails unless Chapa explicitly documents wallet-based subaccounts for this flow
- Explain that lole creates and manages the Chapa settlement subaccount
- Explain that guest payment methods are configured separately

### Guest Menu QR

Guest should choose checkout behavior, not see settlement internals.

Supported concepts:

- Pay online now
- Pay at counter
- Pay with waiter

The guest does not need to know the merchant payout bank or subaccount arrangement.

### Online Ordering

Treat this as a checkout surface, not a payout surface.

Current policy:

- prepaid digital checkout by default
- payment methods shown inside secure checkout
- merchant payout remains separate

### Waiter POS

Waiter POS should focus on tender handling and service flow.

Examples:

- cash
- digital checkout
- other/manual tender

Do not imply that the waiter is choosing a merchant settlement rail.

### Terminal

Terminal is an operator tender surface.

It should present:

- cash
- digital checkout
- other/manual tender

Again, this is about how the guest settles the bill, not how the merchant receives provider settlement.

## Recommended Data Model

### Transitional v1 model

Keep the existing `platform_fee_percentage` field for now, but constrain its meaning in code and UI.

Add payment-level reporting fields:

```sql
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS gross_amount numeric(12,2),
    ADD COLUMN IF NOT EXISTS provider_fee_amount numeric(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS platform_fee_amount numeric(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS net_amount numeric(12,2),
    ADD COLUMN IF NOT EXISTS fee_breakdown jsonb DEFAULT '{}'::jsonb;
```

Recommended `fee_breakdown` semantics:

```json
{
    "surface": "guest_qr",
    "checkout_mode": "hosted",
    "provider": "chapa",
    "provider_fee_estimated": false,
    "provider_fee_rate": 0.018,
    "provider_fee_amount": 18,
    "platform_fee_rate": 0.03,
    "platform_fee_amount": 30,
    "net_amount": 952
}
```

### Target model after v1

Move to explicit pricing tables instead of a single percentage field.

Recommended entities:

- `pricing_plans`
- `restaurant_pricing_assignments`
- `checkout_fee_rules`
- `provider_fee_rules` for estimates or contracted defaults
- `payment_fee_ledger` for actual charged fees

## Implementation Rules

### Rule 1: settlement eligibility must be server-enforced

If Chapa settlement subaccounts only support bank-style destinations, backend validation must reject unsupported payout destinations even if the provider directory is noisy.

### Rule 2: pricing copy must match actual scope

Do not say:

- "Every customer payment uses a fixed 3% platform fee"

Say:

- "Current hosted checkout fee"
- "applies to Chapa-hosted guest payments"

### Rule 3: guest UI must not expose internal processor assumptions

The guest should see:

- pay now
- pay later
- pay with waiter
- secure checkout

The guest should not be taught the merchant's payout architecture.

### Rule 4: fee reporting must separate estimate from actual

Merchant reporting should distinguish:

- gross sales
- provider fees
- lole fees
- net payout
- payout status

But only finalized transactions should use actual provider fee values.

## Revised Roadmap

### Phase 1: Correct the product contract

- Filter unsupported wallet rails from payout setup
- Update Merchant Settings and onboarding copy
- Update guest and staff payment wording to say "checkout" or "pay now", not settlement
- Treat `platform_fee_percentage` as hosted checkout fee in product language

### Phase 2: Payment-level reporting

- Store gross, provider fee, platform fee, and net per payment
- Add merchant payout summary
- Add platform fee analytics

### Phase 3: Real pricing model

- Introduce plan assignments
- Introduce surface-aware fee rules
- Support enterprise overrides safely

### Phase 4: Optional monetization layers

- online ordering package
- premium support
- loyalty and messaging
- instant settlement
- financing

## Concrete UI Copy Requirements

### Merchant Settings

Use wording like:

- "Payout bank"
- "Account holder name"
- "lole creates and manages this restaurant's Chapa settlement subaccount."
- "Guest payment methods stay separate from this payout setup."

### Guest Menu and Online Ordering

Use wording like:

- "Pay online now"
- "Continue to secure checkout"
- "Available options there may include card or supported wallets"

### Waiter POS and Terminal

Use wording like:

- "Digital checkout"
- "Cash"
- "Other/manual tender"

Not:

- settlement bank
- payout account
- split settlement

## Final Recommendation

lole should take inspiration from Toast in structure, not by blindly copying a blended transaction fee strategy.

The correct platform model is:

- SaaS fee for operating system value
- hosted checkout fee where lole actually runs the payment flow
- provider-fee awareness for reconciliation
- separate merchant payout configuration
- separate guest checkout choice

That is the model we can safely implement across Merchant Settings, Guest Menu, Online Ordering, Waiter POS, and Terminal without creating product debt or misleading merchants.

# lole — Database Schema

**Version 1.0 · March 2026**

---

## Schema Conventions

These conventions apply to every table without exception:

| Convention          | Rule                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **restaurant_id**   | Every table has `restaurant_id UUID NOT NULL REFERENCES restaurants(id)` — no exceptions  |
| **Monetary values** | All money stored as `INTEGER` in Santim (100 santim = 1 ETB). Never `FLOAT` or `DECIMAL`. |
| **Primary keys**    | UUID — `DEFAULT gen_random_uuid()`                                                        |
| **Timestamps**      | `created_at TIMESTAMPTZ DEFAULT NOW()` on every table. `updated_at` where relevant.       |
| **Soft deletes**    | `is_active BOOLEAN DEFAULT true` — records are deactivated, not deleted.                  |
| **Bilingual text**  | All user-facing names have `name TEXT` (English) and `name_am TEXT` (Amharic).            |
| **RLS**             | `ALTER TABLE {name} ENABLE ROW LEVEL SECURITY` on every table.                            |
| **Idempotency**     | All order and payment mutations include an `idempotency_key TEXT UNIQUE`.                 |

---

## Core Domains

### Restaurants

```sql
CREATE TABLE restaurants (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    TEXT NOT NULL UNIQUE,          -- used in QR URLs
  name                    TEXT NOT NULL,                 -- English name
  name_am                 TEXT,                          -- Amharic name: e.g., 'ካፌ ሉቺያ'
  address                 TEXT,
  address_am              TEXT,
  phone                   TEXT,
  email                   TEXT,
  logo_url                TEXT,                          -- Cloudflare R2 URL
  cover_image_url         TEXT,
  timezone                TEXT DEFAULT 'Africa/Addis_Ababa',
  currency_code           CHAR(3) DEFAULT 'ETB',
  vat_number              TEXT,                          -- ERCA VAT registration number
  tin_number              TEXT,                          -- Ethiopian Tax Identification Number
  owner_telegram_id       TEXT,                          -- For EOD reports via Telegram
  plan                    TEXT DEFAULT 'starter'
    CHECK (plan IN ('starter','pro','business','enterprise')),
  plan_expires_at         TIMESTAMPTZ,
  chapa_subscription_id   TEXT,
  is_active               BOOLEAN DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE restaurant_settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL UNIQUE REFERENCES restaurants(id),
  settings                JSONB DEFAULT '{}',
  -- settings keys include:
  -- dashboard_preset: 'owner' | 'manager' | 'kitchen_lead'
  -- kds_stations: string[]
  -- receipt_footer_am: string
  -- receipt_footer_en: string
  -- loyalty_enabled: boolean
  -- online_ordering_enabled: boolean
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

### Tables (Physical Restaurant Tables)

```sql
CREATE TABLE tables (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  table_number            TEXT NOT NULL,                 -- 'A1', 'B3', '12', etc.
  label                   TEXT,                          -- Display label (can differ from number)
  capacity                INTEGER,
  section                 TEXT,                          -- 'Indoor', 'Outdoor', 'Terrace'
  is_active               BOOLEAN DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (restaurant_id, table_number)
);

-- QR code sessions (one per table scan — 24h window)
CREATE TABLE table_sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  table_id                UUID NOT NULL REFERENCES tables(id),
  opened_at               TIMESTAMPTZ DEFAULT NOW(),
  closed_at               TIMESTAMPTZ,
  revenue_santim          INTEGER DEFAULT 0,
  order_count             INTEGER DEFAULT 0
);

ALTER TABLE tables         ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;
```

---

### Staff & Roles

```sql
CREATE TABLE restaurant_staff (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  user_id                 UUID REFERENCES auth.users(id),  -- NULL for PIN-only staff
  full_name               TEXT NOT NULL,
  role                    TEXT NOT NULL
    CHECK (role IN ('owner','admin','manager','kitchen','bar','waiter')),
  pin_code                TEXT,                           -- 4-digit PIN for POS login
  is_active               BOOLEAN DEFAULT true,
  hired_at                DATE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE time_entries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  staff_id                UUID NOT NULL REFERENCES restaurant_staff(id),
  clocked_in_at           TIMESTAMPTZ NOT NULL,
  clocked_out_at          TIMESTAMPTZ,
  duration_minutes        INTEGER GENERATED ALWAYS AS (
    CASE WHEN clocked_out_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (clocked_out_at - clocked_in_at))::INTEGER / 60
    ELSE NULL END
  ) STORED,
  notes                   TEXT
);

CREATE TABLE schedules (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  staff_id                UUID NOT NULL REFERENCES restaurant_staff(id),
  shift_date              DATE NOT NULL,
  start_time              TIME NOT NULL,
  end_time                TIME NOT NULL,
  station                 TEXT,                          -- 'waiter', 'kitchen', 'bar', etc.
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE restaurant_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules        ENABLE ROW LEVEL SECURITY;
```

---

### Menu

```sql
CREATE TABLE categories (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  name                    TEXT NOT NULL,                 -- English
  name_am                 TEXT,                          -- Amharic: e.g., 'መጠጥ', 'ምሳ', 'ቁርስ'
  image_url               TEXT,
  sort_order              INTEGER DEFAULT 0,
  kds_station             TEXT,                          -- Routes items to kitchen/bar/coffee/dessert
  is_active               BOOLEAN DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE menu_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  category_id             UUID NOT NULL REFERENCES categories(id),
  name                    TEXT NOT NULL,                 -- English
  name_am                 TEXT,                          -- Amharic: e.g., 'ቅቅል ዶሮ'
  description             TEXT,
  description_am          TEXT,
  price                   INTEGER NOT NULL,              -- in SANTIM (100 santim = 1 ETB)
  image_url               TEXT,
  is_available            BOOLEAN DEFAULT true,
  is_featured             BOOLEAN DEFAULT false,
  sort_order              INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Modifier groups (replaces JSONB — migrated from menu_items.modifiers)
CREATE TABLE modifier_groups (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  menu_item_id            UUID NOT NULL REFERENCES menu_items(id),
  name                    TEXT NOT NULL,
  name_am                 TEXT,
  required                BOOLEAN DEFAULT false,
  multi_select            BOOLEAN DEFAULT false,
  min_select              INTEGER DEFAULT 0,
  max_select              INTEGER,
  sort_order              INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE modifier_options (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  modifier_group_id       UUID NOT NULL REFERENCES modifier_groups(id),
  name                    TEXT NOT NULL,
  name_am                 TEXT,
  price_adjustment        INTEGER DEFAULT 0,             -- in SANTIM (can be negative)
  is_available            BOOLEAN DEFAULT true,
  sort_order              INTEGER DEFAULT 0
);

-- Full-text search indexes
CREATE INDEX idx_menu_items_am
  ON menu_items USING gin(to_tsvector('simple', COALESCE(name_am, '')));

CREATE INDEX idx_menu_items_bilingual
  ON menu_items USING gin(
    to_tsvector('simple', COALESCE(name_am,'') || ' ' || COALESCE(name,''))
  );

CREATE INDEX idx_menu_items_restaurant_available
  ON menu_items (restaurant_id, is_available, category_id);

ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_options ENABLE ROW LEVEL SECURITY;
```

---

### Orders

```sql
CREATE TABLE orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  table_id                UUID REFERENCES tables(id),
  table_session_id        UUID REFERENCES table_sessions(id),
  order_number            TEXT NOT NULL,                 -- human-readable '#0042'
  status                  TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','preparing','ready','served','cancelled')),
  type                    TEXT NOT NULL DEFAULT 'dine_in'
    CHECK (type IN ('dine_in','takeaway','delivery')),
  total_price             INTEGER NOT NULL DEFAULT 0,    -- in SANTIM
  discount_id             UUID REFERENCES discounts(id),
  discount_amount         INTEGER DEFAULT 0,             -- in SANTIM
  notes                   TEXT,
  guest_id                UUID REFERENCES guests(id),
  guest_fingerprint       TEXT,                          -- for anonymous guests
  staff_id                UUID REFERENCES restaurant_staff(id),
  delivery_partner_id     UUID REFERENCES delivery_partners(id),
  external_order_id       TEXT,                          -- delivery platform's own ID
  idempotency_key         TEXT UNIQUE NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  order_id                UUID NOT NULL REFERENCES orders(id),
  menu_item_id            UUID NOT NULL REFERENCES menu_items(id),
  quantity                INTEGER NOT NULL CHECK (quantity > 0),
  unit_price              INTEGER NOT NULL,              -- in SANTIM at time of order
  item_total              INTEGER GENERATED ALWAYS AS (quantity * unit_price) STORED,
  modifiers               JSONB,                         -- selected modifier names + prices
  notes                   TEXT,
  status                  TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','started','held','ready','served')),
  kds_station             TEXT,
  idempotency_key         TEXT UNIQUE NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Critical indexes for POS performance
CREATE INDEX idx_orders_restaurant_status
  ON orders (restaurant_id, status, created_at DESC);

CREATE INDEX idx_orders_restaurant_date
  ON orders (restaurant_id, created_at DESC);

CREATE INDEX idx_order_items_order
  ON order_items (order_id);

CREATE INDEX idx_order_items_kds_station
  ON order_items (restaurant_id, kds_station, status);

ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
```

---

### Payments & Finance

```sql
CREATE TABLE payments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  order_id                UUID NOT NULL REFERENCES orders(id),
  amount                  INTEGER NOT NULL,              -- in SANTIM
  currency_code           CHAR(3) DEFAULT 'ETB',
  method                  TEXT NOT NULL
    CHECK (method IN ('cash','telebirr','chapa','cbe_birr','amole','card')),
  provider                TEXT,                          -- 'internal', 'chapa', 'telebirr', 'cbe'
  provider_transaction_id TEXT,                          -- provider's own TX ID (for webhook matching)
  status                  TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','captured','failed','refunded')),
  captured_at             TIMESTAMPTZ,
  idempotency_key         TEXT UNIQUE NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE refunds (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  payment_id              UUID NOT NULL REFERENCES payments(id),
  amount                  INTEGER NOT NULL,              -- in SANTIM
  reason                  TEXT,
  initiated_by            UUID REFERENCES restaurant_staff(id),
  status                  TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','processed','failed')),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payouts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  provider                TEXT NOT NULL,
  amount                  INTEGER NOT NULL,              -- in SANTIM
  status                  TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  period_start            TIMESTAMPTZ,
  period_end              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reconciliation_entries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  source_type             TEXT NOT NULL
    CHECK (source_type IN ('payment','payout','refund')),
  source_id               UUID NOT NULL,
  amount                  INTEGER NOT NULL,              -- in SANTIM
  status                  TEXT DEFAULT 'pending',
  reconciled_at           TIMESTAMPTZ
);

-- Discounts
CREATE TABLE discounts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  name                    TEXT NOT NULL,
  name_am                 TEXT,
  type                    TEXT NOT NULL
    CHECK (type IN ('percentage','fixed_amount','bogo','item_override')),
  value                   INTEGER NOT NULL,              -- basis points (pct) or santim (fixed)
  applies_to              TEXT CHECK (applies_to IN ('order','item','category')),
  requires_manager_pin    BOOLEAN DEFAULT false,
  max_uses_per_day        INTEGER,
  valid_from              TIMESTAMPTZ DEFAULT NOW(),
  valid_until             TIMESTAMPTZ,
  is_active               BOOLEAN DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_order     ON payments (order_id, status);
CREATE INDEX idx_payments_restaurant ON payments (restaurant_id, created_at DESC);
CREATE INDEX idx_payments_provider_tx ON payments (provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;

ALTER TABLE payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds                ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts              ENABLE ROW LEVEL SECURITY;
```

---

### Guests & Loyalty

```sql
CREATE TABLE guests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  user_id                 UUID REFERENCES auth.users(id),  -- NULL for anonymous
  full_name               TEXT,
  phone                   TEXT,
  email                   TEXT,
  first_visit_at          TIMESTAMPTZ DEFAULT NOW(),
  last_visit_at           TIMESTAMPTZ DEFAULT NOW(),
  visit_count             INTEGER DEFAULT 1,
  lifetime_value_santim   INTEGER DEFAULT 0,
  tin_number              TEXT,                          -- for B2B invoicing
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE guest_menu_sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  table_id                UUID NOT NULL REFERENCES tables(id),
  guest_id                UUID REFERENCES guests(id),    -- NULL for anonymous
  guest_fingerprint       TEXT,                          -- device fingerprint for anonymous
  started_at              TIMESTAMPTZ DEFAULT NOW(),
  ended_at                TIMESTAMPTZ,
  is_active               BOOLEAN DEFAULT true
);

-- Loyalty system
CREATE TABLE loyalty_programs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL UNIQUE REFERENCES restaurants(id),
  name                    TEXT NOT NULL,
  name_am                 TEXT,
  points_rule_json        JSONB DEFAULT '{"points_per_currency_unit": 1}',
  -- points_per_currency_unit: points earned per 1 ETB spent
  tier_rule_json          JSONB DEFAULT '{}',
  -- tier thresholds: {"silver": 500, "gold": 2000, "platinum": 10000}
  status                  TEXT DEFAULT 'active'
    CHECK (status IN ('draft','active','paused','archived')),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loyalty_accounts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  guest_id                UUID NOT NULL REFERENCES guests(id),
  program_id              UUID NOT NULL REFERENCES loyalty_programs(id),
  points_balance          INTEGER DEFAULT 0 CHECK (points_balance >= 0),
  tier                    TEXT DEFAULT 'base'
    CHECK (tier IN ('base','silver','gold','platinum')),
  status                  TEXT DEFAULT 'active'
    CHECK (status IN ('active','suspended','closed')),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (guest_id, program_id)
);

CREATE TABLE loyalty_transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  account_id              UUID NOT NULL REFERENCES loyalty_accounts(id),
  order_id                UUID REFERENCES orders(id),
  points                  INTEGER NOT NULL,              -- positive = earned, negative = redeemed
  transaction_type        TEXT NOT NULL
    CHECK (transaction_type IN ('earn','redeem','adjust','expire')),
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loyalty_accounts_guest
  ON loyalty_accounts (guest_id, restaurant_id) WHERE status = 'active';

CREATE INDEX idx_loyalty_transactions_account
  ON loyalty_transactions (account_id, created_at DESC);

ALTER TABLE guests               ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_menu_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_programs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
```

---

### Inventory

```sql
CREATE TABLE inventory_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  name                    TEXT NOT NULL,
  name_am                 TEXT,
  sku                     TEXT,
  unit                    TEXT NOT NULL,                 -- 'kg', 'liter', 'piece', 'gram', 'ml'
  current_stock           NUMERIC NOT NULL DEFAULT 0,
  reorder_level           NUMERIC,                       -- Alert triggered at this level
  cost_per_unit_santim    INTEGER,                       -- cost tracking in santim
  supplier_id             UUID REFERENCES suppliers(id),
  is_active               BOOLEAN DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE suppliers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  name                    TEXT NOT NULL,
  phone                   TEXT,
  email                   TEXT,
  address                 TEXT,
  is_active               BOOLEAN DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recipes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  menu_item_id            UUID NOT NULL UNIQUE REFERENCES menu_items(id),
  name                    TEXT,
  yield_quantity          NUMERIC DEFAULT 1,             -- how many servings per recipe batch
  is_active               BOOLEAN DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recipe_ingredients (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  recipe_id               UUID NOT NULL REFERENCES recipes(id),
  inventory_item_id       UUID NOT NULL REFERENCES inventory_items(id),
  qty_per_recipe          NUMERIC NOT NULL CHECK (qty_per_recipe > 0),
  unit                    TEXT NOT NULL
);

CREATE TABLE stock_movements (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  inventory_item_id       UUID NOT NULL REFERENCES inventory_items(id),
  movement_type           TEXT NOT NULL
    CHECK (movement_type IN ('in','out','adjustment','waste','count')),
  quantity                NUMERIC NOT NULL,
  unit_cost_santim        INTEGER,
  reference_id            UUID,                          -- order_id, purchase_order_id, etc.
  notes                   TEXT,
  created_by              UUID REFERENCES restaurant_staff(id),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  supplier_id             UUID REFERENCES suppliers(id),
  status                  TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','sent','received','cancelled')),
  total_cost_santim       INTEGER DEFAULT 0,
  ordered_at              TIMESTAMPTZ,
  received_at             TIMESTAMPTZ,
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders  ENABLE ROW LEVEL SECURITY;
```

---

### Delivery Channels

```sql
CREATE TABLE delivery_partners (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  provider                TEXT NOT NULL
    CHECK (provider IN ('beu','deliver_addis','zmall','esoora','custom_local')),
  display_name            TEXT,
  api_key                 TEXT,                          -- encrypted at rest
  webhook_secret          TEXT,                          -- for verifying their webhooks
  status                  TEXT DEFAULT 'active'
    CHECK (status IN ('active','paused','inactive')),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE external_orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id),
  delivery_partner_id     UUID REFERENCES delivery_partners(id),
  order_id                UUID REFERENCES orders(id),   -- linked lole order
  provider                TEXT NOT NULL,
  provider_order_id       TEXT NOT NULL,
  normalized_status       TEXT,
  raw_payload             JSONB,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, provider_order_id)
);

CREATE TABLE online_ordering_settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL UNIQUE REFERENCES restaurants(id),
  is_active               BOOLEAN DEFAULT true,
  estimated_wait_minutes  INTEGER DEFAULT 30,
  minimum_order_santim    INTEGER DEFAULT 0,
  delivery_fee_santim     INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE delivery_partners        ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_ordering_settings ENABLE ROW LEVEL SECURITY;
```

---

### Analytics (TimescaleDB)

```sql
-- Enable TimescaleDB extension (once, in Supabase Dashboard → Extensions)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert orders to hypertable (partitioned by created_at day)
SELECT create_hypertable('orders', 'created_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Compress chunks older than 30 days (frees ~90% storage)
SELECT add_compression_policy('orders', INTERVAL '30 days');

-- Continuous aggregate: hourly revenue per restaurant
-- Auto-refreshes every 30 minutes, lag of 1 hour
CREATE MATERIALIZED VIEW hourly_sales
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', created_at)  AS hour,
  restaurant_id,
  SUM(total_price)                   AS revenue_santim,
  COUNT(*)                           AS order_count,
  AVG(total_price)::INTEGER          AS avg_order_santim
FROM orders
WHERE status = 'completed'
GROUP BY hour, restaurant_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('hourly_sales',
  start_offset      => INTERVAL '3 hours',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '30 minutes'
);

-- Analytics events (append-only, high volume)
CREATE TABLE analytics_events (
  id            BIGSERIAL,
  restaurant_id UUID NOT NULL,
  event_type    TEXT NOT NULL,
  -- event_type values: 'item_viewed', 'order_started', 'payment_method_selected',
  --                    'qr_scanned', 'loyalty_enrolled', 'menu_searched'
  payload       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('analytics_events', 'created_at',
  chunk_time_interval => INTERVAL '1 day'
);

SELECT add_retention_policy('analytics_events', INTERVAL '90 days');
```

---

### Database Triggers

```sql
-- 1. Auto-deduct inventory when order is confirmed
CREATE OR REPLACE FUNCTION deduct_inventory_on_order_confirm()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    INSERT INTO stock_movements (
      id, restaurant_id, inventory_item_id,
      movement_type, quantity, reference_id, created_at
    )
    SELECT
      gen_random_uuid(), oi.restaurant_id, ri.inventory_item_id,
      'out', ri.qty_per_recipe * oi.quantity, NEW.id, NOW()
    FROM order_items oi
    JOIN recipes r           ON r.menu_item_id = oi.menu_item_id AND r.is_active = true
    JOIN recipe_ingredients ri ON ri.recipe_id = r.id
    WHERE oi.order_id = NEW.id;

    UPDATE inventory_items ii
    SET current_stock = ii.current_stock - totals.qty
    FROM (
      SELECT inventory_item_id, SUM(quantity) AS qty
      FROM stock_movements WHERE reference_id = NEW.id AND movement_type = 'out'
      GROUP BY inventory_item_id
    ) totals
    WHERE ii.id = totals.inventory_item_id;

    -- Notify for low-stock check
    PERFORM pg_notify('inventory_check',
      json_build_object('restaurant_id', NEW.restaurant_id)::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_deduct_inventory
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION deduct_inventory_on_order_confirm();

-- 2. Auto-create reconciliation entry when payment is captured
CREATE OR REPLACE FUNCTION create_reconciliation_on_capture()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'captured' AND OLD.status != 'captured' THEN
    INSERT INTO reconciliation_entries (
      id, restaurant_id, source_type, source_id, amount, status, reconciled_at
    ) VALUES (
      gen_random_uuid(), NEW.restaurant_id,
      'payment', NEW.id, NEW.amount, 'reconciled', NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_reconcile_payment
  AFTER UPDATE OF status ON payments
  FOR EACH ROW EXECUTE FUNCTION create_reconciliation_on_capture();

-- 3. Update guest lifetime_value on order completion
CREATE OR REPLACE FUNCTION update_guest_lifetime_value()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'served' AND OLD.status != 'served' AND NEW.guest_id IS NOT NULL THEN
    UPDATE guests
    SET
      lifetime_value_santim = lifetime_value_santim + NEW.total_price,
      last_visit_at = NOW(),
      visit_count = visit_count + 1
    WHERE id = NEW.guest_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_guest_value
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION update_guest_lifetime_value();

-- 4. Auto-update updated_at on key tables
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_restaurants_updated_at
  BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_menu_items_updated_at
  BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

### Row Level Security Policies

```sql
-- Template policy (replicated for every table)
-- Staff can only see data for restaurants they belong to

CREATE POLICY "restaurant_staff_isolation" ON orders
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM restaurant_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Guest can only see their own session data
CREATE POLICY "guest_own_session" ON guest_menu_sessions
  FOR SELECT TO authenticated
  USING (guest_id IN (
    SELECT id FROM guests WHERE user_id = auth.uid()
  ));

-- Guest order tracking — guests can read their own orders
CREATE POLICY "guest_order_read" ON orders
  FOR SELECT
  USING (
    guest_id IN (SELECT id FROM guests WHERE user_id = auth.uid())
    OR guest_fingerprint = current_setting('app.guest_fingerprint', true)
  );
```

---

### Migration Execution Order

Run migrations in this exact sequence. Each migration depends on the previous.

```
001_restaurants.sql              -- restaurants, restaurant_settings
002_tables.sql                   -- tables, table_sessions
003_staff.sql                    -- restaurant_staff, time_entries, schedules
004_categories.sql               -- categories
005_menu_items.sql               -- menu_items
006_modifier_tables.sql          -- modifier_groups, modifier_options (replaces JSONB)
007_guests.sql                   -- guests, guest_menu_sessions
008_orders.sql                   -- orders, order_items
009_discounts.sql                -- discounts
010_payments.sql                 -- payments, refunds, payouts, reconciliation_entries
011_loyalty.sql                  -- loyalty_programs, loyalty_accounts, loyalty_transactions
012_inventory.sql                -- inventory_items, suppliers, recipes, recipe_ingredients
                                    stock_movements, purchase_orders
013_channels.sql                 -- delivery_partners, external_orders, online_ordering_settings
014_timescaledb.sql              -- hypertables, continuous aggregates, analytics_events
015_triggers.sql                 -- all database triggers
016_rls_policies.sql             -- all RLS policies
017_santim_migration.sql         -- convert DECIMAL → INTEGER santim (run on existing data)
018_bilingual_columns.sql        -- add name_am columns to all user-facing tables
019_subscription_columns.sql     -- add plan, plan_expires_at to restaurants
```

---

_lole Database Schema v1.0 · March 2026_

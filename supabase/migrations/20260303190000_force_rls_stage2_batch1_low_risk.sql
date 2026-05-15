-- Stage 2 (Batch 1): FORCE RLS rollout on low-risk, authenticated-only tenant tables.
-- Scope intentionally excludes core hot-path tables (orders/payments/table_sessions/kds_*)
-- and guest-facing mutation surfaces for first-wave risk reduction.

alter table if exists public.agency_users force row level security;
alter table if exists public.alert_events force row level security;
alter table if exists public.alert_rules force row level security;
alter table if exists public.delivery_partners force row level security;
alter table if exists public.inventory_items force row level security;
alter table if exists public.purchase_orders force row level security;
alter table if exists public.recipe_ingredients force row level security;
alter table if exists public.recipes force row level security;
alter table if exists public.shifts force row level security;
alter table if exists public.stock_movements force row level security;
alter table if exists public.supplier_invoices force row level security;
alter table if exists public.support_tickets force row level security;

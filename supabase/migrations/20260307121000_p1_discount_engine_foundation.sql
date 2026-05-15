-- ============================================================================
-- P1 Discount Engine Foundation
-- Date: 2026-03-07
-- Purpose: Creates the discounts table with RLS policies (staff read, manager write),
--          and adds discount_id and discount_amount columns to the orders table.
-- Impact: public.discounts (new table), public.orders (discount_id, discount_amount columns)
-- Rollback: DROP TABLE IF EXISTS public.discounts;
--           ALTER TABLE public.orders DROP COLUMN IF EXISTS discount_id;
--           ALTER TABLE public.orders DROP COLUMN IF EXISTS discount_amount;
-- ============================================================================

create table if not exists public.discounts (
    id uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references public.restaurants(id) on delete cascade,
    name text not null,
    name_am text,
    type text not null check (type in ('percentage', 'fixed_amount', 'bogo', 'item_override')),
    value integer not null,
    applies_to text not null default 'order' check (applies_to in ('order', 'item', 'category')),
    target_menu_item_id uuid references public.menu_items(id) on delete set null,
    target_category_id uuid references public.categories(id) on delete set null,
    requires_manager_pin boolean not null default false,
    max_uses_per_day integer,
    valid_from timestamptz,
    valid_until timestamptz,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_discounts_restaurant_active
    on public.discounts (restaurant_id, is_active, created_at desc);

create index if not exists idx_discounts_target_menu_item
    on public.discounts (target_menu_item_id)
    where target_menu_item_id is not null;

create index if not exists idx_discounts_target_category
    on public.discounts (target_category_id)
    where target_category_id is not null;

alter table public.discounts enable row level security;
alter table public.discounts force row level security;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'discounts'
          and policyname = 'discounts_staff_select'
    ) then
        create policy discounts_staff_select
            on public.discounts
            for select
            to authenticated
            using (
                exists (
                    select 1
                    from public.restaurant_staff rs
                    where rs.restaurant_id = discounts.restaurant_id
                      and rs.user_id = (select auth.uid())
                      and rs.is_active = true
                )
            );
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'discounts'
          and policyname = 'discounts_manager_write'
    ) then
        create policy discounts_manager_write
            on public.discounts
            for all
            to authenticated
            using (
                exists (
                    select 1
                    from public.restaurant_staff rs
                    where rs.restaurant_id = discounts.restaurant_id
                      and rs.user_id = (select auth.uid())
                      and rs.is_active = true
                      and rs.role in ('owner', 'admin', 'manager')
                )
            )
            with check (
                exists (
                    select 1
                    from public.restaurant_staff rs
                    where rs.restaurant_id = discounts.restaurant_id
                      and rs.user_id = (select auth.uid())
                      and rs.is_active = true
                      and rs.role in ('owner', 'admin', 'manager')
                )
            );
    end if;
end
$$;

alter table public.orders
    add column if not exists discount_id uuid references public.discounts(id) on delete set null;

alter table public.orders
    add column if not exists discount_amount integer not null default 0;

create index if not exists idx_orders_discount_id
    on public.orders (discount_id)
    where discount_id is not null;

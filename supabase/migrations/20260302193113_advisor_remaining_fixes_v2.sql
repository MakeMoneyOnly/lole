-- Persisted from remote migration history for parity across environments.
-- Security + policy cleanup made idempotent for fresh environments.

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'orders' and policyname = 'Guests can create orders'
  ) then
    execute $sql$
      alter policy "Guests can create orders" on public.orders
      with check (restaurant_id is not null and status in ('pending', 'draft'))
    $sql$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'restaurants' and policyname = 'Authenticated can create restaurants'
  ) then
    execute $sql$
      alter policy "Authenticated can create restaurants" on public.restaurants
      with check (name is not null and slug is not null)
    $sql$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reviews' and policyname = 'Authenticated can insert reviews'
  ) then
    execute $sql$
      alter policy "Authenticated can insert reviews" on public.reviews
      with check (restaurant_id is not null and rating is not null and rating between 1 and 5)
    $sql$;
  end if;
end
$$;

drop policy if exists "Anyone can view categories" on public.categories;
drop policy if exists "Anyone can view tables" on public.tables;
drop policy if exists "Public Read Menu" on public.menu_items;

drop index if exists public.idx_audit_log_created_at;
alter table if exists public.orders drop constraint if exists orders_idempotency_key_key;

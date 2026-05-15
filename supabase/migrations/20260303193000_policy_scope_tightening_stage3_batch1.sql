-- Stage 3 (Batch 1): tighten policy role scopes from public -> authenticated
-- where predicates already depend on auth.uid() and are not intended for anon flows.
-- This reduces anonymous mutating surface without changing policy logic.

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agency_users'
      and policyname = 'Admins can insert agency users'
  ) then
    execute 'alter policy "Admins can insert agency users" on public.agency_users to authenticated';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agency_users'
      and policyname = 'Admins can update agency users'
  ) then
    execute 'alter policy "Admins can update agency users" on public.agency_users to authenticated';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agency_users'
      and policyname = 'Admins can delete agency users'
  ) then
    execute 'alter policy "Admins can delete agency users" on public.agency_users to authenticated';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hardware_devices'
      and policyname = 'Managers and owners can insert devices'
  ) then
    execute 'alter policy "Managers and owners can insert devices" on public.hardware_devices to authenticated';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hardware_devices'
      and policyname = 'Managers and owners can update devices'
  ) then
    execute 'alter policy "Managers and owners can update devices" on public.hardware_devices to authenticated';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hardware_devices'
      and policyname = 'Managers and owners can delete devices'
  ) then
    execute 'alter policy "Managers and owners can delete devices" on public.hardware_devices to authenticated';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stations'
      and policyname = 'Admins can insert stations'
  ) then
    execute 'alter policy "Admins can insert stations" on public.stations to authenticated';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stations'
      and policyname = 'Admins can update stations'
  ) then
    execute 'alter policy "Admins can update stations" on public.stations to authenticated';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stations'
      and policyname = 'Admins can delete stations'
  ) then
    execute 'alter policy "Admins can delete stations" on public.stations to authenticated';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'restaurants'
      and policyname = 'Admins can delete restaurants'
  ) then
    execute 'alter policy "Admins can delete restaurants" on public.restaurants to authenticated';
  end if;
end
$$;

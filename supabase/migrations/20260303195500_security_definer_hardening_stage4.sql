-- Stage 4: harden SECURITY DEFINER functions previously using search_path=public.
-- Changes:
-- - explicit secure search_path = pg_catalog, public
-- - schema-qualified table references in function bodies

create or replace function public.bootstrap_merchant_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
    base_slug text;
    restaurant_slug text;
    restaurant_name text;
    v_restaurant_id uuid;
begin
    base_slug := regexp_replace(lower(coalesce(split_part(NEW.email, '@', 1), 'merchant')), '[^a-z0-9]+', '-', 'g');
    base_slug := trim(both '-' from base_slug);
    if base_slug = '' then
        base_slug := 'merchant';
    end if;

    restaurant_slug := base_slug || '-' || substring(NEW.id::text from 1 for 8);
    restaurant_name := coalesce(
        NEW.raw_user_meta_data ->> 'restaurant_name',
        initcap(replace(base_slug, '-', ' ')) || ' Restaurant'
    );

    insert into public.restaurants (name, slug, contact_email, is_active)
    values (restaurant_name, restaurant_slug, NEW.email, true)
    returning id into v_restaurant_id;

    insert into public.restaurant_staff (user_id, restaurant_id, role, is_active)
    values (NEW.id, v_restaurant_id, 'owner', true)
    on conflict (user_id, restaurant_id) do nothing;

    return NEW;
end;
$function$;

create or replace function public.check_merchant_item_updates()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
    user_role text;
begin
    select au.role into user_role
    from public.agency_users au
    where au.user_id = auth.uid();

    if user_role = 'merchant' then
        if (NEW.name is distinct from OLD.name) or
           (NEW.description is distinct from OLD.description) or
           (NEW.image_url is distinct from OLD.image_url) or
           (NEW.category_id is distinct from OLD.category_id) then
            raise exception 'Merchants are restricted to updating Price and Availability only.';
        end if;
    end if;

    return NEW;
end;
$function$;

create or replace function public.get_my_staff_role(p_restaurant_id uuid default null::uuid)
returns table(role text, restaurant_id uuid)
language sql
security definer
set search_path = pg_catalog, public
as $function$
    select rs.role, rs.restaurant_id
    from public.restaurant_staff rs
    where rs.user_id = auth.uid()
      and coalesce(rs.is_active, true) = true
      and (p_restaurant_id is null or rs.restaurant_id = p_restaurant_id)
    order by rs.created_at desc
    limit 1
$function$;

create or replace function public.is_agency_admin()
returns boolean
language sql
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.agency_users au
    where au.user_id = auth.uid()
      and au.role = 'admin'
  );
$function$;

create or replace function public.validate_item_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
    user_role text;
begin
    select au.role into user_role
    from public.agency_users au
    where au.user_id = auth.uid()
    limit 1;

    if user_role = 'manager' then
        if (NEW.name is distinct from OLD.name) or
           (NEW.name_am is distinct from OLD.name_am) or
           (NEW.description is distinct from OLD.description) or
           (NEW.description_am is distinct from OLD.description_am) or
           (NEW.image_url is distinct from OLD.image_url) or
           (NEW.station is distinct from OLD.station) or
           (NEW.category_id is distinct from OLD.category_id) then
            raise exception 'Managers are only allowed to update price and availability.';
        end if;
    end if;

    return NEW;
end;
$function$;

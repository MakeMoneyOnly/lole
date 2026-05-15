-- Stage 3 (Batch 2): harden remaining guest-facing mutating policies with
-- explicit abuse controls and stricter payload checks.

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'Guests can create orders'
  ) then
    execute $sql$
      alter policy "Guests can create orders"
      on public.orders
      to public
      with check (
        restaurant_id is not null
        and status = any (array['pending'::text, 'draft'::text])
        and idempotency_key is not null
        and length(trim(both from coalesce(guest_fingerprint, ''))) between 16 and 200
        and jsonb_typeof(items) = 'array'
        and jsonb_array_length(items) between 1 and 50
        and total_price >= 0
        and total_price <= 1000000
        and length(trim(both from coalesce(table_number, ''))) between 1 and 32
        and coalesce(length(notes), 0) <= 500
        and (
          select count(*)
          from public.orders o
          where o.restaurant_id = orders.restaurant_id
            and o.guest_fingerprint = orders.guest_fingerprint
            and o.created_at >= (now() - interval '10 minutes')
        ) < 5
      )
    $sql$;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_requests'
      and policyname = 'Guest can create service requests with valid tenant data'
  ) then
    execute $sql$
      alter policy "Guest can create service requests with valid tenant data"
      on public.service_requests
      to anon, authenticated
      with check (
        exists (
          select 1
          from public.restaurants r
          where r.id = service_requests.restaurant_id
            and coalesce(r.is_active, true) = true
        )
        and length(trim(both from coalesce(service_requests.table_number, ''))) between 1 and 24
        and service_requests.request_type = any (array['waiter'::text, 'bill'::text, 'cutlery'::text, 'other'::text])
        and coalesce(service_requests.status, 'pending') = 'pending'
        and coalesce(length(service_requests.notes), 0) <= 500
        and (
          select count(*)
          from public.service_requests sr
          where sr.restaurant_id = service_requests.restaurant_id
            and sr.table_number = service_requests.table_number
            and sr.request_type = service_requests.request_type
            and sr.created_at >= (now() - interval '2 minutes')
        ) < 3
      )
    $sql$;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rate_limit_logs'
      and policyname = 'Anyone can insert rate_limit_logs'
  ) then
    execute $sql$
      alter policy "Anyone can insert rate_limit_logs"
      on public.rate_limit_logs
      to public
      with check (
        action = any (
          array[
            'order_create'::text,
            'menu_view'::text,
            'api_request'::text,
            'auth_attempt'::text,
            'guest_order'::text,
            'rl:auth'::text,
            'rl:order'::text,
            'rl:service'::text,
            'rl:api'::text,
            'rl:guest'::text
          ]
        )
        and length(trim(both from coalesce(fingerprint, ''))) between 8 and 200
        and coalesce(length(ip_address), 0) <= 64
        and coalesce(length(user_agent), 0) <= 512
        and (
          metadata is null
          or jsonb_typeof(metadata) = 'object'
        )
        and (
          restaurant_id is null
          or exists (
            select 1
            from public.restaurants r
            where r.id = rate_limit_logs.restaurant_id
              and coalesce(r.is_active, true) = true
          )
        )
        and (
          select count(*)
          from public.rate_limit_logs rll
          where rll.fingerprint = rate_limit_logs.fingerprint
            and rll.action = rate_limit_logs.action
            and rll.created_at >= (now() - interval '1 minute')
        ) < 240
      )
    $sql$;
  end if;
end
$$;

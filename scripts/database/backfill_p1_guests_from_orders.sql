-- P1-003 Backfill guests + guest_visits from historical orders
-- Usage:
--   psql "$DATABASE_URL" -f scripts/backfill_p1_guests_from_orders.sql

BEGIN;

WITH normalized_orders AS (
    SELECT
        o.id AS order_id,
        o.restaurant_id,
        NULLIF(trim(o.customer_name), '') AS customer_name,
        CASE
            WHEN NULLIF(trim(o.customer_phone), '') IS NULL THEN NULL
            ELSE encode(digest(lower(regexp_replace(trim(o.customer_phone), '[^0-9+]', '', 'g')), 'sha256'), 'hex')
        END AS phone_hash,
        CASE
            WHEN NULLIF(trim(o.guest_fingerprint), '') IS NULL THEN NULL
            ELSE encode(digest(trim(o.guest_fingerprint), 'sha256'), 'hex')
        END AS fingerprint_hash,
        CASE
            WHEN NULLIF(trim(o.customer_phone), '') IS NOT NULL THEN concat(
                'phone:',
                encode(digest(lower(regexp_replace(trim(o.customer_phone), '[^0-9+]', '', 'g')), 'sha256'), 'hex')
            )
            WHEN NULLIF(trim(o.guest_fingerprint), '') IS NOT NULL THEN concat(
                'fingerprint:',
                encode(digest(trim(o.guest_fingerprint), 'sha256'), 'hex')
            )
            ELSE concat('order:', o.id::text)
        END AS identity_key,
        COALESCE(o.total_price, 0)::numeric(12, 2) AS spend,
        COALESCE(o.created_at, NOW()) AS visited_at,
        COALESCE(NULLIF(trim(o.table_number), ''), 'unknown') AS table_number
    FROM public.orders o
    WHERE o.restaurant_id IS NOT NULL
),
aggregated_guests AS (
    SELECT
        restaurant_id,
        identity_key,
        max(customer_name) AS name,
        max(phone_hash) AS phone_hash,
        max(fingerprint_hash) AS fingerprint_hash,
        min(visited_at) AS first_seen_at,
        max(visited_at) AS last_seen_at,
        count(*)::integer AS visit_count,
        sum(spend)::numeric(12, 2) AS lifetime_value
    FROM normalized_orders
    GROUP BY restaurant_id, identity_key
),
upserted_guests AS (
    INSERT INTO public.guests (
        restaurant_id,
        identity_key,
        name,
        phone_hash,
        fingerprint_hash,
        first_seen_at,
        last_seen_at,
        visit_count,
        lifetime_value,
        metadata
    )
    SELECT
        restaurant_id,
        identity_key,
        name,
        phone_hash,
        fingerprint_hash,
        first_seen_at,
        last_seen_at,
        visit_count,
        lifetime_value,
        jsonb_build_object('source', 'orders_backfill')
    FROM aggregated_guests
    ON CONFLICT (restaurant_id, identity_key)
    DO UPDATE
    SET
        name = COALESCE(EXCLUDED.name, guests.name),
        phone_hash = COALESCE(EXCLUDED.phone_hash, guests.phone_hash),
        fingerprint_hash = COALESCE(EXCLUDED.fingerprint_hash, guests.fingerprint_hash),
        first_seen_at = LEAST(guests.first_seen_at, EXCLUDED.first_seen_at),
        last_seen_at = GREATEST(guests.last_seen_at, EXCLUDED.last_seen_at),
        visit_count = GREATEST(guests.visit_count, EXCLUDED.visit_count),
        lifetime_value = GREATEST(guests.lifetime_value, EXCLUDED.lifetime_value),
        metadata = guests.metadata || EXCLUDED.metadata
    RETURNING id, restaurant_id, identity_key
)
INSERT INTO public.guest_visits (
    restaurant_id,
    guest_id,
    order_id,
    table_id,
    channel,
    visited_at,
    spend,
    metadata
)
SELECT
    no.restaurant_id,
    g.id AS guest_id,
    no.order_id,
    t.id AS table_id,
    CASE
        WHEN no.table_number = 'unknown' THEN 'online'
        ELSE 'dine_in'
    END AS channel,
    no.visited_at,
    no.spend,
    jsonb_build_object('source', 'orders_backfill')
FROM normalized_orders no
JOIN public.guests g
    ON g.restaurant_id = no.restaurant_id
    AND g.identity_key = no.identity_key
LEFT JOIN public.tables t
    ON t.restaurant_id = no.restaurant_id
    AND t.table_number = no.table_number
WHERE NOT EXISTS (
    SELECT 1
    FROM public.guest_visits gv
    WHERE gv.order_id = no.order_id
);

-- Reconcile aggregate counters from visit records.
WITH guest_visit_rollup AS (
    SELECT
        guest_id,
        min(visited_at) AS first_seen_at,
        max(visited_at) AS last_seen_at,
        count(*)::integer AS visit_count,
        sum(spend)::numeric(12, 2) AS lifetime_value
    FROM public.guest_visits
    GROUP BY guest_id
)
UPDATE public.guests g
SET
    first_seen_at = r.first_seen_at,
    last_seen_at = r.last_seen_at,
    visit_count = r.visit_count,
    lifetime_value = r.lifetime_value
FROM guest_visit_rollup r
WHERE g.id = r.guest_id;

COMMIT;

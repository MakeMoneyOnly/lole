-- Seed script for local P0 end-to-end merchant flow
-- Usage: run against local/staging DB only

BEGIN;

-- 1) Base restaurant
INSERT INTO public.restaurants (
    id,
    slug,
    name,
    location,
    currency,
    currency_symbol,
    is_active,
    settings
)
VALUES (
    '11111111-1111-4111-8111-111111111111',
    'p0-demo-restaurant',
    'P0 Demo Restaurant',
    'Addis Ababa',
    'ETB',
    'Br',
    true,
    '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE
SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    updated_at = NOW();

-- 2) Optional staff link for first available auth user (if present)
INSERT INTO public.restaurant_staff (restaurant_id, user_id, role, is_active)
SELECT
    '11111111-1111-4111-8111-111111111111',
    u.id,
    'manager',
    true
FROM auth.users u
LIMIT 1
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- 3) Categories and menu
INSERT INTO public.categories (id, restaurant_id, name, order_index, section)
VALUES
    ('22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 'Main', 1, 'food'),
    ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Drinks', 2, 'drinks')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.menu_items (id, category_id, restaurant_id, name, price, is_available, station)
VALUES
    ('33333333-3333-4333-8333-333333333331', '22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 'Doro Wat', 420, true, 'kitchen'),
    ('33333333-3333-4333-8333-333333333332', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Fresh Juice', 180, true, 'bar')
ON CONFLICT (id) DO NOTHING;

-- 4) Tables
INSERT INTO public.tables (id, restaurant_id, table_number, status, is_active, capacity, qr_version)
VALUES
    ('44444444-4444-4444-8444-444444444441', '11111111-1111-4111-8111-111111111111', 'A1', 'available', true, 4, 1),
    ('44444444-4444-4444-8444-444444444442', '11111111-1111-4111-8111-111111111111', 'A2', 'occupied', true, 2, 1),
    ('44444444-4444-4444-8444-444444444443', '11111111-1111-4111-8111-111111111111', 'B1', 'available', true, 6, 1)
ON CONFLICT (restaurant_id, table_number) DO UPDATE
SET status = EXCLUDED.status, updated_at = NOW();

-- 5) Table session
INSERT INTO public.table_sessions (
    id,
    restaurant_id,
    table_id,
    guest_count,
    status,
    opened_at
)
VALUES (
    '55555555-5555-4555-8555-555555555551',
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444442',
    2,
    'open',
    NOW() - INTERVAL '20 minutes'
)
ON CONFLICT (id) DO NOTHING;

-- 6) Orders and order events
INSERT INTO public.orders (
    id,
    restaurant_id,
    table_number,
    order_number,
    status,
    kitchen_status,
    items,
    total_price,
    created_at
)
VALUES
    (
        '66666666-6666-4666-8666-666666666661',
        '11111111-1111-4111-8111-111111111111',
        'A2',
        'ORD-P0-001',
        'preparing',
        'preparing',
        '[{\"id\":\"33333333-3333-4333-8333-333333333331\",\"name\":\"Doro Wat\",\"quantity\":1,\"price\":420}]'::jsonb,
        420,
        NOW() - INTERVAL '15 minutes'
    ),
    (
        '66666666-6666-4666-8666-666666666662',
        '11111111-1111-4111-8111-111111111111',
        'A1',
        'ORD-P0-002',
        'pending',
        'pending',
        '[{\"id\":\"33333333-3333-4333-8333-333333333332\",\"name\":\"Fresh Juice\",\"quantity\":1,\"price\":180}]'::jsonb,
        180,
        NOW() - INTERVAL '5 minutes'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_events (
    restaurant_id,
    order_id,
    event_type,
    from_status,
    to_status,
    metadata
)
VALUES
    ('11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666661', 'status_changed', 'pending', 'acknowledged', '{}'::jsonb),
    ('11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666661', 'status_changed', 'acknowledged', 'preparing', '{}'::jsonb)
ON CONFLICT DO NOTHING;

-- 7) Service requests
INSERT INTO public.service_requests (
    id,
    restaurant_id,
    table_number,
    request_type,
    status,
    created_at
)
VALUES (
    '77777777-7777-4777-8777-777777777771',
    '11111111-1111-4111-8111-111111111111',
    'A1',
    'bill',
    'pending',
    NOW() - INTERVAL '3 minutes'
)
ON CONFLICT (id) DO NOTHING;

-- 8) Alert rules + events
INSERT INTO public.alert_rules (
    id,
    restaurant_id,
    name,
    severity,
    enabled,
    condition_json
)
VALUES (
    '88888888-8888-4888-8888-888888888881',
    '11111111-1111-4111-8111-111111111111',
    'Order wait threshold',
    'high',
    true,
    '{"type":"order_wait_minutes","threshold":12}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.alert_events (
    id,
    restaurant_id,
    rule_id,
    entity_type,
    entity_id,
    severity,
    status,
    payload
)
VALUES (
    '99999999-9999-4999-8999-999999999991',
    '11111111-1111-4111-8111-111111111111',
    '88888888-8888-4888-8888-888888888881',
    'order',
    '66666666-6666-4666-8666-666666666661',
    'high',
    'open',
    '{"wait_minutes":15}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 9) Support ticket
INSERT INTO public.support_tickets (
    id,
    restaurant_id,
    subject,
    description,
    priority,
    status,
    diagnostics_json
)
VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '11111111-1111-4111-8111-111111111111',
    'Printer integration issue',
    'Kitchen printer delayed for 2 tickets during peak hour.',
    'medium',
    'open',
    '{"channel":"kitchen","ticket_count":2}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

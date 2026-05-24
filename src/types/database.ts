export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: '14.1';
    };
    public: {
        Tables: {
            agency_users: {
                Row: {
                    created_at: string | null;
                    id: string;
                    restaurant_ids: string[] | null;
                    role: string | null;
                    user_id: string;
                };
                Insert: {
                    created_at?: string | null;
                    id?: string;
                    restaurant_ids?: string[] | null;
                    role?: string | null;
                    user_id: string;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    restaurant_ids?: string[] | null;
                    role?: string | null;
                    user_id?: string;
                };
                Relationships: [];
            };
            alert_events: {
                Row: {
                    created_at: string;
                    entity_id: string | null;
                    entity_type: string;
                    id: string;
                    payload: Json;
                    resolved_at: string | null;
                    restaurant_id: string;
                    rule_id: string | null;
                    severity: string;
                    status: string;
                };
                Insert: {
                    created_at?: string;
                    entity_id?: string | null;
                    entity_type: string;
                    id?: string;
                    payload?: Json;
                    resolved_at?: string | null;
                    restaurant_id: string;
                    rule_id?: string | null;
                    severity?: string;
                    status?: string;
                };
                Update: {
                    created_at?: string;
                    entity_id?: string | null;
                    entity_type?: string;
                    id?: string;
                    payload?: Json;
                    resolved_at?: string | null;
                    restaurant_id?: string;
                    rule_id?: string | null;
                    severity?: string;
                    status?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'alert_events_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'alert_events_rule_id_fkey';
                        columns: ['rule_id'];
                        isOneToOne: false;
                        referencedRelation: 'alert_rules';
                        referencedColumns: ['id'];
                    },
                ];
            };
            alert_rules: {
                Row: {
                    condition_json: Json;
                    created_at: string;
                    enabled: boolean;
                    id: string;
                    name: string;
                    restaurant_id: string;
                    severity: string;
                    target_json: Json;
                    updated_at: string;
                };
                Insert: {
                    condition_json?: Json;
                    created_at?: string;
                    enabled?: boolean;
                    id?: string;
                    name: string;
                    restaurant_id: string;
                    severity?: string;
                    target_json?: Json;
                    updated_at?: string;
                };
                Update: {
                    condition_json?: Json;
                    created_at?: string;
                    enabled?: boolean;
                    id?: string;
                    name?: string;
                    restaurant_id?: string;
                    severity?: string;
                    target_json?: Json;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'alert_rules_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            audit_logs: {
                Row: {
                    action: string;
                    created_at: string | null;
                    entity_id: string | null;
                    entity_type: string;
                    id: string;
                    metadata: Json | null;
                    new_value: Json | null;
                    old_value: Json | null;
                    restaurant_id: string | null;
                    telegram_user_id: string | null;
                    user_id: string | null;
                };
                Insert: {
                    action: string;
                    created_at?: string | null;
                    entity_id?: string | null;
                    entity_type: string;
                    id?: string;
                    metadata?: Json | null;
                    new_value?: Json | null;
                    old_value?: Json | null;
                    restaurant_id?: string | null;
                    telegram_user_id?: string | null;
                    user_id?: string | null;
                };
                Update: {
                    action?: string;
                    created_at?: string | null;
                    entity_id?: string | null;
                    entity_type?: string;
                    id?: string;
                    metadata?: Json | null;
                    new_value?: Json | null;
                    old_value?: Json | null;
                    restaurant_id?: string | null;
                    telegram_user_id?: string | null;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'audit_log_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            campaign_deliveries: {
                Row: {
                    campaign_id: string;
                    clicked_at: string | null;
                    conversion_order_id: string | null;
                    created_at: string | null;
                    guest_id: string;
                    id: string;
                    metadata: Json;
                    opened_at: string | null;
                    sent_at: string | null;
                    status: string;
                };
                Insert: {
                    campaign_id: string;
                    clicked_at?: string | null;
                    conversion_order_id?: string | null;
                    created_at?: string | null;
                    guest_id: string;
                    id?: string;
                    metadata?: Json;
                    opened_at?: string | null;
                    sent_at?: string | null;
                    status?: string;
                };
                Update: {
                    campaign_id?: string;
                    clicked_at?: string | null;
                    conversion_order_id?: string | null;
                    created_at?: string | null;
                    guest_id?: string;
                    id?: string;
                    metadata?: Json;
                    opened_at?: string | null;
                    sent_at?: string | null;
                    status?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'campaign_deliveries_campaign_id_fkey';
                        columns: ['campaign_id'];
                        isOneToOne: false;
                        referencedRelation: 'campaigns';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'campaign_deliveries_conversion_order_id_fkey';
                        columns: ['conversion_order_id'];
                        isOneToOne: false;
                        referencedRelation: 'orders';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'campaign_deliveries_guest_id_fkey';
                        columns: ['guest_id'];
                        isOneToOne: false;
                        referencedRelation: 'guests';
                        referencedColumns: ['id'];
                    },
                ];
            };
            campaigns: {
                Row: {
                    channel: string;
                    created_at: string | null;
                    created_by: string | null;
                    id: string;
                    launched_at: string | null;
                    name: string;
                    restaurant_id: string;
                    scheduled_at: string | null;
                    segment_id: string | null;
                    status: string;
                    template_json: Json;
                    updated_at: string | null;
                };
                Insert: {
                    channel: string;
                    created_at?: string | null;
                    created_by?: string | null;
                    id?: string;
                    launched_at?: string | null;
                    name: string;
                    restaurant_id: string;
                    scheduled_at?: string | null;
                    segment_id?: string | null;
                    status?: string;
                    template_json?: Json;
                    updated_at?: string | null;
                };
                Update: {
                    channel?: string;
                    created_at?: string | null;
                    created_by?: string | null;
                    id?: string;
                    launched_at?: string | null;
                    name?: string;
                    restaurant_id?: string;
                    scheduled_at?: string | null;
                    segment_id?: string | null;
                    status?: string;
                    template_json?: Json;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'campaigns_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'campaigns_segment_id_fkey';
                        columns: ['segment_id'];
                        isOneToOne: false;
                        referencedRelation: 'segments';
                        referencedColumns: ['id'];
                    },
                ];
            };
            categories: {
                Row: {
                    created_at: string | null;
                    id: string;
                    name: string;
                    name_am: string | null;
                    order_index: number | null;
                    restaurant_id: string;
                    section: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    id?: string;
                    name: string;
                    name_am?: string | null;
                    order_index?: number | null;
                    restaurant_id: string;
                    section?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    name?: string;
                    name_am?: string | null;
                    order_index?: number | null;
                    restaurant_id?: string;
                    section?: string | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'categories_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            centralized_menu_configs: {
                Row: {
                    auto_sync_enabled: boolean;
                    created_at: string;
                    description: string | null;
                    id: string;
                    name: string;
                    primary_restaurant_id: string;
                    sync_availability: boolean;
                    sync_categories: boolean;
                    sync_items: boolean;
                    sync_modifiers: boolean;
                    sync_pricing: boolean;
                    sync_schedule: string | null;
                    updated_at: string;
                };
                Insert: {
                    auto_sync_enabled?: boolean;
                    created_at?: string;
                    description?: string | null;
                    id?: string;
                    name: string;
                    primary_restaurant_id: string;
                    sync_availability?: boolean;
                    sync_categories?: boolean;
                    sync_items?: boolean;
                    sync_modifiers?: boolean;
                    sync_pricing?: boolean;
                    sync_schedule?: string | null;
                    updated_at?: string;
                };
                Update: {
                    auto_sync_enabled?: boolean;
                    created_at?: string;
                    description?: string | null;
                    id?: string;
                    name?: string;
                    primary_restaurant_id?: string;
                    sync_availability?: boolean;
                    sync_categories?: boolean;
                    sync_items?: boolean;
                    sync_modifiers?: boolean;
                    sync_pricing?: boolean;
                    sync_schedule?: string | null;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'centralized_menu_configs_primary_restaurant_id_fkey';
                        columns: ['primary_restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            delivery_partners: {
                Row: {
                    api_key: string | null;
                    created_at: string;
                    created_by: string | null;
                    credentials_ref: string | null;
                    display_name: string | null;
                    id: string;
                    last_sync_at: string | null;
                    provider: string;
                    restaurant_id: string;
                    settings_json: Json;
                    status: string;
                    updated_at: string;
                };
                Insert: {
                    api_key?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    credentials_ref?: string | null;
                    display_name?: string | null;
                    id?: string;
                    last_sync_at?: string | null;
                    provider: string;
                    restaurant_id: string;
                    settings_json?: Json;
                    status?: string;
                    updated_at?: string;
                };
                Update: {
                    api_key?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    credentials_ref?: string | null;
                    display_name?: string | null;
                    id?: string;
                    last_sync_at?: string | null;
                    provider?: string;
                    restaurant_id?: string;
                    settings_json?: Json;
                    status?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'delivery_partners_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            delivery_aggregator_configs: {
                Row: {
                    id: string;
                    restaurant_id: string;
                    aggregator_name: string;
                    api_key: string | null;
                    api_secret_ref: string | null;
                    webhook_url: string | null;
                    settings_json: Json;
                    status: string;
                    last_sync_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    restaurant_id: string;
                    aggregator_name: string;
                    api_key?: string | null;
                    api_secret_ref?: string | null;
                    webhook_url?: string | null;
                    settings_json?: Json;
                    status?: string;
                    last_sync_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    restaurant_id?: string;
                    aggregator_name?: string;
                    api_key?: string | null;
                    api_secret_ref?: string | null;
                    webhook_url?: string | null;
                    settings_json?: Json;
                    status?: string;
                    last_sync_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'delivery_aggregator_configs_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            device_management_actions: {
                Row: {
                    id: string;
                    restaurant_id: string;
                    hardware_device_id: string;
                    requested_by: string | null;
                    provider: string;
                    action_type: string;
                    status: string;
                    request_payload: Json | null;
                    provider_job_id: string | null;
                    response_payload: Json | null;
                    completed_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    restaurant_id: string;
                    hardware_device_id: string;
                    requested_by?: string | null;
                    provider: string;
                    action_type: string;
                    status?: string;
                    request_payload?: Json | null;
                    provider_job_id?: string | null;
                    response_payload?: Json | null;
                    completed_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    restaurant_id?: string;
                    hardware_device_id?: string;
                    requested_by?: string | null;
                    provider?: string;
                    action_type?: string;
                    status?: string;
                    request_payload?: Json | null;
                    provider_job_id?: string | null;
                    response_payload?: Json | null;
                    completed_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'device_management_actions_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'device_management_actions_hardware_device_id_fkey';
                        columns: ['hardware_device_id'];
                        isOneToOne: false;
                        referencedRelation: 'hardware_devices';
                        referencedColumns: ['id'];
                    },
                ];
            };
            device_sync_status: {
                Row: {
                    created_at: string | null;
                    device_id: string;
                    device_name: string | null;
                    device_type: string;
                    id: string;
                    last_sync_at: string | null;
                    restaurant_id: string;
                    sync_status: string;
                    sync_version: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    device_id: string;
                    device_name?: string | null;
                    device_type: string;
                    id?: string;
                    last_sync_at?: string | null;
                    restaurant_id: string;
                    sync_status?: string;
                    sync_version?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    device_id?: string;
                    device_name?: string | null;
                    device_type?: string;
                    id?: string;
                    last_sync_at?: string | null;
                    restaurant_id?: string;
                    sync_status?: string;
                    sync_version?: string | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'device_sync_status_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            device_tokens: {
                Row: {
                    id: string;
                    restaurant_id: string | null;
                    guest_id: string | null;
                    token: string;
                    device_type: string;
                    provider: string;
                    device_name: string | null;
                    metadata: Json;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                    last_used_at: string | null;
                };
                Insert: {
                    id?: string;
                    restaurant_id?: string | null;
                    guest_id?: string | null;
                    token: string;
                    device_type: string;
                    provider?: string;
                    device_name?: string | null;
                    metadata?: Json;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                    last_used_at?: string | null;
                };
                Update: {
                    id?: string;
                    restaurant_id?: string | null;
                    guest_id?: string | null;
                    token?: string;
                    device_type?: string;
                    provider?: string;
                    device_name?: string | null;
                    metadata?: Json;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                    last_used_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'device_tokens_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'device_tokens_guest_id_fkey';
                        columns: ['guest_id'];
                        isOneToOne: false;
                        referencedRelation: 'guests';
                        referencedColumns: ['id'];
                    },
                ];
            };
            discounts: {
                Row: {
                    applies_to: string;
                    created_at: string;
                    id: string;
                    is_active: boolean;
                    max_uses_per_day: number | null;
                    name: string;
                    name_am: string | null;
                    requires_manager_pin: boolean;
                    restaurant_id: string;
                    target_category_id: string | null;
                    target_menu_item_id: string | null;
                    type: string;
                    updated_at: string;
                    valid_from: string | null;
                    valid_until: string | null;
                    value: number;
                };
                Insert: {
                    applies_to?: string;
                    created_at?: string;
                    id?: string;
                    is_active?: boolean;
                    max_uses_per_day?: number | null;
                    name: string;
                    name_am?: string | null;
                    requires_manager_pin?: boolean;
                    restaurant_id: string;
                    target_category_id?: string | null;
                    target_menu_item_id?: string | null;
                    type: string;
                    updated_at?: string;
                    valid_from?: string | null;
                    valid_until?: string | null;
                    value: number;
                };
                Update: {
                    applies_to?: string;
                    created_at?: string;
                    id?: string;
                    is_active?: boolean;
                    max_uses_per_day?: number | null;
                    name?: string;
                    name_am?: string | null;
                    requires_manager_pin?: boolean;
                    restaurant_id?: string;
                    target_category_id?: string | null;
                    target_menu_item_id?: string | null;
                    type?: string;
                    updated_at?: string;
                    valid_from?: string | null;
                    valid_until?: string | null;
                    value?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: 'discounts_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'discounts_target_category_id_fkey';
                        columns: ['target_category_id'];
                        isOneToOne: false;
                        referencedRelation: 'categories';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'discounts_target_menu_item_id_fkey';
                        columns: ['target_menu_item_id'];
                        isOneToOne: false;
                        referencedRelation: 'menu_items';
                        referencedColumns: ['id'];
                    },
                ];
            };
            external_orders: {
                Row: {
                    acked_by: string | null;
                    acknowledged_at: string | null;
                    created_at: string;
                    currency: string;
                    delivery_partner_id: string | null;
                    id: string;
                    normalized_status: string;
                    payload_json: Json;
                    provider: string;
                    provider_order_id: string;
                    restaurant_id: string;
                    source_channel: string;
                    total_amount: number;
                    updated_at: string;
                };
                Insert: {
                    acked_by?: string | null;
                    acknowledged_at?: string | null;
                    created_at?: string;
                    currency?: string;
                    delivery_partner_id?: string | null;
                    id?: string;
                    normalized_status?: string;
                    payload_json?: Json;
                    provider: string;
                    provider_order_id: string;
                    restaurant_id: string;
                    source_channel?: string;
                    total_amount?: number;
                    updated_at?: string;
                };
                Update: {
                    acked_by?: string | null;
                    acknowledged_at?: string | null;
                    created_at?: string;
                    currency?: string;
                    delivery_partner_id?: string | null;
                    id?: string;
                    normalized_status?: string;
                    payload_json?: Json;
                    provider?: string;
                    provider_order_id?: string;
                    restaurant_id?: string;
                    source_channel?: string;
                    total_amount?: number;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'external_orders_delivery_partner_id_fkey';
                        columns: ['delivery_partner_id'];
                        isOneToOne: false;
                        referencedRelation: 'delivery_partner_integrations';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'external_orders_delivery_partner_id_fkey';
                        columns: ['delivery_partner_id'];
                        isOneToOne: false;
                        referencedRelation: 'delivery_partners';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'external_orders_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            global_orders: {
                Row: {
                    created_at: string | null;
                    currency: string | null;
                    external_order_id: string | null;
                    id: string;
                    items: Json;
                    status: string | null;
                    table_number: string | null;
                    tenant_id: string | null;
                    total_amount: number | null;
                    updated_at: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    currency?: string | null;
                    external_order_id?: string | null;
                    id?: string;
                    items: Json;
                    status?: string | null;
                    table_number?: string | null;
                    tenant_id?: string | null;
                    total_amount?: number | null;
                    updated_at?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    currency?: string | null;
                    external_order_id?: string | null;
                    id?: string;
                    items?: Json;
                    status?: string | null;
                    table_number?: string | null;
                    tenant_id?: string | null;
                    total_amount?: number | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'global_orders_tenant_id_fkey';
                        columns: ['tenant_id'];
                        isOneToOne: false;
                        referencedRelation: 'tenants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            gift_cards: {
                Row: {
                    id: string;
                    restaurant_id: string;
                    code: string;
                    currency: string;
                    initial_balance: number;
                    current_balance: number;
                    status: string;
                    expires_at: string | null;
                    metadata: Json;
                    created_by: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    restaurant_id: string;
                    code: string;
                    currency?: string;
                    initial_balance: number;
                    current_balance: number;
                    status?: string;
                    expires_at?: string | null;
                    metadata?: Json;
                    created_by?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    restaurant_id?: string;
                    code?: string;
                    currency?: string;
                    initial_balance?: number;
                    current_balance?: number;
                    status?: string;
                    expires_at?: string | null;
                    metadata?: Json;
                    created_by?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'gift_cards_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            gift_card_transactions: {
                Row: {
                    id: string;
                    restaurant_id: string;
                    gift_card_id: string;
                    order_id: string | null;
                    amount_delta: number;
                    balance_after: number;
                    type: string;
                    metadata: Json;
                    created_by: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    restaurant_id: string;
                    gift_card_id: string;
                    order_id?: string | null;
                    amount_delta: number;
                    balance_after: number;
                    type: string;
                    metadata?: Json;
                    created_by?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    restaurant_id?: string;
                    gift_card_id?: string;
                    order_id?: string | null;
                    amount_delta?: number;
                    balance_after?: number;
                    type?: string;
                    metadata?: Json;
                    created_by?: string | null;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'gift_card_transactions_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'gift_card_transactions_gift_card_id_fkey';
                        columns: ['gift_card_id'];
                        isOneToOne: false;
                        referencedRelation: 'gift_cards';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'gift_card_transactions_order_id_fkey';
                        columns: ['order_id'];
                        isOneToOne: false;
                        referencedRelation: 'orders';
                        referencedColumns: ['id'];
                    },
                ];
            };
            guest_visits: {
                Row: {
                    channel: string;
                    created_at: string;
                    guest_id: string;
                    id: string;
                    metadata: Json;
                    order_id: string | null;
                    restaurant_id: string;
                    spend: number;
                    table_id: string | null;
                    visited_at: string;
                };
                Insert: {
                    channel?: string;
                    created_at?: string;
                    guest_id: string;
                    id?: string;
                    metadata?: Json;
                    order_id?: string | null;
                    restaurant_id: string;
                    spend?: number;
                    table_id?: string | null;
                    visited_at?: string;
                };
                Update: {
                    channel?: string;
                    created_at?: string;
                    guest_id?: string;
                    id?: string;
                    metadata?: Json;
                    order_id?: string | null;
                    restaurant_id?: string;
                    spend?: number;
                    table_id?: string | null;
                    visited_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'guest_visits_guest_id_fkey';
                        columns: ['guest_id'];
                        isOneToOne: false;
                        referencedRelation: 'guests';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'guest_visits_order_id_fkey';
                        columns: ['order_id'];
                        isOneToOne: false;
                        referencedRelation: 'orders';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'guest_visits_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'guest_visits_table_id_fkey';
                        columns: ['table_id'];
                        isOneToOne: false;
                        referencedRelation: 'tables';
                        referencedColumns: ['id'];
                    },
                ];
            };
            guests: {
                Row: {
                    created_at: string;
                    email_hash: string | null;
                    fingerprint_hash: string | null;
                    first_seen_at: string;
                    id: string;
                    identity_key: string;
                    is_vip: boolean;
                    language: string;
                    last_seen_at: string;
                    lifetime_value: number;
                    metadata: Json;
                    name: string | null;
                    notes: string | null;
                    phone_hash: string | null;
                    restaurant_id: string;
                    tags: string[];
                    updated_at: string;
                    visit_count: number;
                };
                Insert: {
                    created_at?: string;
                    email_hash?: string | null;
                    fingerprint_hash?: string | null;
                    first_seen_at?: string;
                    id?: string;
                    identity_key: string;
                    is_vip?: boolean;
                    language?: string;
                    last_seen_at?: string;
                    lifetime_value?: number;
                    metadata?: Json;
                    name?: string | null;
                    notes?: string | null;
                    phone_hash?: string | null;
                    restaurant_id: string;
                    tags?: string[];
                    updated_at?: string;
                    visit_count?: number;
                };
                Update: {
                    created_at?: string;
                    email_hash?: string | null;
                    fingerprint_hash?: string | null;
                    first_seen_at?: string;
                    id?: string;
                    identity_key?: string;
                    is_vip?: boolean;
                    language?: string;
                    last_seen_at?: string;
                    lifetime_value?: number;
                    metadata?: Json;
                    name?: string | null;
                    notes?: string | null;
                    phone_hash?: string | null;
                    restaurant_id?: string;
                    tags?: string[];
                    updated_at?: string;
                    visit_count?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: 'guests_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            happy_hour_schedules: {
                Row: {
                    applies_to: string;
                    created_at: string;
                    created_by: string | null;
                    description: string | null;
                    description_am: string | null;
                    discount_fixed_amount: number | null;
                    discount_percentage: number | null;
                    id: string;
                    is_active: boolean;
                    name: string;
                    name_am: string | null;
                    priority: number;
                    requires_manager_pin: boolean;
                    restaurant_id: string;
                    schedule_days: string[];
                    schedule_end_time: string;
                    schedule_start_time: string;
                    target_category_id: string | null;
                    target_menu_item_ids: string[] | null;
                    updated_at: string;
                };
                Insert: {
                    applies_to?: string;
                    created_at?: string;
                    created_by?: string | null;
                    description?: string | null;
                    description_am?: string | null;
                    discount_fixed_amount?: number | null;
                    discount_percentage?: number | null;
                    id?: string;
                    is_active?: boolean;
                    name: string;
                    name_am?: string | null;
                    priority?: number;
                    requires_manager_pin?: boolean;
                    restaurant_id: string;
                    schedule_days?: string[];
                    schedule_end_time: string;
                    schedule_start_time: string;
                    target_category_id?: string | null;
                    target_menu_item_ids?: string[] | null;
                    updated_at?: string;
                };
                Update: {
                    applies_to?: string;
                    created_at?: string;
                    created_by?: string | null;
                    description?: string | null;
                    description_am?: string | null;
                    discount_fixed_amount?: number | null;
                    discount_percentage?: number | null;
                    id?: string;
                    is_active?: boolean;
                    name?: string;
                    name_am?: string | null;
                    priority?: number;
                    requires_manager_pin?: boolean;
                    restaurant_id?: string;
                    schedule_days?: string[];
                    schedule_end_time?: string;
                    schedule_start_time?: string;
                    target_category_id?: string | null;
                    target_menu_item_ids?: string[] | null;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'happy_hour_schedules_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'happy_hour_schedules_target_category_id_fkey';
                        columns: ['target_category_id'];
                        isOneToOne: false;
                        referencedRelation: 'categories';
                        referencedColumns: ['id'];
                    },
                ];
            };
            hardware_devices: {
                Row: {
                    assigned_zones: string[] | null;
                    created_at: string | null;
                    device_token: string | null;
                    device_type: string;
                    id: string;
                    last_active_at: string | null;
                    metadata: Json | null;
                    name: string;
                    paired_at: string | null;
                    pairing_code: string | null;
                    restaurant_id: string;
                    status: string;
                    updated_at: string | null;
                    device_profile: string | null;
                    location_id: string | null;
                    pairing_state: string | null;
                    pairing_code_expires_at: string | null;
                    pairing_completed_at: string | null;
                    hardware_fingerprint: string | null;
                    printer_connection_type: string | null;
                    printer_device_id: string | null;
                    printer_device_name: string | null;
                    printer_mac_address: string | null;
                    printer_preferences: Json | null;
                    management_provider: string | null;
                    management_device_id: string | null;
                    management_status: string | null;
                    app_channel: string | null;
                    app_version: string | null;
                    last_boot_at: string | null;
                    fiscal_mode: string | null;
                };
                Insert: {
                    assigned_zones?: string[] | null;
                    created_at?: string | null;
                    device_token?: string | null;
                    device_type: string;
                    id?: string;
                    last_active_at?: string | null;
                    metadata?: Json | null;
                    name: string;
                    paired_at?: string | null;
                    pairing_code?: string | null;
                    restaurant_id: string;
                    status?: string;
                    updated_at?: string | null;
                    device_profile?: string | null;
                    location_id?: string | null;
                    pairing_state?: string | null;
                    pairing_code_expires_at?: string | null;
                    pairing_completed_at?: string | null;
                    hardware_fingerprint?: string | null;
                    printer_connection_type?: string | null;
                    printer_device_id?: string | null;
                    printer_device_name?: string | null;
                    printer_mac_address?: string | null;
                    printer_preferences?: Json | null;
                    management_provider?: string | null;
                    management_device_id?: string | null;
                    management_status?: string | null;
                    app_channel?: string | null;
                    app_version?: string | null;
                    last_boot_at?: string | null;
                    fiscal_mode?: string | null;
                };
                Update: {
                    assigned_zones?: string[] | null;
                    created_at?: string | null;
                    device_token?: string | null;
                    device_type?: string;
                    id?: string;
                    last_active_at?: string | null;
                    metadata?: Json | null;
                    name?: string;
                    paired_at?: string | null;
                    pairing_code?: string | null;
                    restaurant_id?: string;
                    status?: string;
                    updated_at?: string | null;
                    device_profile?: string | null;
                    location_id?: string | null;
                    pairing_state?: string | null;
                    pairing_code_expires_at?: string | null;
                    pairing_completed_at?: string | null;
                    hardware_fingerprint?: string | null;
                    printer_connection_type?: string | null;
                    printer_device_id?: string | null;
                    printer_device_name?: string | null;
                    printer_mac_address?: string | null;
                    printer_preferences?: Json | null;
                    management_provider?: string | null;
                    management_device_id?: string | null;
                    management_status?: string | null;
                    app_channel?: string | null;
                    app_version?: string | null;
                    last_boot_at?: string | null;
                    fiscal_mode?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'hardware_devices_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            kds_item_events: {
                Row: {
                    actor_user_id: string | null;
                    created_at: string;
                    event_type: string;
                    from_status: string | null;
                    id: string;
                    kds_order_item_id: string;
                    metadata: Json;
                    order_id: string;
                    reason: string | null;
                    restaurant_id: string;
                    to_status: string | null;
                };
                Insert: {
                    actor_user_id?: string | null;
                    created_at?: string;
                    event_type: string;
                    from_status?: string | null;
                    id?: string;
                    kds_order_item_id: string;
                    metadata?: Json;
                    order_id: string;
                    reason?: string | null;
                    restaurant_id: string;
                    to_status?: string | null;
                };
                Update: {
                    actor_user_id?: string | null;
                    created_at?: string;
                    event_type?: string;
                    from_status?: string | null;
                    id?: string;
                    kds_order_item_id?: string;
                    metadata?: Json;
                    order_id?: string;
                    reason?: string | null;
                    restaurant_id?: string;
                    to_status?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'kds_item_events_kds_order_item_id_fkey';
                        columns: ['kds_order_item_id'];
                        isOneToOne: false;
                        referencedRelation: 'kds_order_items';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'kds_item_events_order_id_fkey';
                        columns: ['order_id'];
                        isOneToOne: false;
                        referencedRelation: 'orders';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'kds_item_events_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            kds_order_items: {
                Row: {
                    created_at: string;
                    held_at: string | null;
                    id: string;
                    last_action_at: string | null;
                    last_action_by: string | null;
                    metadata: Json;
                    modifiers: Json;
                    name: string;
                    notes: string | null;
                    order_id: string;
                    order_item_id: string | null;
                    quantity: number;
                    ready_at: string | null;
                    recalled_at: string | null;
                    restaurant_id: string;
                    started_at: string | null;
                    station: string;
                    status: string;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    held_at?: string | null;
                    id?: string;
                    last_action_at?: string | null;
                    last_action_by?: string | null;
                    metadata?: Json;
                    modifiers?: Json;
                    name: string;
                    notes?: string | null;
                    order_id: string;
                    order_item_id?: string | null;
                    quantity?: number;
                    ready_at?: string | null;
                    recalled_at?: string | null;
                    restaurant_id: string;
                    started_at?: string | null;
                    station?: string;
                    status?: string;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    held_at?: string | null;
                    id?: string;
                    last_action_at?: string | null;
                    last_action_by?: string | null;
                    metadata?: Json;
                    modifiers?: Json;
                    name?: string;
                    notes?: string | null;
                    order_id?: string;
                    order_item_id?: string | null;
                    quantity?: number;
                    ready_at?: string | null;
                    recalled_at?: string | null;
                    restaurant_id?: string;
                    started_at?: string | null;
                    station?: string;
                    status?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'kds_order_items_order_id_fkey';
                        columns: ['order_id'];
                        isOneToOne: false;
                        referencedRelation: 'orders';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'kds_order_items_order_item_id_fkey';
                        columns: ['order_item_id'];
                        isOneToOne: false;
                        referencedRelation: 'order_items';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'kds_order_items_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            loyalty_accounts: {
                Row: {
                    id: string;
                    restaurant_id: string;
                    guest_id: string;
                    program_id: string;
                    points_balance: number;
                    tier: string;
                    status: string;
                    total_visits: number;
                    total_points_earned: number;
                    last_visit_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    restaurant_id: string;
                    guest_id: string;
                    program_id: string;
                    points_balance?: number;
                    tier?: string;
                    status?: string;
                    total_visits?: number;
                    total_points_earned?: number;
                    last_visit_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    restaurant_id?: string;
                    guest_id?: string;
                    program_id?: string;
                    points_balance?: number;
                    tier?: string;
                    status?: string;
                    total_visits?: number;
                    total_points_earned?: number;
                    last_visit_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'loyalty_accounts_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'loyalty_accounts_guest_id_fkey';
                        columns: ['guest_id'];
                        isOneToOne: false;
                        referencedRelation: 'guests';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'loyalty_accounts_program_id_fkey';
                        columns: ['program_id'];
                        isOneToOne: false;
                        referencedRelation: 'loyalty_programs';
                        referencedColumns: ['id'];
                    },
                ];
            };
            loyalty_programs: {
                Row: {
                    id: string;
                    restaurant_id: string;
                    name: string;
                    points_rule_json: Json;
                    tier_rule_json: Json;
                    status: string;
                    created_by: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    restaurant_id: string;
                    name: string;
                    points_rule_json?: Json;
                    tier_rule_json?: Json;
                    status?: string;
                    created_by?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    restaurant_id?: string;
                    name?: string;
                    points_rule_json?: Json;
                    tier_rule_json?: Json;
                    status?: string;
                    created_by?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'loyalty_programs_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            loyalty_transactions: {
                Row: {
                    id: string;
                    restaurant_id: string;
                    account_id: string;
                    order_id: string | null;
                    points_delta: number;
                    balance_after: number;
                    transaction_type: string;
                    reason: string | null;
                    metadata: Json;
                    created_by: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    restaurant_id: string;
                    account_id: string;
                    order_id?: string | null;
                    points_delta: number;
                    balance_after: number;
                    transaction_type: string;
                    reason?: string | null;
                    metadata?: Json;
                    created_by?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    restaurant_id?: string;
                    account_id?: string;
                    order_id?: string | null;
                    points_delta?: number;
                    balance_after?: number;
                    transaction_type?: string;
                    reason?: string | null;
                    metadata?: Json;
                    created_by?: string | null;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'loyalty_transactions_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'loyalty_transactions_account_id_fkey';
                        columns: ['account_id'];
                        isOneToOne: false;
                        referencedRelation: 'loyalty_accounts';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'loyalty_transactions_order_id_fkey';
                        columns: ['order_id'];
                        isOneToOne: false;
                        referencedRelation: 'orders';
                        referencedColumns: ['id'];
                    },
                ];
            };
            menu_items: {
                Row: {
                    allergens: string[] | null;
                    category_id: string;
                    connected_stations: string[];
                    course: string;
                    created_at: string | null;
                    description: string | null;
                    description_am: string | null;
                    dietary_tags: string[] | null;
                    has_ar: boolean | null;
                    id: string;
                    image_url: string | null;
                    ingredients: string[] | null;
                    is_available: boolean | null;
                    is_chef_special: boolean | null;
                    is_fasting: boolean | null;
                    likes_count: number | null;
                    model_glb: string | null;
                    model_scale: string | null;
                    model_usdz: string | null;
                    modifiers: Json | null;
                    name: string;
                    name_am: string | null;
                    nutrition: Json | null;
                    order_count: number | null;
                    pairings: string[] | null;
                    popularity: number | null;
                    preparation_time: number | null;
                    preparation_time_minutes: number | null;
                    price: number;
                    rating: number | null;
                    reviews_count: number | null;
                    spicy_level: number | null;
                    station: string | null;
                    stock_quantity: number | null;
                    upsell_tags: string[] | null;
                    complementary_items: string[] | null;
                    updated_at: string | null;
                };
                Insert: {
                    allergens?: string[] | null;
                    category_id: string;
                    connected_stations?: string[];
                    course?: string;
                    created_at?: string | null;
                    description?: string | null;
                    description_am?: string | null;
                    dietary_tags?: string[] | null;
                    has_ar?: boolean | null;
                    id?: string;
                    image_url?: string | null;
                    ingredients?: string[] | null;
                    is_available?: boolean | null;
                    is_chef_special?: boolean | null;
                    is_fasting?: boolean | null;
                    likes_count?: number | null;
                    model_glb?: string | null;
                    model_scale?: string | null;
                    model_usdz?: string | null;
                    modifiers?: Json | null;
                    name: string;
                    name_am?: string | null;
                    nutrition?: Json | null;
                    order_count?: number | null;
                    pairings?: string[] | null;
                    popularity?: number | null;
                    preparation_time?: number | null;
                    preparation_time_minutes?: number | null;
                    price: number;
                    rating?: number | null;
                    reviews_count?: number | null;
                    spicy_level?: number | null;
                    station?: string | null;
                    stock_quantity?: number | null;
                    upsell_tags?: string[] | null;
                    complementary_items?: string[] | null;
                    updated_at?: string | null;
                };
                Update: {
                    allergens?: string[] | null;
                    category_id?: string;
                    connected_stations?: string[];
                    course?: string;
                    created_at?: string | null;
                    description?: string | null;
                    description_am?: string | null;
                    dietary_tags?: string[] | null;
                    has_ar?: boolean | null;
                    id?: string;
                    image_url?: string | null;
                    ingredients?: string[] | null;
                    is_available?: boolean | null;
                    is_chef_special?: boolean | null;
                    is_fasting?: boolean | null;
                    likes_count?: number | null;
                    model_glb?: string | null;
                    model_scale?: string | null;
                    model_usdz?: string | null;
                    modifiers?: Json | null;
                    name?: string;
                    name_am?: string | null;
                    nutrition?: Json | null;
                    order_count?: number | null;
                    pairings?: string[] | null;
                    popularity?: number | null;
                    preparation_time?: number | null;
                    preparation_time_minutes?: number | null;
                    price?: number;
                    rating?: number | null;
                    reviews_count?: number | null;
                    spicy_level?: number | null;
                    station?: string | null;
                    stock_quantity?: number | null;
                    upsell_tags?: string[] | null;
                    complementary_items?: string[] | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'items_category_id_fkey';
                        columns: ['category_id'];
                        isOneToOne: false;
                        referencedRelation: 'categories';
                        referencedColumns: ['id'];
                    },
                ];
            };
            menu_location_links: {
                Row: {
                    id: string;
                    menu_config_id: string;
                    restaurant_id: string;
                    is_primary: boolean;
                    sync_enabled: boolean;
                    sync_status: string | null;
                    last_sync_at: string | null;
                    pending_changes: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    menu_config_id: string;
                    restaurant_id: string;
                    is_primary?: boolean;
                    sync_enabled?: boolean;
                    sync_status?: string | null;
                    last_sync_at?: string | null;
                    pending_changes?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    menu_config_id?: string;
                    restaurant_id?: string;
                    is_primary?: boolean;
                    sync_enabled?: boolean;
                    sync_status?: string | null;
                    last_sync_at?: string | null;
                    pending_changes?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'menu_location_links_menu_config_id_fkey';
                        columns: ['menu_config_id'];
                        isOneToOne: false;
                        referencedRelation: 'centralized_menu_configs';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'menu_location_links_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            menu_change_queue: {
                Row: {
                    id: string;
                    menu_config_id: string;
                    change_type: string;
                    entity_type: string;
                    entity_id: string;
                    location_ids: string[];
                    change_data: Json;
                    status: string;
                    applied_at: string | null;
                    applied_to: string[];
                    failed_at: string | null;
                    error_message: string | null;
                    created_at: string;
                    created_by: string;
                };
                Insert: {
                    id?: string;
                    menu_config_id: string;
                    change_type: string;
                    entity_type: string;
                    entity_id: string;
                    location_ids?: string[];
                    change_data?: Json;
                    status?: string;
                    applied_at?: string | null;
                    applied_to?: string[];
                    failed_at?: string | null;
                    error_message?: string | null;
                    created_at?: string;
                    created_by: string;
                };
                Update: {
                    id?: string;
                    menu_config_id?: string;
                    change_type?: string;
                    entity_type?: string;
                    entity_id?: string;
                    location_ids?: string[];
                    change_data?: Json;
                    status?: string;
                    applied_at?: string | null;
                    applied_to?: string[];
                    failed_at?: string | null;
                    error_message?: string | null;
                    created_at?: string;
                    created_by?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'menu_change_queue_menu_config_id_fkey';
                        columns: ['menu_config_id'];
                        isOneToOne: false;
                        referencedRelation: 'centralized_menu_configs';
                        referencedColumns: ['id'];
                    },
                ];
            };
            modifier_groups: {
                Row: {
                    created_at: string | null;
                    id: string;
                    is_active: boolean | null;
                    max_select: number | null;
                    menu_item_id: string;
                    min_select: number | null;
                    multi_select: boolean | null;
                    name: string;
                    name_am: string | null;
                    required: boolean | null;
                    restaurant_id: string;
                    sort_order: number | null;
                    updated_at: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    id?: string;
                    is_active?: boolean | null;
                    max_select?: number | null;
                    menu_item_id: string;
                    min_select?: number | null;
                    multi_select?: boolean | null;
                    name: string;
                    name_am?: string | null;
                    required?: boolean | null;
                    restaurant_id: string;
                    sort_order?: number | null;
                    updated_at?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    is_active?: boolean | null;
                    max_select?: number | null;
                    menu_item_id?: string;
                    min_select?: number | null;
                    multi_select?: boolean | null;
                    name?: string;
                    name_am?: string | null;
                    required?: boolean | null;
                    restaurant_id?: string;
                    sort_order?: number | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'modifier_groups_menu_item_id_fkey';
                        columns: ['menu_item_id'];
                        isOneToOne: false;
                        referencedRelation: 'menu_items';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'modifier_groups_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            modifier_options: {
                Row: {
                    created_at: string | null;
                    id: string;
                    is_available: boolean | null;
                    modifier_group_id: string;
                    name: string;
                    name_am: string | null;
                    price_adjustment: number | null;
                    restaurant_id: string;
                    sort_order: number | null;
                };
                Insert: {
                    created_at?: string | null;
                    id?: string;
                    is_available?: boolean | null;
                    modifier_group_id: string;
                    name: string;
                    name_am?: string | null;
                    price_adjustment?: number | null;
                    restaurant_id: string;
                    sort_order?: number | null;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    is_available?: boolean | null;
                    modifier_group_id?: string;
                    name?: string;
                    name_am?: string | null;
                    price_adjustment?: number | null;
                    restaurant_id?: string;
                    sort_order?: number | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'modifier_options_modifier_group_id_fkey';
                        columns: ['modifier_group_id'];
                        isOneToOne: false;
                        referencedRelation: 'modifier_groups';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'modifier_options_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            notification_logs: {
                Row: {
                    id: string;
                    restaurant_id: string;
                    order_id: string | null;
                    type: string;
                    recipient: string | null;
                    status: string;
                    provider: string | null;
                    error_message: string | null;
                    metadata: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    restaurant_id: string;
                    order_id?: string | null;
                    type: string;
                    recipient?: string | null;
                    status?: string;
                    provider?: string | null;
                    error_message?: string | null;
                    metadata?: Json;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    restaurant_id?: string;
                    order_id?: string | null;
                    type?: string;
                    recipient?: string | null;
                    status?: string;
                    provider?: string | null;
                    error_message?: string | null;
                    metadata?: Json;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'notification_logs_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'notification_logs_order_id_fkey';
                        columns: ['order_id'];
                        isOneToOne: false;
                        referencedRelation: 'orders';
                        referencedColumns: ['id'];
                    },
                ];
            };
            order_check_split_items: {
                Row: {
                    created_at: string;
                    id: string;
                    idempotency_key: string | null;
                    line_amount: number;
                    order_id: string;
                    order_item_id: string;
                    quantity: number;
                    restaurant_id: string;
                    split_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    idempotency_key?: string | null;
                    line_amount: number;
                    order_id: string;
                    order_item_id: string;
                    quantity?: number;
                    restaurant_id: string;
                    split_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    idempotency_key?: string | null;
                    line_amount?: number;
                    order_id?: string;
                    order_item_id?: string;
                    quantity?: number;
                    restaurant_id?: string;
                    split_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'order_check_split_items_order_id_fkey';
                        columns: ['order_id'];
                        isOneToOne: false;
                        referencedRelation: 'orders';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'order_check_split_items_order_item_id_fkey';
                        columns: ['order_item_id'];
                        isOneToOne: false;
                        referencedRelation: 'order_items';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'order_check_split_items_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'order_check_split_items_split_id_fkey';
                        columns: ['split_id'];
                        isOneToOne: false;
                        referencedRelation: 'order_check_splits';
                        referencedColumns: ['id'];
                    },
                ];
            };
            order_check_splits: {
                Row: {
                    computed_amount: number;
                    created_at: string;
                    created_by: string | null;
                    id: string;
                    metadata: Json;
                    order_id: string;
                    requested_amount: number | null;
                    restaurant_id: string;
                    split_index: number;
                    split_label: string | null;
                    status: string;
                    updated_at: string;
                };
                Insert: {
                    computed_amount?: number;
                    created_at?: string;
                    created_by?: string | null;
                    id?: string;
                    metadata?: Json;
                    order_id: string;
                    requested_amount?: number | null;
                    restaurant_id: string;
                    split_index: number;
                    split_label?: string | null;
                    status?: string;
                    updated_at?: string;
                };
                Update: {
                    computed_amount?: number;
                    created_at?: string;
                    created_by?: string | null;
                    id?: string;
                    metadata?: Json;
                    order_id?: string;
                    requested_amount?: number | null;
                    restaurant_id?: string;
                    split_index?: number;
                    split_label?: string | null;
                    status?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'order_check_splits_order_id_fkey';
                        columns: ['order_id'];
                        isOneToOne: false;
                        referencedRelation: 'orders';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'order_check_splits_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            order_events: {
                Row: {
                    actor_user_id: string | null;
                    created_at: string;
                    event_type: string;
                    from_status: string | null;
                    id: string;
                    metadata: Json;
                    order_id: string;
                    restaurant_id: string;
                    to_status: string | null;
                };
                Insert: {
                    actor_user_id?: string | null;
                    created_at?: string;
                    event_type: string;
                    from_status?: string | null;
                    id?: string;
                    metadata?: Json;
                    order_id: string;
                    restaurant_id: string;
                    to_status?: string | null;
                };
                Update: {
                    actor_user_id?: string | null;
                    created_at?: string;
                    event_type?: string;
                    from_status?: string | null;
                    id?: string;
                    metadata?: Json;
                    order_id?: string;
                    restaurant_id?: string;
                    to_status?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'order_events_order_id_fkey';
                        columns: ['order_id'];
                        isOneToOne: false;
                        referencedRelation: 'orders';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'order_events_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            order_items: {
                Row: {
                    completed_at: string | null;
                    course: string;
                    created_at: string | null;
                    id: string;
                    idempotency_key: string | null;
                    item_id: string;
                    modifiers: Json | null;
                    name: string;
                    notes: string | null;
                    order_id: string;
                    price: number;
                    quantity: number | null;
                    restaurant_id: string;
                    started_at: string | null;
                    station: string | null;
                    status: string | null;
                };
                Insert: {
                    completed_at?: string | null;
                    course?: string;
                    created_at?: string | null;
                    id?: string;
                    idempotency_key?: string | null;
                    item_id: string;
                    modifiers?: Json | null;
                    name: string;
                    notes?: string | null;
                    order_id: string;
                    price: number;
                    quantity?: number | null;
                    restaurant_id: string;
                    started_at?: string | null;
                    station?: string | null;
                    status?: string | null;
                };
                Update: {
                    completed_at?: string | null;
                    course?: string;
                    created_at?: string | null;
                    id?: string;
                    idempotency_key?: string | null;
                    item_id?: string;
                    modifiers?: Json | null;
                    name?: string;
                    notes?: string | null;
                    order_id?: string;
                    price?: number;
                    quantity?: number | null;
                    restaurant_id?: string;
                    started_at?: string | null;
                    station?: string | null;
                    status?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'order_items_item_id_fkey';
                        columns: ['item_id'];
                        isOneToOne: false;
                        referencedRelation: 'menu_items';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'order_items_order_id_fkey';
                        columns: ['order_id'];
                        isOneToOne: false;
                        referencedRelation: 'orders';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'order_items_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            orders: {
                Row: {
                    acknowledged_at: string | null;
                    bar_status: string | null;
                    chapa_tx_ref: string | null;
                    chapa_verified: boolean;
                    completed_at: string | null;
                    created_at: string | null;
                    current_course: string | null;
                    customer_name: string | null;
                    customer_phone: string | null;
                    delivery_address: string | null;
                    discount_amount: number;
                    discount_id: string | null;
                    fire_mode: string;
                    guest_fingerprint: string | null;
                    happy_hour_schedule_id: string | null;
                    id: string;
                    idempotency_key: string | null;
                    items: Json;
                    kitchen_status: string | null;
                    metadata: Json | null;
                    notes: string | null;
                    order_number: string;
                    order_type: string | null;
                    paid_at: string | null;
                    restaurant_id: string;
                    status: string | null;
                    table_number: string;
                    total_price: number;
                    updated_at: string | null;
                };
                Insert: {
                    acknowledged_at?: string | null;
                    bar_status?: string | null;
                    chapa_tx_ref?: string | null;
                    chapa_verified?: boolean;
                    completed_at?: string | null;
                    created_at?: string | null;
                    current_course?: string | null;
                    customer_name?: string | null;
                    customer_phone?: string | null;
                    delivery_address?: string | null;
                    discount_amount?: number;
                    discount_id?: string | null;
                    fire_mode?: string;
                    guest_fingerprint?: string | null;
                    happy_hour_schedule_id?: string | null;
                    id?: string;
                    idempotency_key?: string | null;
                    items: Json;
                    kitchen_status?: string | null;
                    metadata?: Json | null;
                    notes?: string | null;
                    order_number: string;
                    order_type?: string | null;
                    paid_at?: string | null;
                    restaurant_id: string;
                    status?: string | null;
                    table_number: string;
                    total_price: number;
                    updated_at?: string | null;
                };
                Update: {
                    acknowledged_at?: string | null;
                    bar_status?: string | null;
                    chapa_tx_ref?: string | null;
                    chapa_verified?: boolean;
                    completed_at?: string | null;
                    created_at?: string | null;
                    current_course?: string | null;
                    customer_name?: string | null;
                    customer_phone?: string | null;
                    delivery_address?: string | null;
                    discount_amount?: number;
                    discount_id?: string | null;
                    fire_mode?: string;
                    guest_fingerprint?: string | null;
                    happy_hour_schedule_id?: string | null;
                    id?: string;
                    idempotency_key?: string | null;
                    items?: Json;
                    kitchen_status?: string | null;
                    metadata?: Json | null;
                    notes?: string | null;
                    order_number?: string;
                    order_type?: string | null;
                    paid_at?: string | null;
                    restaurant_id?: string;
                    status?: string | null;
                    table_number?: string;
                    total_price?: number;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'orders_discount_id_fkey';
                        columns: ['discount_id'];
                        isOneToOne: false;
                        referencedRelation: 'discounts';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'orders_happy_hour_schedule_id_fkey';
                        columns: ['happy_hour_schedule_id'];
                        isOneToOne: false;
                        referencedRelation: 'happy_hour_schedules';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'orders_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            payment_sessions: {
                Row: {
                    amount: number;
                    authorized_at: string | null;
                    captured_at: string | null;
                    channel: string;
                    checkout_url: string | null;
                    created_at: string;
                    created_by: string | null;
                    currency: string;
                    expires_at: string | null;
                    id: string;
                    intent_type: string;
                    metadata: Json;
                    order_id: string | null;
                    provider_reference: string | null;
                    provider_transaction_id: string | null;
                    restaurant_id: string;
                    selected_method: string | null;
                    selected_provider: string | null;
                    status: string;
                    surface: string;
                    updated_at: string;
                };
                Insert: {
                    amount?: number;
                    authorized_at?: string | null;
                    captured_at?: string | null;
                    channel: string;
                    checkout_url?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    currency?: string;
                    expires_at?: string | null;
                    id?: string;
                    intent_type: string;
                    metadata?: Json;
                    order_id?: string | null;
                    provider_reference?: string | null;
                    provider_transaction_id?: string | null;
                    restaurant_id: string;
                    selected_method?: string | null;
                    selected_provider?: string | null;
                    status: string;
                    surface: string;
                    updated_at?: string;
                };
                Update: {
                    amount?: number;
                    authorized_at?: string | null;
                    captured_at?: string | null;
                    channel?: string;
                    checkout_url?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    currency?: string;
                    expires_at?: string | null;
                    id?: string;
                    intent_type?: string;
                    metadata?: Json;
                    order_id?: string | null;
                    provider_reference?: string | null;
                    provider_transaction_id?: string | null;
                    restaurant_id?: string;
                    selected_method?: string | null;
                    selected_provider?: string | null;
                    status?: string;
                    surface?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'payment_sessions_order_id_fkey';
                        columns: ['order_id'];
                        isOneToOne: false;
                        referencedRelation: 'orders';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'payment_sessions_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            payments: {
                Row: {
                    amount: number;
                    authorized_at: string | null;
                    captured_at: string | null;
                    created_at: string;
                    created_by: string | null;
                    currency: string;
                    id: string;
                    idempotency_key: string | null;
                    metadata: Json;
                    method: string;
                    order_id: string | null;
                    payment_session_id: string | null;
                    provider: string;
                    provider_reference: string | null;
                    restaurant_id: string;
                    split_id: string | null;
                    status: string;
                    tip_allocation_id: string | null;
                    tip_amount: number;
                    tip_pool_id: string | null;
                    updated_at: string;
                };
                Insert: {
                    amount: number;
                    authorized_at?: string | null;
                    captured_at?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    currency?: string;
                    id?: string;
                    idempotency_key?: string | null;
                    metadata?: Json;
                    method: string;
                    order_id?: string | null;
                    payment_session_id?: string | null;
                    provider?: string;
                    provider_reference?: string | null;
                    restaurant_id: string;
                    split_id?: string | null;
                    status?: string;
                    tip_allocation_id?: string | null;
                    tip_amount: number;
                    tip_pool_id?: string | null;
                    updated_at?: string;
                };
                Update: {
                    amount?: number;
                    authorized_at?: string | null;
                    captured_at?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    currency?: string;
                    id?: string;
                    idempotency_key?: string | null;
                    metadata?: Json;
                    method?: string;
                    order_id?: string | null;
                    payment_session_id?: string | null;
                    provider?: string;
                    provider_reference?: string | null;
                    restaurant_id?: string;
                    split_id?: string | null;
                    status?: string;
                    tip_allocation_id?: string | null;
                    tip_amount?: number;
                    tip_pool_id?: string | null;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'payments_order_id_fkey';
                        columns: ['order_id'];
                        isOneToOne: false;
                        referencedRelation: 'orders';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'payments_payment_session_id_fkey';
                        columns: ['payment_session_id'];
                        isOneToOne: false;
                        referencedRelation: 'payment_sessions';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'payments_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'payments_split_id_fkey';
                        columns: ['split_id'];
                        isOneToOne: false;
                        referencedRelation: 'order_check_splits';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'payments_tip_allocation_id_fkey';
                        columns: ['tip_allocation_id'];
                        isOneToOne: false;
                        referencedRelation: 'tip_allocations';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'payments_tip_pool_id_fkey';
                        columns: ['tip_pool_id'];
                        isOneToOne: false;
                        referencedRelation: 'tip_pools';
                        referencedColumns: ['id'];
                    },
                ];
            };
            payouts: {
                Row: {
                    adjustments: number;
                    channel: string;
                    created_at: string;
                    created_by: string | null;
                    currency: string;
                    fees: number;
                    gross: number;
                    id: string;
                    metadata: Json;
                    net: number;
                    paid_at: string | null;
                    period_end: string;
                    period_start: string;
                    provider: string;
                    restaurant_id: string;
                    status: string;
                    updated_at: string;
                };
                Insert: {
                    adjustments: number;
                    channel?: string;
                    created_at?: string;
                    created_by?: string | null;
                    currency?: string;
                    fees: number;
                    gross: number;
                    id?: string;
                    metadata?: Json;
                    net: number;
                    paid_at?: string | null;
                    period_end: string;
                    period_start: string;
                    provider: string;
                    restaurant_id: string;
                    status?: string;
                    updated_at?: string;
                };
                Update: {
                    adjustments?: number;
                    channel?: string;
                    created_at?: string;
                    created_by?: string | null;
                    currency?: string;
                    fees?: number;
                    gross?: number;
                    id?: string;
                    metadata?: Json;
                    net?: number;
                    paid_at?: string | null;
                    period_end?: string;
                    period_start?: string;
                    provider?: string;
                    restaurant_id?: string;
                    status?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'payouts_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            notification_metrics: {
                Row: {
                    id: string;
                    restaurant_id: string;
                    notification_id: string | null;
                    channel: string;
                    status: string;
                    latency_ms: number | null;
                    error_code: string | null;
                    error_message: string | null;
                    is_retry: boolean;
                    recorded_at: string;
                };
                Insert: {
                    id?: string;
                    restaurant_id: string;
                    notification_id?: string | null;
                    channel: string;
                    status: string;
                    latency_ms?: number | null;
                    error_code?: string | null;
                    error_message?: string | null;
                    is_retry?: boolean;
                    recorded_at?: string;
                };
                Update: {
                    id?: string;
                    restaurant_id?: string;
                    notification_id?: string | null;
                    channel?: string;
                    status?: string;
                    latency_ms?: number | null;
                    error_code?: string | null;
                    error_message?: string | null;
                    is_retry?: boolean;
                    recorded_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'notification_metrics_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            push_tokens: {
                Row: {
                    id: string;
                    restaurant_id: string | null;
                    phone: string | null;
                    guest_id: string | null;
                    token: string;
                    platform: string | null;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                    last_used_at: string | null;
                };
                Insert: {
                    id?: string;
                    restaurant_id?: string | null;
                    phone?: string | null;
                    guest_id?: string | null;
                    token: string;
                    platform?: string | null;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                    last_used_at?: string | null;
                };
                Update: {
                    id?: string;
                    restaurant_id?: string | null;
                    phone?: string | null;
                    guest_id?: string | null;
                    token?: string;
                    platform?: string | null;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                    last_used_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'push_tokens_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'push_tokens_guest_id_fkey';
                        columns: ['guest_id'];
                        isOneToOne: false;
                        referencedRelation: 'guests';
                        referencedColumns: ['id'];
                    },
                ];
            };
            rate_limit_logs: {
                Row: {
                    action: string;
                    created_at: string | null;
                    fingerprint: string;
                    id: string;
                    ip_address: string | null;
                    metadata: Json | null;
                    restaurant_id: string | null;
                    user_agent: string | null;
                };
                Insert: {
                    action: string;
                    created_at?: string | null;
                    fingerprint: string;
                    id?: string;
                    ip_address?: string | null;
                    metadata?: Json | null;
                    restaurant_id?: string | null;
                    user_agent?: string | null;
                };
                Update: {
                    action?: string;
                    created_at?: string | null;
                    fingerprint?: string;
                    id?: string;
                    ip_address?: string | null;
                    metadata?: Json | null;
                    restaurant_id?: string | null;
                    user_agent?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'rate_limit_logs_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            reconciliation_entries: {
                Row: {
                    created_at: string;
                    created_by: string | null;
                    delta_amount: number;
                    expected_amount: number;
                    id: string;
                    ledger_id: string;
                    ledger_type: string;
                    metadata: Json;
                    notes: string | null;
                    payment_id: string | null;
                    payout_id: string | null;
                    refund_id: string | null;
                    restaurant_id: string;
                    settled_amount: number;
                    source_id: string | null;
                    source_type: string;
                    status: string;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    created_by?: string | null;
                    delta_amount: number;
                    expected_amount: number;
                    id?: string;
                    ledger_id: string;
                    ledger_type: string;
                    metadata?: Json;
                    notes?: string | null;
                    payment_id?: string | null;
                    payout_id?: string | null;
                    refund_id?: string | null;
                    restaurant_id: string;
                    settled_amount: number;
                    source_id?: string | null;
                    source_type: string;
                    status?: string;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    created_by?: string | null;
                    delta_amount?: number;
                    expected_amount?: number;
                    id?: string;
                    ledger_id?: string;
                    ledger_type?: string;
                    metadata?: Json;
                    notes?: string | null;
                    payment_id?: string | null;
                    payout_id?: string | null;
                    refund_id?: string | null;
                    restaurant_id?: string;
                    settled_amount?: number;
                    source_id?: string | null;
                    source_type?: string;
                    status?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'reconciliation_entries_payment_id_fkey';
                        columns: ['payment_id'];
                        isOneToOne: false;
                        referencedRelation: 'payments';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'reconciliation_entries_payout_id_fkey';
                        columns: ['payout_id'];
                        isOneToOne: false;
                        referencedRelation: 'payouts';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'reconciliation_entries_refund_id_fkey';
                        columns: ['refund_id'];
                        isOneToOne: false;
                        referencedRelation: 'refunds';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'reconciliation_entries_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            refunds: {
                Row: {
                    amount: number;
                    created_at: string;
                    created_by: string | null;
                    id: string;
                    metadata: Json;
                    order_id: string | null;
                    payment_id: string;
                    processed_at: string | null;
                    provider_reference: string | null;
                    reason: string;
                    restaurant_id: string;
                    status: string;
                    updated_at: string;
                };
                Insert: {
                    amount: number;
                    created_at?: string;
                    created_by?: string | null;
                    id?: string;
                    metadata?: Json;
                    order_id?: string | null;
                    payment_id: string;
                    processed_at?: string | null;
                    provider_reference?: string | null;
                    reason: string;
                    restaurant_id: string;
                    status?: string;
                    updated_at?: string;
                };
                Update: {
                    amount?: number;
                    created_at?: string;
                    created_by?: string | null;
                    id?: string;
                    metadata?: Json;
                    order_id?: string | null;
                    payment_id?: string;
                    processed_at?: string | null;
                    provider_reference?: string | null;
                    reason?: string;
                    restaurant_id?: string;
                    status?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'refunds_order_id_fkey';
                        columns: ['order_id'];
                        isOneToOne: false;
                        referencedRelation: 'orders';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'refunds_payment_id_fkey';
                        columns: ['payment_id'];
                        isOneToOne: false;
                        referencedRelation: 'payments';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'refunds_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            restaurant_staff: {
                Row: {
                    assigned_zones: string[] | null;
                    created_at: string | null;
                    id: string;
                    is_active: boolean | null;
                    name: string | null;
                    pin_code: string | null;
                    restaurant_id: string;
                    role: string;
                    user_id: string | null;
                };
                Insert: {
                    assigned_zones?: string[] | null;
                    created_at?: string | null;
                    id?: string;
                    is_active?: boolean | null;
                    name?: string | null;
                    pin_code?: string | null;
                    restaurant_id: string;
                    role: string;
                    user_id?: string | null;
                };
                Update: {
                    assigned_zones?: string[] | null;
                    created_at?: string | null;
                    id?: string;
                    is_active?: boolean | null;
                    name?: string | null;
                    pin_code?: string | null;
                    restaurant_id?: string;
                    role?: string;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'restaurant_staff_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            role_permissions: {
                Row: {
                    id: string;
                    permission: string;
                    role: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    permission: string;
                    role: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    permission?: string;
                    role?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            restaurants: {
                Row: {
                    brand_color: string | null;
                    chapa_settlement_account_name: string | null;
                    chapa_settlement_account_number_masked: string | null;
                    chapa_settlement_bank_code: string | null;
                    chapa_settlement_bank_name: string | null;
                    chapa_subaccount_id: string | null;
                    chapa_subaccount_last_error: string | null;
                    chapa_subaccount_provisioned_at: string | null;
                    chapa_subaccount_status: string;
                    contact_email: string | null;
                    contact_phone: string | null;
                    cover_image_url: string | null;
                    created_at: string | null;
                    currency: string | null;
                    currency_symbol: string | null;
                    description: string | null;
                    features: Json | null;
                    hero_image_url: string | null;
                    hosted_checkout_fee_percentage: number;
                    hours_weekday: string | null;
                    hours_weekend: string | null;
                    id: string;
                    is_active: boolean | null;
                    location: string | null;
                    logo_url: string | null;
                    name: string;
                    name_am: string | null;
                    onboarding_completed: boolean;
                    owner_telegram_chat_id: string | null;
                    platform_fee_percentage: number;
                    promo_banners: Json | null;
                    settings: Json | null;
                    slug: string;
                    social: Json | null;
                    telegram_chat_id: string | null;
                    tin_number: string | null;
                    updated_at: string | null;
                    vat_number: string | null;
                };
                Insert: {
                    brand_color?: string | null;
                    chapa_settlement_account_name?: string | null;
                    chapa_settlement_account_number_masked?: string | null;
                    chapa_settlement_bank_code?: string | null;
                    chapa_settlement_bank_name?: string | null;
                    chapa_subaccount_id?: string | null;
                    chapa_subaccount_last_error?: string | null;
                    chapa_subaccount_provisioned_at?: string | null;
                    chapa_subaccount_status?: string;
                    contact_email?: string | null;
                    contact_phone?: string | null;
                    cover_image_url?: string | null;
                    created_at?: string | null;
                    currency?: string | null;
                    currency_symbol?: string | null;
                    description?: string | null;
                    features?: Json | null;
                    hero_image_url?: string | null;
                    hosted_checkout_fee_percentage?: number;
                    hours_weekday?: string | null;
                    hours_weekend?: string | null;
                    id?: string;
                    is_active?: boolean | null;
                    location?: string | null;
                    logo_url?: string | null;
                    name: string;
                    name_am?: string | null;
                    onboarding_completed?: boolean;
                    owner_telegram_chat_id?: string | null;
                    platform_fee_percentage?: number;
                    promo_banners?: Json | null;
                    settings?: Json | null;
                    slug: string;
                    social?: Json | null;
                    telegram_chat_id?: string | null;
                    tin_number?: string | null;
                    updated_at?: string | null;
                    vat_number?: string | null;
                };
                Update: {
                    brand_color?: string | null;
                    chapa_settlement_account_name?: string | null;
                    chapa_settlement_account_number_masked?: string | null;
                    chapa_settlement_bank_code?: string | null;
                    chapa_settlement_bank_name?: string | null;
                    chapa_subaccount_id?: string | null;
                    chapa_subaccount_last_error?: string | null;
                    chapa_subaccount_provisioned_at?: string | null;
                    chapa_subaccount_status?: string;
                    contact_email?: string | null;
                    contact_phone?: string | null;
                    cover_image_url?: string | null;
                    created_at?: string | null;
                    currency?: string | null;
                    currency_symbol?: string | null;
                    description?: string | null;
                    features?: Json | null;
                    hero_image_url?: string | null;
                    hosted_checkout_fee_percentage?: number;
                    hours_weekday?: string | null;
                    hours_weekend?: string | null;
                    id?: string;
                    is_active?: boolean | null;
                    location?: string | null;
                    logo_url?: string | null;
                    name?: string;
                    onboarding_completed?: boolean;
                    owner_telegram_chat_id?: string | null;
                    platform_fee_percentage?: number;
                    promo_banners?: Json | null;
                    settings?: Json | null;
                    slug?: string;
                    social?: Json | null;
                    telegram_chat_id?: string | null;
                    tin_number?: string | null;
                    updated_at?: string | null;
                    vat_number?: string | null;
                };
                Relationships: [];
            };
            report_executions: {
                Row: {
                    id: string;
                    scheduled_report_id: string;
                    restaurant_id: string;
                    status: string;
                    started_at: string;
                    completed_at: string | null;
                    duration_ms: number | null;
                    report_period_start: string | null;
                    report_period_end: string | null;
                    data_row_count: number | null;
                    file_url: string | null;
                    file_size_bytes: number | null;
                    file_format: string | null;
                    email_sent: boolean | null;
                    email_sent_at: string | null;
                    email_error: string | null;
                    error_message: string | null;
                    error_stack: string | null;
                    metadata: Json;
                };
                Insert: {
                    id?: string;
                    scheduled_report_id: string;
                    restaurant_id: string;
                    status: string;
                    started_at?: string;
                    completed_at?: string | null;
                    duration_ms?: number | null;
                    report_period_start?: string | null;
                    report_period_end?: string | null;
                    data_row_count?: number | null;
                    file_url?: string | null;
                    file_size_bytes?: number | null;
                    file_format?: string | null;
                    email_sent?: boolean | null;
                    email_sent_at?: string | null;
                    email_error?: string | null;
                    error_message?: string | null;
                    error_stack?: string | null;
                    metadata?: Json;
                };
                Update: {
                    id?: string;
                    scheduled_report_id?: string;
                    restaurant_id?: string;
                    status?: string;
                    started_at?: string;
                    completed_at?: string | null;
                    duration_ms?: number | null;
                    report_period_start?: string | null;
                    report_period_end?: string | null;
                    data_row_count?: number | null;
                    file_url?: string | null;
                    file_size_bytes?: number | null;
                    file_format?: string | null;
                    email_sent?: boolean | null;
                    email_sent_at?: string | null;
                    email_error?: string | null;
                    error_message?: string | null;
                    error_stack?: string | null;
                    metadata?: Json;
                };
                Relationships: [
                    {
                        foreignKeyName: 'report_executions_scheduled_report_id_fkey';
                        columns: ['scheduled_report_id'];
                        isOneToOne: false;
                        referencedRelation: 'scheduled_reports';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'report_executions_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            report_templates: {
                Row: {
                    id: string;
                    restaurant_id: string | null;
                    name: string;
                    description: string | null;
                    report_type: string;
                    columns: Json;
                    filters: Json;
                    group_by: string[] | null;
                    order_by: string[] | null;
                    sql_template: string | null;
                    chart_config: Json | null;
                    is_active: boolean | null;
                    is_system: boolean | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    restaurant_id?: string | null;
                    name: string;
                    description?: string | null;
                    report_type: string;
                    columns?: Json;
                    filters?: Json;
                    group_by?: string[] | null;
                    order_by?: string[] | null;
                    sql_template?: string | null;
                    chart_config?: Json | null;
                    is_active?: boolean | null;
                    is_system?: boolean | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    restaurant_id?: string | null;
                    name?: string;
                    description?: string | null;
                    report_type?: string;
                    columns?: Json;
                    filters?: Json;
                    group_by?: string[] | null;
                    order_by?: string[] | null;
                    sql_template?: string | null;
                    chart_config?: Json | null;
                    is_active?: boolean | null;
                    is_system?: boolean | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'report_templates_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            reviews: {
                Row: {
                    comment: string | null;
                    created_at: string | null;
                    id: string;
                    item_id: string | null;
                    rating: number;
                    restaurant_id: string | null;
                    user_name: string;
                };
                Insert: {
                    comment?: string | null;
                    created_at?: string | null;
                    id?: string;
                    item_id?: string | null;
                    rating: number;
                    restaurant_id?: string | null;
                    user_name: string;
                };
                Update: {
                    comment?: string | null;
                    created_at?: string | null;
                    id?: string;
                    item_id?: string | null;
                    rating?: number;
                    restaurant_id?: string | null;
                    user_name?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'reviews_item_id_fkey';
                        columns: ['item_id'];
                        isOneToOne: false;
                        referencedRelation: 'menu_items';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'reviews_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            scheduled_reports: {
                Row: {
                    id: string;
                    restaurant_id: string;
                    name: string;
                    report_type: string;
                    schedule_cron: string;
                    recipient_emails: string[];
                    delivery_method: string;
                    is_active: boolean | null;
                    last_run_at: string | null;
                    next_run_at: string | null;
                    created_by: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    restaurant_id: string;
                    name: string;
                    report_type: string;
                    schedule_cron: string;
                    recipient_emails?: string[];
                    delivery_method: string;
                    is_active?: boolean | null;
                    last_run_at?: string | null;
                    next_run_at?: string | null;
                    created_by?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    restaurant_id?: string;
                    name?: string;
                    report_type?: string;
                    schedule_cron?: string;
                    recipient_emails?: string[];
                    delivery_method?: string;
                    is_active?: boolean | null;
                    last_run_at?: string | null;
                    next_run_at?: string | null;
                    created_by?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'scheduled_reports_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            service_requests: {
                Row: {
                    completed_at: string | null;
                    created_at: string | null;
                    id: string;
                    idempotency_key: string | null;
                    notes: string | null;
                    request_type: string;
                    restaurant_id: string | null;
                    status: string | null;
                    table_number: string;
                };
                Insert: {
                    completed_at?: string | null;
                    created_at?: string | null;
                    id?: string;
                    idempotency_key?: string | null;
                    notes?: string | null;
                    request_type: string;
                    restaurant_id?: string | null;
                    status?: string | null;
                    table_number: string;
                };
                Update: {
                    completed_at?: string | null;
                    created_at?: string | null;
                    id?: string;
                    idempotency_key?: string | null;
                    notes?: string | null;
                    request_type?: string;
                    restaurant_id?: string | null;
                    status?: string | null;
                    table_number?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'service_requests_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            shifts: {
                Row: {
                    created_at: string;
                    created_by: string | null;
                    end_time: string;
                    id: string;
                    notes: string | null;
                    restaurant_id: string;
                    role: string;
                    shift_date: string;
                    staff_id: string;
                    start_time: string;
                    station: string | null;
                    status: string;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    created_by?: string | null;
                    end_time: string;
                    id?: string;
                    notes?: string | null;
                    restaurant_id: string;
                    role: string;
                    shift_date: string;
                    staff_id: string;
                    start_time: string;
                    station?: string | null;
                    status?: string;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    created_by?: string | null;
                    end_time?: string;
                    id?: string;
                    notes?: string | null;
                    restaurant_id?: string;
                    role?: string;
                    shift_date?: string;
                    staff_id?: string;
                    start_time?: string;
                    station?: string | null;
                    status?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'shifts_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'shifts_staff_id_fkey';
                        columns: ['staff_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurant_staff';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'shifts_staff_id_fkey';
                        columns: ['staff_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurant_staff_with_users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            segments: {
                Row: {
                    id: string;
                    restaurant_id: string;
                    name: string;
                    rule_json: Json;
                    created_by: string | null;
                    created_at: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    id?: string;
                    restaurant_id: string;
                    name: string;
                    rule_json?: Json;
                    created_by?: string | null;
                    created_at?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    id?: string;
                    restaurant_id?: string;
                    name?: string;
                    rule_json?: Json;
                    created_by?: string | null;
                    created_at?: string | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'segments_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            staff_invites: {
                Row: {
                    code: string;
                    created_at: string | null;
                    created_by: string | null;
                    email: string | null;
                    expires_at: string;
                    id: string;
                    pin_code: string | null;
                    restaurant_id: string;
                    role: string;
                    status: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    code: string;
                    created_at?: string | null;
                    created_by?: string | null;
                    email?: string | null;
                    expires_at?: string;
                    id?: string;
                    pin_code?: string | null;
                    restaurant_id: string;
                    role: string;
                    status?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    code?: string;
                    created_at?: string | null;
                    created_by?: string | null;
                    email?: string | null;
                    expires_at?: string;
                    id?: string;
                    pin_code?: string | null;
                    restaurant_id?: string;
                    role?: string;
                    status?: string | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'staff_invites_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            stations: {
                Row: {
                    created_at: string | null;
                    description: string | null;
                    enabled: boolean | null;
                    id: string;
                    name: string;
                    restaurant_id: string;
                    station_type: string;
                    telegram_chat_id: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    description?: string | null;
                    enabled?: boolean | null;
                    id?: string;
                    name: string;
                    restaurant_id: string;
                    station_type: string;
                    telegram_chat_id?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    description?: string | null;
                    enabled?: boolean | null;
                    id?: string;
                    name?: string;
                    restaurant_id?: string;
                    station_type?: string;
                    telegram_chat_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'stations_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            support_tickets: {
                Row: {
                    created_at: string;
                    created_by: string | null;
                    description: string;
                    diagnostics_json: Json;
                    id: string;
                    priority: string;
                    restaurant_id: string;
                    source: string;
                    status: string;
                    subject: string;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    created_by?: string | null;
                    description: string;
                    diagnostics_json?: Json;
                    id?: string;
                    priority?: string;
                    restaurant_id: string;
                    source?: string;
                    status?: string;
                    subject: string;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    created_by?: string | null;
                    description?: string;
                    diagnostics_json?: Json;
                    id?: string;
                    priority?: string;
                    restaurant_id?: string;
                    source?: string;
                    status?: string;
                    subject?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'support_tickets_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            sync_idempotency_keys: {
                Row: {
                    created_at: string;
                    id: string;
                    idempotency_key: string;
                    operation_type: string;
                    processed_at: string;
                    restaurant_id: string;
                    result_data: Json | null;
                    version: number | null;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    idempotency_key: string;
                    operation_type: string;
                    processed_at?: string;
                    restaurant_id: string;
                    result_data?: Json | null;
                    version?: number | null;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    idempotency_key?: string;
                    operation_type?: string;
                    processed_at?: string;
                    restaurant_id?: string;
                    result_data?: Json | null;
                    version?: number | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'sync_idempotency_keys_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            system_health: {
                Row: {
                    created_at: string | null;
                    id: string;
                    last_checked: string | null;
                    latency_ms: number | null;
                    message: string | null;
                    metadata: Json | null;
                    service: string;
                    status: string;
                };
                Insert: {
                    created_at?: string | null;
                    id?: string;
                    last_checked?: string | null;
                    latency_ms?: number | null;
                    message?: string | null;
                    metadata?: Json | null;
                    service: string;
                    status: string;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    last_checked?: string | null;
                    latency_ms?: number | null;
                    message?: string | null;
                    metadata?: Json | null;
                    service?: string;
                    status?: string;
                };
                Relationships: [];
            };
            system_health_monitor: {
                Row: {
                    id: string;
                    last_checked: string | null;
                    latency_ms: number | null;
                    message: string | null;
                    metadata: Json | null;
                    service: string;
                    status: string;
                };
                Insert: {
                    id?: string;
                    last_checked?: string | null;
                    latency_ms?: number | null;
                    message?: string | null;
                    metadata?: Json | null;
                    service: string;
                    status: string;
                };
                Update: {
                    id?: string;
                    last_checked?: string | null;
                    latency_ms?: number | null;
                    message?: string | null;
                    metadata?: Json | null;
                    service?: string;
                    status?: string;
                };
                Relationships: [];
            };
            table_sessions: {
                Row: {
                    assigned_staff_id: string | null;
                    closed_at: string | null;
                    created_at: string;
                    guest_count: number;
                    id: string;
                    metadata: Json;
                    notes: string | null;
                    opened_at: string;
                    restaurant_id: string;
                    status: string;
                    table_id: string;
                    updated_at: string;
                };
                Insert: {
                    assigned_staff_id?: string | null;
                    closed_at?: string | null;
                    created_at?: string;
                    guest_count?: number;
                    id?: string;
                    metadata?: Json;
                    notes?: string | null;
                    opened_at?: string;
                    restaurant_id: string;
                    status?: string;
                    table_id: string;
                    updated_at?: string;
                };
                Update: {
                    assigned_staff_id?: string | null;
                    closed_at?: string | null;
                    created_at?: string;
                    guest_count?: number;
                    id?: string;
                    metadata?: Json;
                    notes?: string | null;
                    opened_at?: string;
                    restaurant_id?: string;
                    status?: string;
                    table_id?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'table_sessions_assigned_staff_id_fkey';
                        columns: ['assigned_staff_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurant_staff';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'table_sessions_assigned_staff_id_fkey';
                        columns: ['assigned_staff_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurant_staff_with_users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'table_sessions_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'table_sessions_table_id_fkey';
                        columns: ['table_id'];
                        isOneToOne: false;
                        referencedRelation: 'tables';
                        referencedColumns: ['id'];
                    },
                ];
            };
            tables: {
                Row: {
                    active_order_id: string | null;
                    capacity: number | null;
                    created_at: string | null;
                    id: string;
                    is_active: boolean | null;
                    qr_code_url: string | null;
                    qr_version: number | null;
                    restaurant_id: string | null;
                    status: string | null;
                    table_number: string;
                    updated_at: string | null;
                    zone: string | null;
                };
                Insert: {
                    active_order_id?: string | null;
                    capacity?: number | null;
                    created_at?: string | null;
                    id?: string;
                    is_active?: boolean | null;
                    qr_code_url?: string | null;
                    qr_version?: number | null;
                    restaurant_id?: string | null;
                    status?: string | null;
                    table_number: string;
                    updated_at?: string | null;
                    zone?: string | null;
                };
                Update: {
                    active_order_id?: string | null;
                    capacity?: number | null;
                    created_at?: string | null;
                    id?: string;
                    is_active?: boolean | null;
                    qr_code_url?: string | null;
                    qr_version?: number | null;
                    restaurant_id?: string | null;
                    status?: string | null;
                    table_number?: string;
                    updated_at?: string | null;
                    zone?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'tables_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            tenants: {
                Row: {
                    api_key: string | null;
                    created_at: string | null;
                    id: string;
                    is_active: boolean | null;
                    name: string;
                    settings: Json | null;
                    slug: string;
                };
                Insert: {
                    api_key?: string | null;
                    created_at?: string | null;
                    id?: string;
                    is_active?: boolean | null;
                    name: string;
                    settings?: Json | null;
                    slug: string;
                };
                Update: {
                    api_key?: string | null;
                    created_at?: string | null;
                    id?: string;
                    is_active?: boolean | null;
                    name?: string;
                    settings?: Json | null;
                    slug?: string;
                };
                Relationships: [];
            };
            time_entries: {
                Row: {
                    clock_in_at: string;
                    clock_out_at: string | null;
                    created_at: string;
                    created_by: string | null;
                    id: string;
                    metadata: Json;
                    restaurant_id: string;
                    shift_id: string | null;
                    source: string;
                    staff_id: string;
                    status: string;
                    updated_at: string;
                };
                Insert: {
                    clock_in_at: string;
                    clock_out_at?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    id?: string;
                    metadata?: Json;
                    restaurant_id: string;
                    shift_id?: string | null;
                    source?: string;
                    staff_id: string;
                    status?: string;
                    updated_at?: string;
                };
                Update: {
                    clock_in_at?: string;
                    clock_out_at?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    id?: string;
                    metadata?: Json;
                    restaurant_id?: string;
                    shift_id?: string | null;
                    source?: string;
                    staff_id?: string;
                    status?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'time_entries_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'time_entries_shift_id_fkey';
                        columns: ['shift_id'];
                        isOneToOne: false;
                        referencedRelation: 'shifts';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'time_entries_staff_id_fkey';
                        columns: ['staff_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurant_staff';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'time_entries_staff_id_fkey';
                        columns: ['staff_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurant_staff_with_users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            tip_allocations: {
                Row: {
                    created_at: string;
                    created_by: string | null;
                    distribution: Json;
                    id: string;
                    period_date: string;
                    period_end: string;
                    period_start: string;
                    restaurant_id: string;
                    shift_id: string | null;
                    status: string;
                    tip_pool_id: string;
                    total_tips_collected: number;
                    total_tips_distributed: number;
                    total_tips_pooled: number;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    created_by?: string | null;
                    distribution?: Json;
                    id?: string;
                    period_date: string;
                    period_end: string;
                    period_start: string;
                    restaurant_id: string;
                    shift_id?: string | null;
                    status?: string;
                    tip_pool_id: string;
                    total_tips_collected?: number;
                    total_tips_distributed?: number;
                    total_tips_pooled?: number;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    created_by?: string | null;
                    distribution?: Json;
                    id?: string;
                    period_date?: string;
                    period_end?: string;
                    period_start?: string;
                    restaurant_id?: string;
                    shift_id?: string | null;
                    status?: string;
                    tip_pool_id?: string;
                    total_tips_collected?: number;
                    total_tips_distributed?: number;
                    total_tips_pooled?: number;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'tip_allocations_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'tip_allocations_shift_id_fkey';
                        columns: ['shift_id'];
                        isOneToOne: false;
                        referencedRelation: 'shifts';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'tip_allocations_tip_pool_id_fkey';
                        columns: ['tip_pool_id'];
                        isOneToOne: false;
                        referencedRelation: 'tip_pools';
                        referencedColumns: ['id'];
                    },
                ];
            };
            tip_pool_shares: {
                Row: {
                    created_at: string;
                    id: string;
                    percentage: number;
                    restaurant_id: string;
                    role: string;
                    tip_pool_id: string;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    percentage: number;
                    restaurant_id: string;
                    role: string;
                    tip_pool_id: string;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    percentage?: number;
                    restaurant_id?: string;
                    role?: string;
                    tip_pool_id?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'tip_pool_shares_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'tip_pool_shares_tip_pool_id_fkey';
                        columns: ['tip_pool_id'];
                        isOneToOne: false;
                        referencedRelation: 'tip_pools';
                        referencedColumns: ['id'];
                    },
                ];
            };
            tip_pools: {
                Row: {
                    allocation_mode: string;
                    calculated_from: string;
                    created_at: string;
                    created_by: string | null;
                    description: string | null;
                    description_am: string | null;
                    id: string;
                    is_active: boolean;
                    name: string;
                    name_am: string | null;
                    pool_type: string;
                    pool_value: number;
                    restaurant_id: string;
                    updated_at: string;
                    valid_from: string | null;
                    valid_until: string | null;
                };
                Insert: {
                    allocation_mode?: string;
                    calculated_from?: string;
                    created_at?: string;
                    created_by?: string | null;
                    description?: string | null;
                    description_am?: string | null;
                    id?: string;
                    is_active?: boolean;
                    name: string;
                    name_am?: string | null;
                    pool_type?: string;
                    pool_value?: number;
                    restaurant_id: string;
                    updated_at?: string;
                    valid_from?: string | null;
                    valid_until?: string | null;
                };
                Update: {
                    allocation_mode?: string;
                    calculated_from?: string;
                    created_at?: string;
                    created_by?: string | null;
                    description?: string | null;
                    description_am?: string | null;
                    id?: string;
                    is_active?: boolean;
                    name?: string;
                    name_am?: string | null;
                    pool_type?: string;
                    pool_value?: number;
                    restaurant_id?: string;
                    updated_at?: string;
                    valid_from?: string | null;
                    valid_until?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'tip_pools_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            upsell_analytics: {
                Row: {
                    id: string;
                    restaurant_id: string;
                    guest_id: string | null;
                    item_viewed: string | null;
                    recommended_items: string[] | null;
                    clicked_item: string | null;
                    added_to_cart: boolean | null;
                    order_id: string | null;
                    created_at: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    id?: string;
                    restaurant_id: string;
                    guest_id?: string | null;
                    item_viewed?: string | null;
                    recommended_items?: string[] | null;
                    clicked_item?: string | null;
                    added_to_cart?: boolean | null;
                    order_id?: string | null;
                    created_at?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    id?: string;
                    restaurant_id?: string;
                    guest_id?: string | null;
                    item_viewed?: string | null;
                    recommended_items?: string[] | null;
                    clicked_item?: string | null;
                    added_to_cart?: boolean | null;
                    order_id?: string | null;
                    created_at?: string | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'upsell_analytics_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'upsell_analytics_guest_id_fkey';
                        columns: ['guest_id'];
                        isOneToOne: false;
                        referencedRelation: 'guests';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'upsell_analytics_item_viewed_fkey';
                        columns: ['item_viewed'];
                        isOneToOne: false;
                        referencedRelation: 'menu_items';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'upsell_analytics_clicked_item_fkey';
                        columns: ['clicked_item'];
                        isOneToOne: false;
                        referencedRelation: 'menu_items';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'upsell_analytics_order_id_fkey';
                        columns: ['order_id'];
                        isOneToOne: false;
                        referencedRelation: 'orders';
                        referencedColumns: ['id'];
                    },
                ];
            };
            user_profiles: {
                Row: {
                    email: string | null;
                    first_name: string | null;
                    full_name: string | null;
                    id: string;
                    last_name: string | null;
                    name: string | null;
                    updated_at: string;
                };
                Insert: {
                    email?: string | null;
                    first_name?: string | null;
                    full_name?: string | null;
                    id: string;
                    last_name?: string | null;
                    name?: string | null;
                    updated_at?: string;
                };
                Update: {
                    email?: string | null;
                    first_name?: string | null;
                    full_name?: string | null;
                    id?: string;
                    last_name?: string | null;
                    name?: string | null;
                    updated_at?: string;
                };
                Relationships: [];
            };
            workflow_audit_logs: {
                Row: {
                    created_at: string | null;
                    error_message: string | null;
                    execution_id: string | null;
                    id: string;
                    status: string | null;
                    tenant_id: string | null;
                    workflow_id: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    error_message?: string | null;
                    execution_id?: string | null;
                    id?: string;
                    status?: string | null;
                    tenant_id?: string | null;
                    workflow_id?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    error_message?: string | null;
                    execution_id?: string | null;
                    id?: string;
                    status?: string | null;
                    tenant_id?: string | null;
                    workflow_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'workflow_audit_logs_tenant_id_fkey';
                        columns: ['tenant_id'];
                        isOneToOne: false;
                        referencedRelation: 'tenants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            hourly_sales: {
                Row: {
                    id: number;
                    restaurant_id: string;
                    hour_start: string;
                    hour_end: string;
                    total_orders: number;
                    completed_orders: number;
                    cancelled_orders: number;
                    total_revenue: number;
                    total_discounts: number;
                    total_tips: number;
                    dine_in_orders: number;
                    takeout_orders: number;
                    delivery_orders: number;
                    payment_method_breakdown: Json;
                    top_items: Json;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: number;
                    restaurant_id: string;
                    hour_start: string;
                    hour_end: string;
                    total_orders?: number;
                    completed_orders?: number;
                    cancelled_orders?: number;
                    total_revenue?: number;
                    total_discounts?: number;
                    total_tips?: number;
                    dine_in_orders?: number;
                    takeout_orders?: number;
                    delivery_orders?: number;
                    payment_method_breakdown?: Json;
                    top_items?: Json;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: number;
                    restaurant_id?: string;
                    hour_start?: string;
                    hour_end?: string;
                    total_orders?: number;
                    completed_orders?: number;
                    cancelled_orders?: number;
                    total_revenue?: number;
                    total_discounts?: number;
                    total_tips?: number;
                    dine_in_orders?: number;
                    takeout_orders?: number;
                    delivery_orders?: number;
                    payment_method_breakdown?: Json;
                    top_items?: Json;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            daily_sales: {
                Row: {
                    id: number;
                    restaurant_id: string;
                    date: string;
                    total_orders: number;
                    completed_orders: number;
                    cancelled_orders: number;
                    total_revenue: number;
                    total_discounts: number;
                    total_tips: number;
                    net_revenue: number;
                    dine_in_orders: number;
                    takeout_orders: number;
                    delivery_orders: number;
                    avg_order_value: number;
                    payment_method_breakdown: Json;
                    hourly_distribution: Json;
                    top_items: Json;
                    orders_by_status: Json;
                    new_customers: number;
                    returning_customers: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: number;
                    restaurant_id: string;
                    date: string;
                    total_orders?: number;
                    completed_orders?: number;
                    cancelled_orders?: number;
                    total_revenue?: number;
                    total_discounts?: number;
                    total_tips?: number;
                    net_revenue?: number;
                    dine_in_orders?: number;
                    takeout_orders?: number;
                    delivery_orders?: number;
                    avg_order_value?: number;
                    payment_method_breakdown?: Json;
                    hourly_distribution?: Json;
                    top_items?: Json;
                    orders_by_status?: Json;
                    new_customers?: number;
                    returning_customers?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: number;
                    restaurant_id?: string;
                    date?: string;
                    total_orders?: number;
                    completed_orders?: number;
                    cancelled_orders?: number;
                    total_revenue?: number;
                    total_discounts?: number;
                    total_tips?: number;
                    net_revenue?: number;
                    dine_in_orders?: number;
                    takeout_orders?: number;
                    delivery_orders?: number;
                    avg_order_value?: number;
                    payment_method_breakdown?: Json;
                    hourly_distribution?: Json;
                    top_items?: Json;
                    orders_by_status?: Json;
                    new_customers?: number;
                    returning_customers?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            erca_submissions: {
                Row: {
                    id: string;
                    restaurant_id: string;
                    order_id: string;
                    invoice_number: string;
                    vat_amount_santim: number | null;
                    grand_total_santim: number | null;
                    erca_invoice_id: string | null;
                    qr_payload: string | null;
                    digital_signature: string | null;
                    status: string;
                    error_message: string | null;
                    retry_count: number;
                    submitted_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    restaurant_id: string;
                    order_id: string;
                    invoice_number: string;
                    vat_amount_santim?: number | null;
                    grand_total_santim?: number | null;
                    erca_invoice_id?: string | null;
                    qr_payload?: string | null;
                    digital_signature?: string | null;
                    status?: string;
                    error_message?: string | null;
                    retry_count?: number;
                    submitted_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    restaurant_id?: string;
                    order_id?: string;
                    invoice_number?: string;
                    vat_amount_santim?: number | null;
                    grand_total_santim?: number | null;
                    erca_invoice_id?: string | null;
                    qr_payload?: string | null;
                    digital_signature?: string | null;
                    status?: string;
                    error_message?: string | null;
                    retry_count?: number;
                    submitted_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'erca_submissions_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'erca_submissions_order_id_fkey';
                        columns: ['order_id'];
                        isOneToOne: true;
                        referencedRelation: 'orders';
                        referencedColumns: ['id'];
                    },
                ];
            };
        };
        Views: {
            delivery_partner_integrations: {
                Row: {
                    api_key_masked: string | null;
                    created_at: string | null;
                    id: string | null;
                    provider: string | null;
                    restaurant_id: string | null;
                    status: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    api_key_masked?: never;
                    created_at?: string | null;
                    id?: string | null;
                    provider?: string | null;
                    restaurant_id?: string | null;
                    status?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    api_key_masked?: never;
                    created_at?: string | null;
                    id?: string | null;
                    provider?: string | null;
                    restaurant_id?: string | null;
                    status?: string | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'delivery_partners_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
            restaurant_staff_with_users: {
                Row: {
                    created_at: string | null;
                    email: string | null;
                    first_name: string | null;
                    full_name: string | null;
                    id: string | null;
                    is_active: boolean | null;
                    last_name: string | null;
                    name: string | null;
                    restaurant_id: string | null;
                    role: string | null;
                    user_id: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    email?: never;
                    first_name?: never;
                    full_name?: never;
                    id?: string | null;
                    is_active?: boolean | null;
                    last_name?: never;
                    name?: never;
                    restaurant_id?: string | null;
                    role?: string | null;
                    user_id?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    email?: never;
                    first_name?: never;
                    full_name?: never;
                    id?: string | null;
                    is_active?: boolean | null;
                    last_name?: never;
                    name?: never;
                    restaurant_id?: string | null;
                    role?: string | null;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'restaurant_staff_restaurant_id_fkey';
                        columns: ['restaurant_id'];
                        isOneToOne: false;
                        referencedRelation: 'restaurants';
                        referencedColumns: ['id'];
                    },
                ];
            };
        };
        Functions: {
            birr_to_santim: { Args: { birr_value: number }; Returns: number };
            check_auth_users_fk_cascade: {
                Args: never;
                Returns: {
                    column_name: string;
                    constraint_name: string;
                    has_cascade: boolean;
                    table_name: string;
                }[];
            };
            current_user_id: { Args: never; Returns: string };
            get_my_staff_role: {
                Args: { p_restaurant_id?: string };
                Returns: {
                    restaurant_id: string;
                    role: string;
                }[];
            };
            increment_likes: {
                Args: { delta: number; item_id: string };
                Returns: undefined;
            };
            increment_pending_changes: {
                Args: { p_restaurant_id: string; p_menu_config_id: string };
                Returns: undefined;
            };
            is_agency_admin: { Args: never; Returns: boolean };
            mark_stale_devices_offline: { Args: never; Returns: undefined };
            santim_to_birr: { Args: { santim_value: number }; Returns: number };
            complete_report_execution: {
                Args: {
                    p_execution_id: string;
                    p_status: string;
                    p_file_url: string | null;
                    p_file_size_bytes: number | null;
                    p_error_message: string | null;
                };
                Returns: undefined;
            };
            user_has_restaurant_access: {
                Args: { p_restaurant_id: string };
                Returns: boolean;
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
          DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
          Row: infer R;
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
            DefaultSchema['Views'])
      ? (DefaultSchema['Tables'] &
            DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R;
        }
          ? R
          : never
      : never;

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema['Tables']
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Insert: infer I;
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Insert: infer I;
        }
          ? I
          : never
      : never;

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema['Tables']
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Update: infer U;
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Update: infer U;
        }
          ? U
          : never
      : never;

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
        | keyof DefaultSchema['Enums']
        | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
        : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
      ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
      : never;

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema['CompositeTypes']
        | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
        : never = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
      ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
      : never;

export const Constants = {
    public: {
        Enums: {},
    },
} as const;

// Convenience types
export type Restaurant = Database['public']['Tables']['restaurants']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type MenuItem = Database['public']['Tables']['menu_items']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type Station = Database['public']['Tables']['stations']['Row'];
export type AgencyUser = Database['public']['Tables']['agency_users']['Row'];
export type ServiceRequest = Database['public']['Tables']['service_requests']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

// Restaurant settings type
export interface RestaurantSettings {
    telegram_bot_token?: string;
    telegram_chat_id?: string;
    telegram_kitchen_chat_id?: string;
    telegram_bar_chat_id?: string;
    branding?: {
        primary_color?: string;
        secondary_color?: string;
    };
    enable_ordering?: boolean;
    qr_base_url?: string;
}

// Extended types with relations
export interface CategoryWithItems extends Category {
    items: MenuItem[];
}

export interface RestaurantWithMenu extends Restaurant {
    categories: CategoryWithItems[];
    stations?: Station[];
}

// Cart item type
export interface CartItem {
    id: string;
    name: string;
    name_am?: string | null;
    price: number;
    quantity: number;
    notes?: string;
    image_url?: string | null;
    station: 'kitchen' | 'bar' | 'dessert' | 'coffee';
    modifiers?: string;
}

// Order item type (in JSON)
export interface OrderItem {
    id: string;
    name: string;
    quantity: number;
    price: number;
    notes?: string;
    station?: string;
}

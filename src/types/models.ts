import { Database } from './database';

export type Json = Database['public']['Tables']['restaurants']['Row']['features'];

// Convenience types
export type Restaurant = Database['public']['Tables']['restaurants']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type MenuItem = Database['public']['Tables']['menu_items']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type Station = Database['public']['Tables']['stations']['Row'];
export type AgencyUser = Database['public']['Tables']['agency_users']['Row'];
export type ServiceRequest = Database['public']['Tables']['service_requests']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

// Helper types from the generated schema
export type Tables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Update'];

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

// Re-export StaffRole from canonical source
export type { StaffRole } from './status';

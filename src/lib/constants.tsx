import { FoodItem } from '@/types';
import { Fish, Sandwich, Pizza, Coffee, Leaf, Flame } from 'lucide-react';
import React from 'react';

interface UICategory {
    id: string;
    name: string;
    icon: React.ReactNode;
}

export const CATEGORIES: UICategory[] = [
    { id: 'all', name: 'All', icon: <Flame size={18} /> },
    { id: 'sushi', name: 'Sushi', icon: <Fish size={18} /> },
    { id: 'burger', name: 'Burger', icon: <Sandwich size={18} /> },
    { id: 'pizza', name: 'Pizza', icon: <Pizza size={18} /> },
    { id: 'vegan', name: 'Vegan', icon: <Leaf size={18} /> },
    { id: 'sweet', name: 'Sweet', icon: <Coffee size={18} /> },
];

// Realtime and polling constants
export const GUEST_TRACKER_POLL_INTERVAL_MS = 8000;
export const DEFAULT_LOCATION_ID = 'default-location';
export const TOPIC_FILTER_TABLES_COMMANDS = 'tables/commands';

const SUPABASE_STORAGE_URL =
    'https://axuegixbqsvztdraenkz.supabase.co/storage/v1/object/public/food-images';
const PLACEHOLDER_IMAGE =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="220"%3E%3Crect width="400" height="220" fill="%23DC143C"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="system-ui" font-size="20" fill="white"%3Elole%3C/text%3E%3C/svg%3E';

export const FOOD_ITEMS: FoodItem[] = [
    {
        id: '1',
        title: 'Spicy Tonkotsu',
        shop: 'Ramen Lord',
        price: 450.0,
        imageUrl: `${SUPABASE_STORAGE_URL}/Spicy%20Tonkotsu.webp`,
        category: 'sushi',
        rating: 4.8,
    },
    {
        id: '2',
        title: 'Neon Tacos',
        shop: 'Loco Chino',
        price: 280.0,
        imageUrl: `${SUPABASE_STORAGE_URL}/Neon%20Tacos.webp`,
        category: 'vegan',
        tag: 'Trending',
        rating: 4.5,
    },
    {
        id: '3',
        title: 'Double Smash',
        shop: 'Burger Joint',
        price: 380.0,
        imageUrl: `${SUPABASE_STORAGE_URL}/Double%20Smash.webp`,
        category: 'burger',
        rating: 4.9,
    },
    {
        id: '4',
        title: 'Salmon Poke',
        shop: 'Aloha Bowl',
        price: 520.0,
        imageUrl: `${SUPABASE_STORAGE_URL}/Salmon%20Poke.webp`,
        category: 'sushi',
        rating: 4.7,
    },
    {
        id: '5',
        title: 'Glazed Pop',
        shop: 'Dough & Co.',
        price: 150.0,
        imageUrl: PLACEHOLDER_IMAGE,
        category: 'sweet',
        rating: 4.6,
    },
    {
        id: '6',
        title: 'Truffle Pasta',
        shop: "Nonna's",
        price: 650.0,
        imageUrl: `${SUPABASE_STORAGE_URL}/Truffle%20Pasta.webp`,
        category: 'vegan',
        rating: 4.8,
    },
    {
        id: '7',
        title: 'Lobster Roll',
        shop: 'Seaside Grill',
        price: 750.0,
        imageUrl: PLACEHOLDER_IMAGE,
        category: 'sushi',
        rating: 4.9,
    },
    {
        id: '8',
        title: 'Special Kitfo',
        shop: 'Habesha Grill',
        price: 850.0,
        imageUrl: `${SUPABASE_STORAGE_URL}/Spicy%20Tonkotsu.webp`,
        category: 'traditional',
        rating: 4.8,
    },
    {
        id: '9',
        title: 'Special Beyaynetu',
        shop: 'Habesha Grill',
        price: 600.0,
        imageUrl: `${SUPABASE_STORAGE_URL}/Neon%20Tacos.webp`, // Placeholder real image
        category: 'traditional',
        rating: 4.7,
    },
    {
        id: '10',
        title: 'Shekla Tibs',
        shop: 'Habesha Grill',
        price: 900.0,
        imageUrl: `${SUPABASE_STORAGE_URL}/Double%20Smash.webp`, // Placeholder real image
        category: 'traditional',
        rating: 4.9,
    },
];

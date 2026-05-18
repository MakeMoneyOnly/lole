'use client';

import React, { useState } from 'react';
import { Plus, Search, ChevronRight, MoreVertical } from 'lucide-react';
import { MenuGridEditor } from '../MenuGridEditor';

import type { CategoryWithItems } from '@/lib/services/dashboardDataService';

// Mock data to display in the editor
const mockCategory: CategoryWithItems = {
    id: 'cat_1',
    name: 'Main Courses',
    name_am: 'ዋና ምግቦች',
    section: 'Main',
    order_index: 1,
    items: [
        {
            id: 'item_1',
            name: 'Doro Wat',
            price: 450,
            description: 'Spicy chicken stew with hard-boiled eggs, served with injera.',
            is_available: true,
            image_url:
                'https://images.unsplash.com/photo-1548943487-a2e4f43b4850?q=80&w=300&auto=format&fit=crop',
            category_id: 'cat_1',
        },
        {
            id: 'item_2',
            name: 'Shiro',
            price: 250,
            description: 'Chickpea powder stew prepared with onions, garlic, and ginger.',
            is_available: true,
            category_id: 'cat_1',
        },
        {
            id: 'item_3',
            name: 'Tibs',
            price: 550,
            description: 'Sautéed meat chunks with onions, peppers, and rosemary.',
            is_available: false,
            category_id: 'cat_1',
        },
    ],
};

export function MenuManagerTab({ initialData }: { initialData?: unknown }): React.JSX.Element {
    const categories = ((initialData as Record<string, unknown>)?.categories || [
        mockCategory,
    ]) as CategoryWithItems[];
    const [selectedMenu, setSelectedMenu] = useState('menu_1');
    const [selectedCategory, setSelectedCategory] = useState<string>(
        categories[0]?.id || mockCategory.id
    );

    const activeCategory =
        categories.find((c: CategoryWithItems) => c.id === selectedCategory) || mockCategory;

    return (
        <div className="flex items-start gap-8">
            {/* Sidebar (Menus & Categories) */}
            <div className="sticky top-8 flex w-80 shrink-0 flex-col gap-6 border-r border-gray-100 pr-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-900">Menus</h3>
                        <button className="rounded-lg bg-[#DDF853] p-1 text-black hover:brightness-105">
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="space-y-1">
                        <button
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${selectedMenu === 'menu_1' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                            onClick={() => setSelectedMenu('menu_1')}
                        >
                            Dine-In Menu
                            {selectedMenu === 'menu_1' && (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                        </button>
                        <button
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${selectedMenu === 'menu_2' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                            onClick={() => setSelectedMenu('menu_2')}
                        >
                            Takeaway & Delivery
                            {selectedMenu === 'menu_2' && (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                        </button>
                    </div>
                </div>

                <div className="h-px bg-gray-100" />

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-900">Categories</h3>
                        <button className="rounded-lg bg-gray-100 p-1 text-gray-600 hover:bg-gray-200 hover:text-black">
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                    {categories.map((category: CategoryWithItems) => (
                        <button
                            key={category.id}
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${selectedCategory === category.id ? 'bg-black text-white shadow-none' : 'text-gray-600 hover:bg-gray-50'}`}
                            onClick={() => setSelectedCategory(category.id)}
                        >
                            {category.name}
                            <span className="text-xs opacity-60">
                                {category.items?.length || 0} items
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col gap-6 pb-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{activeCategory.name}</h2>
                        <p className="mt-1 text-sm font-medium text-gray-500">
                            Dine-In Menu • {activeCategory.items?.length || 0} items
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search items..."
                                className="w-64 rounded-xl border border-gray-200 py-2 pr-4 pl-9 text-sm focus:border-transparent focus:ring-2 focus:ring-black focus:outline-none"
                            />
                        </div>
                        <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
                            <MoreVertical className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <MenuGridEditor
                    category={activeCategory}
                    onAddItem={() => {}}
                    onOpenAdvancedEdit={() => {}}
                    onSaveInline={async () => {}}
                    onBulkAvailabilityUpdate={async () => {}}
                    onBulkPriceUpdate={async () => {}}
                />
            </div>
        </div>
    );
}

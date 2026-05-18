'use client';

import React from 'react';
import { Store, Image as ImageIcon, Globe, Clock, MessageSquare, BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RestaurantProfileTab(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Restaurant Profile</h2>
                    <p className="text-sm text-gray-500">
                        Public branding and operational details for customer-facing channels.
                    </p>
                </div>
            </div>

            {/* Branding Section */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-8 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                        <Store className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Branding</h3>
                </div>

                <div className="space-y-8">
                    {/* Visual Assets */}
                    <div className="flex flex-col gap-6 lg:flex-row">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-400">
                                Restaurant Logo
                            </label>
                            <div className="group relative h-32 w-32 cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed border-gray-100 bg-gray-50/50 transition-all hover:bg-gray-100/50 active:scale-95">
                                <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                                    <ImageIcon className="h-6 w-6 text-gray-300 transition-colors group-hover:text-gray-400" />
                                    <span className="text-[10px] font-bold text-gray-400">
                                        Upload
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-1 flex-col gap-2 text-right">
                            <label className="text-left text-sm font-medium text-gray-400">
                                Banner Image
                            </label>
                            <div className="group relative h-32 w-full cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed border-gray-100 bg-gray-50/50 transition-all hover:bg-gray-100/50 active:scale-95">
                                <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                                    <ImageIcon className="h-6 w-6 text-gray-300 transition-colors group-hover:text-gray-400" />
                                    <span className="text-[10px] font-bold text-gray-400">
                                        Upload Banner (min 1200px)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Identity Details */}
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">
                                Trading Name (English)
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-xl border border-gray-100 bg-gray-50/10 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                defaultValue="Cafe Lucia"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">
                                Restaurant Name (Amharic) 🇪🇹
                            </label>
                            <input
                                type="text"
                                className="font-inter w-full rounded-xl border border-gray-100 bg-gray-50/10 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                placeholder="ካፌ ሉቺያ"
                                defaultValue="ካፌ ሉቺያ"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium text-gray-400">
                                Tagline / Motto
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-xl border border-gray-100 bg-gray-50/10 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                placeholder="e.g. The heart of Bole's specialty coffee"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-1">
                            <label className="text-sm font-medium text-gray-400">
                                Description (English)
                            </label>
                            <textarea
                                className="h-32 w-full resize-none rounded-xl border border-gray-100 bg-gray-50/10 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                placeholder="Tell your customers about your restaurant..."
                            />
                        </div>
                        <div className="space-y-2 md:col-span-1">
                            <label className="text-sm font-medium text-gray-400">
                                Description (Amharic) 🇪🇹
                            </label>
                            <textarea
                                className="h-32 w-full resize-none rounded-xl border border-gray-100 bg-gray-50/10 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                placeholder="ስለ ሬስቶራንቱ መግለጫ ይጻፉ..."
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Operations Section */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* Operating Hours */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <Clock className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Operating Hours</h3>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                            <div
                                key={day}
                                className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/30 px-4 py-3 transition-all focus-within:border-[#DDF853] focus-within:ring-1 focus-within:ring-[#DDF853]"
                            >
                                <label className="flex cursor-pointer items-center gap-3">
                                    <div className="relative inline-flex h-4 w-7 shrink-0 items-center">
                                        <input
                                            type="checkbox"
                                            defaultChecked
                                            className="peer sr-only"
                                        />
                                        <div className="h-full w-full rounded-full bg-gray-200 text-black transition-all peer-checked:bg-[#DDF853]" />
                                        <div className="absolute left-0.5 h-3 w-3 rounded-full bg-white transition-all peer-checked:translate-x-3" />
                                    </div>
                                    <span
                                        className={cn(
                                            'text-sm font-bold',
                                            idx > 4 ? 'text-blue-600' : 'text-gray-900'
                                        )}
                                    >
                                        {day}
                                    </span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="time"
                                        defaultValue="08:00"
                                        className="bg-transparent text-xs font-semibold text-gray-900 outline-none"
                                    />
                                    <span className="text-gray-300">-</span>
                                    <input
                                        type="time"
                                        defaultValue="22:00"
                                        className="bg-transparent text-xs font-semibold text-gray-900 outline-none"
                                    />
                                </div>
                            </div>
                        ))}
                        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-3 text-xs font-bold text-gray-500 transition-all hover:bg-gray-100 hover:text-black">
                            Add Holiday / Special Hours Override
                        </button>
                    </div>
                </div>

                {/* Service & Social */}
                <div className="space-y-8">
                    {/* Service Types */}
                    <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <BadgeCheck className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Service Types</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {['Dine-in', 'Takeout', 'Delivery', 'Catering'].map(type => (
                                <label
                                    key={type}
                                    className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 bg-gray-50/30 px-4 py-3 transition-all hover:bg-gray-50"
                                >
                                    <span className="text-sm font-bold text-gray-900">{type}</span>
                                    <div className="relative inline-flex h-5 w-9 cursor-pointer items-center">
                                        <input
                                            type="checkbox"
                                            defaultChecked
                                            className="peer sr-only"
                                        />
                                        <div className="h-full w-full rounded-full bg-gray-200 text-black transition-all peer-checked:bg-[#DDF853]" />
                                        <div className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition-all peer-checked:translate-x-4" />
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Social Media */}
                    <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <MessageSquare className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Presence</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-400">
                                    Telegram Channel 🇪🇹
                                </label>
                                <div className="flex overflow-hidden rounded-xl border border-gray-100 bg-gray-50/10 transition-all focus-within:border-[#DDF853] focus-within:ring-1 focus-within:ring-[#DDF853]">
                                    <span className="flex items-center border-r border-gray-100 bg-gray-100 px-4 text-xs font-bold text-gray-500">
                                        t.me/
                                    </span>
                                    <input
                                        type="text"
                                        className="flex-1 bg-transparent px-4 py-3 text-sm font-semibold text-gray-900 outline-none"
                                        placeholder="cafe_lucia_aa"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-400">
                                    Instagram
                                </label>
                                <div className="flex overflow-hidden rounded-xl border border-gray-100 bg-gray-50/10 transition-all focus-within:border-[#DDF853] focus-within:ring-1 focus-within:ring-[#DDF853]">
                                    <span className="flex items-center border-r border-gray-100 bg-gray-100 px-4 text-xs font-bold text-gray-500">
                                        @
                                    </span>
                                    <input
                                        type="text"
                                        className="flex-1 bg-transparent px-4 py-3 text-sm font-semibold text-gray-900 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-400">
                                    TikTok 🇪🇹
                                </label>
                                <div className="flex overflow-hidden rounded-xl border border-gray-100 bg-gray-50/10 transition-all focus-within:border-[#DDF853] focus-within:ring-1 focus-within:ring-[#DDF853]">
                                    <span className="flex items-center border-r border-gray-100 bg-gray-100 px-4 text-xs font-bold text-gray-500">
                                        @
                                    </span>
                                    <input
                                        type="text"
                                        className="flex-1 bg-transparent px-4 py-3 text-sm font-semibold text-gray-900 outline-none"
                                        placeholder="cafe_lucia"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-400">
                                    WhatsApp Business
                                </label>
                                <div className="flex overflow-hidden rounded-xl border border-gray-100 bg-gray-50/10 transition-all focus-within:border-[#DDF853] focus-within:ring-1 focus-within:ring-[#DDF853]">
                                    <span className="flex items-center border-r border-gray-100 bg-gray-100 px-4 text-xs font-bold text-gray-500">
                                        wa.me/
                                    </span>
                                    <input
                                        type="text"
                                        className="flex-1 bg-transparent px-4 py-3 text-sm font-semibold text-gray-900 outline-none"
                                        placeholder="251911234567"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Amenities & Attributes */}
                        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                            <div className="mb-6 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                    <Globe className="h-5 w-5" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">
                                    Attributes & Amenities
                                </h3>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-400">
                                        Cuisine Tags (Comma separated)
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-gray-100 bg-gray-50/10 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                        placeholder="e.g. Ethiopian, Coffee, Breakfast, Pastry"
                                        defaultValue="Ethiopian, Coffee, Breakfast, Pastry"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-400">
                                            Seating Capacity
                                        </label>
                                        <input
                                            type="number"
                                            className="w-full rounded-xl border border-gray-100 bg-gray-50/10 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                            placeholder="e.g. 120"
                                            defaultValue="120"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-400">
                                            Parking Capacity
                                        </label>
                                        <input
                                            type="number"
                                            className="w-full rounded-xl border border-gray-100 bg-gray-50/10 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                            placeholder="e.g. 20"
                                            defaultValue="20"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-gray-400">
                                        Available Amenities
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            'Free WiFi',
                                            'Outdoor Seating',
                                            'Live Music',
                                            'Valet Parking',
                                            'Wheelchair Accessible',
                                        ].map((amenity, i) => (
                                            <label
                                                key={i}
                                                className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 bg-gray-50/30 px-4 py-3 transition-all hover:bg-gray-50"
                                            >
                                                <span className="text-xs font-bold text-gray-900">
                                                    {amenity}
                                                </span>
                                                <div className="relative inline-flex h-4 w-7 cursor-pointer items-center">
                                                    <input
                                                        type="checkbox"
                                                        defaultChecked={i < 2}
                                                        className="peer sr-only"
                                                    />
                                                    <div className="h-full w-full rounded-full bg-gray-200 text-black transition-all peer-checked:bg-[#DDF853]" />
                                                    <div className="absolute left-0.5 h-3 w-3 rounded-full bg-white transition-all peer-checked:translate-x-3" />
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

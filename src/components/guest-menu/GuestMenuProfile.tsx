'use client';

import React from 'react';
import { Package, MapPin, Ticket, LayoutGrid, Bell, Settings, Mail, Phone, Info, LogOut, ChevronRight, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface MenuItemProps {
    icon: React.ElementType;
    title: string;
    onClick?: () => void;
    isLast?: boolean;
}

const ProfileMenuItem: React.FC<MenuItemProps> = ({ icon: Icon, title, onClick, isLast }) => {
    return (
        <div 
            onClick={onClick}
            className={cn(
                "group flex items-center justify-between px-5 py-4 cursor-pointer active:bg-gray-50 transition-colors",
                !isLast && "border-bottom border-gray-50"
            )}
        >
            <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 group-active:bg-white transition-colors">
                    <Icon className="h-5 w-5 text-black" />
                </div>
                <span className="text-[15px] font-bold text-black tracking-[-0.04em]">{title}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-black/10" />
        </div>
    );
};

const MenuSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    return (
        <div className="mb-6">
            <h3 className="mb-3 px-1 text-[17px] font-bold text-black tracking-[-0.04em]">{title}</h3>
            <div className="overflow-hidden rounded-[24px] border border-brand-neutral-soft/10 bg-white">
                {children}
            </div>
        </div>
    );
};

export const GuestMenuProfile: React.FC<{
    isLoggedIn?: boolean;
    onLogout?: () => void;
}> = ({ isLoggedIn = false, onLogout }) => {
    return (
        <div className="flex flex-col bg-[#FFFFFF] min-h-screen relative">
            {/* Premium Header - Full Bleed to Status Bar */}
            <div className="relative overflow-hidden rounded-b-[40px] bg-black px-5 pt-[calc(env(safe-area-inset-top)+40px)] pb-12 z-10 -mt-[env(safe-area-inset-top)]">
                {/* Background Image Overlay - Fixed for bleed */}
                <div className="absolute inset-0 z-0 h-full w-full">
<Image
                                src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80"
                                alt="Profile Background"
                                fill
                                className="h-full w-full object-cover opacity-40 grayscale"
                                unoptimized={true}
                            />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black" />
                </div>

                <div className="relative z-10 flex items-center gap-5">
                    <div className="relative h-[85px] w-[85px] shrink-0 rounded-full border-2 border-white/20 bg-white/10 p-1 backdrop-blur-sm shadow-xl">
                        <div className="h-full w-full overflow-hidden rounded-full bg-white/20 flex items-center justify-center">
                            <User className="h-10 w-10 text-white/40" />
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                        <h2 className="text-[22px] font-bold text-white tracking-[-0.04em]">Guest User</h2>
                        <span className="text-[14px] font-semibold text-white/60 tracking-[-0.04em]">@guest_lole</span>
                        <button className="mt-3 w-fit rounded-xl border border-white/20 bg-white/10 px-6 py-2 text-[14px] font-bold text-white tracking-[-0.04em] backdrop-blur-md active:scale-95 transition-all">
                            {isLoggedIn ? 'Edit Profile' : 'Track Order'}
                        </button>
                    </div>
                </div>

                <div className="relative z-10 mt-8 flex items-center justify-around">
                    <div className="flex flex-col items-center">
                        <span className="text-[20px] font-bold text-white tracking-[-0.04em]">0</span>
                        <span className="text-[13px] font-medium text-white/60 tracking-[-0.04em]">Orders</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[20px] font-bold text-white tracking-[-0.04em]">0</span>
                        <span className="text-[13px] font-medium text-white/60 tracking-[-0.04em]">Wishlist</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[20px] font-bold text-white tracking-[-0.04em]">0</span>
                        <span className="text-[13px] font-medium text-white/60 tracking-[-0.04em]">Coupons</span>
                    </div>
                </div>
            </div>

            {/* Menu List */}
            <div className="px-5 pt-8 pb-32 bg-[#FFFFFF]">
                <MenuSection title="Account Settings">
                    <ProfileMenuItem icon={Package} title="All Orders" />
                    <ProfileMenuItem icon={MapPin} title="Saved Addresses" />
                    <ProfileMenuItem icon={Ticket} title="Vouchers & Coupons" isLast />
                </MenuSection>

                <MenuSection title="Application">
                    <ProfileMenuItem icon={LayoutGrid} title="Browse Categories" />
                    <ProfileMenuItem icon={Bell} title="Notifications" />
                    <ProfileMenuItem icon={Settings} title="App Settings" isLast />
                </MenuSection>

                <MenuSection title="Help & Info">
                    <ProfileMenuItem icon={Mail} title="Customer Inbox" />
                    <ProfileMenuItem icon={Phone} title="Contact Support" />
                    <ProfileMenuItem icon={Info} title="FAQ" isLast />
                </MenuSection>

                {/* Logout Button */}
                <button 
                    onClick={onLogout}
                    className="mt-4 flex w-full items-center justify-center gap-3 rounded-[18px] border border-red-500/10 bg-red-500/[0.03] py-4 transition-all active:scale-95"
                >
                    <LogOut className="h-5 w-5 text-red-500" />
                    <span className="text-[16px] font-bold text-red-500 tracking-[-0.04em]">
                        {isLoggedIn ? 'Sign Out of Account' : 'Sign In to Lole'}
                    </span>
                </button>
            </div>
        </div>
    );
};

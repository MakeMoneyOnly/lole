'use client';

import React from 'react';
import { ChevronLeft, MapPin, ShoppingCart, ChevronRight, ArrowRight, Trash2, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MenuItem } from '@/app/(guest)/[slug]/menu-client';
import Image from 'next/image';
import { formatCurrency } from '@/lib/utils';

interface CartItemProps {
    item: any;
    onUpdateQuantity: (id: string, delta: number) => void;
    onRemove: (id: string) => void;
}

const CartItem: React.FC<CartItemProps> = ({ item, onUpdateQuantity, onRemove }) => {
    return (
        <div className="flex gap-4 rounded-[24px] bg-[#FFFFFF] border border-brand-neutral-soft/10 p-4 mb-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-brand-neutral-soft/10 bg-[#FFFFFF]">
                <Image
                    src={item.image || item.imageUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                />
            </div>
            
            <div className="flex flex-1 flex-col justify-between">
                <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                        <h3 className="line-clamp-1 text-[16px] font-semibold text-black tracking-tight">
                            {item.title}
                        </h3>
                        <span className="text-[13px] font-light text-black/40">Default Variant</span>
                    </div>
                    <button 
                        onClick={() => onRemove(item.uniqueId || item.id)}
                        className="text-red-500/50 hover:text-red-500 transition-colors"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-[16px] font-bold text-black">
                        {formatCurrency(item.price)}
                    </span>
                    
                    <div className="flex items-center gap-3 rounded-full bg-gray-50 border border-gray-100 px-2 py-1">
                        <button 
                            onClick={() => onUpdateQuantity(item.uniqueId || item.id, -1)}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-gray-100 shadow-sm active:scale-90"
                        >
                            <Minus className="h-3 w-3 text-black" />
                        </button>
                        <span className="min-w-[20px] text-center text-sm font-bold text-black">
                            {item.quantity}
                        </span>
                        <button 
                            onClick={() => onUpdateQuantity(item.uniqueId || item.id, 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-gray-100 shadow-sm active:scale-90"
                        >
                            <Plus className="h-3 w-3 text-black" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const GuestMenuCart: React.FC<{
    cartItems: any[];
    onBack: () => void;
    onUpdateQuantity: (id: string, delta: number) => void;
    onRemove: (id: string) => void;
    onCheckout: () => void;
}> = ({ cartItems = [], onBack, onUpdateQuantity, onRemove, onCheckout }) => {
    const subtotal = cartItems.reduce((acc, curr) => acc + (curr.price || 0) * (curr.quantity || 0), 0);
    const isEmpty = cartItems.length === 0;

    return (
        <div className="flex flex-col bg-[#FFFFFF] min-h-[calc(100vh-76px)]">
            {/* Header */}
            <header className="flex w-full items-center justify-between px-5 py-[7px] bg-[#FFFFFF]">
                <button
                    onClick={onBack}
                    className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-[#FFFFFF] border border-brand-neutral-soft/10 transition-all active:scale-95"
                >
                    <ChevronLeft className="h-6 w-6 text-black" />
                </button>
                <h2 className="text-[20px] font-bold text-black tracking-tight">Cart</h2>
                <button
                    className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-[#FFFFFF] border border-brand-neutral-soft/10 transition-all active:scale-95"
                >
                    <MapPin className="h-6 w-6 text-black" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 pt-4">
                {isEmpty ? (
                    <div className="flex flex-col items-center justify-center pt-20">
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-50 border border-gray-100 mb-6">
                            <ShoppingCart className="h-10 w-10 text-black/10" />
                        </div>
                        <h3 className="text-[20px] font-bold text-black mb-2">Your cart is empty</h3>
                        <p className="text-[14px] font-light text-black/40 text-center px-10">
                            Add some delicious items to start your ordering journey.
                        </p>
                        <button 
                            onClick={onBack}
                            className="mt-8 rounded-full bg-black px-10 py-4 text-white font-bold transition-all active:scale-95"
                        >
                            Start Shopping
                        </button>
                    </div>
                ) : (
                    <div className="pb-32">
                        {cartItems.map((item) => (
                            <CartItem 
                                key={item.uniqueId || item.id} 
                                item={item} 
                                onUpdateQuantity={onUpdateQuantity}
                                onRemove={onRemove}
                            />
                        ))}
                        
                        {/* Recommendations Stubs */}
                        <div className="mt-10 mb-6">
                            <h3 className="text-[18px] font-bold text-black tracking-tight mb-4">You Might Also Like</h3>
                            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="w-40 shrink-0 rounded-[24px] border border-brand-neutral-soft/10 p-3">
                                        <div className="relative aspect-square w-full rounded-2xl bg-gray-100 overflow-hidden mb-2" />
                                        <div className="h-4 w-20 bg-gray-100 rounded mb-2" />
                                        <div className="h-4 w-12 bg-gray-200 rounded" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Bar */}
            {!isEmpty && (
                <div className="fixed bottom-[76px] left-0 right-0 z-40 flex justify-center px-5 pb-4">
                    <div className="flex w-full max-w-md items-center justify-between rounded-[24px] bg-[#F9F9F9] border border-brand-neutral-soft/10 p-5">
                        <div className="flex flex-col">
                            <span className="text-[13px] font-light text-black/40">Subtotal</span>
                            <span className="text-[22px] font-bold text-black tracking-tight">
                                {formatCurrency(subtotal)}
                            </span>
                        </div>
                        <button
                            onClick={onCheckout}
                            className="flex items-center gap-2 rounded-full bg-[#1B3C58] px-8 py-4 text-white font-bold transition-all active:scale-95"
                        >
                            <span>Checkout</span>
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

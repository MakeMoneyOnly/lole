'use client';

import React from 'react';
import { ChevronLeft, MapPin, ShoppingCart, ChevronRight, ArrowRight, Trash2, Plus, Minus, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { formatCurrency } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface CartItemProps {
    item: any;
    onUpdateQuantity: (id: string, delta: number) => void;
    onRemove: (id: string) => void;
}

const CartItem: React.FC<CartItemProps> = ({ item, onUpdateQuantity, onRemove }) => {
    const [isSlidOpen, setIsSlidOpen] = React.useState(false);

    return (
        <div className="relative overflow-hidden rounded-[28px] mb-4 bg-[#FFE8E8]">
            {/* Background Swipe Action Container (Trash Can) */}
            <div 
                onClick={() => onRemove(item.uniqueId || item.id)}
                className="absolute right-0 top-0 bottom-0 flex w-[90px] items-center justify-center bg-[#FFE8E8] text-[#FF3B30] rounded-r-[28px] cursor-pointer active:bg-[#FFD1D1] transition-colors"
            >
                <Trash2 className="h-6 w-6" />
            </div>

            {/* Draggable Card Front Layer */}
            <motion.div
                drag="x"
                dragConstraints={{ left: -90, right: 0 }}
                dragElastic={0.1}
                onDragEnd={(event, info) => {
                    if (info.offset.x < -30) {
                        setIsSlidOpen(true);
                    } else {
                        setIsSlidOpen(false);
                    }
                }}
                animate={{ x: isSlidOpen ? -90 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="flex gap-4 rounded-[28px] bg-[#FFFFFF] border border-brand-neutral-soft/5 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.03)] p-4 relative z-10 select-none cursor-grab active:cursor-grabbing"
            >
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#F6F6F6] flex items-center justify-center">
                    {item.image || item.imageUrl ? (
                        <Image
                            src={item.image || item.imageUrl}
                            alt={item.title}
                            fill
                            className="object-cover"
                            draggable={false}
                        />
                    ) : (
                        <span className="text-[22px] font-bold text-black/20 select-none">
                            {item.title ? item.title.charAt(0).toUpperCase() : 'L'}
                        </span>
                    )}
                </div>
                
                <div className="flex flex-1 flex-col justify-between">
                    <div className="flex items-start justify-between">
                        <div className="flex flex-col">
                            <h3 className="line-clamp-1 text-[16px] font-bold text-black tracking-tight">
                                {item.title}
                            </h3>
                            {/* Date Subtitle matching Image 2 */}
                            <div className="flex items-center gap-1 text-[12px] font-light text-black/40 mt-0.5">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-black/40">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span>02.01-07.01</span>
                            </div>
                        </div>
                        
                        <button className="text-black/20 hover:text-black/50 transition-colors mt-0.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil">
                                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                            </svg>
                        </button>
                    </div>

                    <div className="flex items-end justify-between mt-3">
                        {/* Rounded Compact Quantity Controller */}
                        <div className="flex items-center gap-3.5 rounded-full bg-[#F3F3F3] px-3.5 py-1.5">
                            <button 
                                onClick={() => onUpdateQuantity(item.uniqueId || item.id, -1)}
                                className="text-[16px] font-bold text-black/60 active:scale-75 transition-transform"
                            >
                                <Minus className="h-3 w-3 text-black" strokeWidth={3} />
                            </button>
                            <span className="min-w-[14px] text-center text-[13px] font-bold text-black">
                                {item.quantity}
                            </span>
                            <button 
                                onClick={() => onUpdateQuantity(item.uniqueId || item.id, 1)}
                                className="text-[16px] font-bold text-black/60 active:scale-75 transition-transform"
                            >
                                <Plus className="h-3 w-3 text-black" strokeWidth={3} />
                            </button>
                        </div>

                        <span className="text-[16px] font-bold text-black tracking-tight pb-0.5">
                            {formatCurrency(item.price / 100)}
                        </span>
                    </div>
                </div>
            </motion.div>
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
    const [showDiscount, setShowDiscount] = React.useState(false);

    return (
        <div className="flex flex-col bg-[#FFFFFF] min-h-[calc(100vh-76px)]">
            {/* Pixel Perfect Image 2 Header - Main White Background */}
            <header className="flex w-full items-center justify-between px-5 py-4 bg-[#FFFFFF]">
                <button
                    onClick={onBack}
                    className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#FFFFFF] border border-brand-neutral-soft/5 active:scale-95"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 6H20M4 12H14M4 18H9" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                </button>
                
                <h2 className="text-[20px] font-bold text-black tracking-tight">My Order</h2>
                
                <button
                    className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#FFFFFF] border border-brand-neutral-soft/5 active:scale-95"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="5" r="2.5" fill="black" />
                        <circle cx="12" cy="12" r="2.5" fill="black" />
                        <circle cx="12" cy="19" r="2.5" fill="black" />
                    </svg>
                </button>
            </header>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-48 bg-[#FFFFFF]">
                {isEmpty ? (
                    <div className="flex flex-col items-center justify-center pt-20">
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#F6F6F6] shadow-sm mb-6">
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
                    <div>
                        {cartItems.map((item) => (
                            <CartItem 
                                key={item.uniqueId || item.id} 
                                item={item} 
                                onUpdateQuantity={onUpdateQuantity}
                                onRemove={onRemove}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Checkout & Total Card from Image 2 */}
            {!isEmpty && (
                <div className="fixed bottom-[76px] left-0 right-0 z-40 bg-[#FFFFFF] rounded-t-[32px] border-t border-brand-neutral-soft/5 shadow-2xl shadow-black/5 px-5 pt-5 pb-4">
                    {/* Discount Input directly at the top of checkout card */}
                    <div className="flex items-center justify-between rounded-[20px] bg-[#F3F3F3] px-4 py-3 mb-3 border border-black/5">
                        <input 
                            type="text" 
                            placeholder="Enter your discount code" 
                            className="bg-transparent border-none text-[14px] font-light text-black/60 focus:outline-none flex-1"
                        />
                        <button className="text-[14px] font-bold text-[#000000] hover:text-black/80 transition-colors ml-2">
                            Apply
                        </button>
                    </div>

                    {/* Subtotal Row - Extremely tight */}
                    <div className="flex items-center justify-between py-0.5">
                        <span className="text-[14px] font-light text-black/40">Subtotal</span>
                        <span className="text-[16px] font-bold text-[#000000] tracking-tight">
                            {formatCurrency(subtotal / 100)}
                        </span>
                    </div>

                    {/* Dotted Divider line - Extremely tight */}
                    <div className="border-t border-dashed border-black/10 my-2" />

                    {/* Total Row - Extremely tight */}
                    <div className="flex items-center justify-between py-0.5 mb-3">
                        <span className="text-[14px] font-bold text-[#000000]">Total</span>
                        <span className="text-[18px] font-bold text-[#000000] tracking-tight">
                            {formatCurrency(subtotal / 100)}
                        </span>
                    </div>

                    {/* Lime Pay Button */}
                    <button
                        onClick={onCheckout}
                        className="w-full flex items-center justify-center rounded-[20px] bg-[#DDF853] py-4 text-[16px] font-bold text-[#000000] transition-all active:scale-[0.98] shadow-sm"
                    >
                        Pay
                    </button>
                </div>
            )}
        </div>
    );
};

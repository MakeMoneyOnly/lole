'use client';

import React from 'react';
import { ShoppingCart, Trash2, Plus, Minus } from 'lucide-react';
import Image from 'next/image';
import { formatCurrency } from '@/lib/utils';
import { cleanItemTitle } from '@/lib/utils/monetary';
import { motion } from 'framer-motion';
import type { CartItem } from '@/domains/cart/service';

interface CartItemProps {
    item: CartItem;
    onUpdateQuantity: (id: string, delta: number) => void;
    onRemove: (id: string) => void;
}

const CartItem: React.FC<CartItemProps> = ({ item, onUpdateQuantity, onRemove }) => {
    const [isSlidOpen, setIsSlidOpen] = React.useState(false);
    const cleanedTitle = cleanItemTitle(item.title);

    return (
        <div className="relative mb-4 overflow-hidden rounded-[28px] bg-[#FFE8E8]">
            {/* Background Swipe Action Container (Trash Can) */}
            <div
                onClick={() => onRemove(item.uniqueId)}
                className="absolute top-0 right-0 bottom-0 flex w-[90px] cursor-pointer items-center justify-center rounded-r-[28px] bg-[#FFE8E8] text-[#EF4444] transition-colors active:bg-[#FFD1D1]"
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
                className="border-brand-neutral-soft/5 relative z-10 flex cursor-grab gap-4 rounded-[28px] border bg-[#FFFFFF] p-4 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.03)] select-none active:cursor-grabbing"
            >
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#F6F6F6]">
                    {item.image ? (
                        <Image
                            src={item.image}
                            alt={cleanedTitle}
                            fill
                            className="object-cover"
                            draggable={false}
                            unoptimized={true}
                        />
                    ) : (
                        <span className="text-[22px] font-bold text-black/20 select-none">
                            {cleanedTitle ? cleanedTitle.charAt(0).toUpperCase() : 'L'}
                        </span>
                    )}
                </div>

                <div className="flex flex-1 flex-col justify-between">
                    <div className="flex items-start justify-between">
                        <div className="flex flex-col">
                            <h3 className="line-clamp-1 text-[16px] font-bold tracking-[-0.04em] text-[#1A1C1E]">
                                {cleanedTitle}
                            </h3>
                            {/* Date Subtitle matching Image 2 */}
                            <div className="mt-0.5 flex items-center gap-1 text-[12px] font-semibold tracking-[-0.04em] text-black/40">
                                <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="text-black/40"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span>02.01-07.01</span>
                            </div>
                        </div>

                        <button className="mt-0.5 text-black/20 transition-colors hover:text-black/50">
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="lucide lucide-pencil"
                            >
                                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                        </button>
                    </div>

                    <div className="mt-3 flex items-end justify-between">
                        {/* Rounded Compact Quantity Controller */}
                        <div className="flex items-center gap-3.5 rounded-full bg-[#F3F3F3] px-3.5 py-1.5">
                            <button
                                onClick={() => onUpdateQuantity(item.uniqueId, -1)}
                                className="text-[16px] font-bold text-black/60 transition-transform active:scale-75"
                            >
                                <Minus className="h-3 w-3 text-black" strokeWidth={3} />
                            </button>
                            <span className="min-w-[14px] text-center text-[13px] font-bold tracking-[-0.04em] text-[#1A1C1E]">
                                {item.quantity}
                            </span>
                            <button
                                onClick={() => onUpdateQuantity(item.uniqueId, 1)}
                                className="text-[16px] font-bold text-black/60 transition-transform active:scale-75"
                            >
                                <Plus className="h-3 w-3 text-black" strokeWidth={3} />
                            </button>
                        </div>

                        <span className="pb-0.5 text-[16px] font-bold tracking-[-0.04em] text-[#1A1C1E]">
                            {formatCurrency(item.price / 100)}
                        </span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export const GuestMenuCart: React.FC<{
    cartItems: CartItem[];
    onBack: () => void;
    onUpdateQuantity: (id: string, delta: number) => void;
    onRemove: (id: string) => void;
    onCheckout: () => void;
}> = ({ cartItems = [], onBack, onUpdateQuantity, onRemove, onCheckout }) => {
    const subtotal = cartItems.reduce(
        (acc, curr) => acc + (curr.price || 0) * (curr.quantity || 0),
        0
    );
    const isEmpty = cartItems.length === 0;

    return (
        <div className="flex min-h-[calc(100vh-76px)] flex-col bg-[#FFFFFF]">
            {/* Pixel Perfect Image 2 Header - Main White Background */}
            <header className="flex w-full items-center justify-between bg-[#FFFFFF] px-5 py-4">
                <button
                    onClick={onBack}
                    className="border-brand-neutral-soft/5 flex h-11 w-11 items-center justify-center rounded-[16px] border bg-[#FFFFFF] active:scale-95"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M4 6H20M4 12H14M4 18H9"
                            stroke="black"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>

                <h2 className="text-[20px] font-bold tracking-[-0.04em] text-[#1A1C1E]">
                    My Order
                </h2>

                <button className="border-brand-neutral-soft/5 flex h-11 w-11 items-center justify-center rounded-[16px] border bg-[#FFFFFF] active:scale-95">
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <circle cx="12" cy="5" r="2.5" fill="black" />
                        <circle cx="12" cy="12" r="2.5" fill="black" />
                        <circle cx="12" cy="19" r="2.5" fill="black" />
                    </svg>
                </button>
            </header>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto bg-[#FFFFFF] px-5 pt-4 pb-48">
                {isEmpty ? (
                    <div className="flex flex-col items-center justify-center pt-20">
                        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#F6F6F6] shadow-sm">
                            <ShoppingCart className="h-10 w-10 text-[#1A1C1E]/10" />
                        </div>
                        <h3 className="mb-2 text-[20px] font-bold tracking-[-0.04em] text-[#1A1C1E]">
                            Your cart is empty
                        </h3>
                        <p className="px-10 text-center text-[14px] font-medium tracking-[-0.04em] text-black/40">
                            Add some delicious items to start your ordering journey.
                        </p>
                        <button
                            onClick={onBack}
                            className="mt-8 rounded-full bg-[#1A1C1E] px-10 py-4 font-bold tracking-[-0.04em] text-white transition-all active:scale-95"
                        >
                            Start Shopping
                        </button>
                    </div>
                ) : (
                    <div>
                        {cartItems.map(item => (
                            <CartItem
                                key={item.uniqueId}
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
                <div className="border-brand-neutral-soft/5 fixed right-0 bottom-[76px] left-0 z-40 rounded-t-[32px] border-t bg-[#FFFFFF] px-5 pt-5 pb-4 shadow-2xl shadow-black/5">
                    {/* Discount Input directly at the top of checkout card */}
                    <div className="mb-3 flex items-center justify-between rounded-[20px] border border-black/5 bg-[#F3F3F3] px-4 py-3">
                        <input
                            type="text"
                            placeholder="Enter your discount code"
                            className="flex-1 border-none bg-transparent text-[14px] font-medium tracking-[-0.04em] text-[#1A1C1E]/60 focus:outline-none"
                        />
                        <button className="ml-2 text-[14px] font-bold tracking-[-0.04em] text-[#1A1C1E] transition-colors hover:text-[#1A1C1E]/80">
                            Apply
                        </button>
                    </div>

                    {/* Subtotal Row - Extremely tight */}
                    <div className="flex items-center justify-between py-0.5">
                        <span className="text-[14px] font-medium tracking-[-0.04em] text-black/45">
                            Subtotal
                        </span>
                        <span className="text-[16px] font-bold tracking-[-0.04em] text-[#1A1C1E]">
                            {formatCurrency(subtotal / 100)}
                        </span>
                    </div>

                    {/* Dotted Divider line - Extremely tight */}
                    <div className="my-2 border-t border-dashed border-black/10" />

                    {/* Total Row - Extremely tight */}
                    <div className="mb-3 flex items-center justify-between py-0.5">
                        <span className="text-[14px] font-bold tracking-[-0.04em] text-[#1A1C1E]">
                            Total
                        </span>
                        <span className="text-[18px] font-bold tracking-[-0.04em] text-[#1A1C1E]">
                            {formatCurrency(subtotal / 100)}
                        </span>
                    </div>

                    {/* Lime Pay Button */}
                    <button
                        onClick={onCheckout}
                        className="flex w-full items-center justify-center rounded-[20px] bg-[#DDF853] py-4 text-[16px] font-bold tracking-[-0.04em] text-[#1A1C1E] shadow-sm transition-all active:scale-[0.98]"
                    >
                        Pay
                    </button>
                </div>
            )}
        </div>
    );
};

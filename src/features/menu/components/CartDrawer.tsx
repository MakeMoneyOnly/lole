'use client';

import { Drawer } from 'vaul';
import {
    Minus,
    Plus,
    Trash2,
    Truck,
    ShoppingBag,
    Utensils,
    ChevronRight,
    CheckCircle2,
    Smartphone,
    HandCoins,
    Users,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useHaptic } from '@/hooks/useHaptic';
import Image from 'next/image';
import { isRemoteOrDataImageSrc } from '@/lib/utils';
import { formatCurrencyCompact } from '@/lib/utils/monetary';
import { useState, useEffect, useMemo } from 'react';
import { isAbortError } from '@/hooks/useSafeFetch';
import { calculateDiscount } from '@/lib/discounts/calculator';
import type { DiscountRecord } from '@/lib/discounts/types';

type OrderType = 'pickup' | 'delivery' | 'dine_in';
type PaymentChoice = 'pay_now' | 'pay_later' | 'waiter_close_out';
type DigitalPaymentMethod = 'chapa';

interface CartDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    guestContext: {
        slug: string;
        table: string;
        sig: string;
        exp: number;
        guest_session_id?: string;
        auth_state?: 'guest' | 'authenticated';
        login_url?: string;
        is_online_order?: boolean;
        campaign_attribution?: {
            campaign_delivery_id: string;
            campaign_id?: string;
        };
    } | null;
    tableNumber: string | null;
    /** When true, the drawer starts on the success screen (returning from Chapa) */
    paymentReturnSuccess?: boolean;
    paymentOrderId?: string;
}

// ── Order Type Selector pill button ──────────────────────────────────────────
function OrderTypeButton({
    label,
    icon,
    selected,
    onClick,
}: {
    label: string;
    icon: React.ReactNode;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 py-3 text-xs font-bold transition-all ${
                selected
                    ? 'border-brand-accent bg-brand-accent text-black shadow-md'
                    : 'border-black/10 bg-black/5 text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-black/60'
            }`}
        >
            <span className={`${selected ? 'text-white' : 'text-black/40 dark:text-white/40'}`}>
                {icon}
            </span>
            {label}
        </button>
    );
}

function PaymentChoiceButton({
    label,
    description,
    icon,
    selected,
    onClick,
}: {
    label: string;
    description: string;
    icon: React.ReactNode;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-300 outline-none active:scale-[0.98] ${
                selected
                    ? 'border-[#DDF853] bg-[#DDF853]/5 shadow-[0_8px_16px_-6px_rgba(221,248,83,0.15)]'
                    : 'border-black/5 bg-transparent hover:border-black/10 hover:bg-black/5'
            }`}
        >
            <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                    selected
                        ? 'scale-105 bg-[#DDF853] text-[#1A1C1E] shadow-lg shadow-[#DDF853]/30'
                        : 'bg-black/5 text-black/50 group-hover:scale-105 group-hover:text-black/70'
                }`}
            >
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p
                    className={`text-[15px] font-bold tracking-tight transition-colors duration-300 ${
                        selected ? 'text-[#1A1C1E]' : 'text-[#1A1C1E]'
                    }`}
                >
                    {label}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed font-medium text-black/50">
                    {description}
                </p>
            </div>
            <div className="flex shrink-0 items-center justify-center pl-2">
                <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                        selected ? 'border-[#DDF853] bg-[#DDF853]' : 'border-black/20'
                    }`}
                >
                    <div
                        className={`h-2.5 w-2.5 rounded-full bg-white transition-all duration-300 ${
                            selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                        }`}
                    />
                </div>
            </div>
        </button>
    );
}

export function CartDrawer({
    open,
    onOpenChange,
    guestContext,
    tableNumber,
    paymentReturnSuccess,
    paymentOrderId,
}: CartDrawerProps) {
    const { items, updateQuantity, updateInstructions, clearCart } = useCart();
    const { trigger } = useHaptic();
    const [submitting, setSubmitting] = useState(false);
    const [orderMessage, setOrderMessage] = useState<string | null>(null);
    const [orderError, setOrderError] = useState<string | null>(null);
    const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
    const [placedOrderNumber, setPlacedOrderNumber] = useState<string | null>(null);

    // Online ordering state
    const isOnlineOrder = !!guestContext?.is_online_order;
    const [orderType, setOrderType] = useState<OrderType>('pickup');
    const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>(
        paymentReturnSuccess || isOnlineOrder ? 'pay_now' : 'pay_later'
    );
    const [digitalPaymentMethod, setDigitalPaymentMethod] = useState<DigitalPaymentMethod>('chapa');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [availableDiscounts, setAvailableDiscounts] = useState<DiscountRecord[]>([]);
    const [selectedDiscountId, setSelectedDiscountId] = useState('');
    // If returning from Chapa with success, jump straight to success screen
    const [step, setStep] = useState<'cart' | 'payment' | 'success'>(
        paymentReturnSuccess ? 'success' : 'cart'
    );
    const selectedDiscount = useMemo(
        () => availableDiscounts.find(discount => discount.id === selectedDiscountId) ?? null,
        [availableDiscounts, selectedDiscountId]
    );
    const discountPreview = useMemo(
        () =>
            calculateDiscount(
                items.map(item => ({
                    id: item.menuItemId,
                    category_id: null,
                    price: item.price,
                    quantity: item.quantity,
                })),
                selectedDiscount
            ),
        [items, selectedDiscount]
    );

    // Clear cart on successful payment return
    useEffect(() => {
        if (paymentReturnSuccess) {
            clearCart();
            if (paymentOrderId) {
                setPlacedOrderId(paymentOrderId);
            }
        }
    }, [paymentOrderId, paymentReturnSuccess]);

    useEffect(() => {
        if (isOnlineOrder) {
            setPaymentChoice('pay_now');
        }
    }, [isOnlineOrder]);

    useEffect(() => {
        async function fetchDiscounts() {
            if (!guestContext?.slug) {
                setAvailableDiscounts([]);
                return;
            }

            try {
                const url = new URL('/api/v1/guest-portal/discounts', window.location.origin);
                url.searchParams.set('slug', guestContext.slug);
                const response = await fetch(url.toString());
                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload?.error ?? 'Failed to load discounts');
                }
                setAvailableDiscounts((payload.data?.discounts ?? []) as DiscountRecord[]);
            } catch (error) {
                if (!isAbortError(error)) {
                    console.error('Failed to fetch guest discounts:', error);
                }
                setAvailableDiscounts([]);
            }
        }

        void fetchDiscounts();
    }, [guestContext?.slug]);

    const handlePlaceOrder = async () => {
        if (!guestContext) {
            setOrderError('Unable to place order: missing order context.');
            return;
        }

        if (!guestContext.is_online_order && !tableNumber) {
            setOrderError('Unable to place order: invalid or expired table QR context.');
            return;
        }

        if (items.length === 0 || submitting) return;

        if (!isOnlineOrder && step === 'cart') {
            setOrderError(null);
            setStep('payment');
            return;
        }

        if (
            !isOnlineOrder &&
            step === 'payment' &&
            paymentChoice === 'pay_now' &&
            !digitalPaymentMethod
        ) {
            setOrderError('Please choose Chapa to continue.');
            return;
        }

        // For online orders, require customer details
        if (isOnlineOrder) {
            if (!customerName.trim()) {
                setOrderError('Please enter your name.');
                return;
            }
            if (!customerPhone.trim()) {
                setOrderError('Please enter your phone number (09xxxxxxxx).');
                return;
            }
            if (orderType === 'delivery' && !deliveryAddress.trim()) {
                setOrderError('Please enter your delivery address.');
                return;
            }
        }

        setSubmitting(true);
        setOrderError(null);

        try {
            const response = await fetch('/api/v1/merchant/operations/payments/sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-idempotency-key': crypto.randomUUID(),
                },
                body: JSON.stringify({
                    guest_context: isOnlineOrder
                        ? {
                              slug: guestContext.slug,
                              is_online_order: true,
                          }
                        : {
                              slug: guestContext.slug,
                              table: guestContext.table,
                              sig: guestContext.sig,
                              exp: guestContext.exp,
                          },
                    items: items.map(item => ({
                        id: item.menuItemId,
                        name: item.title,
                        quantity: item.quantity,
                        price: item.price,
                        notes: item.instructions,
                    })),
                    total_price: discountPreview.total,
                    order_type: isOnlineOrder ? orderType : 'dine_in',
                    payment_choice: isOnlineOrder ? 'pay_now' : paymentChoice,
                    ...(paymentChoice === 'pay_now' && digitalPaymentMethod
                        ? { preferred_method: digitalPaymentMethod }
                        : {}),
                    customer_name: customerName || undefined,
                    customer_phone: customerPhone || undefined,
                    ...(orderType === 'delivery' ? { delivery_address: deliveryAddress } : {}),
                    ...(selectedDiscount ? { discount_id: selectedDiscount.id } : {}),
                    ...(guestContext.campaign_attribution
                        ? { campaign_attribution: guestContext.campaign_attribution }
                        : {}),
                    ...(guestContext.guest_session_id
                        ? { guest_session_id: guestContext.guest_session_id }
                        : {}),
                }),
            });

            const payload = (await response.json()) as {
                data?: {
                    mode?: 'hosted_checkout' | 'deferred';
                    checkout_url?: string | null;
                    order_id?: string;
                    order_number?: string;
                };
                error?: string;
            };

            if (!response.ok) {
                setOrderError(payload?.error ?? 'Failed to place order.');
                return;
            }

            if (payload.data?.mode === 'hosted_checkout' && payload.data.checkout_url) {
                trigger('success');
                window.location.href = payload.data.checkout_url;
                return;
            }

            trigger('success');
            clearCart();
            setPlacedOrderId(payload.data?.order_id ?? null);
            setPlacedOrderNumber(payload.data?.order_number ?? null);
            setOrderMessage(
                paymentChoice === 'waiter_close_out'
                    ? 'Order received! A waiter can help you settle before you leave.'
                    : isOnlineOrder
                      ? 'Order received! We will notify you as it moves forward.'
                      : 'Order received! You can settle with staff when you are ready.'
            );
            setStep('success');
        } catch (error) {
            if (isAbortError(error)) return;
            console.error('Order submission failed:', error);
            setOrderError('Network error. Please retry.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        // Reset state on close
        if (step === 'success') {
            setStep('cart');
            setPlacedOrderId(null);
            setPlacedOrderNumber(null);
            setCustomerName('');
            setCustomerPhone('');
            setDeliveryAddress('');
            setOrderType('pickup');
            setSelectedDiscountId('');
            setDigitalPaymentMethod('chapa');
            setPaymentChoice(isOnlineOrder ? 'pay_now' : 'pay_later');
        }
        if (step === 'payment') {
            setStep('cart');
        }
        setOrderMessage(null);
        setOrderError(null);
        onOpenChange(false);
    };

    return (
        <Drawer.Root open={open} onOpenChange={handleClose}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[9999] bg-[#1A1C1E]/60 backdrop-blur-sm" />
                <Drawer.Content className="fixed right-0 bottom-0 left-0 z-[9999] flex h-[92vh] flex-col rounded-t-[3rem] border-t border-black/5 bg-white transition-colors duration-300 outline-none">
                    <Drawer.Title className="sr-only">
                        {step === 'success'
                            ? 'Order placed confirmation'
                            : step === 'payment'
                              ? 'Choose your checkout option'
                              : 'Your order'}
                    </Drawer.Title>
                    <Drawer.Description className="sr-only">
                        {step === 'success'
                            ? 'Review the order placed confirmation and next actions.'
                            : step === 'payment'
                              ? 'Choose how you want to settle this order before continuing.'
                              : 'Review the items in your cart before placing the order.'}
                    </Drawer.Description>
                    {/* ── Success Screen ─────────────────────────────────── */}
                    {step === 'success' ? (
                        <div className="flex flex-1 flex-col items-center gap-5 p-8 text-center">
                            {/* Icon */}
                            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
                                <CheckCircle2 size={48} className="text-emerald-500" />
                            </div>

                            {/* Title */}
                            <div>
                                <h2 className="font-manrope text-2xl font-black tracking-tight text-black dark:text-white">
                                    Order Placed!
                                </h2>
                                {placedOrderNumber && (
                                    <p className="mt-1 text-sm font-bold text-black/40 dark:text-white/40">
                                        #{placedOrderNumber}
                                    </p>
                                )}
                                <p className="mt-2 text-sm font-medium text-black/50 dark:text-white/50">
                                    {isOnlineOrder
                                        ? orderType === 'delivery'
                                            ? 'Your order is being prepared and will be delivered to you.'
                                            : 'Your order is being prepared. Come pick it up when ready!'
                                        : 'Your order has been sent to the kitchen. Track live below 👇'}
                                </p>
                            </div>

                            {/* ── LIVE TRACKER — dine-in primary CTA ───────────── */}
                            {!isOnlineOrder && placedOrderId && guestContext && (
                                <a
                                    href={`/${guestContext.slug}/tracker?order_id=${placedOrderId}&table=${encodeURIComponent(guestContext.table)}&sig=${encodeURIComponent(guestContext.sig)}&exp=${guestContext.exp}`}
                                    className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 text-base font-black text-white shadow-lg transition active:scale-95"
                                >
                                    🔴 Track Your Order Live
                                </a>
                            )}

                            {/* Online order summary card */}
                            {isOnlineOrder && (
                                <div className="w-full rounded-xl border border-black/5 bg-black/5 p-4 text-left dark:border-white/5 dark:bg-white/5">
                                    {orderType === 'delivery' && deliveryAddress && (
                                        <p className="text-sm font-bold text-black/60 dark:text-white/60">
                                            📍 {deliveryAddress}
                                        </p>
                                    )}
                                    {(customerName || customerPhone) && (
                                        <p className="mt-1 text-sm font-bold text-black dark:text-white">
                                            {customerName && `👤 ${customerName}`}
                                            {customerName && customerPhone && ' · '}
                                            {customerPhone && `📞 ${customerPhone}`}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Done button */}
                            <button
                                onClick={handleClose}
                                className="flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-black/10 text-sm font-bold text-black/60 transition active:scale-95 dark:border-white/10 dark:text-white/60"
                            >
                                {!isOnlineOrder ? 'Back to Menu' : 'Done'}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="no-scrollbar flex-1 overflow-y-auto p-6 text-black dark:text-white">
                                {/* Drag Handle */}
                                <div className="mx-auto mb-6 h-1.5 w-12 shrink-0 rounded-full bg-black/20 dark:bg-white/20" />

                                {/* Header */}
                                <div className="mb-6 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {step === 'payment' && !isOnlineOrder && (
                                            <button
                                                onClick={() => setStep('cart')}
                                                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 transition-colors active:scale-95 dark:bg-white/10"
                                            >
                                                <ChevronRight
                                                    size={18}
                                                    className="rotate-180 text-black dark:text-white"
                                                />
                                            </button>
                                        )}
                                        <Drawer.Title className="font-manrope text-2xl font-black tracking-tight text-black dark:text-white">
                                            {step === 'payment' ? 'Payment Method' : 'Your Order'}
                                        </Drawer.Title>
                                    </div>
                                    <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-black/60 dark:bg-white/10 dark:text-white/60">
                                        {isOnlineOrder ? 'Online' : `Table ${tableNumber ?? '--'}`}
                                    </span>
                                </div>

                                {/* ── Online Order Type Selector ───────────── */}
                                {isOnlineOrder && step === 'cart' && (
                                    <div className="mb-6">
                                        <p className="mb-3 text-sm font-bold text-black/50 dark:text-white/50">
                                            How would you like your order?
                                        </p>
                                        <div className="flex gap-2">
                                            <OrderTypeButton
                                                label="Pickup"
                                                icon={<ShoppingBag size={18} />}
                                                selected={orderType === 'pickup'}
                                                onClick={() => setOrderType('pickup')}
                                            />
                                            <OrderTypeButton
                                                label="Delivery"
                                                icon={<Truck size={18} />}
                                                selected={orderType === 'delivery'}
                                                onClick={() => setOrderType('delivery')}
                                            />
                                            <OrderTypeButton
                                                label="Dine In"
                                                icon={<Utensils size={18} />}
                                                selected={orderType === 'dine_in'}
                                                onClick={() => setOrderType('dine_in')}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* ── Cart Items ──────────────────────────── */}
                                {items.length === 0 ? (
                                    <div className="flex h-48 flex-col items-center justify-center text-center text-gray-400">
                                        <p className="text-lg font-medium">Your cart is empty</p>
                                        <p className="text-sm">
                                            Add some delicious items to get started!
                                        </p>
                                    </div>
                                ) : step === 'payment' && !isOnlineOrder ? (
                                    <div className="space-y-3">
                                        <PaymentChoiceButton
                                            label="Pay Online Now"
                                            description="Continue to secure checkout. Available options there may include card or supported wallets."
                                            icon={<Smartphone size={20} strokeWidth={2.5} />}
                                            selected={paymentChoice === 'pay_now'}
                                            onClick={() => {
                                                setPaymentChoice('pay_now');
                                                setDigitalPaymentMethod('chapa');
                                            }}
                                        />
                                        <PaymentChoiceButton
                                            label="Pay at Counter"
                                            description="Send your order and pay later at the cashier."
                                            icon={<HandCoins size={20} strokeWidth={2.5} />}
                                            selected={paymentChoice === 'pay_later'}
                                            onClick={() => setPaymentChoice('pay_later')}
                                        />
                                        <PaymentChoiceButton
                                            label="Pay with Waiter"
                                            description="Send your order and ask a waiter to bring the bill to your table."
                                            icon={<Users size={20} strokeWidth={2.5} />}
                                            selected={paymentChoice === 'waiter_close_out'}
                                            onClick={() => setPaymentChoice('waiter_close_out')}
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {items.map(item => (
                                            <div
                                                key={item.uniqueId}
                                                className="flex flex-col gap-4 border-b border-black/5 pb-6 last:border-0 last:pb-0 dark:border-white/5"
                                            >
                                                <div className="flex gap-4">
                                                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                                                        {item.image && (
                                                            <Image
                                                                src={item.image}
                                                                alt={item.title}
                                                                fill
                                                                className="object-cover"
                                                                unoptimized={isRemoteOrDataImageSrc(
                                                                    item.image
                                                                )}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-1 flex-col justify-between py-1">
                                                        <div className="flex items-start justify-between">
                                                            <h3 className="w-[65%] text-base leading-tight font-bold text-black dark:text-white">
                                                                {item.title}
                                                            </h3>
                                                            <div className="flex flex-col items-end">
                                                                <span className="font-black text-black">
                                                                    {formatCurrencyCompact(
                                                                        item.price * item.quantity
                                                                    )}{' '}
                                                                    ETB
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 flex items-center justify-between">
                                                            <div className="flex items-center gap-2 rounded-full border border-black/10 bg-black/5 p-1 px-2 dark:border-white/10 dark:bg-white/5">
                                                                <button
                                                                    onClick={() =>
                                                                        item.quantity > 1 &&
                                                                        updateQuantity(
                                                                            item.uniqueId,
                                                                            -1
                                                                        )
                                                                    }
                                                                    disabled={item.quantity <= 1}
                                                                    className="bg-brand-accent/10 flex h-7 w-7 items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-50"
                                                                >
                                                                    <Minus size={12} />
                                                                </button>
                                                                <span className="w-4 text-center text-sm font-bold">
                                                                    {item.quantity}
                                                                </span>
                                                                <button
                                                                    onClick={() =>
                                                                        updateQuantity(
                                                                            item.uniqueId,
                                                                            1
                                                                        )
                                                                    }
                                                                    className="bg-brand-accent flex h-7 w-7 items-center justify-center rounded-full text-black transition-transform active:scale-90"
                                                                >
                                                                    <Plus size={12} />
                                                                </button>
                                                            </div>
                                                            <button
                                                                onClick={() =>
                                                                    updateQuantity(
                                                                        item.uniqueId,
                                                                        -item.quantity
                                                                    )
                                                                }
                                                                className="bg-brand-accent/10 flex h-7 w-7 items-center justify-center rounded-full text-black transition-transform active:scale-90"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Add instructions (e.g., No onions)..."
                                                    value={item.instructions || ''}
                                                    onChange={e =>
                                                        updateInstructions(
                                                            item.uniqueId,
                                                            e.target.value
                                                        )
                                                    }
                                                    className="focus:ring-brand-accent/40 bg-brand-accent/5 w-full rounded-xl border border-black/10 px-4 py-2.5 text-sm text-black placeholder:text-black/30 focus:ring-2 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-black dark:placeholder:text-black/30"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* ── Online Order: Customer Details Form ─── */}
                                {isOnlineOrder && items.length > 0 && step === 'cart' && (
                                    <div className="mt-6 space-y-3">
                                        <p className="text-sm font-bold text-black/50 dark:text-white/50">
                                            Your Details
                                        </p>
                                        <input
                                            type="text"
                                            placeholder="Full name *"
                                            value={customerName}
                                            onChange={e => setCustomerName(e.target.value)}
                                            className="focus:ring-brand-accent/30 w-full rounded-xl border border-black/10 bg-black/5 px-4 py-3 text-sm font-medium text-black placeholder:text-black/30 focus:ring-2 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
                                        />
                                        <input
                                            type="tel"
                                            placeholder="Phone number *"
                                            value={customerPhone}
                                            onChange={e => setCustomerPhone(e.target.value)}
                                            className="focus:ring-brand-accent/30 w-full rounded-xl border border-black/10 bg-black/5 px-4 py-3 text-sm font-medium text-black placeholder:text-black/30 focus:ring-2 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
                                        />
                                        {orderType === 'delivery' && (
                                            <textarea
                                                placeholder="Delivery address (street, area, landmark) *"
                                                value={deliveryAddress}
                                                onChange={e => setDeliveryAddress(e.target.value)}
                                                rows={2}
                                                className="focus:ring-brand-accent/30 w-full resize-none rounded-xl border border-black/10 bg-black/5 px-4 py-3 text-sm font-medium text-black placeholder:text-black/30 focus:ring-2 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
                                            />
                                        )}
                                        {orderType === 'pickup' && (
                                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
                                                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                                                    🛍 We&apos;ll prepare your order — head to the
                                                    counter when ready!
                                                </p>
                                            </div>
                                        )}
                                        {orderType === 'dine_in' && (
                                            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-900/20">
                                                <p className="text-xs font-bold text-blue-700 dark:text-blue-400">
                                                    🍽 Choose a table when you arrive — your order
                                                    will be waiting!
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── Footer / Checkout ──────────────────────── */}
                            <div className="bg-background border-t border-black/5 p-6 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-[0_-5px_30px_rgba(0,0,0,0.05)] dark:border-white/10 dark:shadow-[0_-5px_30px_rgba(0,0,0,0.5)]">
                                {availableDiscounts.length > 0 && step === 'cart' && (
                                    <div className="mb-4 space-y-3 rounded-xl border border-black/5 bg-black/5 p-3 dark:border-white/10 dark:bg-white/5">
                                        <div>
                                            <label className="mb-1 block text-sm font-bold text-black/50 dark:text-white/50">
                                                Discount
                                            </label>
                                            <select
                                                value={selectedDiscountId}
                                                onChange={event =>
                                                    setSelectedDiscountId(event.target.value)
                                                }
                                                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-black dark:border-white/10 dark:bg-neutral-950 dark:text-white"
                                            >
                                                <option value="">No discount</option>
                                                {availableDiscounts.map(discount => (
                                                    <option key={discount.id} value={discount.id}>
                                                        {discount.name_am || discount.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {discountPreview.discountAmount > 0 && (
                                            <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm dark:bg-neutral-950">
                                                <span className="font-semibold text-black/50 dark:text-white/50">
                                                    Discount applied
                                                </span>
                                                <span className="font-bold text-emerald-600">
                                                    -{discountPreview.discountAmount.toFixed(2)} ETB
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {/* Total */}
                                <div className="mb-4 flex items-center justify-between">
                                    <span className="font-medium text-black/40 dark:text-white/40">
                                        Total
                                    </span>
                                    <div className="flex items-end gap-1">
                                        <span className="text-3xl font-black text-black dark:text-white">
                                            {formatCurrencyCompact(discountPreview.total)}
                                        </span>
                                        <span className="mb-1 text-sm font-bold text-black/40 dark:text-white/40">
                                            ETB
                                        </span>
                                    </div>
                                </div>

                                {/* Place Order button */}
                                <button
                                    disabled={
                                        items.length === 0 ||
                                        submitting ||
                                        (step === 'payment' &&
                                            paymentChoice === 'pay_now' &&
                                            !digitalPaymentMethod)
                                    }
                                    onClick={handlePlaceOrder}
                                    className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-[#DDF853] text-sm font-black tracking-widest text-[#1A1C1E] uppercase shadow-xl shadow-[#DDF853]/10 transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {submitting ? (
                                        'Placing order...'
                                    ) : (
                                        <>
                                            {isOnlineOrder ? (
                                                <>
                                                    {orderType === 'delivery' && (
                                                        <Truck size={18} />
                                                    )}
                                                    {orderType === 'pickup' && (
                                                        <ShoppingBag size={18} />
                                                    )}
                                                    {orderType === 'dine_in' && (
                                                        <Utensils size={18} />
                                                    )}
                                                    Place{' '}
                                                    {orderType === 'delivery'
                                                        ? 'Delivery'
                                                        : orderType === 'pickup'
                                                          ? 'Pickup'
                                                          : 'Dine-in'}{' '}
                                                    order
                                                </>
                                            ) : step === 'cart' ? (
                                                <>
                                                    Choose checkout option{' '}
                                                    <ChevronRight size={18} />
                                                </>
                                            ) : paymentChoice === 'pay_now' ? (
                                                <>
                                                    {digitalPaymentMethod === 'chapa'
                                                        ? 'Continue to secure checkout'
                                                        : 'Choose payment method'}{' '}
                                                    <ChevronRight size={18} />
                                                </>
                                            ) : paymentChoice === 'waiter_close_out' ? (
                                                <>
                                                    Order and pay with waiter{' '}
                                                    <ChevronRight size={18} />
                                                </>
                                            ) : (
                                                <>
                                                    Order and pay later <ChevronRight size={18} />
                                                </>
                                            )}
                                        </>
                                    )}
                                </button>

                                {orderMessage && (
                                    <p className="mt-3 text-center text-sm font-semibold text-green-500">
                                        ✓ {orderMessage}
                                    </p>
                                )}
                                {orderError && (
                                    <p className="mt-3 text-center text-sm font-semibold text-red-400">
                                        {orderError}
                                    </p>
                                )}
                                {guestContext?.auth_state !== 'authenticated' &&
                                guestContext?.login_url &&
                                !isOnlineOrder ? (
                                    <p className="mt-3 text-center text-xs font-semibold text-black/50 dark:text-white/50">
                                        <a href={guestContext.login_url} className="underline">
                                            Log in
                                        </a>{' '}
                                        to earn loyalty points.
                                    </p>
                                ) : null}
                            </div>
                        </>
                    )}
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}

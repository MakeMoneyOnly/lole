import { Minus, Plus } from 'lucide-react';

interface DishCartFooterProps {
    quantity: number;
    price: number;
    onIncrement: () => void;
    onDecrement: () => void;
    onAddToCart: () => void;
}

export function DishCartFooter({
    quantity,
    onIncrement,
    onDecrement,
    onAddToCart,
}: DishCartFooterProps) {
    return (
        <div className="z-30 border-t border-gray-100 bg-white p-10 pb-[calc(env(safe-area-inset-bottom)+32px)]">
            <div className="flex items-center gap-6">
                {/* Quantity Controls - Engineered Pill */}
                <div className="flex h-16 items-center gap-6 rounded-2xl border border-gray-100 bg-[#F7F5F2] p-2 px-6">
                    <button
                        onClick={onDecrement}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-[#1A1C1E] transition-all hover:border-[#1A1C1E] active:scale-90"
                    >
                        <Minus size={20} strokeWidth={3} />
                    </button>
                    <span className="w-8 text-center text-2xl font-black tracking-tighter text-[#1A1C1E] tabular-nums">
                        {quantity}
                    </span>
                    <button
                        onClick={onIncrement}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A1C1E] text-[#DDF853] transition-all hover:scale-110 active:scale-90"
                    >
                        <Plus size={20} strokeWidth={3} />
                    </button>
                </div>

                {/* Add to Cart Button - Lole Accent */}
                <button
                    onClick={onAddToCart}
                    className="h-16 flex-1 rounded-2xl bg-[#DDF853] text-xl font-black tracking-widest text-[#1A1C1E] uppercase shadow-2xl shadow-[#DDF853]/40 transition-all hover:scale-[1.02] active:scale-95"
                >
                    Add to Order
                </button>
            </div>
        </div>
    );
}

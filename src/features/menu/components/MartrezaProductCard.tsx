'use client';
import React from 'react';
import NextImage from 'next/image';
import { Heart, ShoppingBag, Star } from 'lucide-react';
import { cn, isRemoteOrDataImageSrc } from '@/lib/utils';
import { formatCurrencyCompact } from '@/lib/utils/monetary';
import { useHaptic } from '@/hooks/useHaptic';

interface MartrezaProductCardProps {
    id: string;
    title: string;
    price: number;
    imageUrl: string;
    rating?: number;
    soldCount?: number;
}

export function MartrezaProductCard({
    item,
    onClick,
    onAdd,
    className,
}: {
    item: MartrezaProductCardProps;
    onClick?: () => void;
    onAdd?: () => void;
    className?: string;
}) {
    const { trigger } = useHaptic();
    const [imgSrc, setImgSrc] = React.useState(item.imageUrl);
    const isRemoteOrDataImage = imgSrc ? isRemoteOrDataImageSrc(imgSrc) : false;

    return (
        <div
            className={cn(
                'flex flex-col gap-3 transition-transform active:scale-[0.98]',
                className
            )}
            onClick={() => {
                trigger('soft');
                onClick?.();
            }}
        >
            <div className="relative aspect-square w-full overflow-hidden rounded-[24px]">
                <NextImage
                    src={imgSrc}
                    alt={item.title}
                    fill
                    className="object-cover"
                    unoptimized={isRemoteOrDataImage}
                    onError={() =>
                        setImgSrc(
                            'https://axuegixbqsvztdraenkz.supabase.co/storage/v1/object/public/food-images/Spicy%20Tonkotsu.webp'
                        )
                    }
                />

                {/* Floating Heart */}
                <button
                    onClick={e => {
                        e.stopPropagation();
                        trigger('medium');
                    }}
                    className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm transition-transform active:scale-90"
                >
                    <Heart size={18} className="text-black" />
                </button>

                {/* Floating Shop Badge */}
                <button
                    onClick={e => {
                        e.stopPropagation();
                        trigger('success');
                        onAdd?.();
                    }}
                    className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-[#ddf853] px-4 py-2 shadow-sm transition-transform active:scale-90"
                >
                    <ShoppingBag size={14} className="text-black" />
                    <span className="text-[12px] font-medium text-black">Shop</span>
                </button>
            </div>

            <div className="flex flex-col px-1">
                <h3 className="line-clamp-1 text-base font-medium tracking-tight text-black">
                    {item.title}
                </h3>

                <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-light text-black/50">
                        {item.soldCount || 12} sold
                    </span>
                    <div className="flex items-center gap-1">
                        <Star size={14} className="fill-amber-400 text-amber-400" />
                        <span className="text-sm font-light text-black">
                            {(item.rating || 4.5).toFixed(1)}
                        </span>
                    </div>
                </div>

                <span className="mt-1 text-lg font-medium text-[#EE4D2D]">
                    {formatCurrencyCompact(item.price)} ETB
                </span>
            </div>
        </div>
    );
}

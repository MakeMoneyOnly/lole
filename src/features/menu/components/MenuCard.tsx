'use client';

import React from 'react';
import { Heart, Plus } from 'lucide-react';
import NextImage from 'next/image';

import { useHaptic } from '@/hooks/useHaptic';
import { formatCurrencyCompact } from '@/lib/utils/monetary';
import { cn, isRemoteOrDataImageSrc } from '@/lib/utils';

interface MenuItemProps {
    id: string;
    title: string;
    description?: string;
    price: number;
    imageUrl: string;
    rating?: number;
    shopName?: string;
}

export function MenuCard({
    item,
    onClick,
    onAdd,
    className,
}: {
    item: MenuItemProps;
    onClick?: () => void;
    onAdd?: () => void;
    className?: string;
}) {
    const { trigger } = useHaptic();
    const [imgSrc, setImgSrc] = React.useState(item.imageUrl);
    const [isLiked, setIsLiked] = React.useState(false);
    const isRemoteOrDataImage = imgSrc ? isRemoteOrDataImageSrc(imgSrc) : false;

    React.useEffect(() => {
        setImgSrc(item.imageUrl);
    }, [item.imageUrl]);

    const handleLike = (e: React.MouseEvent) => {
        e.stopPropagation();
        trigger('medium');
        setIsLiked(!isLiked);
    };

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        trigger('success');
        onAdd?.();
    };

    return (
        <div
            className={cn(
                'group relative touch-manipulation transition-transform active:scale-[0.98]',
                className || 'mb-6'
            )}
            onClick={() => {
                trigger('soft');
                onClick?.();
            }}
        >
            {/* Image Container */}
            <div className="relative aspect-[4/6] w-full overflow-hidden rounded-[32px] bg-[#F7F5F2] shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all">
                <NextImage
                    src={imgSrc}
                    alt={item.title}
                    fill
                    sizes="(max-width: 768px) 50vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    unoptimized={isRemoteOrDataImage}
                    onError={() =>
                        setImgSrc(
                            'https://axuegixbqsvztdraenkz.supabase.co/storage/v1/object/public/food-images/Spicy%20Tonkotsu.webp'
                        )
                    }
                />

                {/* 'New' Badge - Modern Blue Pill */}
                <div className="absolute top-4 left-4 z-10">
                    <span className="flex items-center justify-center rounded-full bg-[#007AFF] px-2 py-1 text-[8px] font-black tracking-tight text-white shadow-lg">
                        New
                    </span>
                </div>

                {/* Favorite Heart */}
                <button
                    onClick={handleLike}
                    className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/60 shadow-sm backdrop-blur-md transition-all active:scale-90"
                >
                    <Heart
                        size={14}
                        className={cn(
                            'transition-colors duration-300',
                            isLiked ? 'fill-red-500 text-red-500' : 'text-black/40'
                        )}
                    />
                </button>
            </div>

            {/* Info Below */}
            <div className="mt-3 px-1">
                <h3 className="line-clamp-1 text-[13px] font-black tracking-tight text-black">
                    {item.title}
                </h3>
                <div className="mt-0.5 flex items-center justify-between">
                    <span className="text-sm font-black text-black">
                        {formatCurrencyCompact(item.price)}{' '}
                        <span className="text-[9px] font-bold text-black/20">ETB</span>
                    </span>
                    <div className="flex items-center gap-1 opacity-40">
                        <span className="text-[9px] font-black text-black">★</span>
                        <span className="text-[9px] font-bold text-black">
                            {item.rating || 4.5}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

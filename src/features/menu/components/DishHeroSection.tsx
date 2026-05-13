import { ArrowLeft, Heart } from 'lucide-react';
import Image from 'next/image';
import { DishItem } from './DishDetailDrawer.types';
import { cn } from '@/lib/utils';

interface DishHeroSectionProps {
    item: DishItem;
    isRemoteOrDataImage: boolean;
    isLiked: boolean;
    onBack: () => void;
    onToggleLike: (e?: React.MouseEvent) => void;
}

export function DishHeroSection({
    item,
    isRemoteOrDataImage,
    isLiked,
    onBack,
    onToggleLike,
}: DishHeroSectionProps) {
    return (
        <div className="relative h-[45vh] w-full shrink-0 overflow-hidden rounded-t-[3.5rem] bg-[#1A1C1E]">
            <Image
                src={item.imageUrl}
                alt={item.title}
                fill
                className="object-cover transition-transform duration-1000 group-hover:scale-110"
                priority
                unoptimized={isRemoteOrDataImage}
            />

            {/* Top Navigation */}
            <div className="absolute top-10 right-10 left-10 z-30 flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#1A1C1E] text-[#DDF853] shadow-2xl shadow-black/40 transition-all hover:scale-110 active:scale-95"
                >
                    <ArrowLeft size={28} strokeWidth={3} />
                </button>
                <button
                    onClick={e => onToggleLike(e)}
                    className={cn(
                        'flex h-14 w-14 items-center justify-center rounded-2xl border-2 shadow-2xl shadow-black/40 transition-all hover:scale-110 active:scale-95',
                        isLiked
                            ? 'border-[#DDF853] bg-[#DDF853] text-[#1A1C1E]'
                            : 'border-white/20 bg-[#1A1C1E]/40 text-white backdrop-blur-xl'
                    )}
                >
                    <Heart size={28} fill={isLiked ? 'currentColor' : 'none'} strokeWidth={3} />
                </button>
            </div>

            {/* Bottom Gradient Fade */}
            <div className="absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-white via-white/80 to-transparent" />
        </div>
    );
}

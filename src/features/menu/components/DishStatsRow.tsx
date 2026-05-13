import { Star, Heart, Clock } from 'lucide-react';
import { DishItem } from './DishDetailDrawer.types';

interface DishStatsRowProps {
    item: DishItem;
    likesCount: number;
    formatLikes: (count: number) => string;
}

export function DishStatsRow({ item, likesCount, formatLikes }: DishStatsRowProps) {
    return (
        <div className="mt-2 flex items-center justify-between gap-8">
            {/* Rating Group */}
            <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F5F2] text-[#DDF853]">
                    <Star size={20} fill="currentColor" strokeWidth={0} />
                </div>
                <div>
                    <p className="text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase">
                        Rating
                    </p>
                    <p className="text-lg font-black tracking-tighter text-[#1A1C1E]">
                        {item.rating?.toFixed(1) || '4.5'}
                    </p>
                </div>
            </div>

            {/* Likes Group */}
            <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F5F2] text-[#1A1C1E]">
                    <Heart size={20} fill="currentColor" strokeWidth={0} />
                </div>
                <div>
                    <p className="text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase">
                        Likes
                    </p>
                    <p className="text-lg font-black tracking-tighter text-[#1A1C1E]">
                        {formatLikes(likesCount)}
                    </p>
                </div>
            </div>

            {/* Prep Time Group */}
            <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F5F2] text-[#1A1C1E]">
                    <Clock size={20} strokeWidth={2.5} />
                </div>
                <div>
                    <p className="text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase">
                        Time
                    </p>
                    <p className="text-lg font-black tracking-tighter text-[#1A1C1E]">
                        {item.preparationTime || 15}
                        <span className="ml-0.5 text-xs font-bold text-gray-400">min</span>
                    </p>
                </div>
            </div>
        </div>
    );
}

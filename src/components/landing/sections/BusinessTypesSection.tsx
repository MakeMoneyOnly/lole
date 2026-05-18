import React from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';

interface BusinessType {
    name: string;
    description: string;
    image: string;
}

const businessTypes: BusinessType[] = [
    {
        name: 'Restaurants',
        description:
            'Fine dining, casual dining, and fast casual. Manage every table and order with precision.',
        image: '/images/business-types/restaurants.png',
    },
    {
        name: 'Bars & Clubs',
        description:
            'High-volume service for high-energy environments. Keep the drinks flowing smoothly.',
        image: '/images/business-types/bars.png',
    },
    {
        name: 'Cafes & Bakeries',
        description:
            'From the first coffee to the last pastry. Designed for the unique flow of cafes.',
        image: '/images/business-types/cafes.png',
    },
    {
        name: 'Quick Service',
        description:
            'Speed is the standard. Streamline counter and drive-thru operations with ease.',
        image: '/images/business-types/quick-service.png',
    },
    {
        name: 'Events & Venues',
        description:
            'Reliable tech that scales. High-speed ordering for high-capacity stadiums and arenas.',
        image: '/images/business-types/events.png',
    },
];

interface BusinessTypesSectionProps {
    scrollRef: React.RefObject<HTMLDivElement | null>;
    onScroll: (direction: 'left' | 'right') => void;
}

export function BusinessTypesSection({ scrollRef, onScroll }: BusinessTypesSectionProps): React.JSX.Element {
    return (
        <section className="w-full overflow-hidden bg-[#17120B] px-4 py-12 md:px-10 lg:px-20">
            <div className="w-full">
                <div className="mb-16 flex items-end justify-between">
                    <div className="flex flex-col gap-2">
                        <h2 className="translate-x-[125px] text-[32px] leading-[0.95] font-semibold tracking-[-0.07em] text-white md:text-[48px]">
                            For small shops and fine dining.
                        </h2>
                        <p className="translate-x-[125px] text-[32px] leading-[0.95] font-semibold tracking-[-0.07em] text-[#888884] md:text-[48px]">
                            Lole flexes to your needs.
                        </p>
                    </div>
                    <div className="mb-2.5 flex translate-y-[40px] gap-2.5">
                        <button
                            onClick={() => onScroll('left')}
                            aria-label="Previous business type"
                            className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/5 bg-white/10 text-white/70 transition-all hover:text-white active:scale-95"
                        >
                            <ChevronLeft className="h-4.5 w-4.5" />
                        </button>
                        <button
                            onClick={() => onScroll('right')}
                            aria-label="Next business type"
                            className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/5 bg-white/10 text-white/70 transition-all hover:text-white active:scale-95"
                        >
                            <ChevronRight className="h-4.5 w-4.5" />
                        </button>
                    </div>
                </div>

                <div
                    ref={scrollRef}
                    className="no-scrollbar -mx-4 flex gap-5 overflow-x-auto px-4 pb-4 md:mx-0 md:gap-6 md:px-0"
                >
                    {businessTypes.map((item, idx) => (
                        <div
                            key={idx}
                            className="group relative h-[460px] min-w-[342px] cursor-pointer overflow-hidden rounded-[32px] shadow-2xl md:h-[550px] md:min-w-[422px] lg:h-[500px] lg:min-w-[382px]"
                        >
                            <Image
                                src={item.image}
                                alt={item.name}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-70 transition-opacity group-hover:opacity-90" />

                            {/* Top Link Icon */}
                            <div className="absolute top-10 right-10 flex h-11 w-11 translate-y-4 items-center justify-center rounded-full bg-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                                <ArrowUpRight className="h-5 w-5 text-black" strokeWidth={2} />
                            </div>

                            {/* Text Content */}
                            <div className="absolute right-0 bottom-0 left-0 transition-all duration-300">
                                <div className="absolute inset-0 mask-[linear-gradient(to_top,black_40%,transparent)] backdrop-blur-md" />
                                <div className="relative z-10 flex flex-col px-10 pt-6 pb-10">
                                    <span className="text-[26px] font-semibold tracking-tight text-white">
                                        {item.name}
                                    </span>
                                    <div className="grid grid-rows-[0fr] transition-all duration-500 ease-in-out group-hover:mt-2 group-hover:grid-rows-[1fr]">
                                        <div className="overflow-hidden">
                                            <p className="text-[16px] leading-[1.4] font-medium text-white/80 opacity-0 transition-all duration-500 group-hover:opacity-100">
                                                {item.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

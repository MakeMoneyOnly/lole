import React from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';

interface Testimonial {
    name: string;
    location: string;
    type: string;
    quote: string;
    image: string;
    logo: string;
}

const testimonials: Testimonial[] = [
    {
        name: 'ZeroZero',
        location: 'Addis Ababa',
        type: 'Restaurant',
        quote: "“Lole really helped us to gain insights on what we can expect, what we've done in the past, what we're doing at the moment itself.”",
        image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=2070&auto=format&fit=crop',
        logo: 'ZEROZERO',
    },
    {
        name: 'Zoldering',
        location: 'Addis Ababa',
        type: 'Restaurant*',
        quote: "“Lole didn't just replace our tools. It helped us rethink how we work with one seamless, integrated platform.”",
        image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1974&auto=format&fit=crop',
        logo: 'ZOLDERING',
    },
    {
        name: 'The Daily Grind',
        location: 'Addis Ababa',
        type: 'Cafe',
        quote: '“The real-time insights allow us to optimize our shifts during peak hours, significantly improving our bottom line.”',
        image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=2047&auto=format&fit=crop',
        logo: 'GRIND',
    },
];

interface TestimonialsSectionProps {
    scrollRef: React.RefObject<HTMLDivElement | null>;
    onScroll: (direction: 'left' | 'right') => void;
}

export function TestimonialsSection({
    scrollRef,
    onScroll,
}: TestimonialsSectionProps): React.JSX.Element {
    return (
        <section className="w-full overflow-hidden px-4 py-16 md:px-10 lg:px-20">
            <div className="w-full">
                <div className="mb-12 flex items-end justify-between">
                    <h2 className="translate-x-[125px] text-[32px] leading-[0.95] font-semibold tracking-[-0.07em] text-black md:text-[48px]">
                        Why operators choose Lole.
                    </h2>
                    <div className="mb-2.5 flex gap-2.5">
                        <button
                            onClick={() => onScroll('left')}
                            aria-label="Previous testimonial"
                            className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-black/5 bg-black/5 text-black/30 transition-all hover:bg-black/10 hover:text-black active:scale-95"
                        >
                            <ChevronLeft className="h-5 w-5 text-gray-500 group-hover:text-black" />
                        </button>
                        <button
                            onClick={() => onScroll('right')}
                            aria-label="Next testimonial"
                            className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-black/5 bg-black/5 text-black/30 transition-all hover:bg-black/10 hover:text-black active:scale-95"
                        >
                            <ChevronRight className="h-5 w-5 text-gray-500 group-hover:text-black" />
                        </button>
                    </div>
                </div>

                <div
                    ref={scrollRef}
                    className="no-scrollbar -mx-4 flex gap-6 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0"
                >
                    {testimonials.map((op, idx) => (
                        <div
                            key={idx}
                            className="group relative h-[550px] min-w-[432px] cursor-pointer overflow-hidden rounded-[32px] shadow-xl shadow-black/5 md:h-[550px] md:min-w-[732px] lg:h-[620px] lg:min-w-[862px]"
                        >
                            <Image
                                src={op.image}
                                alt={op.name}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="object-cover transition-transform duration-1000 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80 transition-opacity group-hover:opacity-90" />

                            {/* Card Header Content */}
                            <div className="absolute top-8 right-8 left-8 flex items-start justify-between">
                                <div className="text-[20px] font-bold -tracking-widest text-white md:text-[24px]">
                                    <span className="-tracking-widest opacity-50">
                                        {op.logo.slice(0, Math.floor(op.logo.length / 2))}
                                    </span>
                                    <span className="-tracking-widest">
                                        {op.logo.slice(Math.floor(op.logo.length / 2))}
                                    </span>
                                </div>
                                <button
                                    aria-label={`Play video testimonial from ${op.name}`}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 text-white backdrop-blur-sm transition-all hover:bg-white hover:text-black md:h-12 md:w-12"
                                >
                                    <Play className="ml-[2px] h-4 w-4 fill-current md:h-5 md:w-5" />
                                </button>
                            </div>

                            {/* Card Footer Content */}
                            <div className="absolute right-0 bottom-0 left-0">
                                <div className="absolute inset-0 mask-[linear-gradient(to_top,black_40%,transparent)] backdrop-blur-md" />
                                <div className="relative z-10 px-8 pt-4 pb-10 md:px-12 md:pt-6 md:pb-12">
                                    <p className="mb-8 text-[18px] leading-[1.3] font-semibold text-white md:text-[24px]">
                                        {op.quote}
                                    </p>
                                    <div className="flex flex-wrap gap-2.5">
                                        {[op.name, op.location, op.type].map((tag, i) => (
                                            <span
                                                key={i}
                                                className="rounded-xl border border-white/20 px-5 py-2 text-[13px] font-medium text-white backdrop-blur-md transition-colors hover:bg-white/10"
                                            >
                                                {tag}
                                            </span>
                                        ))}
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

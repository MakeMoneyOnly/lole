import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function FeaturesGallerySection(): React.JSX.Element {
    return (
        <div className="w-full py-16 md:py-24">
            <div className="mb-12 box-border w-full px-4 md:mb-16 md:px-10 lg:px-20">
                <h2 className="max-w-[600px] translate-x-[125px] text-[36px] leading-none font-semibold tracking-[-0.07em] text-black md:text-[48px]">
                    Everything you need
                    <br />
                    in one connected system.
                </h2>
            </div>

            <div className="grid grid-cols-12 gap-6 px-4 md:px-10 lg:px-20">
                {/* Left column — 5 cards, scrolls normally */}
                <div className="col-span-4 grid gap-6">
                    {/* Card 1: Point of Sale */}
                    <figure className="group relative h-96 w-full cursor-pointer overflow-hidden rounded-[16px]">
                        <Image
                            src="https://images.unsplash.com/photo-1556740738-b6a63e27c4df?q=80&w=2070&auto=format&fit=crop"
                            alt="Point of Sale"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-all duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-2 p-6">
                            <h3 className="text-[18px] font-semibold tracking-tight text-white">
                                Point of Sale
                            </h3>
                            <p className="text-[13px] leading-relaxed text-white/70">
                                Run efficient service with an intuitive system, flexible to how your
                                business runs.
                            </p>
                            <Link
                                href="#"
                                className="mt-1 inline-flex w-fit items-center gap-1 border-b border-white/30 pb-0.5 text-[12px] font-semibold text-white/90 transition-colors hover:border-white hover:text-white"
                            >
                                Discover Lole&apos;s POS <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </figure>

                    {/* Card 2: Reservations */}
                    <figure className="group relative h-96 w-full cursor-pointer overflow-hidden rounded-[16px]">
                        <Image
                            src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=2070&auto=format&fit=crop"
                            alt="Reservations"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-all duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-2 p-6">
                            <h3 className="text-[18px] font-semibold tracking-tight text-white">
                                Reservations
                            </h3>
                            <p className="text-[13px] leading-relaxed text-white/70">
                                Fill tables securely, automate waitlists, message guests instantly,
                                and track every special request.
                            </p>
                            <Link
                                href="#"
                                className="mt-1 inline-flex w-fit items-center gap-1 border-b border-white/30 pb-0.5 text-[12px] font-semibold text-white/90 transition-colors hover:border-white hover:text-white"
                            >
                                Discover Lole&apos;s Reservations <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </figure>

                    {/* Card 3: Payments */}
                    <figure className="group relative h-96 w-full cursor-pointer overflow-hidden rounded-[16px]">
                        <Image
                            src="https://images.unsplash.com/photo-1556742044-3c52d6e88c62?w=600&auto=format&fit=crop"
                            alt="Payments"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-all duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-2 p-6">
                            <h3 className="text-[18px] font-semibold tracking-tight text-white">
                                Payments
                            </h3>
                            <p className="text-[13px] leading-relaxed text-white/70">
                                Quick, secure, and embedded in your flow. Split bills, send
                                invoices, accept Telebirr and more.
                            </p>
                            <Link
                                href="#"
                                className="mt-1 inline-flex w-fit items-center gap-1 border-b border-white/30 pb-0.5 text-[12px] font-semibold text-white/90 transition-colors hover:border-white hover:text-white"
                            >
                                Discover Lole&apos;s Payments <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </figure>

                    {/* Card 4: QR Ordering */}
                    <figure className="group relative h-96 w-full cursor-pointer overflow-hidden rounded-[16px]">
                        <Image
                            src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=2070&auto=format&fit=crop"
                            alt="QR Ordering"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-all duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-2 p-6">
                            <h3 className="text-[18px] font-semibold tracking-tight text-white">
                                QR Ordering
                            </h3>
                            <p className="text-[13px] leading-relaxed text-white/70">
                                More covers, less wait for guests. Take orders and payments with
                                fewer staff on the floor.
                            </p>
                            <Link
                                href="#"
                                className="mt-1 inline-flex w-fit items-center gap-1 border-b border-white/30 pb-0.5 text-[12px] font-semibold text-white/90 transition-colors hover:border-white hover:text-white"
                            >
                                Discover Lole&apos;s QR Ordering <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </figure>

                    {/* Card 5: Inventory */}
                    <figure className="group relative h-96 w-full cursor-pointer overflow-hidden rounded-[16px]">
                        <Image
                            src="https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1974&auto=format&fit=crop"
                            alt="Inventory"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-all duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-2 p-6">
                            <h3 className="text-[18px] font-semibold tracking-tight text-white">
                                Inventory
                            </h3>
                            <p className="text-[13px] leading-relaxed text-white/70">
                                Reduce waste and over-ordering with real-time stock that updates
                                automatically with every sale.
                            </p>
                            <Link
                                href="#"
                                className="mt-1 inline-flex w-fit items-center gap-1 border-b border-white/30 pb-0.5 text-[12px] font-semibold text-white/90 transition-colors hover:border-white hover:text-white"
                            >
                                Discover Lole&apos;s Inventory <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </figure>
                </div>

                {/* Middle column — 3 cards, STICKY, fills viewport height, grid-rows-3 */}
                <div className="sticky top-0 col-span-4 grid h-screen grid-rows-3 gap-6">
                    {/* Sticky Card 1: Kitchen Display */}
                    <figure className="group relative h-full w-full cursor-pointer overflow-hidden rounded-[16px]">
                        <Image
                            src="https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1974&auto=format&fit=crop"
                            alt="Kitchen Display"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-all duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-2 p-6">
                            <h3 className="text-[18px] font-semibold tracking-tight text-white">
                                Kitchen Display
                            </h3>
                            <p className="text-[13px] leading-relaxed text-white/70">
                                Fly through tickets with spot-on accuracy. Orders flow directly from
                                POS to kitchen in real time.
                            </p>
                            <Link
                                href="#"
                                className="mt-1 inline-flex w-fit items-center gap-1 border-b border-white/30 pb-0.5 text-[12px] font-semibold text-white/90 transition-colors hover:border-white hover:text-white"
                            >
                                Discover Lole&apos;s KDS <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </figure>

                    {/* Sticky Card 2: Insights */}
                    <figure className="group relative h-full w-full cursor-pointer overflow-hidden rounded-[16px]">
                        <Image
                            src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2070&auto=format&fit=crop"
                            alt="Insights"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-all duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-2 p-6">
                            <h3 className="text-[18px] font-semibold tracking-tight text-white">
                                Insights
                            </h3>
                            <p className="text-[13px] leading-relaxed text-white/70">
                                Understand your daily ops and revenue in real time, right from your
                                phone.
                            </p>
                            <Link
                                href="#"
                                className="mt-1 inline-flex w-fit items-center gap-1 border-b border-white/30 pb-0.5 text-[12px] font-semibold text-white/90 transition-colors hover:border-white hover:text-white"
                            >
                                Discover Lole&apos;s Insights <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </figure>

                    {/* Sticky Card 3: Offline Sync */}
                    <figure className="group relative h-full w-full cursor-pointer overflow-hidden rounded-[16px]">
                        <Image
                            src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=2047&auto=format&fit=crop"
                            alt="Offline Sync"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-all duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-2 p-6">
                            <h3 className="text-[18px] font-semibold tracking-tight text-white">
                                Offline Sync
                            </h3>
                            <p className="text-[13px] leading-relaxed text-white/70">
                                Built for Addis. Keep taking orders and payments even when the
                                internet drops.
                            </p>
                            <Link
                                href="#"
                                className="mt-1 inline-flex w-fit items-center gap-1 border-b border-white/30 pb-0.5 text-[12px] font-semibold text-white/90 transition-colors hover:border-white hover:text-white"
                            >
                                Learn about Offline Mode <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </figure>
                </div>

                {/* Right column — 5 cards, scrolls normally */}
                <div className="col-span-4 grid gap-6">
                    {/* Card 1: Guest Profiles */}
                    <figure className="group relative h-96 w-full cursor-pointer overflow-hidden rounded-[16px]">
                        <Image
                            src="https://images.unsplash.com/photo-1470337458703-46ad1756a187?q=80&w=2070&auto=format&fit=crop"
                            alt="Guest Profiles"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-all duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-2 p-6">
                            <h3 className="text-[18px] font-semibold tracking-tight text-white">
                                Guest Profiles
                            </h3>
                            <p className="text-[13px] leading-relaxed text-white/70">
                                Build rich guest profiles with allergies, top ordered products,
                                return visits, and VIP notes.
                            </p>
                            <Link
                                href="#"
                                className="mt-1 inline-flex w-fit items-center gap-1 border-b border-white/30 pb-0.5 text-[12px] font-semibold text-white/90 transition-colors hover:border-white hover:text-white"
                            >
                                Discover Lole&apos;s Reservations <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </figure>

                    {/* Card 2: Table Management */}
                    <figure className="group relative h-96 w-full cursor-pointer overflow-hidden rounded-[16px]">
                        <Image
                            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070&auto=format&fit=crop"
                            alt="Table Management"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-all duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-2 p-6">
                            <h3 className="text-[18px] font-semibold tracking-tight text-white">
                                Table Management
                            </h3>
                            <p className="text-[13px] leading-relaxed text-white/70">
                                Control the flow of the floor, monitor every cover, and spot which
                                tables need extra attention.
                            </p>
                            <Link
                                href="#"
                                className="mt-1 inline-flex w-fit items-center gap-1 border-b border-white/30 pb-0.5 text-[12px] font-semibold text-white/90 transition-colors hover:border-white hover:text-white"
                            >
                                Discover Lole&apos;s POS <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </figure>

                    {/* Card 3: Staff & Shifts */}
                    <figure className="group relative h-96 w-full cursor-pointer overflow-hidden rounded-[16px]">
                        <Image
                            src="https://images.unsplash.com/photo-1505935428862-770b6f24f629?q=80&w=2071&auto=format&fit=crop"
                            alt="Staff & Shifts"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-all duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-2 p-6">
                            <h3 className="text-[18px] font-semibold tracking-tight text-white">
                                Staff &amp; Shifts
                            </h3>
                            <p className="text-[13px] leading-relaxed text-white/70">
                                Track which shifts and stations drive the most profit. Optimize your
                                team with real data.
                            </p>
                            <Link
                                href="#"
                                className="mt-1 inline-flex w-fit items-center gap-1 border-b border-white/30 pb-0.5 text-[12px] font-semibold text-white/90 transition-colors hover:border-white hover:text-white"
                            >
                                Discover Lole&apos;s Insights <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </figure>

                    {/* Card 4: Menu Builder */}
                    <figure className="group relative h-96 w-full cursor-pointer overflow-hidden rounded-[16px]">
                        <Image
                            src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2070&auto=format&fit=crop"
                            alt="Menu Builder"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-all duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-2 p-6">
                            <h3 className="text-[18px] font-semibold tracking-tight text-white">
                                Menu Builder
                            </h3>
                            <p className="text-[13px] leading-relaxed text-white/70">
                                Adjust discounts, modifiers, and prices in a few taps to boost your
                                margins and drive more sales.
                            </p>
                            <Link
                                href="#"
                                className="mt-1 inline-flex w-fit items-center gap-1 border-b border-white/30 pb-0.5 text-[12px] font-semibold text-white/90 transition-colors hover:border-white hover:text-white"
                            >
                                Discover Lole&apos;s POS <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </figure>

                    {/* Card 5: Multi-Location */}
                    <figure className="group relative h-96 w-full cursor-pointer overflow-hidden rounded-[16px]">
                        <Image
                            src="https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=2070&auto=format&fit=crop"
                            alt="Multi-Location"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-all duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-2 p-6">
                            <h3 className="text-[18px] font-semibold tracking-tight text-white">
                                Multi-Location
                            </h3>
                            <p className="text-[13px] leading-relaxed text-white/70">
                                See across your entire business from a single dashboard. One source
                                of truth for every location.
                            </p>
                            <Link
                                href="#"
                                className="mt-1 inline-flex w-fit items-center gap-1 border-b border-white/30 pb-0.5 text-[12px] font-semibold text-white/90 transition-colors hover:border-white hover:text-white"
                            >
                                Discover Lole&apos;s Insights <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </figure>
                </div>
            </div>
        </div>
    );
}

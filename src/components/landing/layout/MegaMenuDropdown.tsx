'use client';

import { motion } from 'framer-motion';
import {
    Store,
    CalendarCheck,
    MonitorPlay,
    CreditCard,
    ScanLine,
    Boxes,
    LineChart,
} from 'lucide-react';

interface MegaMenuDropdownProps {
    isOpen: boolean;
    isScrolled: boolean;
}

export function MegaMenuDropdown({ isOpen, isScrolled }: MegaMenuDropdownProps): React.JSX.Element {
    return (
        <motion.div
            initial={false}
            animate={{ opacity: isOpen ? 1 : 0 }}
            transition={{
                duration: 0.25,
                ease: 'easeOut',
                delay: isOpen ? 0 : 0,
            }}
            className={`absolute top-0 right-0 left-0 -z-10 w-full overflow-hidden ${isScrolled ? 'rounded-xl md:rounded-2xl' : 'rounded-xl md:rounded-2xl'} shadow-2xl transition-shadow duration-300 ${isOpen ? 'pointer-events-auto shadow-black/10' : 'pointer-events-none shadow-transparent'}`}
        >
            <motion.div
                initial={false}
                animate={{ y: isOpen ? 0 : '-100%' }}
                transition={{ duration: 0.3, ease: [0.33, 1, 0.68, 1] }}
                className="w-full bg-[#F4F3EF] pt-[88px] pb-2 md:pt-[104px]"
            >
                <motion.div
                    initial={false}
                    animate={{
                        opacity: isOpen ? 1 : 0,
                        y: isOpen ? 0 : 8,
                    }}
                    transition={{
                        duration: 0.35,
                        ease: [0.33, 1, 0.68, 1],
                        delay: isOpen ? 0.11 : 0,
                    }}
                    className="border-t border-black/5 px-6 pt-6 pb-4 md:px-14 lg:px-20"
                >
                    <div className="grid max-w-[1050px] grid-cols-4 gap-x-8 gap-y-5">
                        <div className="flex flex-col gap-8">
                            <div className="flex flex-col gap-2">
                                <div className="font-inter flex items-center gap-2 text-[14px] leading-[21px] font-medium text-black">
                                    <Store className="h-4 w-4 text-gray-700" strokeWidth={1.5} />
                                    Point of Sale
                                </div>
                                <p className="font-inter max-w-[200px] text-[12.5px] leading-[18px] font-medium text-gray-500/85">
                                    A POS that flexes to your needs — intuitive, easy to learn, and
                                    connected to keep your business flowing.
                                </p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="font-inter flex items-center gap-2 text-[14px] leading-[21px] font-medium text-black">
                                    <ScanLine className="h-4 w-4 text-gray-700" strokeWidth={1.5} />
                                    QR ordering
                                </div>
                                <p className="font-inter max-w-[200px] text-[12.5px] leading-[18px] font-medium text-gray-500/85">
                                    From table to prep ticket to payment, serve guests faster and
                                    let the floor run itself.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-8">
                            <div className="flex flex-col gap-2">
                                <div className="font-inter flex items-center gap-2 text-[14px] leading-[21px] font-medium text-black">
                                    <CalendarCheck
                                        className="h-4 w-4 text-gray-700"
                                        strokeWidth={1.5}
                                    />
                                    Reservations
                                </div>
                                <p className="font-inter max-w-[200px] text-[12.5px] leading-[18px] font-medium text-gray-500/85">
                                    Fill your tables easier with valuable guests to grow more
                                    predictable revenue.
                                </p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="font-inter flex items-center gap-2 text-[14px] leading-[21px] font-medium text-black">
                                    <Boxes className="h-4 w-4 text-gray-700" strokeWidth={1.5} />
                                    Inventory
                                </div>
                                <p className="font-inter max-w-[200px] text-[12.5px] leading-[18px] font-medium text-gray-500/85">
                                    With speedy sales and accurate stock-keeping, you can monitor
                                    your products in one view.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-8">
                            <div className="flex flex-col gap-2">
                                <div className="font-inter flex items-center gap-2 text-[14px] leading-[21px] font-medium text-black">
                                    <MonitorPlay
                                        className="h-4 w-4 text-gray-700"
                                        strokeWidth={1.5}
                                    />
                                    Kitchen Display
                                </div>
                                <p className="font-inter max-w-[200px] text-[12.5px] leading-[18px] font-medium text-gray-500/85">
                                    Orders flow directly from your POS to the kitchen in real time.
                                    Fly through tickets without costly mistakes.
                                </p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="font-inter flex items-center gap-2 text-[14px] leading-[21px] font-medium text-black">
                                    <LineChart
                                        className="h-4 w-4 text-gray-700"
                                        strokeWidth={1.5}
                                    />
                                    Insights
                                </div>
                                <p className="font-inter max-w-[200px] text-[12.5px] leading-[18px] font-medium text-gray-500/85">
                                    Understand how your daily ops drive real-time revenue, so you
                                    can grow your business confidently.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-8">
                            <div className="flex flex-col gap-2">
                                <div className="font-inter flex items-center gap-2 text-[14px] leading-[21px] font-medium text-black">
                                    <CreditCard
                                        className="h-4 w-4 text-gray-700"
                                        strokeWidth={1.5}
                                    />
                                    Payments
                                </div>
                                <p className="font-inter max-w-[200px] text-[12.5px] leading-[18px] font-medium text-gray-500/85">
                                    Secure your revenue at the speed you need.
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </motion.div>
    );
}

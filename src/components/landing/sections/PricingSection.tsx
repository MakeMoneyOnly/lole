import React from 'react';
import dynamic from 'next/dynamic';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const PricingAnimation = dynamic(
    () => import('../shared/PricingAnimation').then(mod => mod.PricingAnimation),
    { ssr: false, loading: () => <span className="block">...</span> }
);

interface PricingPlan {
    title: string;
    desc: string;
    monthlyPrice: number;
    annuallyPrice: number;
    badge?: string;
    buttonText: string;
    features: string[];
}

const plans: PricingPlan[] = [
    {
        title: 'Starter',
        desc: 'Perfect for small cafes and restaurants starting their digital journey.',
        monthlyPrice: 2900,
        annuallyPrice: 29000,
        buttonText: 'Start with Starter',
        features: [
            'Access to 50+ Menu items',
            'Offline sync support',
            'Standard KDS support',
            'Basic analytics',
            '1 terminal license',
            'Community support',
            'Standard updates',
        ],
    },
    {
        title: 'Pro',
        desc: 'For busy venues requiring advanced inventory, multi-terminal KDS, and priority support.',
        monthlyPrice: 7900,
        annuallyPrice: 79000,
        badge: 'Best Value',
        buttonText: 'Upgrade to Pro',
        features: [
            'Unlimited Menu items',
            'Advanced Inventory & Stock',
            'Multi-terminal KDS',
            'Live performance tracking',
            '10 project licenses',
            'Priority WhatsApp support',
            'Team collaboration tools',
        ],
    },
    {
        title: 'Enterprise',
        desc: 'Built for major restaurant groups and multi-location franchises needing maximum control.',
        monthlyPrice: 15900,
        annuallyPrice: 159000,
        buttonText: 'Contact Sales',
        features: [
            'Everything in Pro',
            'Custom API integrations',
            'Dedicated Account Manager',
            'Enterprise-grade Security',
            'Unlimited terminal licenses',
            'Multi-location management',
            '99.9% Uptime SLA',
        ],
    },
];

interface PricingSectionProps {
    billPlan: 'monthly' | 'annually';
    setBillPlan: (plan: 'monthly' | 'annually') => void;
}

export function PricingSection({ billPlan, setBillPlan }: PricingSectionProps): React.JSX.Element {
    return (
        <div className="relative z-10 box-border w-full px-4 pt-8 md:px-10 md:pt-12 lg:px-20">
            <div className="w-full">
                <div className="mb-12 flex w-full flex-col gap-8 px-2 md:px-0">
                    <h2 className="translate-x-[125px] text-center text-[32px] font-semibold tracking-[-0.07em] text-black md:text-left md:text-[44px]">
                        Pricing that works for you.
                    </h2>

                    {/* Toggle Button Container */}
                    <div className="flex w-full justify-center">
                        <button
                            onClick={() =>
                                setBillPlan(billPlan === 'monthly' ? 'annually' : 'monthly')
                            }
                            aria-label={`Switch to ${billPlan === 'monthly' ? 'annual' : 'monthly'} billing`}
                            className="flex cursor-pointer items-center gap-4 rounded-full border border-black/5 bg-white/50 px-4 py-2 backdrop-blur-sm transition-colors select-none hover:bg-white/70"
                        >
                            <span
                                className={`text-sm font-medium transition-colors ${billPlan === 'monthly' ? 'text-black' : 'text-black/40'}`}
                            >
                                Monthly
                            </span>
                            <div className="relative rounded-full focus:outline-none">
                                <div className="h-6 w-12 rounded-full bg-[#1C1917] shadow-sm transition outline-none"></div>
                                <div
                                    className={`absolute top-1 left-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white transition-all duration-500 ease-in-out ${
                                        billPlan === 'annually' ? 'translate-x-6' : 'translate-x-0'
                                    }`}
                                />
                            </div>
                            <span
                                className={`text-sm font-medium transition-colors ${billPlan === 'annually' ? 'text-black' : 'text-black/40'}`}
                            >
                                Annually
                            </span>
                        </button>
                    </div>
                </div>

                <div className="mx-auto grid max-w-[1340px] grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                    {plans.map((plan, idx) => (
                        <div
                            key={idx}
                            className={`relative flex flex-col rounded-4xl bg-white p-8 transition-all duration-300 md:p-10 ${plan.badge ? 'shadow-xl shadow-black/2' : ''}`}
                        >
                            {plan.badge && (
                                <div className="absolute top-6 right-8 rounded-[16px] bg-[#DDF853] px-5 py-2.5 text-[14px] leading-[21px] font-medium text-black shadow-sm">
                                    Best value
                                </div>
                            )}

                            <div className="mb-10 flex flex-col">
                                <h3 className="mb-4 text-[20px] font-semibold text-black">
                                    {plan.title}
                                </h3>
                                <div className="mb-4 flex items-baseline gap-1">
                                    <span className="text-[40px] font-semibold tracking-[-0.07em] text-black md:text-[56px]">
                                        <PricingAnimation
                                            billPlan={billPlan}
                                            monthlyPrice={plan.monthlyPrice}
                                            annuallyPrice={plan.annuallyPrice}
                                        />
                                    </span>
                                    <span className="text-[18px] font-medium text-black/40">
                                        Br/{billPlan === 'monthly' ? 'mo' : 'yr'}
                                    </span>
                                </div>
                                <p className="max-w-[340px] text-[15px] leading-relaxed text-black/60">
                                    {plan.desc}
                                </p>
                            </div>

                            <div className="mb-10 flex w-full flex-col">
                                <Button
                                    variant="ghost"
                                    size="lg"
                                    className={`h-14 w-full rounded-[16px] text-[14px] font-medium shadow-none transition-all duration-300 ${plan.badge ? 'bg-[#292723] text-white hover:bg-[#3d3a34]' : 'border border-black/10 bg-transparent text-black hover:bg-black/2'}`}
                                >
                                    {plan.buttonText}
                                </Button>
                                <span className="mt-3 text-center text-[12px] font-medium text-black/40">
                                    {billPlan === 'monthly'
                                        ? 'Billed monthly'
                                        : 'Billed in one annual payment'}
                                </span>
                            </div>

                            <div className="flex flex-col gap-3.5 border-t border-black/5 pt-8">
                                <span className="mb-1 text-[14px] font-semibold text-black">
                                    Includes:
                                </span>
                                {plan.features.map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/5">
                                            <Check className="h-3 w-3 text-black" />
                                        </div>
                                        <span className="text-[14px] font-medium text-black/70">
                                            {feature}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

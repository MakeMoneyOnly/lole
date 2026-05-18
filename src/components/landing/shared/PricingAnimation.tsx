'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface PricingAnimationProps {
    billPlan: 'monthly' | 'annually';
    monthlyPrice: number;
    annuallyPrice: number;
}

export function PricingAnimation({ billPlan, monthlyPrice, annuallyPrice }: PricingAnimationProps): React.JSX.Element {
    return (
        <AnimatePresence mode="wait">
            <motion.span
                key={billPlan}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{
                    duration: 0.2,
                    ease: 'easeOut',
                }}
                className="block"
            >
                {billPlan === 'monthly'
                    ? monthlyPrice.toLocaleString()
                    : annuallyPrice.toLocaleString()}
            </motion.span>
        </AnimatePresence>
    );
}

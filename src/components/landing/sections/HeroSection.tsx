import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function HeroSection(): React.JSX.Element {
    return (
        <div className="box-border h-svh w-full p-3 md:p-4">
            {/* Hero Card */}
            <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-gray-900 md:rounded-2xl">
                {/* Background Image */}
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                        backgroundImage:
                            "url('https://res.cloudinary.com/dcm6m7d81/image/upload/v1774504640/9pzsEjPpCGZ2zEKMUp_Oti_e8qovr.png')",
                    }}
                ></div>

                {/* Hero Content */}
                <div className="relative z-10 -mt-[100px] flex flex-grow flex-col items-center justify-center px-4 text-center">
                    <h1 className="mx-auto mb-6 max-w-4xl text-3xl leading-[1.05] font-semibold tracking-[-0.07em] text-white md:text-[4rem]">
                        Tech that gives your
                        <br />
                        restaurant flow.
                    </h1>
                    <p className="mx-auto mb-8 max-w-2xl text-[18px] leading-[27px] font-medium text-white">
                        Lole intelligently connects your daily operations to your back-office admin
                        so you can run smoother service and plan with confidence.
                    </p>
                    <div className="flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row">
                        <Link
                            href="/signup"
                            className="flex w-full items-center justify-center gap-1.5 rounded-[16px] bg-[#DDF853] px-6 py-3 text-[14px] leading-[21px] font-medium text-black transition-colors hover:brightness-105 sm:w-auto"
                        >
                            Book a demo
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link
                            href="/signup"
                            className="flex w-full items-center justify-center rounded-[16px] border border-white/40 bg-transparent px-6 py-3 text-[14px] leading-[21px] font-medium text-white transition-colors hover:bg-white/10 sm:w-auto"
                        >
                            Get started
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

import React from 'react';
import Link from 'next/link';
import { ChevronDown, ArrowRight } from 'lucide-react';

interface FaqSectionProps {
    openFaq: number | null;
    setOpenFaq: (idx: number | null) => void;
}

export function FaqSection({ openFaq, setOpenFaq }: FaqSectionProps) {
    const questions = [
        'How is Lole different from other POS systems?',
        'What type of businesses can benefit from Lole?',
        'How does pricing work?',
        'What hardware do I need?',
        'How are payments handled?',
    ];

    return (
        <div className="w-full px-4 pt-24 pb-8 md:px-10 md:pt-32 lg:px-20">
            <div className="grid w-full grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
                {/* Left Content */}
                <div className="flex flex-col lg:col-span-5">
                    <h2 className="mb-6 translate-x-[125px] text-[48px] leading-[0.9] font-semibold tracking-[-0.07em] text-black">
                        FAQ
                    </h2>
                    <p className="max-w-[460px] translate-x-[125px] text-[15px] leading-[1.6] font-medium text-black">
                        Find quick answers to our most common questions. If you can't find what you
                        need, visit our{' '}
                        <Link
                            href="#"
                            className="underline underline-offset-2 transition-colors hover:text-gray-600"
                        >
                            help section
                        </Link>{' '}
                        or{' '}
                        <Link
                            href="#"
                            className="underline underline-offset-2 transition-colors hover:text-gray-600"
                        >
                            contact us
                        </Link>
                        .
                    </p>
                </div>

                {/* Right Content: FAQ Items */}
                <div className="mx-auto flex w-full max-w-3xl -translate-x-[100px] flex-col gap-3 lg:col-span-7">
                    {questions.map((question, idx) => (
                        <div
                            key={idx}
                            className="group flex flex-col overflow-hidden rounded-[20px] border border-transparent bg-white transition-all duration-300"
                        >
                            <button
                                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                aria-expanded={openFaq === idx}
                                aria-controls={`faq-answer-${idx}`}
                                className="flex w-full items-center justify-between px-8 py-6 text-left transition-colors hover:bg-black/5"
                            >
                                <span
                                    id={`faq-question-${idx}`}
                                    className="text-[15px] leading-tight font-semibold text-black"
                                >
                                    {question}
                                </span>
                                <ChevronDown
                                    className={`h-4 w-4 text-black/60 transition-transform duration-300 ${openFaq === idx ? 'rotate-180' : ''}`}
                                />
                            </button>
                            <div
                                id={`faq-answer-${idx}`}
                                role="region"
                                aria-labelledby={`faq-question-${idx}`}
                                className={`px-8 transition-all duration-300 ease-in-out ${
                                    openFaq === idx
                                        ? 'max-h-40 pb-6 opacity-100'
                                        : 'max-h-0 overflow-hidden opacity-0'
                                }`}
                            >
                                <p className="text-[14px] leading-relaxed text-gray-500">
                                    {idx === 0
                                        ? 'Lole is built specifically for local restaurant operations in Addis Ababa, focusing on offline reliability, multi-tenant security, and intuitive staff workflows.'
                                        : idx === 1
                                          ? "Any restaurant, cafe, bar or bakery looking to modernize their operations and improve service speed can benefit from Lole's platform."
                                          : idx === 2
                                            ? 'We offer transparent, volume-based pricing designed to scale with your business. Contact our sales team for a detailed breakdown.'
                                            : idx === 3
                                              ? 'Lole is compatible with standard Android tablets and professional KDS displays. We also support standard thermal printers.'
                                              : 'We support all major local payment methods including Telebirr, CBE Birr, and international cards through our secure payment gateway.'}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* CTA Section */}
            <div className="flex w-full justify-center px-6 py-16 md:px-12 md:py-24">
                <div className="flex w-full max-w-6xl flex-col items-center justify-between gap-8 md:flex-row">
                    <h2 className="text-center text-[24px] leading-[1.1] font-semibold tracking-[-0.07em] text-black md:text-left md:text-[34px]">
                        Start flowing with Lole today.
                    </h2>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/signup"
                            className="flex items-center justify-center rounded-[16px] bg-[#292723] px-6 py-3 text-[14px] leading-[21px] font-medium text-white transition-colors hover:bg-[#3d3a34]"
                        >
                            Get started
                        </Link>
                        <Link
                            href="/signup"
                            className="flex items-center justify-center gap-1.5 rounded-[16px] bg-[#DDF853] px-6 py-3 text-[14px] leading-[21px] font-medium text-black transition-colors hover:brightness-105"
                        >
                            Book a demo
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

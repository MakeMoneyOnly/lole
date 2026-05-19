'use client';

import { useCallback, useEffect, useRef, useState, useTransition, forwardRef } from 'react';
import Image from 'next/image';
import { SendIcon, LoaderIcon, BarChart3, ShoppingBag, Users, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AutoResizeOptions {
    minHeight: number;
    maxHeight?: number;
}

// ─── Auto-resize textarea hook ───────────────────────────────────────────────
function useAutoResizeTextarea(options?: AutoResizeOptions): {
     textareaRef: React.RefObject<HTMLTextAreaElement | null>;
     adjustHeight: (reset?: boolean) => void;
 } {
     const { minHeight = 44, maxHeight = 120 } = options || {};
     const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const el = textareaRef.current;
            if (!el) return;
            el.style.height = `${minHeight}px`;
            if (!reset) {
                const next = Math.max(
                    minHeight,
                    Math.min(el.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
                );
                el.style.height = `${next}px`;
            }
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        if (textareaRef.current) textareaRef.current.style.height = `${minHeight}px`;
    }, [minHeight]);

    return { textareaRef, adjustHeight };
}

// ─── Textarea ────────────────────────────────────────────────────────────────

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const ChatTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => (
        <textarea
            ref={ref}
            className={[
                'w-full resize-none bg-transparent text-sm font-medium text-gray-900',
                'placeholder:text-gray-400 focus:outline-none',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
            {...props}
        />
    )
);
ChatTextarea.displayName = 'ChatTextarea';

// ─── Typing dots ─────────────────────────────────────────────────────────────

function TypingDots(): React.JSX.Element {
    return (
        <div className="flex items-center gap-0.5">
            {[0, 1, 2].map(i => (
                <motion.span
                    key={i}
                    className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                    transition={{
                        duration: 1.1,
                        repeat: Infinity,
                        delay: i * 0.18,
                        ease: 'easeInOut',
                    }}
                />
            ))}
        </div>
    );
}

// ─── Quick‑action chips ───────────────────────────────────────────────────────

interface QuickAction {
    label: string;
    icon: React.ReactNode;
    prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
    {
        label: 'Sales Summary',
        icon: <BarChart3 className="h-3.5 w-3.5" />,
        prompt: 'Give me a sales summary for today.',
    },
    {
        label: 'Active Orders',
        icon: <ShoppingBag className="h-3.5 w-3.5" />,
        prompt: 'How many active orders do we have right now?',
    },
    {
        label: 'Staff Status',
        icon: <Users className="h-3.5 w-3.5" />,
        prompt: 'Who is currently on shift?',
    },
    {
        label: 'Quick Insight',
        icon: <Zap className="h-3.5 w-3.5" />,
        prompt: 'Give me a quick performance insight.',
    },
];

// ─── Message types ────────────────────────────────────────────────────────────

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    ts: Date;
}

// ─── Mock reply generator (placeholder until real API is wired) ───────────────

const MOCK_REPLIES: Record<string, string> = {
    default:
        "I'm lole, your AI restaurant operating agent. I can help you track orders, analyze sales, manage staff, and optimize your operations. What do you need?",
    sales: "Today's sales are looking strong! You're currently at 12,450 ETB — up 8% from yesterday. Lunch service drove 60% of revenue. Shall I break it down by category?",
    orders: 'You have 7 active orders right now: 3 in preparation, 2 ready to serve, and 2 pending acknowledgement. Average ticket time is 14 minutes.',
    staff: '3 staff members are currently on shift: 1 manager, 1 cashier, and 1 server. Clock-in records are up to date.',
    insight:
        'Your best-performing item today is the Tibs Firfir (23 orders). Table 5 has the longest wait at 22 minutes — consider reassigning a server.',
};

function getMockReply(input: string): string {
    const lower = input.toLowerCase();
    if (lower.includes('sales') || lower.includes('revenue') || lower.includes('summary'))
        return MOCK_REPLIES.sales;
    if (lower.includes('order')) return MOCK_REPLIES.orders;
    if (lower.includes('staff') || lower.includes('shift') || lower.includes('who'))
        return MOCK_REPLIES.staff;
    if (lower.includes('insight') || lower.includes('performance')) return MOCK_REPLIES.insight;
    return MOCK_REPLIES.default;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LoleChatbot(): React.JSX.Element {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '0',
            role: 'assistant',
            content:
                "Hi! I'm **lole**, your AI restaurant operating agent. Ask me anything about your orders, sales, staff, or operations.",
            ts: new Date(),
        },
    ]);
    const [value, setValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [, startTransition] = useTransition();
    const scrollRef = useRef<HTMLDivElement>(null);

    const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 44, maxHeight: 120 });

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const sendMessage = useCallback(
        (text: string) => {
            const trimmed = text.trim();
            if (!trimmed || isTyping) return;

            const userMsg: Message = {
                id: Date.now().toString(),
                role: 'user',
                content: trimmed,
                ts: new Date(),
            };

            setMessages(prev => [...prev, userMsg]);
            setValue('');
            adjustHeight(true);

            startTransition(() => {
                setIsTyping(true);
                setTimeout(
                    () => {
                        const reply: Message = {
                            id: (Date.now() + 1).toString(),
                            role: 'assistant',
                            content: getMockReply(trimmed),
                            ts: new Date(),
                        };
                        setMessages(prev => [...prev, reply]);
                        setIsTyping(false);
                    },
                    1400 + Math.random() * 600
                );
            });
        },
        [isTyping, adjustHeight]
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(value);
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* ── Header — logo mark + headline + subtitle ── */}
            <div className="mb-2">
                <video
                    src="/mascot.webm"
                    width={88}
                    height={88}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="mb-1 -ml-1 object-contain"
                    style={{
                        backfaceVisibility: 'hidden',
                        transform: 'translateZ(0)',
                        isolation: 'isolate',
                    }}
                />
                <h3 className="mb-1 text-[17px] leading-snug font-semibold tracking-tight text-gray-900">
                    Beyond chat, get it done.
                </h3>
                <p className="text-[12px] leading-relaxed font-normal text-gray-500">
                    Just tell lole what you need — it plans, executes, and delivers, keeping you in
                    the loop.
                </p>
            </div>

            {/* ── Messages ── */}
            <div
                ref={scrollRef}
                className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}
                tabIndex={0}
            >
                <AnimatePresence initial={false}>
                    {messages.map(msg => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.role === 'assistant' && (
                                <Image
                                    src="/icons/mascot.svg"
                                    alt="lole"
                                    width={44}
                                    height={44}
                                    className="mt-0.5 mr-2 shrink-0 rounded-lg object-contain"
                                />
                            )}
                            <div
                                className={[
                                    'max-w-[78%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed font-medium',
                                    msg.role === 'user'
                                        ? 'rounded-br-sm bg-[#DDF853] text-black'
                                        : 'rounded-bl-sm bg-[#F8F9FA] text-gray-800',
                                ].join(' ')}
                            >
                                {/* Render **bold** markdown */}
                                {msg.content
                                    .split(/(\*\*[^*]+\*\*)/g)
                                    .map((part, i) =>
                                        part.startsWith('**') && part.endsWith('**') ? (
                                            <strong key={i}>{part.slice(2, -2)}</strong>
                                        ) : (
                                            <span key={i}>{part}</span>
                                        )
                                    )}
                            </div>
                            {msg.role === 'user' && (
                                <div className="mt-0.5 ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gray-200">
                                    <span className="text-[9px] font-bold text-gray-600">YOU</span>
                                </div>
                            )}
                        </motion.div>
                    ))}

                    {isTyping && (
                        <motion.div
                            key="typing"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-start justify-start"
                        >
                            <Image
                                src="/icons/mascot.svg"
                                alt="lole"
                                width={24}
                                height={24}
                                className="mt-0.5 mr-2 shrink-0 rounded-lg object-contain"
                            />
                            <div className="rounded-2xl rounded-bl-sm bg-[#F8F9FA] px-3.5 py-3">
                                <TypingDots />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Input ── */}
            <div className="mt-3 rounded-2xl border border-gray-200 bg-[#F8F9FA] transition-all focus-within:border-black/30 focus-within:shadow-none">
                <div className="px-4 pt-3">
                    <ChatTextarea
                        ref={textareaRef}
                        value={value}
                        onChange={e => {
                            setValue(e.target.value);
                            adjustHeight();
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask lole anything…"
                        rows={1}
                        disabled={isTyping}
                    />
                </div>
                <div className="flex items-center justify-between px-3 pt-1 pb-2.5">
                    <span className="text-[10px] font-semibold text-gray-500">
                        {isTyping ? 'lole is thinking…' : 'Enter to send · Shift+Enter for newline'}
                    </span>
                    <motion.button
                        type="button"
                        aria-label="Send message"
                        onClick={() => sendMessage(value)}
                        disabled={isTyping || !value.trim()}
                        whileTap={{ scale: 0.93 }}
                        className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#DDF853] text-black shadow-none transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {isTyping ? (
                            <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <SendIcon className="h-3.5 w-3.5" />
                        )}
                    </motion.button>
                </div>
            </div>

            {/* ── Quick actions ── */}
            <div
                className="mt-3 flex gap-2 overflow-x-auto pb-1"
                style={{ scrollbarWidth: 'none' }}
            >
                {QUICK_ACTIONS.map(action => (
                    <button
                        key={action.label}
                        onClick={() => sendMessage(action.prompt)}
                        disabled={isTyping}
                        className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-600 transition-all hover:border-[#DDF853]/20 hover:bg-[#DDF853] hover:text-black disabled:opacity-50"
                    >
                        {action.icon}
                        {action.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

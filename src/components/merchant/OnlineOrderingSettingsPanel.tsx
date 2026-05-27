'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, Save, Copy, Check, Clock, Globe, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

function ToggleSwitch({
    checked,
    onChange,
    disabled,
    ariaLabel,
}: {
    checked: boolean;
    onChange: (c: boolean) => void;
    disabled?: boolean;
    ariaLabel?: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-[#a0151e] focus:ring-offset-2 focus:outline-none',
                checked ? 'bg-[#98141F]' : 'bg-gray-200',
                disabled && 'cursor-not-allowed opacity-50'
            )}
        >
            <span
                className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    checked ? 'translate-x-5' : 'translate-x-0'
                )}
            />
        </button>
    );
}

function CustomTimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const options = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15) {
            const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
            const ampm = h < 12 ? 'AM' : 'PM';
            const hh = h.toString().padStart(2, '0');
            const mm = m.toString().padStart(2, '0');
            const hh12 = hour12.toString().padStart(2, '0');
            options.push({
                value: `${hh}:${mm}`,
                label: `${hh12}:${mm} ${ampm}`,
            });
        }
    }

    const selectedOption = options.find(o => o.value === value) || options[0];

    return (
        <div ref={ref} className="relative w-full">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex h-12 w-full items-center justify-between rounded-xl border-0 bg-gray-50 px-4 text-[15px] font-semibold text-gray-800 transition-all outline-none hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-[#98141F]"
            >
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>{selectedOption ? selectedOption.label : 'Select time'}</span>
                </div>
                <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && (
                <div className="custom-scrollbar absolute z-10 mt-2 flex max-h-60 w-full flex-col overflow-y-auto rounded-xl bg-white py-1 shadow-[0px_4px_24px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
                    {options.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setOpen(false);
                            }}
                            className={cn(
                                'flex w-full items-center justify-between px-4 py-3 text-left text-[14px] transition-colors',
                                value === option.value
                                    ? 'bg-gray-50 font-bold text-[#98141F]'
                                    : 'font-medium text-gray-700 hover:bg-gray-50'
                            )}
                        >
                            {option.label}
                            {value === option.value && <Check className="h-4 w-4 text-[#98141F]" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export type OnlineOrderingSettings = {
    enabled: boolean;
    accepts_scheduled_orders: boolean;
    auto_accept_orders: boolean;
    prep_time_minutes: number;
    max_daily_orders: number;
    service_hours: {
        start: string;
        end: string;
    };
    order_throttling_enabled: boolean;
    throttle_limit_per_15m: number;
};

interface OnlineOrderingSettingsPanelProps {
    loading: boolean;
    saving: boolean;
    error: string | null;
    settings: OnlineOrderingSettings;
    restaurantSlug?: string | null;
    onChange: (next: OnlineOrderingSettings) => void;
    onSave: () => Promise<void>;
}

export function OnlineOrderingSettingsPanel({
    loading,
    saving,
    error,
    settings,
    restaurantSlug,
    onChange,
    onSave,
}: OnlineOrderingSettingsPanelProps) {
    const [copied, setCopied] = useState(false);

    // Derive the stable guest-facing origin:
    // On Vercel always use the production domain so the storefront link works for real guests.
    // Locally (or if env var is missing) fall back to window.location.origin.
    const guestOrigin = (() => {
        const productionUrl = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
        if (productionUrl) return `https://${productionUrl.replace(/\r|\n|["']/g, '').trim()}`;
        if (typeof window !== 'undefined') return window.location.origin;
        return '';
    })();

    const storeLink = guestOrigin && restaurantSlug ? `${guestOrigin}/${restaurantSlug}` : '';

    const handleCopyLink = async () => {
        if (!storeLink) return;
        try {
            await navigator.clipboard.writeText(storeLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    return (
        <div className="rounded-[1.5rem] bg-white p-6 shadow-[0px_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Online Ordering Settings</h3>
                    <p className="mt-1 text-sm font-medium text-gray-500">
                        Control online storefront availability and order intake rules.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void onSave()}
                    disabled={saving || loading}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#98141F] px-5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#801019] hover:shadow active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                >
                    {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    Save Changes
                </button>
            </div>
            {storeLink ? (
                <div
                    className={cn(
                        'mt-6 flex items-center justify-between overflow-hidden rounded-[1.25rem] p-1.5 shadow-lg transition-all',
                        settings.enabled
                            ? 'bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900'
                            : 'border border-gray-200 bg-gray-100 shadow-none'
                    )}
                >
                    <div
                        className={cn(
                            'flex items-center gap-4 py-3 pl-4 transition-opacity',
                            settings.enabled ? 'opacity-100' : 'opacity-50 grayscale'
                        )}
                    >
                        <div
                            className={cn(
                                'flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-inner backdrop-blur-md',
                                settings.enabled ? 'bg-white/10' : 'bg-gray-300'
                            )}
                        >
                            <Globe
                                className={cn(
                                    'h-5 w-5 text-gray-100',
                                    settings.enabled ? '' : 'text-gray-500'
                                )}
                            />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span
                                className={cn(
                                    'text-[10px] font-bold tracking-widest uppercase',
                                    settings.enabled ? 'text-gray-400' : 'text-gray-500'
                                )}
                            >
                                {settings.enabled ? 'Your Live Storefront' : 'Storefront Disabled'}
                            </span>
                            <a
                                href={settings.enabled ? storeLink : '#'}
                                target={settings.enabled ? '_blank' : undefined}
                                rel={settings.enabled ? 'noopener noreferrer' : undefined}
                                onClick={e => !settings.enabled && e.preventDefault()}
                                className={cn(
                                    'text-[15px] font-semibold transition-colors',
                                    settings.enabled
                                        ? 'text-white hover:text-[#ff6b7b]'
                                        : 'pointer-events-none text-gray-600'
                                )}
                            >
                                {storeLink}
                            </a>
                        </div>
                    </div>
                    <div className="pr-1.5">
                        <button
                            onClick={handleCopyLink}
                            disabled={!settings.enabled}
                            className={cn(
                                'flex h-12 w-12 items-center justify-center rounded-xl transition-all',
                                settings.enabled
                                    ? 'bg-white/10 text-white hover:bg-white/20 active:scale-95'
                                    : 'cursor-not-allowed bg-gray-200 text-gray-400 opacity-50'
                            )}
                            aria-label="Copy store link"
                        >
                            {copied ? (
                                <Check className="h-5 w-5 text-emerald-400" />
                            ) : (
                                <Copy className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="mt-6 h-[76px] w-full animate-pulse rounded-[1.25rem] bg-gray-100" />
            )}

            {error && (
                <p
                    role="alert"
                    className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"
                >
                    {error}
                </p>
            )}

            {loading ? (
                <div className="mt-4 h-48 animate-pulse rounded-xl bg-gray-50" />
            ) : (
                <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                        <span className="text-sm font-semibold text-gray-800">
                            Online ordering enabled
                        </span>
                        <ToggleSwitch
                            checked={settings.enabled}
                            ariaLabel="Online ordering enabled"
                            onChange={checked => onChange({ ...settings, enabled: checked })}
                        />
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                        <span className="text-sm font-semibold text-gray-800">
                            Accept scheduled orders
                        </span>
                        <ToggleSwitch
                            checked={settings.accepts_scheduled_orders}
                            ariaLabel="Accept scheduled orders"
                            onChange={checked =>
                                onChange({ ...settings, accepts_scheduled_orders: checked })
                            }
                        />
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                        <span className="text-sm font-semibold text-gray-800">
                            Auto-accept incoming orders
                        </span>
                        <ToggleSwitch
                            checked={settings.auto_accept_orders}
                            ariaLabel="Auto-accept incoming orders"
                            onChange={checked =>
                                onChange({ ...settings, auto_accept_orders: checked })
                            }
                        />
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                        <span className="text-sm font-semibold text-gray-800">
                            Enable throttling
                        </span>
                        <ToggleSwitch
                            checked={settings.order_throttling_enabled}
                            ariaLabel="Enable throttling"
                            onChange={checked =>
                                onChange({ ...settings, order_throttling_enabled: checked })
                            }
                        />
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                        <label className="text-sm font-medium text-gray-700">
                            Prep Time (minutes)
                        </label>
                        <input
                            type="number"
                            min={5}
                            max={180}
                            value={settings.prep_time_minutes}
                            onChange={event =>
                                onChange({
                                    ...settings,
                                    prep_time_minutes:
                                        Number.parseInt(event.target.value, 10) || 30,
                                })
                            }
                            className="h-12 w-full rounded-xl border-0 bg-gray-50 px-4 text-[15px] font-semibold text-gray-800 transition-all outline-none hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-[#98141F]"
                        />
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                        <label className="text-sm font-medium text-gray-700">
                            Max Daily Orders
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={5000}
                            value={settings.max_daily_orders}
                            onChange={event =>
                                onChange({
                                    ...settings,
                                    max_daily_orders:
                                        Number.parseInt(event.target.value, 10) || 300,
                                })
                            }
                            className="h-12 w-full rounded-xl border-0 bg-gray-50 px-4 text-[15px] font-semibold text-gray-800 transition-all outline-none hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-[#98141F]"
                        />
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                        <label className="text-sm font-medium text-gray-700">Service Start</label>
                        <CustomTimeSelect
                            value={settings.service_hours.start}
                            onChange={val =>
                                onChange({
                                    ...settings,
                                    service_hours: { ...settings.service_hours, start: val },
                                })
                            }
                        />
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                        <label className="text-sm font-medium text-gray-700">Service End</label>
                        <CustomTimeSelect
                            value={settings.service_hours.end}
                            onChange={val =>
                                onChange({
                                    ...settings,
                                    service_hours: { ...settings.service_hours, end: val },
                                })
                            }
                        />
                    </div>

                    <div className="flex flex-col gap-2 pt-2 md:col-span-2">
                        <label className="text-sm font-medium text-gray-700">
                            Throttle Limit (orders / 15 min)
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={500}
                            value={settings.throttle_limit_per_15m}
                            onChange={event =>
                                onChange({
                                    ...settings,
                                    throttle_limit_per_15m:
                                        Number.parseInt(event.target.value, 10) || 40,
                                })
                            }
                            className="h-12 w-full rounded-xl border-0 bg-gray-50 px-4 text-[15px] font-semibold text-gray-800 transition-all outline-none hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-[#98141F]"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

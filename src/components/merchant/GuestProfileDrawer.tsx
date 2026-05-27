'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
import { Loader2, Save, Star, X } from 'lucide-react';
import { formatETBCurrency } from '@/lib/format/et';

type GuestDetail = {
    id: string;
    name: string | null;
    language: string;
    tags: string[];
    is_vip: boolean;
    notes: string | null;
    visit_count: number;
    lifetime_value: number;
    first_seen_at: string;
    last_seen_at: string;
};

type GuestVisit = {
    id: string;
    channel: string;
    visited_at: string;
    spend: number;
    order_id: string | null;
    metadata: Record<string, unknown>;
};

interface GuestProfileDrawerProps {
    open: boolean;
    guest: GuestDetail | null;
    visits: GuestVisit[];
    loading: boolean;
    saving: boolean;
    onClose: () => void;
    onSave: (payload: {
        guestId: string;
        name?: string;
        language?: 'en' | 'am';
        tags?: string[];
        is_vip?: boolean;
        notes?: string | null;
    }) => Promise<void>;
}

const QUICK_TAGS = ['vip', 'frequent', 'weekday-lunch', 'family', 'delivery-fan'];
const DASHBOARD_LOCALE = 'en-ET';

function parseTags(value: string) {
    return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, 20);
}

export function GuestProfileDrawer({
    open,
    guest,
    visits,
    loading,
    saving,
    onClose,
    onSave,
}: GuestProfileDrawerProps) {
    const drawerHeadingId = useId();
    const nameInputId = useId();
    const languageInputId = useId();
    const tagsInputId = useId();
    const notesInputId = useId();
    const [name, setName] = useState('');
    const [language, setLanguage] = useState<'en' | 'am'>('en');
    const [tagsInput, setTagsInput] = useState('');
    const [isVip, setIsVip] = useState(false);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!guest) return;
        setName(guest.name ?? '');
        setLanguage((guest.language === 'am' ? 'am' : 'en') as 'en' | 'am');
        setTagsInput((guest.tags ?? []).join(', '));
        setIsVip(Boolean(guest.is_vip));
        setNotes(guest.notes ?? '');
    }, [guest]);

    const parsedTags = useMemo(() => parseTags(tagsInput), [tagsInput]);

    if (!open) return null;

    const handleSave = async () => {
        if (!guest) return;
        await onSave({
            guestId: guest.id,
            name: name.trim() || undefined,
            language,
            tags: parsedTags,
            is_vip: isVip,
            notes: notes.trim() ? notes.trim() : null,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={drawerHeadingId}
                className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"
            >
                <div className="flex items-start justify-between">
                    <div>
                        <h3 id={drawerHeadingId} className="text-xl font-bold text-gray-900">
                            Guest Profile
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            {guest?.name?.trim() ||
                                (guest ? `Guest ${guest.id.slice(0, 8)}` : 'Loading...')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close guest profile drawer"
                        className="hover:bg-brand-accent flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-all hover:text-black"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {loading || !guest ? (
                    <div
                        role="status"
                        aria-live="polite"
                        className="mt-6 inline-flex items-center gap-2 text-sm text-gray-500"
                    >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading guest profile...
                    </div>
                ) : (
                    <div className="mt-6 space-y-5">
                        <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <div>
                                <p className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
                                    Visits
                                </p>
                                <p className="mt-1 text-lg font-bold text-gray-900">
                                    {guest.visit_count}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
                                    Lifetime Value
                                </p>
                                <p className="mt-1 text-lg font-bold text-gray-900">
                                    {formatETBCurrency(Number(guest.lifetime_value ?? 0))}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
                                    First Seen
                                </p>
                                <p className="mt-1 text-sm font-semibold text-gray-800">
                                    {new Date(guest.first_seen_at).toLocaleDateString(
                                        DASHBOARD_LOCALE
                                    )}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
                                    Last Seen
                                </p>
                                <p className="mt-1 text-sm font-semibold text-gray-800">
                                    {new Date(guest.last_seen_at).toLocaleDateString(
                                        DASHBOARD_LOCALE
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label
                                htmlFor={nameInputId}
                                className="text-xs font-semibold tracking-wide text-gray-500 uppercase"
                            >
                                Name
                            </label>
                            <input
                                id={nameInputId}
                                value={name}
                                onChange={event => setName(event.target.value)}
                                placeholder="Guest name"
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                            />
                        </div>

                        <div className="space-y-3">
                            <label
                                htmlFor={languageInputId}
                                className="text-xs font-semibold tracking-wide text-gray-500 uppercase"
                            >
                                Language
                            </label>
                            <select
                                id={languageInputId}
                                value={language}
                                onChange={event => setLanguage(event.target.value as 'en' | 'am')}
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                            >
                                <option value="en">English</option>
                                <option value="am">Amharic</option>
                            </select>
                        </div>

                        <div className="space-y-3">
                            <label
                                htmlFor={tagsInputId}
                                className="text-xs font-semibold tracking-wide text-gray-500 uppercase"
                            >
                                Segmentation Tags
                            </label>
                            <input
                                id={tagsInputId}
                                value={tagsInput}
                                onChange={event => setTagsInput(event.target.value)}
                                placeholder="vip, frequent, family"
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                            />
                            <div className="flex flex-wrap gap-2">
                                {QUICK_TAGS.map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => {
                                            const set = new Set(parsedTags);
                                            set.add(tag);
                                            setTagsInput([...set].join(', '));
                                        }}
                                        className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                                    >
                                        + {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label
                                htmlFor={notesInputId}
                                className="text-xs font-semibold tracking-wide text-gray-500 uppercase"
                            >
                                Notes
                            </label>
                            <textarea
                                id={notesInputId}
                                value={notes}
                                onChange={event => setNotes(event.target.value)}
                                placeholder="Preferences, allergies, seating notes..."
                                className="min-h-[100px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsVip(value => !value)}
                            aria-pressed={isVip}
                            className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ${
                                isVip ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                            }`}
                        >
                            <Star className="h-4 w-4" />
                            {isVip ? 'Marked as VIP' : 'Mark as VIP'}
                        </button>

                        <div>
                            <h4 className="text-sm font-bold text-gray-900">Visit Timeline</h4>
                            <div className="mt-2 space-y-2">
                                {visits.length === 0 ? (
                                    <p className="text-sm text-gray-500">No visit records yet.</p>
                                ) : (
                                    visits.map(visit => (
                                        <div
                                            key={visit.id}
                                            className="rounded-xl border border-gray-100 p-3"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                                                    {visit.channel}
                                                </span>
                                                <span className="text-xs font-semibold text-gray-800">
                                                    {formatETBCurrency(Number(visit.spend ?? 0))}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {new Date(visit.visited_at).toLocaleString(
                                                    DASHBOARD_LOCALE
                                                )}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || loading || !guest}
                        className="bg-brand-accent inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-black hover:brightness-105 disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

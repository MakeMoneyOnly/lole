'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, HandPlatter, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useRole } from '@/features/auth/hooks/useRole';
import type { UnifiedKDSOrder } from '@/features/operations/kds';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { submitOrderCourseFireUpdate } from '@/lib/orders/command-adapter';
import { submitFinalKdsHandoff } from '@/features/kds/lib/handoff-adapter';
import { readKdsQueue, readKdsSettings } from '@/features/kds/lib/read-adapter';

type ConsolidatedOrder = UnifiedKDSOrder & {
    readiness: {
        total: number;
        ready: number;
        pending: number;
        byStation: Record<string, { total: number; ready: number }>;
    };
};
type CourseType = 'appetizer' | 'main' | 'dessert' | 'beverage' | 'side';

type AlertPolicy = {
    new_ticket_sound: boolean;
    sla_breach_visual: boolean;
    recall_visual: boolean;
    quiet_hours_enabled: boolean;
    quiet_hours_start: string;
    quiet_hours_end: string;
};
type PrintPolicy = {
    mode: 'off' | 'fallback' | 'always';
    provider: 'log' | 'webhook';
    webhook_url: string | null;
    copies: number;
    timeout_ms: number;
    max_attempts: number;
    base_backoff_ms: number;
};

const DEFAULT_ALERT_POLICY: AlertPolicy = {
    new_ticket_sound: true,
    sla_breach_visual: true,
    recall_visual: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '23:00',
    quiet_hours_end: '06:00',
};
const DEFAULT_PRINT_POLICY: PrintPolicy = {
    mode: 'off',
    provider: 'log',
    webhook_url: null,
    copies: 1,
    timeout_ms: 4000,
    max_attempts: 4,
    base_backoff_ms: 400,
};

const COURSE_SEQUENCE: CourseType[] = ['appetizer', 'main', 'dessert', 'beverage', 'side'];

function courseLabel(course: CourseType | null | undefined): string {
    if (!course) return 'Appetizer';
    if (course === 'main') return 'Main';
    return course.charAt(0).toUpperCase() + course.slice(1);
}

function nextCourse(course: CourseType | null | undefined): CourseType | null {
    const current: CourseType = course ?? 'appetizer';
    const index = COURSE_SEQUENCE.indexOf(current);
    if (index < 0 || index >= COURSE_SEQUENCE.length - 1) return null;
    return COURSE_SEQUENCE[index + 1];
}

function normalizeAlertPolicy(input: unknown): AlertPolicy {
    const raw = (input ?? {}) as Record<string, unknown>;
    return {
        new_ticket_sound:
            typeof raw.new_ticket_sound === 'boolean'
                ? raw.new_ticket_sound
                : DEFAULT_ALERT_POLICY.new_ticket_sound,
        sla_breach_visual:
            typeof raw.sla_breach_visual === 'boolean'
                ? raw.sla_breach_visual
                : DEFAULT_ALERT_POLICY.sla_breach_visual,
        recall_visual:
            typeof raw.recall_visual === 'boolean'
                ? raw.recall_visual
                : DEFAULT_ALERT_POLICY.recall_visual,
        quiet_hours_enabled:
            typeof raw.quiet_hours_enabled === 'boolean'
                ? raw.quiet_hours_enabled
                : DEFAULT_ALERT_POLICY.quiet_hours_enabled,
        quiet_hours_start:
            typeof raw.quiet_hours_start === 'string'
                ? raw.quiet_hours_start
                : DEFAULT_ALERT_POLICY.quiet_hours_start,
        quiet_hours_end:
            typeof raw.quiet_hours_end === 'string'
                ? raw.quiet_hours_end
                : DEFAULT_ALERT_POLICY.quiet_hours_end,
    };
}

function normalizePrintPolicy(input: unknown): PrintPolicy {
    const raw = (input ?? {}) as Record<string, unknown>;
    return {
        mode:
            raw.mode === 'fallback' || raw.mode === 'always' || raw.mode === 'off'
                ? raw.mode
                : DEFAULT_PRINT_POLICY.mode,
        provider:
            raw.provider === 'webhook' || raw.provider === 'log'
                ? raw.provider
                : DEFAULT_PRINT_POLICY.provider,
        webhook_url:
            typeof raw.webhook_url === 'string' && raw.webhook_url.trim().length > 0
                ? raw.webhook_url.trim()
                : null,
        copies:
            typeof raw.copies === 'number' && Number.isFinite(raw.copies)
                ? Math.max(1, Math.min(5, Math.floor(raw.copies)))
                : DEFAULT_PRINT_POLICY.copies,
        timeout_ms:
            typeof raw.timeout_ms === 'number' && Number.isFinite(raw.timeout_ms)
                ? Math.max(1000, Math.min(20000, Math.floor(raw.timeout_ms)))
                : DEFAULT_PRINT_POLICY.timeout_ms,
        max_attempts:
            typeof raw.max_attempts === 'number' && Number.isFinite(raw.max_attempts)
                ? Math.max(1, Math.min(8, Math.floor(raw.max_attempts)))
                : DEFAULT_PRINT_POLICY.max_attempts,
        base_backoff_ms:
            typeof raw.base_backoff_ms === 'number' && Number.isFinite(raw.base_backoff_ms)
                ? Math.max(100, Math.min(5000, Math.floor(raw.base_backoff_ms)))
                : DEFAULT_PRINT_POLICY.base_backoff_ms,
    };
}
function buildReadiness(order: UnifiedKDSOrder): ConsolidatedOrder['readiness'] {
    const items = order.items ?? [];
    const byStation: Record<string, { total: number; ready: number }> = {};
    let ready = 0;
    for (const item of items) {
        const station = item.station ?? 'kitchen';
        if (!byStation[station]) {
            byStation[station] = { total: 0, ready: 0 };
        }
        byStation[station].total += 1;
        if ((item.status ?? 'queued') === 'ready') {
            byStation[station].ready += 1;
            ready += 1;
        }
    }

    return {
        total: items.length,
        ready,
        pending: Math.max(0, items.length - ready),
        byStation,
    };
}

export function ExpeditorBoard(): React.JSX.Element {
    const searchParams = useSearchParams();
    const queryRestaurantId = searchParams.get('restaurantId');
    const {
        role,
        restaurantId: roleRestaurantId,
        loading: roleLoading,
    } = useRole(queryRestaurantId);
    const restaurantId = queryRestaurantId || roleRestaurantId;
    const bypassForE2E =
        process.env.NODE_ENV !== 'production' &&
        typeof window !== 'undefined' &&
        window.localStorage.getItem('__e2e_bypass_auth') === 'true';
    const canFinalizeHandoff =
        bypassForE2E || role === 'owner' || role === 'admin' || role === 'manager';

    const [orders, setOrders] = useState<UnifiedKDSOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [handoffOrderId, setHandoffOrderId] = useState<string | null>(null);
    const [advancingCourseOrderId, setAdvancingCourseOrderId] = useState<string | null>(null);
    const [archiveMinutes, setArchiveMinutes] = useState(15);
    const [archiveInput, setArchiveInput] = useState('15');
    const [savingArchive, setSavingArchive] = useState(false);
    const [alertPolicy, setAlertPolicy] = useState<AlertPolicy>(DEFAULT_ALERT_POLICY);
    const [savingAlerts, setSavingAlerts] = useState(false);
    const [printPolicy, setPrintPolicy] = useState<PrintPolicy>(DEFAULT_PRINT_POLICY);
    const [savingPrintPolicy, setSavingPrintPolicy] = useState(false);
    const [clock, setClock] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setClock(new Date()), 60_000);
        return () => clearInterval(timer);
    }, []);

    const fetchQueue = useCallback(async () => {
        if (!restaurantId) {
            setOrders([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const result = await readKdsQueue({
                station: 'expeditor',
                limit: 120,
                slaMinutes: 30,
            });
            if (!result.ok || !result.data) {
                setError(result.error ?? 'Failed to fetch expeditor queue');
                return;
            }
            setOrders((result.data.orders ?? []) as UnifiedKDSOrder[]);
            setError(null);
        } catch {
            setError('Failed to fetch expeditor queue');
        } finally {
            setIsLoading(false);
        }
    }, [restaurantId]);

    const fetchKdsSettings = useCallback(async () => {
        if (!restaurantId) return;
        try {
            const result = await readKdsSettings();
            if (!result.ok || !result.data) {
                return;
            }

            const value = Number(result.data.ready_auto_archive_minutes ?? 15);
            const normalized = Number.isFinite(value)
                ? Math.max(0, Math.min(180, Math.floor(value)))
                : 15;
            setArchiveMinutes(normalized);
            setArchiveInput(String(normalized));
            setAlertPolicy(normalizeAlertPolicy(result.data.alert_policy));
            setPrintPolicy(normalizePrintPolicy(result.data.print_policy));
        } catch {
            // Keep current local value if settings fetch fails.
        }
    }, [restaurantId]);

    useEffect(() => {
        if (!roleLoading || Boolean(queryRestaurantId) || bypassForE2E) {
            void fetchQueue();
            void fetchKdsSettings();
        }
    }, [bypassForE2E, fetchQueue, fetchKdsSettings, queryRestaurantId, roleLoading]);

    useEffect(() => {
        const interval = setInterval(() => {
            void fetchQueue();
        }, 15_000);
        return () => clearInterval(interval);
    }, [fetchQueue]);

    const consolidated = useMemo<ConsolidatedOrder[]>(() => {
        return orders.map(order => ({
            ...order,
            readiness: buildReadiness(order),
        }));
    }, [orders]);

    const handleFinalHandoff = useCallback(async (orderId: string) => {
        setHandoffOrderId(orderId);
        try {
            const result = await submitFinalKdsHandoff({ orderId });
            if (!result.ok) {
                setError(result.error ?? 'Failed to mark order served');
                return;
            }

            setOrders(current => current.filter(order => order.id !== orderId));
            setError(null);
        } finally {
            setHandoffOrderId(null);
        }
    }, []);

    const handleAdvanceCourse = useCallback(async (order: UnifiedKDSOrder) => {
        if (order.fireMode !== 'manual') return;
        const next = nextCourse(order.currentCourse as CourseType | null | undefined);
        if (!next) return;

        setAdvancingCourseOrderId(order.id);
        try {
            const result = await submitOrderCourseFireUpdate({
                orderId: order.id,
                fireMode: 'manual',
                currentCourse: next,
            });
            if (!result.ok) {
                setError(result.error ?? 'Failed to advance course');
                return;
            }
            setError(null);
            setOrders(current =>
                current.map(currentOrder =>
                    currentOrder.id === order.id
                        ? { ...currentOrder, currentCourse: next }
                        : currentOrder
                )
            );
        } finally {
            setAdvancingCourseOrderId(null);
        }
    }, []);

    const handleSaveArchiveMinutes = useCallback(async () => {
        if (!canFinalizeHandoff) {
            setError('Only expeditor override roles can change KDS handoff policy.');
            return;
        }

        const nextValue = Number(archiveInput);
        if (!Number.isFinite(nextValue) || nextValue < 0 || nextValue > 180) {
            setError('Auto-archive must be between 0 and 180 minutes.');
            return;
        }

        setSavingArchive(true);
        try {
            const normalized = Math.floor(nextValue);
            const response = await fetch('/api/v1/merchant/core/settings/kds', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ready_auto_archive_minutes: normalized }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setError(payload?.error ?? 'Failed to save KDS auto-archive setting');
                return;
            }
            setArchiveMinutes(normalized);
            setArchiveInput(String(normalized));
            setError(null);
        } finally {
            setSavingArchive(false);
        }
    }, [archiveInput, canFinalizeHandoff]);

    const handleSaveAlertPolicy = useCallback(async () => {
        if (!canFinalizeHandoff) {
            setError('Only expeditor override roles can change KDS alert policy.');
            return;
        }
        setSavingAlerts(true);
        try {
            const response = await fetch('/api/v1/merchant/core/settings/kds', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alert_policy: alertPolicy }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setError(payload?.error ?? 'Failed to save KDS alert policy');
                return;
            }
            setAlertPolicy(normalizeAlertPolicy(payload?.data?.alert_policy));
            setError(null);
        } finally {
            setSavingAlerts(false);
        }
    }, [alertPolicy, canFinalizeHandoff]);

    const handleSavePrintPolicy = useCallback(async () => {
        if (!canFinalizeHandoff) {
            setError('Only expeditor override roles can change KDS printer policy.');
            return;
        }
        setSavingPrintPolicy(true);
        try {
            const response = await fetch('/api/v1/merchant/core/settings/kds', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ print_policy: printPolicy }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setError(payload?.error ?? 'Failed to save KDS printer policy');
                return;
            }
            setPrintPolicy(normalizePrintPolicy(payload?.data?.print_policy));
            setError(null);
        } finally {
            setSavingPrintPolicy(false);
        }
    }, [canFinalizeHandoff, printPolicy]);

    const fullyReadyOrders = useMemo(
        () =>
            consolidated.filter(
                order =>
                    order.readiness.total > 0 && order.readiness.ready === order.readiness.total
            ),
        [consolidated]
    );

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            const target = event.target as HTMLElement | null;
            const tag = target?.tagName?.toLowerCase();
            if (
                tag === 'input' ||
                tag === 'textarea' ||
                tag === 'select' ||
                target?.isContentEditable
            ) {
                return;
            }
            if (event.key.toLowerCase() !== 'b') return;
            const next = fullyReadyOrders[0];
            if (!next || !canFinalizeHandoff) return;
            event.preventDefault();
            void handleFinalHandoff(next.id);
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [canFinalizeHandoff, fullyReadyOrders, handleFinalHandoff]);

    if (isLoading || (!queryRestaurantId && !bypassForE2E && roleLoading)) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <p className="text-gray-500">Loading expeditor queue...</p>
            </div>
        );
    }

    return (
        <div className="font-manrope flex h-full min-h-0 flex-col bg-gray-50">
            <header className="flex items-center justify-between border-b border-gray-200 bg-white px-8 py-5">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Expeditor Handoff</h1>
                    <p className="text-sm text-gray-500">
                        Cross-station consolidation - {format(clock, 'EEE, MMM d HH:mm')}
                    </p>
                    <nav className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                        <Link
                            href="/kds"
                            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-700"
                        >
                            Kitchen
                        </Link>
                        <Link
                            href="/bar"
                            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-700"
                        >
                            Bar
                        </Link>
                        <Link
                            href="/dessert"
                            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-700"
                        >
                            Dessert
                        </Link>
                        <Link
                            href="/coffee"
                            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-700"
                        >
                            Coffee
                        </Link>
                        <span className="rounded-full bg-gray-900 px-2.5 py-1 text-white">
                            Expeditor
                        </span>
                    </nav>
                </div>
                <button
                    onClick={() => void fetchQueue()}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </button>
            </header>

            <div className="mx-8 mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-semibold text-gray-800">
                        Ready auto-archive (minutes):
                    </span>
                    <input
                        type="number"
                        min={0}
                        max={180}
                        step={1}
                        value={archiveInput}
                        onChange={event => setArchiveInput(event.target.value)}
                        className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-800"
                    />
                    <button
                        onClick={() => void handleSaveArchiveMinutes()}
                        disabled={savingArchive || !canFinalizeHandoff}
                        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        {savingArchive ? 'Saving...' : 'Save'}
                    </button>
                    <span className="text-xs text-gray-500">
                        Current policy: {archiveMinutes === 0 ? 'disabled' : `${archiveMinutes}m`}
                    </span>
                </div>
            </div>

            <div className="mx-8 mt-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-700">
                    <label className="inline-flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={alertPolicy.new_ticket_sound}
                            onChange={event =>
                                setAlertPolicy(current => ({
                                    ...current,
                                    new_ticket_sound: event.target.checked,
                                }))
                            }
                        />
                        New ticket sound
                    </label>
                    <label className="inline-flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={alertPolicy.sla_breach_visual}
                            onChange={event =>
                                setAlertPolicy(current => ({
                                    ...current,
                                    sla_breach_visual: event.target.checked,
                                }))
                            }
                        />
                        SLA breach visual
                    </label>
                    <label className="inline-flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={alertPolicy.recall_visual}
                            onChange={event =>
                                setAlertPolicy(current => ({
                                    ...current,
                                    recall_visual: event.target.checked,
                                }))
                            }
                        />
                        Recall visual
                    </label>
                    <label className="inline-flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={alertPolicy.quiet_hours_enabled}
                            onChange={event =>
                                setAlertPolicy(current => ({
                                    ...current,
                                    quiet_hours_enabled: event.target.checked,
                                }))
                            }
                        />
                        Quiet hours
                    </label>
                    <label className="inline-flex items-center gap-2 text-gray-600">
                        Start
                        <input
                            type="time"
                            value={alertPolicy.quiet_hours_start}
                            onChange={event =>
                                setAlertPolicy(current => ({
                                    ...current,
                                    quiet_hours_start: event.target.value,
                                }))
                            }
                            className="rounded border border-gray-300 px-2 py-1"
                        />
                    </label>
                    <label className="inline-flex items-center gap-2 text-gray-600">
                        End
                        <input
                            type="time"
                            value={alertPolicy.quiet_hours_end}
                            onChange={event =>
                                setAlertPolicy(current => ({
                                    ...current,
                                    quiet_hours_end: event.target.value,
                                }))
                            }
                            className="rounded border border-gray-300 px-2 py-1"
                        />
                    </label>
                    <button
                        onClick={() => void handleSaveAlertPolicy()}
                        disabled={savingAlerts || !canFinalizeHandoff}
                        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        {savingAlerts ? 'Saving alerts...' : 'Save alerts'}
                    </button>
                    <span className="text-xs text-gray-500">
                        Bump-bar hotkey: press `B` to handoff the next fully-ready ticket.
                    </span>
                </div>
            </div>

            <div className="mx-8 mt-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-700">
                    <span className="text-sm font-semibold text-gray-800">Printer fallback:</span>
                    <label className="inline-flex items-center gap-2 text-gray-600">
                        Mode
                        <select
                            value={printPolicy.mode}
                            onChange={event =>
                                setPrintPolicy(current => ({
                                    ...current,
                                    mode: event.target.value as PrintPolicy['mode'],
                                }))
                            }
                            className="rounded border border-gray-300 px-2 py-1"
                        >
                            <option value="off">Off</option>
                            <option value="fallback">Fallback</option>
                            <option value="always">Always</option>
                        </select>
                    </label>
                    <label className="inline-flex items-center gap-2 text-gray-600">
                        Provider
                        <select
                            value={printPolicy.provider}
                            onChange={event =>
                                setPrintPolicy(current => ({
                                    ...current,
                                    provider: event.target.value as PrintPolicy['provider'],
                                }))
                            }
                            className="rounded border border-gray-300 px-2 py-1"
                        >
                            <option value="log">Log</option>
                            <option value="webhook">Webhook</option>
                        </select>
                    </label>
                    <label className="inline-flex items-center gap-2 text-gray-600">
                        Copies
                        <input
                            type="number"
                            min={1}
                            max={5}
                            value={printPolicy.copies}
                            onChange={event =>
                                setPrintPolicy(current => ({
                                    ...current,
                                    copies: Math.max(
                                        1,
                                        Math.min(5, Number(event.target.value || 1))
                                    ),
                                }))
                            }
                            className="w-16 rounded border border-gray-300 px-2 py-1"
                        />
                    </label>
                    <label className="inline-flex items-center gap-2 text-gray-600">
                        Timeout ms
                        <input
                            type="number"
                            min={1000}
                            max={20000}
                            value={printPolicy.timeout_ms}
                            onChange={event =>
                                setPrintPolicy(current => ({
                                    ...current,
                                    timeout_ms: Math.max(
                                        1000,
                                        Math.min(20000, Number(event.target.value || 4000))
                                    ),
                                }))
                            }
                            className="w-24 rounded border border-gray-300 px-2 py-1"
                        />
                    </label>
                    <label className="inline-flex items-center gap-2 text-gray-600">
                        Attempts
                        <input
                            type="number"
                            min={1}
                            max={8}
                            value={printPolicy.max_attempts}
                            onChange={event =>
                                setPrintPolicy(current => ({
                                    ...current,
                                    max_attempts: Math.max(
                                        1,
                                        Math.min(8, Number(event.target.value || 4))
                                    ),
                                }))
                            }
                            className="w-16 rounded border border-gray-300 px-2 py-1"
                        />
                    </label>
                    <label className="inline-flex items-center gap-2 text-gray-600">
                        Backoff ms
                        <input
                            type="number"
                            min={100}
                            max={5000}
                            value={printPolicy.base_backoff_ms}
                            onChange={event =>
                                setPrintPolicy(current => ({
                                    ...current,
                                    base_backoff_ms: Math.max(
                                        100,
                                        Math.min(5000, Number(event.target.value || 400))
                                    ),
                                }))
                            }
                            className="w-20 rounded border border-gray-300 px-2 py-1"
                        />
                    </label>
                    {printPolicy.provider === 'webhook' ? (
                        <label className="inline-flex min-w-[320px] items-center gap-2 text-gray-600">
                            Webhook URL
                            <input
                                type="url"
                                value={printPolicy.webhook_url ?? ''}
                                onChange={event =>
                                    setPrintPolicy(current => ({
                                        ...current,
                                        webhook_url: event.target.value,
                                    }))
                                }
                                className="w-full rounded border border-gray-300 px-2 py-1"
                                placeholder="https://printer-bridge.example/print"
                            />
                        </label>
                    ) : null}
                    <button
                        onClick={() => void handleSavePrintPolicy()}
                        disabled={savingPrintPolicy || !canFinalizeHandoff}
                        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        {savingPrintPolicy ? 'Saving printer...' : 'Save printer policy'}
                    </button>
                </div>
            </div>

            {error ? (
                <div className="mx-8 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            ) : null}

            <main data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {consolidated.map(order => {
                        const allReady =
                            order.readiness.total > 0 &&
                            order.readiness.ready === order.readiness.total;
                        return (
                            <article
                                key={order.id}
                                className="rounded-xl border-l-4 border-gray-200 bg-white p-4 shadow-sm"
                                style={{ borderLeftColor: order.sourceColor || undefined }}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                                                Order #{order.orderNumber}
                                            </p>
                                            {order.sourceLabel && (
                                                <span
                                                    className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase"
                                                    style={{
                                                        backgroundColor:
                                                            order.sourceColor || '#6B7280',
                                                    }}
                                                >
                                                    {order.sourceLabel}
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-xl font-bold text-gray-900">
                                            {order.tableNumber
                                                ? `Table ${order.tableNumber}`
                                                : (order.customerName ?? 'Guest')}
                                        </h2>
                                    </div>
                                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                                        {order.elapsedMinutes}m
                                    </span>
                                </div>
                                {order.fireMode === 'manual' ? (
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                                            Active course:{' '}
                                            {courseLabel(order.currentCourse as CourseType | null)}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => void handleAdvanceCourse(order)}
                                            disabled={
                                                advancingCourseOrderId === order.id ||
                                                nextCourse(
                                                    order.currentCourse as CourseType | null
                                                ) === null
                                            }
                                            className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {advancingCourseOrderId === order.id
                                                ? 'Advancing...'
                                                : 'Advance Course'}
                                        </button>
                                    </div>
                                ) : null}

                                <div className="mt-3 rounded-xl bg-gray-50 p-3">
                                    <p className="text-sm font-semibold text-gray-800">
                                        Ready {order.readiness.ready}/{order.readiness.total}
                                    </p>
                                    <div className="mt-2 space-y-1">
                                        {Object.entries(order.readiness.byStation).map(
                                            ([station, stats]) => (
                                                <p key={station} className="text-xs text-gray-600">
                                                    {station}: {stats.ready}/{stats.total}
                                                </p>
                                            )
                                        )}
                                    </div>
                                </div>

                                {!allReady ? (
                                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                        <AlertTriangle className="h-4 w-4" />
                                        Waiting for remaining station items.
                                    </div>
                                ) : null}

                                <button
                                    disabled={
                                        !allReady ||
                                        handoffOrderId === order.id ||
                                        !canFinalizeHandoff
                                    }
                                    onClick={() => void handleFinalHandoff(order.id)}
                                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-300"
                                >
                                    {handoffOrderId === order.id ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                            Bumping...
                                        </>
                                    ) : (
                                        <>
                                            {allReady ? (
                                                <CheckCircle2 className="h-4 w-4" />
                                            ) : (
                                                <HandPlatter className="h-4 w-4" />
                                            )}
                                            Bump Ticket (Served)
                                        </>
                                    )}
                                </button>
                            </article>
                        );
                    })}
                </div>

                {consolidated.length === 0 ? (
                    <div className="mt-12 text-center text-gray-400">
                        <h2 className="text-2xl font-bold">No active tickets</h2>
                        <p className="text-sm">Orders will appear when stations begin prep.</p>
                    </div>
                ) : null}
            </main>
        </div>
    );
}

export default ExpeditorBoard;

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ChefHat,
    RefreshCw,
    Maximize2,
    AlertCircle,
    LayoutList,
    Grid3X3,
    List,
} from 'lucide-react';
import { format } from 'date-fns';
import { useRole } from '@/features/auth/hooks/useRole';
import type { UnifiedKDSOrder } from '@/app/api/kds/queue/route';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useKDSRealtime } from '@/features/kds/hooks/useKDSRealtime';
import { readKdsQueue, readKdsSettings } from '@/features/kds/lib/read-adapter';
import {
    getOfflineKdsQueueCount,
    getPendingKdsActions,
    clearSyncedKdsActions,
} from '@/features/kds/lib/syncAdapter';
import { submitKdsItemAction, usesLegacyKdsActionReplay } from '@/features/kds/lib/command-adapter';
import { submitOrderCourseFireUpdate } from '@/lib/orders/command-adapter';

type StationType = 'kitchen' | 'bar' | 'dessert' | 'coffee' | 'grill' | 'cold';
type ViewMode = 'grid' | 'list';
type KdsItemAction = 'start' | 'hold' | 'ready';
type CourseType = 'appetizer' | 'main' | 'dessert' | 'beverage' | 'side';
type AlertPolicy = {
    new_ticket_sound: boolean;
    sla_breach_visual: boolean;
    recall_visual: boolean;
    quiet_hours_enabled: boolean;
    quiet_hours_start: string;
    quiet_hours_end: string;
};
type PrintMode = 'off' | 'fallback' | 'always';
type PrintPolicy = {
    mode: PrintMode;
    provider: 'log' | 'webhook';
    webhook_url: string | null;
    copies: number;
    timeout_ms: number;
    max_attempts: number;
    base_backoff_ms: number;
};

type StationBoardProps = {
    station: StationType;
    title: string;
    accentClassName: string;
    restaurantIdOverride?: string | null;
    headerSlot?: React.ReactNode;
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

function allowedActions(status: string): KdsItemAction[] {
    switch (status) {
        case 'queued':
            return ['start', 'hold'];
        case 'in_progress':
            return ['ready', 'hold'];
        case 'on_hold':
            return ['start'];
        case 'ready':
            return [];
        case 'recalled':
            return ['start'];
        default:
            return [];
    }
}

function statusLabel(status: string) {
    if (status === 'in_progress') return 'In Progress';
    if (status === 'on_hold') return 'On Hold';
    if (status === 'recalled') return 'On Hold';
    return status.replace('_', ' ').replace(/\b\w/g, ch => ch.toUpperCase());
}

function actionLabel(action: KdsItemAction) {
    if (action === 'start') return 'Start';
    if (action === 'hold') return 'Hold';
    return 'Ready';
}

function getModifierStyle(modifier: string): string {
    const lower = modifier.toLowerCase();
    const exclusionPattern = /\b(no|without|hold|minus|remove|skip)\b/;
    const additionPattern = /\b(extra|add|with|plus|double)\b/;

    if (exclusionPattern.test(lower)) {
        return 'bg-red-50 text-red-700 ring-red-200';
    }
    if (additionPattern.test(lower)) {
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    }
    return 'bg-sky-50 text-sky-700 ring-sky-200';
}

function urgencyStyles(
    elapsedMinutes: number,
    slaMinutes = 30
): {
    card: string;
    header: string;
    timer: string;
} {
    const pct = elapsedMinutes / slaMinutes;
    if (pct >= 1) {
        // SLA breached — danger
        return {
            card: 'border-red-100 bg-red-50/30 ring-1 ring-red-50',
            header: 'border-red-100 bg-red-50/50',
            timer: 'font-black text-red-600',
        };
    }
    if (pct >= 0.75) {
        // At risk — warning
        return {
            card: 'border-amber-100 bg-amber-50/30 ring-1 ring-amber-50',
            header: 'border-amber-100 bg-amber-50/50',
            timer: 'font-bold text-amber-600',
        };
    }
    // On track — clean
    return {
        card: 'border-gray-100 bg-white',
        header: 'border-gray-100 bg-[#F7F5F2]',
        timer: 'font-bold text-gray-500',
    };
}

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

function parseTimeToMinutes(value: string): number | null {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
}

function isQuietHours(policy: AlertPolicy, now = new Date()): boolean {
    if (!policy.quiet_hours_enabled) return false;
    const start = parseTimeToMinutes(policy.quiet_hours_start);
    const end = parseTimeToMinutes(policy.quiet_hours_end);
    if (start === null || end === null) return false;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    if (start === end) return true;
    if (start < end) {
        return currentMinutes >= start && currentMinutes < end;
    }
    return currentMinutes >= start || currentMinutes < end;
}

function playAlertTone() {
    if (typeof window === 'undefined') return;
    const Context =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;

    const audio = new Context();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.05;

    oscillator.connect(gain);
    gain.connect(audio.destination);

    const now = audio.currentTime;
    oscillator.start(now);
    oscillator.stop(now + 0.12);
    oscillator.onended = () => {
        void audio.close().catch(() => undefined);
    };
}

export function StationBoard({
    station,
    title,
    accentClassName,
    restaurantIdOverride,
    headerSlot,
}: StationBoardProps) {
    const searchParams = useSearchParams();
    const queryRestaurantId = searchParams.get('restaurantId');
    const { restaurantId: roleRestaurantId, loading: roleLoading } = useRole(queryRestaurantId);
    const restaurantId = restaurantIdOverride || queryRestaurantId || roleRestaurantId;
    const previousOrderIdsRef = useRef<string[]>([]);
    // alertPolicyRef mirrors alertPolicy state so fetchQueue can read it
    // without needing alertPolicy as a useCallback dependency (which caused
    // fetchKdsSettings → setAlertPolicy → fetchQueue recreated → useEffect
    // re-fired with background=false → isLoading(true) → flicker).
    const alertPolicyRef = useRef<AlertPolicy>(DEFAULT_ALERT_POLICY);
    const [alertPolicy, setAlertPolicy] = useState<AlertPolicy>(DEFAULT_ALERT_POLICY);
    const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
    const [showPrepSummary, setShowPrepSummary] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [slaMinutes] = useState(30);
    // Tracks whether we have ever successfully completed a fetch.
    // Loading screen is only shown before the first successful load.
    const hasEverLoadedRef = useRef(false);

    const [orders, setOrders] = useState<UnifiedKDSOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [actionKey, setActionKey] = useState<string | null>(null);
    const [advancingCourseOrderId, setAdvancingCourseOrderId] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(true);
    const [queuedActionCount, setQueuedActionCount] = useState(0);
    const [syncingOfflineActions, setSyncingOfflineActions] = useState(false);
    const [printPolicy, setPrintPolicy] = useState<PrintPolicy>(DEFAULT_PRINT_POLICY);
    const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
    const [clock, setClock] = useState(new Date());
    const { isConnected: realtimeConnected } = useKDSRealtime({
        restaurantId: restaurantId ?? '',
        enabled: Boolean(restaurantId),
    });

    useEffect(() => {
        const timer = setInterval(() => setClock(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (typeof navigator !== 'undefined') {
            setIsOnline(navigator.onLine);
        }
        // Use new adapter for queue count
        getOfflineKdsQueueCount().then(count => setQueuedActionCount(count));

        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);

    const fetchQueue = useCallback(
        async (background = false) => {
            if (!restaurantId) {
                setOrders([]);
                setIsLoading(false);
                return;
            }

            // Only show the full-screen loader on the very first fetch.
            // Subsequent calls (background polls, realtime re-syncs) never
            // set isLoading=true so the KDS board never disappears.
            if (!background && !hasEverLoadedRef.current) {
                setIsLoading(true);
            } else {
                setIsRefreshing(true);
            }

            try {
                const result = await readKdsQueue({
                    station,
                    limit: 100,
                    slaMinutes: 30,
                });

                if (!result.ok || !result.data) {
                    setError(result.error ?? 'Failed to fetch KDS queue');
                    return;
                }

                const nextOrders = (result.data.orders ?? []) as UnifiedKDSOrder[];
                // Read alertPolicy from ref — avoids adding it to deps which
                // would cause fetchQueue to recreate on every settings refresh.
                const policy = alertPolicyRef.current;
                if (background) {
                    const previousIds = new Set(previousOrderIdsRef.current);
                    const hasNewTicket = nextOrders.some(order => !previousIds.has(order.id));
                    if (hasNewTicket && policy.new_ticket_sound && !isQuietHours(policy)) {
                        playAlertTone();
                    }
                }
                previousOrderIdsRef.current = nextOrders.map(order => order.id);
                setOrders(nextOrders);
                setError(null);
                hasEverLoadedRef.current = true;
            } catch {
                setError('Failed to fetch KDS queue');
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        },
        // alertPolicy intentionally omitted — read via alertPolicyRef instead.

        [restaurantId, station]
    );

    const fetchKdsSettings = useCallback(async () => {
        if (!restaurantId) return;
        try {
            const result = await readKdsSettings();
            if (!result.ok || !result.data) {
                return;
            }
            const normalized = normalizeAlertPolicy(result.data.alert_policy);
            const normalizedPrint = normalizePrintPolicy(result.data.print_policy);
            // Keep ref in sync so fetchQueue always sees the latest policy.
            alertPolicyRef.current = normalized;
            setAlertPolicy(normalized);
            setPrintPolicy(normalizedPrint);
        } catch {
            // Keep defaults if settings fail to load.
        }
    }, [restaurantId]);

    useEffect(() => {
        if (!roleLoading) {
            void fetchQueue();
            void fetchKdsSettings();
        }
    }, [fetchKdsSettings, fetchQueue, roleLoading]);

    useEffect(() => {
        const interval = setInterval(() => {
            void fetchQueue(true);
        }, 15000);
        return () => clearInterval(interval);
    }, [fetchQueue]);

    useEffect(() => {
        const interval = setInterval(() => {
            void fetchKdsSettings();
        }, 60_000);
        return () => clearInterval(interval);
    }, [fetchKdsSettings]);

    const stationOrders = useMemo(() => {
        return orders.map(order => ({
            ...order,
            stationItems: (order.items ?? []).filter(
                item => (item.station ?? 'kitchen') === station
            ),
        }));
    }, [orders, station]);

    const actionableItems = useMemo(() => {
        return stationOrders.flatMap(order =>
            order.stationItems
                .map(item => ({
                    orderId: order.id,
                    itemId: item.id,
                    kdsItemId: item.kds_item_id,
                    status: item.status ?? 'queued',
                    name: item.name,
                }))
                .filter(item => allowedActions(item.status).length > 0)
        );
    }, [stationOrders]);

    const applyOptimisticItemStatus = useCallback(
        (orderId: string, itemId: string, action: KdsItemAction) => {
            const nextStatus =
                action === 'start' ? 'in_progress' : action === 'hold' ? 'on_hold' : 'ready';
            setOrders(current =>
                current.map(order => {
                    if (order.id !== orderId) return order;
                    return {
                        ...order,
                        items: (order.items ?? []).map(item =>
                            item.id === itemId ? { ...item, status: nextStatus } : item
                        ),
                    };
                })
            );
        },
        []
    );

    const handlePrintTicket = useCallback(
        async (orderId: string, reason: string) => {
            if (printPolicy.mode === 'off') return;
            setPrintingOrderId(orderId);
            try {
                const response = await fetch(
                    `/api/v1/merchant/operations/kds/orders/${orderId}/print`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reason }),
                    }
                );
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    setError(payload?.error ?? 'Failed to dispatch printer fallback');
                    return;
                }
                setError(null);
            } finally {
                setPrintingOrderId(null);
            }
        },
        [printPolicy.mode]
    );

    const syncOfflineActions = useCallback(async () => {
        if (!isOnline || syncingOfflineActions) return;
        if (!usesLegacyKdsActionReplay()) {
            setQueuedActionCount(0);
            return;
        }

        const pendingActions = await getPendingKdsActions();
        if (pendingActions.length === 0) {
            setQueuedActionCount(0);
            return;
        }

        setSyncingOfflineActions(true);
        try {
            await clearSyncedKdsActions();
            setQueuedActionCount(await getOfflineKdsQueueCount());
            await fetchQueue(true);
        } finally {
            setSyncingOfflineActions(false);
        }
    }, [fetchQueue, isOnline, syncingOfflineActions]);

    useEffect(() => {
        if (!isOnline) return;
        if (queuedActionCount === 0) return;
        void syncOfflineActions();
    }, [isOnline, queuedActionCount, syncOfflineActions]);

    useEffect(() => {
        if (!isOnline) return;
        const timer = setInterval(() => {
            void syncOfflineActions();
        }, 20_000);
        return () => clearInterval(timer);
    }, [isOnline, syncOfflineActions]);

    const handleItemAction = useCallback(
        async (
            orderId: string,
            itemId: string,
            kdsItemId: string | undefined,
            action: KdsItemAction
        ) => {
            const key = `${orderId}:${itemId}:${action}`;
            setActionKey(key);

            try {
                if (!kdsItemId) {
                    setError('Item sync pending. Refresh in a moment and retry.');
                    return;
                }

                const result = await submitKdsItemAction({
                    orderId,
                    itemId,
                    kdsItemId,
                    action,
                    isOnline,
                });

                if (!result.ok) {
                    setError(result.error ?? 'Failed to update item');
                    return;
                }

                applyOptimisticItemStatus(orderId, itemId, action);
                const count = await getOfflineKdsQueueCount();
                setQueuedActionCount(count);
                setError(null);

                if (printPolicy.mode === 'always') {
                    await handlePrintTicket(orderId, 'kds_action_print_mode_always');
                }
            } finally {
                setActionKey(null);
            }
        },
        [applyOptimisticItemStatus, fetchQueue, handlePrintTicket, isOnline, printPolicy.mode]
    );

    const handleAdvanceCourse = useCallback(
        async (order: UnifiedKDSOrder) => {
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
        },
        [fetchQueue]
    );

    useEffect(() => {
        if (actionableItems.length === 0) {
            setSelectedItemKey(null);
            return;
        }
        if (
            selectedItemKey &&
            actionableItems.some(item => `${item.orderId}:${item.itemId}` === selectedItemKey)
        ) {
            return;
        }
        setSelectedItemKey(`${actionableItems[0].orderId}:${actionableItems[0].itemId}`);
    }, [actionableItems, selectedItemKey]);

    const selectedActionableItem = useMemo(() => {
        if (!selectedItemKey) return null;
        return (
            actionableItems.find(item => `${item.orderId}:${item.itemId}` === selectedItemKey) ??
            null
        );
    }, [actionableItems, selectedItemKey]);

    const runSelectedItemAction = useCallback(
        (preferredAction?: KdsItemAction) => {
            if (!selectedActionableItem) return;
            const actions = allowedActions(selectedActionableItem.status);
            const actionToRun =
                preferredAction && actions.includes(preferredAction) ? preferredAction : actions[0];
            if (!actionToRun) return;
            void handleItemAction(
                selectedActionableItem.orderId,
                selectedActionableItem.itemId,
                selectedActionableItem.kdsItemId,
                actionToRun
            );
        },
        [handleItemAction, selectedActionableItem]
    );

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
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

            if (event.key >= '1' && event.key <= '9') {
                const index = Number(event.key) - 1;
                const item = actionableItems[index];
                if (item) {
                    setSelectedItemKey(`${item.orderId}:${item.itemId}`);
                    event.preventDefault();
                }
                return;
            }

            if (event.key === 'ArrowDown' || event.key.toLowerCase() === 'j') {
                if (actionableItems.length === 0) return;
                const currentIndex = actionableItems.findIndex(
                    item => `${item.orderId}:${item.itemId}` === selectedItemKey
                );
                const nextIndex =
                    currentIndex < 0 ? 0 : Math.min(actionableItems.length - 1, currentIndex + 1);
                const next = actionableItems[nextIndex];
                if (next) {
                    setSelectedItemKey(`${next.orderId}:${next.itemId}`);
                    event.preventDefault();
                }
                return;
            }

            if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'k') {
                if (actionableItems.length === 0) return;
                const currentIndex = actionableItems.findIndex(
                    item => `${item.orderId}:${item.itemId}` === selectedItemKey
                );
                const nextIndex = currentIndex < 0 ? 0 : Math.max(0, currentIndex - 1);
                const next = actionableItems[nextIndex];
                if (next) {
                    setSelectedItemKey(`${next.orderId}:${next.itemId}`);
                    event.preventDefault();
                }
                return;
            }

            if (event.key === 'Enter') {
                runSelectedItemAction();
                event.preventDefault();
                return;
            }

            const key = event.key.toLowerCase();
            if (key === 's') {
                runSelectedItemAction('start');
                event.preventDefault();
                return;
            }
            if (key === 'h') {
                runSelectedItemAction('hold');
                event.preventDefault();
                return;
            }
            if (key === 'r') {
                runSelectedItemAction('ready');
                event.preventDefault();
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [actionableItems, runSelectedItemAction, selectedItemKey]);

    const breachedCount = useMemo(
        () => stationOrders.filter(order => order.slaStatus === 'breached').length,
        [stationOrders]
    );

    // ── Prep density summary: aggregate uncompleted item counts ──────────────
    const prepSummary = useMemo(() => {
        const counts = new Map<string, number>();
        for (const order of stationOrders) {
            for (const item of order.stationItems) {
                if (item.status === 'ready') continue; // skip completed
                const key = item.name;
                counts.set(key, (counts.get(key) ?? 0) + item.quantity);
            }
        }
        return Array.from(counts.entries())
            .map(([name, qty]) => ({ name, qty }))
            .sort((a, b) => b.qty - a.qty);
    }, [stationOrders]);

    useEffect(() => {
        if (!restaurantId) return;
        const sendHeartbeat = async () => {
            const payload = {
                station,
                realtime_connected: realtimeConnected,
                queue_size: stationOrders.length,
                breached_tickets: breachedCount,
            };
            try {
                await fetch(
                    `/api/v1/merchant/operations/kds/telemetry?restaurant_id=${restaurantId}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    }
                );
            } catch {
                // Telemetry failure should not impact KDS workflow.
            }
        };

        void sendHeartbeat();
        const interval = setInterval(() => {
            void sendHeartbeat();
        }, 30_000);
        return () => clearInterval(interval);
    }, [breachedCount, realtimeConnected, restaurantId, station, stationOrders.length]);

    const toggleFullScreen = useCallback(() => {
        if (!document.fullscreenElement) {
            void document.documentElement.requestFullscreen();
            return;
        }
        void document.exitFullscreen();
    }, []);

    if (isLoading || roleLoading) {
        return (
            <div className="bg-brand-canvas flex h-screen items-center justify-center">
                <div className="text-brand-neutral text-center font-bold tracking-tight">
                    <h1 className="sr-only">Loading {title} queue</h1>
                    Loading {title} queue...
                </div>
            </div>
        );
    }

    return (
        <div className="font-inter flex h-screen flex-col overflow-hidden bg-[#F7F5F2] tracking-[-0.04em] text-[#1A1C1E]">
            {/* KDS Header */}
            <div className="flex items-start justify-between border-b border-gray-100 bg-white px-10 py-10">
                <div>
                    <div className="mb-2 flex items-center gap-3">
                        <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#DDF853]" />
                        <p className="text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase">
                            Live Operations
                        </p>
                    </div>
                    <h1 className="flex items-center gap-4 text-4xl font-bold text-[#1A1C1E]">
                        {title}
                        <span className="rounded-xl bg-[#1A1C1E] px-4 py-1 text-lg font-black text-[#DDF853]">
                            {stationOrders.length}
                        </span>
                    </h1>

                    <div className="mt-6 flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div
                                className={`h-1.5 w-1.5 rounded-full ${realtimeConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            />
                            <span className="text-[11px] font-black tracking-widest text-gray-400 uppercase">
                                {realtimeConnected ? 'Realtime Connected' : 'Syncing...'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div
                                className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`}
                            />
                            <span className="text-[11px] font-black tracking-widest text-gray-400 uppercase">
                                {isOnline ? 'Network Online' : 'Offline Mode'}
                            </span>
                        </div>
                        <div className="h-4 w-px bg-gray-100" />
                        <span className="text-[11px] font-black tracking-widest text-gray-400 uppercase">
                            {format(clock, 'HH:mm:ss')}
                        </span>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => setShowPrepSummary(v => !v)}
                        className={`flex h-16 items-center gap-3 rounded-2xl border px-6 font-bold transition-all ${
                            showPrepSummary
                                ? 'border-[#1A1C1E] bg-[#1A1C1E] text-white'
                                : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                        }`}
                    >
                        <LayoutList className="h-5 w-5" />
                        Prep List
                    </button>
                    <button
                        onClick={() => setViewMode(v => (v === 'grid' ? 'list' : 'grid'))}
                        className="flex h-16 items-center gap-3 rounded-2xl border border-gray-100 bg-white px-6 font-bold text-gray-600 transition-all hover:border-gray-200"
                    >
                        {viewMode === 'grid' ? (
                            <List className="h-5 w-5" />
                        ) : (
                            <Grid3X3 className="h-5 w-5" />
                        )}
                        {viewMode === 'grid' ? 'List View' : 'Grid View'}
                    </button>
                    <button
                        onClick={() => void fetchQueue(true)}
                        className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-white text-gray-600 transition-all hover:border-gray-200"
                    >
                        <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={toggleFullScreen}
                        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#DDF853] text-[#1A1C1E] transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Maximize2 className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {headerSlot && <div className="mt-6 px-10">{headerSlot}</div>}

            <main className="flex flex-1 flex-col gap-8 overflow-hidden p-10">
                {/* ── Prep Summary ──────────────────────────────────── */}
                {showPrepSummary && (
                    <div className="animate-in slide-in-from-top-4 rounded-[2rem] border border-gray-100 bg-white p-10 duration-300">
                        <div className="mb-8 flex items-center justify-between">
                            <h2 className="text-xl font-bold">Preparation Density.</h2>
                            <p className="text-sm font-black tracking-widest text-gray-400 uppercase">
                                {prepSummary.reduce((s, i) => s + i.qty, 0)} Items Total
                            </p>
                        </div>
                        {prepSummary.length === 0 ? (
                            <p className="font-medium text-gray-400">All items processed.</p>
                        ) : (
                            <div className="flex flex-wrap gap-4">
                                {prepSummary.map(({ name, qty }) => (
                                    <div
                                        key={name}
                                        className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-[#F7F5F2] px-6 py-4"
                                    >
                                        <span className="font-bold">{name}</span>
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1C1E] text-xs font-black text-[#DDF853]">
                                            {qty}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 font-bold text-red-600">
                        <AlertCircle className="h-5 w-5" />
                        {error}
                    </div>
                )}

                {/* Tickets Area */}
                <div
                    className={`no-scrollbar grid flex-1 gap-8 overflow-y-auto pr-2 ${
                        viewMode === 'grid'
                            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                            : 'grid-cols-1'
                    }`}
                >
                    {stationOrders.map(order => {
                        const urgency = urgencyStyles(order.elapsedMinutes, slaMinutes);
                        return (
                            <div
                                key={order.id}
                                className={`flex flex-col overflow-hidden rounded-[2.5rem] border transition-all duration-300 ${urgency.card}`}
                            >
                                <div className={`border-b p-8 ${urgency.header}`}>
                                    <div className="mb-4 flex items-center justify-between">
                                        <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase">
                                            #{order.orderNumber} · {order.elapsedMinutes}m
                                        </span>
                                        {order.sourceLabel && (
                                            <span
                                                className="rounded-lg px-3 py-1 text-[10px] font-black tracking-widest text-white uppercase"
                                                style={{
                                                    backgroundColor: order.sourceColor || '#1A1C1E',
                                                }}
                                            >
                                                {order.sourceLabel}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="mb-1 text-3xl font-bold">
                                        {order.tableNumber
                                            ? `Table ${order.tableNumber}`
                                            : (order.customerName ?? 'Guest')}
                                    </h3>
                                    <p
                                        className={`text-xs ${urgency.timer} font-black tracking-widest uppercase`}
                                    >
                                        {statusLabel(order.status)}
                                    </p>
                                </div>

                                <div className="min-h-[300px] flex-1 space-y-6 overflow-y-auto p-8">
                                    {order.stationItems.map(item => {
                                        const itemKey = `${order.id}:${item.id}`;
                                        const isSelected = selectedItemKey === itemKey;
                                        const isRecalled =
                                            alertPolicy.recall_visual &&
                                            (item.status ?? 'queued') === 'recalled';

                                        return (
                                            <div
                                                key={itemKey}
                                                className={`rounded-3xl border p-6 transition-all ${
                                                    isSelected
                                                        ? 'border-[#1A1C1E] bg-[#1A1C1E] text-white'
                                                        : 'border-gray-50 bg-white'
                                                } ${isRecalled ? 'animate-pulse border-red-500' : ''}`}
                                            >
                                                <div className="mb-4 flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3">
                                                            <span
                                                                className={`text-2xl font-black ${isSelected ? 'text-[#DDF853]' : 'text-[#1A1C1E]'}`}
                                                            >
                                                                {item.quantity}×
                                                            </span>
                                                            <h4 className="text-xl leading-tight font-bold">
                                                                {item.name}
                                                            </h4>
                                                        </div>
                                                        {item.notes && (
                                                            <p
                                                                className={`mt-2 text-sm font-medium ${isSelected ? 'text-gray-400' : 'text-gray-500'}`}
                                                            >
                                                                "{item.notes}"
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mb-6 flex flex-wrap gap-2">
                                                    {item.modifiers?.map((mod, idx) => (
                                                        <span
                                                            key={idx}
                                                            className={`rounded-lg px-3 py-1 text-[10px] font-black tracking-widest uppercase ${
                                                                isSelected
                                                                    ? 'bg-white/10 text-white'
                                                                    : 'bg-[#F7F5F2] text-gray-400'
                                                            }`}
                                                        >
                                                            {mod}
                                                        </span>
                                                    ))}
                                                </div>

                                                <div className="flex gap-2">
                                                    {allowedActions(item.status ?? 'queued').map(
                                                        action => {
                                                            const key = `${order.id}:${item.id}:${action}`;
                                                            const disabled = actionKey === key;
                                                            return (
                                                                <button
                                                                    key={action}
                                                                    onClick={() =>
                                                                        void handleItemAction(
                                                                            order.id,
                                                                            item.id,
                                                                            item.kds_item_id,
                                                                            action
                                                                        )
                                                                    }
                                                                    disabled={disabled}
                                                                    className={`h-12 flex-1 rounded-xl text-sm font-black tracking-widest uppercase transition-all ${
                                                                        isSelected
                                                                            ? 'bg-[#DDF853] text-[#1A1C1E]'
                                                                            : 'bg-[#1A1C1E] text-white'
                                                                    } active:scale-95 disabled:opacity-50`}
                                                                >
                                                                    {disabled
                                                                        ? '...'
                                                                        : actionLabel(action)}
                                                                </button>
                                                            );
                                                        }
                                                    )}
                                                    {allowedActions(item.status ?? 'queued')
                                                        .length === 0 && (
                                                        <div className="flex h-12 flex-1 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-sm font-black tracking-widest text-emerald-600 uppercase">
                                                            Ready
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {order.stationItems.length === 0 && (
                                        <div className="flex h-full flex-col items-center justify-center text-center text-gray-300 opacity-50">
                                            <ChefHat className="mb-4 h-10 w-10" />
                                            <p className="text-sm font-bold">No Items.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {stationOrders.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-40">
                            <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl border border-gray-100 bg-white text-gray-200">
                                <ChefHat className="h-12 w-12" />
                            </div>
                            <h2 className="text-3xl font-bold text-[#1A1C1E]">Station Clear.</h2>
                            <p className="mt-2 font-medium text-gray-400">
                                Incoming orders will appear here in realtime.
                            </p>
                        </div>
                    )}
                </div>
            </main>

            {/* Quick Actions Bar */}
            {selectedActionableItem && (
                <div className="animate-in slide-in-from-bottom-4 border-t border-gray-100 bg-white px-10 py-8 duration-300">
                    <div className="mx-auto flex max-w-4xl items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F7F5F2] text-[#1A1C1E]">
                                <ChefHat className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">
                                    Currently Selected
                                </p>
                                <h4 className="text-lg font-bold text-[#1A1C1E]">
                                    {selectedActionableItem.name}
                                </h4>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            {allowedActions(selectedActionableItem.status).map(action => (
                                <button
                                    key={`quick-${action}`}
                                    onClick={() => runSelectedItemAction(action)}
                                    className="h-16 rounded-2xl bg-[#DDF853] px-10 text-sm font-black tracking-widest text-[#1A1C1E] uppercase transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {actionLabel(action)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default StationBoard;

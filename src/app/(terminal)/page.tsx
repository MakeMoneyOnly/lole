'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertCircle,
    Banknote,
    CreditCard,
    Receipt,
    RefreshCw,
    UserX,
    Store,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ManagedDeviceBanner } from '@/components/device/shell/ManagedDeviceBanner';
import { useManagedDeviceSession } from '@/features/merchant/hooks/useManagedDeviceSession';
import type { SupportedPaymentMethod } from '@/lib/devices/config';
import { getDeviceTypeLabel } from '@/lib/devices/config';
import { formatCurrencyCompact } from '@/lib/utils/monetary';
import {
    buildReceiptFromPaymentPayload,
    handleApprovedTransactionReceipt,
} from '@/lib/printer/transaction-print';
import {
    captureTerminalPayment,
    createTerminalEvenSplit,
    readTerminalOrderSplit,
    readTerminalOverview,
} from '@/lib/terminal/read-adapter';
import { submitTerminalSettlement } from '@/lib/terminal/settlement-adapter';

type TerminalTable = {
    id: string;
    table_number: string;
    status: string;
    updated_at: string | null;
    outstanding_total: number;
    active_order_count: number;
};

type TerminalOrder = {
    id: string;
    table_number: string | null;
    order_number: string | null;
    status: string;
    total_price: number;
    created_at: string | null;
};

type TerminalPaymentOption = {
    method: SupportedPaymentMethod;
    label: string;
    description: string;
};

type SettlementSplit = {
    id: string;
    split_index: number;
    split_label?: string | null;
    computed_amount: number;
    requested_amount?: number | null;
};

type SettlementPayment = {
    id: string;
    split_id?: string | null;
    amount: number;
    status: string;
    method: string;
    truth_state: string;
    truth_label: string;
    truth_tone: string;
    provider_reference?: string | null;
    transaction_number: string;
};

type SplitPayload = {
    order: { id: string; total_price: number; status: string };
    splits: SettlementSplit[];
    split_payments: SettlementPayment[];
};

type TerminalOverview = {
    device: {
        id: string;
        name: string;
        device_type: string;
        assigned_zones: string[];
        metadata?: {
            station_name?: string;
            settlement_mode?: string;
            receipt_mode?: string;
        } | null;
    };
    payment_options: TerminalPaymentOption[];
    tables: TerminalTable[];
    orders: TerminalOrder[];
    recent_payments: Array<{
        id: string;
        order_number: string | null;
        table_number: string | null;
        label: string;
        amount: number;
        method: string;
        truth_state: string;
        truth_label: string;
        truth_tone: string;
        created_at: string;
    }>;
};

const METHOD_ICONS: Record<SupportedPaymentMethod, React.ReactNode> = {
    cash: <Banknote className="h-4 w-4" />,
    chapa: <CreditCard className="h-4 w-4" />,
    card: <CreditCard className="h-4 w-4" />,
    other: <Receipt className="h-4 w-4" />,
};

export default function TerminalPage(): React.JSX.Element {
    const managedDevice = useManagedDeviceSession({
        route: '/terminal',
        expectedProfiles: ['cashier'],
        requirePaired: true,
    });
    const deviceToken = managedDevice.deviceToken;
    const deviceInfo = managedDevice.session;
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState<TerminalOverview | null>(null);
    const [selectedTableNumber, setSelectedTableNumber] = useState<string | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [splitPayload, setSplitPayload] = useState<SplitPayload | null>(null);
    const [splitGuestCount, setSplitGuestCount] = useState(2);
    const [paymentMethod, setPaymentMethod] = useState<SupportedPaymentMethod>('cash');
    const [orderAmountInput, setOrderAmountInput] = useState('');
    const [providerReference, setProviderReference] = useState('');
    const [capturingId, setCapturingId] = useState<string | null>(null);

    const loadOverview = useCallback(async () => {
        if (!deviceToken) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
const deviceName = deviceInfo?.name ?? 'Terminal';
                                                             const deviceType = deviceInfo?.device_type ?? 'terminal';
                                                             const metadata = (deviceInfo?.metadata as TerminalOverview['device']['metadata']) ?? null;
            const result = await readTerminalOverview({
                device: {
                    id: deviceInfo?.device_token ?? 'paired-terminal',
                    name: deviceName,
                    device_type: deviceType,
                    assigned_zones: [],
                    metadata,
                },
                deviceToken,
            });
            if (!result.ok || !result.data) {
                throw new Error(result.error ?? 'Failed to load terminal workspace');
            }
            setOverview(result.data as TerminalOverview);
            const firstTable = (result.data as TerminalOverview).tables[0];
            setSelectedTableNumber(current => current ?? firstTable?.table_number ?? null);
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : 'Failed to load terminal workspace'
            );
        } finally {
            setLoading(false);
        }
    }, [deviceToken, deviceInfo?.device_token, deviceInfo?.name, deviceInfo?.device_type, deviceInfo?.metadata]);

    useEffect(() => {
        void loadOverview();
        const interval = window.setInterval(() => {
            void loadOverview();
        }, 30_000);

        return () => window.clearInterval(interval);
    }, [loadOverview]);

    const loadSplitPayload = useCallback(
        async (orderId: string) => {
            if (!deviceToken) return;

            try {
                const result = await readTerminalOrderSplit(orderId, deviceToken);
                if (!result.ok || !result.data) {
                    throw new Error(result.error ?? 'Failed to load split settlement');
                }
                const splitData = result.data as SplitPayload;
                setSplitPayload(splitData);
                if ((splitData.splits?.length ?? 0) >= 2) {
                    setSplitGuestCount(Math.max(2, Math.min(12, splitData.splits.length)));
                }
            } catch (error) {
                toast.error(
                    error instanceof Error ? error.message : 'Failed to load split settlement'
                );
            }
        },
        [deviceToken]
    );

    const selectedTable = useMemo(
        () => overview?.tables.find(table => table.table_number === selectedTableNumber) ?? null,
        [overview?.tables, selectedTableNumber]
    );

    const tableOrders = useMemo(
        () =>
            (overview?.orders ?? []).filter(
                order => String(order.table_number ?? '') === String(selectedTableNumber ?? '')
            ),
        [overview?.orders, selectedTableNumber]
    );

    useEffect(() => {
        const nextOrderId = tableOrders[0]?.id ?? null;
        setSelectedOrderId(current =>
            current && tableOrders.some(order => order.id === current) ? current : nextOrderId
        );
    }, [tableOrders]);

    useEffect(() => {
        if (!selectedOrderId) {
            setSplitPayload(null);
            return;
        }

        void loadSplitPayload(selectedOrderId);
    }, [loadSplitPayload, selectedOrderId]);

    const selectedOrder = useMemo(
        () => tableOrders.find(order => order.id === selectedOrderId) ?? null,
        [tableOrders, selectedOrderId]
    );

    const selectedPaymentOption = useMemo(
        () =>
            (overview?.payment_options ?? []).find(option => option.method === paymentMethod) ??
            null,
        [overview?.payment_options, paymentMethod]
    );

    const splitPaidById = useMemo(() => {
        const totals = new Map<string, number>();
        for (const payment of splitPayload?.split_payments ?? []) {
            if (!payment.split_id) continue;
            if (
                !['local_capture', 'pending_verification', 'verified'].includes(payment.truth_state)
            ) {
                continue;
            }
            totals.set(
                payment.split_id,
                Number(
                    ((totals.get(payment.split_id) ?? 0) + Number(payment.amount ?? 0)).toFixed(2)
                )
            );
        }
        return totals;
    }, [splitPayload?.split_payments]);

    const fullOrderRemaining = useMemo(() => {
        if (!selectedTable) return 0;
        return Number(selectedTable.outstanding_total ?? 0);
    }, [selectedTable]);

    const _splitPaymentsById = useMemo(() => {
        const grouped = new Map<string, SettlementPayment[]>();
        for (const payment of splitPayload?.split_payments ?? []) {
            if (!payment.split_id) continue;
            const existing = grouped.get(payment.split_id) ?? [];
            existing.push(payment);
            grouped.set(payment.split_id, existing);
        }
        return grouped;
    }, [splitPayload?.split_payments]);

    useEffect(() => {
        setOrderAmountInput(fullOrderRemaining > 0 ? String(fullOrderRemaining.toFixed(2)) : '');
    }, [fullOrderRemaining, selectedOrderId]);

    useEffect(() => {
        const preferredMethod =
            overview?.payment_options.find(option => option.method === 'cash')?.method ??
            overview?.payment_options[0]?.method;
        if (preferredMethod) {
            setPaymentMethod(preferredMethod);
        }
    }, [overview?.payment_options]);

    const createEvenSplit = async (): Promise<void> => {
        if (!deviceToken || !selectedOrderId || !selectedOrder) return;

        try {
            setCapturingId('split-setup');
            const result = await createTerminalEvenSplit({
                orderId: selectedOrderId,
                guestCount: splitGuestCount,
                deviceToken,
            });
            if (!result.ok) {
                throw new Error(result.error ?? 'Failed to create even split');
            }
            toast.success(`Split ${selectedOrder.order_number ?? 'order'} into ${splitGuestCount}`);
            await loadSplitPayload(selectedOrderId);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create split');
        } finally {
            setCapturingId(null);
        }
    };

    const capturePayment = async (args: {
        orderId?: string;
        splitId?: string;
        amount: number;
        label: string;
    }): Promise<void> => {
        if (!deviceToken) return;

        try {
            setCapturingId(args.splitId ?? args.orderId ?? 'payment');
            const result = await captureTerminalPayment({
                orderId: args.orderId,
                splitId: args.splitId,
                amount: Number(args.amount.toFixed(2)),
                method: paymentMethod,
                label: args.label,
                providerReference: providerReference.trim() || undefined,
                restaurantId: deviceInfo?.restaurant_id ?? 'local-restaurant',
                terminalName: overview?.device.name ?? null,
                deviceToken,
            });
            if (!result.ok || !result.data) {
                throw new Error(result.error ?? 'Failed to record payment');
            }

            const shouldAutoPrint = overview?.device.metadata?.receipt_mode === 'auto';
            if (shouldAutoPrint) {
                const receipt = buildReceiptFromPaymentPayload({
                    restaurantName: deviceInfo?.name ?? overview?.device.name ?? 'lole',
                    restaurantTin: null,
                    transactionNumber:
                        result.data.transaction_number ??
                        providerReference.trim() ??
                        crypto.randomUUID().slice(0, 8).toUpperCase(),
                    orderNumber: selectedOrder?.order_number ?? args.label,
                    paymentLabel: selectedPaymentOption?.label ?? paymentMethod,
                    subtotal: args.amount,
                    total: args.amount,
                    items: [
                        {
                            name: args.label,
                            quantity: 1,
                            unit_price: args.amount,
                            total_price: args.amount,
                        },
                    ],
                });

                const printResult = await handleApprovedTransactionReceipt({
                    autoPrint: true,
                    orderId: args.orderId ?? selectedOrder?.id ?? null,
                    restaurantId: deviceInfo?.restaurant_id ?? null,
                    transactionNumber: receipt.transaction_number,
                    receipt,
                    fiscalRequest: result.data.fiscal_request ?? null,
                    isOnline: typeof navigator === 'undefined' ? true : Boolean(navigator.onLine),
                });

                if (printResult.blocked) {
                    throw new Error(
                        printResult.warning ??
                            'Fiscalization must succeed before printing this receipt.'
                    );
                }

                if (printResult.warning && !printResult.queuedFiscal) {
                    toast(printResult.warning, { icon: 'ℹ️' });
                }
            }

            toast.success(`${result.data.truth_label ?? 'Payment recorded'} for ${args.label}`);
            setProviderReference('');
            await Promise.all([
                loadOverview(),
                selectedOrderId ? loadSplitPayload(selectedOrderId) : null,
            ]);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to record payment');
        } finally {
            setCapturingId(null);
        }
    };

    const closeTableSettlement = async (): Promise<void> => {
        if (!deviceToken || !selectedTable) return;

        const parsedAmount = Number(orderAmountInput);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            toast.error('Enter a valid settlement amount');
            return;
        }

        try {
            setCapturingId(`table-${selectedTable.id}`);
            const localResult = await submitTerminalSettlement({
                restaurantId: deviceInfo?.restaurant_id ?? '',
                tableId: selectedTable.id,
                paymentProvider:
                    paymentMethod === 'cash'
                        ? 'cash'
                        : paymentMethod === 'chapa'
                          ? 'chapa'
                          : 'other',
                orders: tableOrders.map(order => ({
                    id: order.id,
                    status: order.status,
                })),
                amount: parsedAmount,
                providerReference: providerReference.trim() || undefined,
                terminalName: overview?.device.name ?? null,
            });

            if (!localResult.ok) {
                throw new Error(localResult.error ?? 'Failed to close table settlement');
            }

            setOverview(current =>
                current
                    ? {
                          ...current,
                          tables: current.tables.map(table =>
                              table.id === selectedTable.id
                                  ? {
                                        ...table,
                                        status: 'available',
                                        outstanding_total: 0,
                                        active_order_count: 0,
                                    }
                                  : table
                          ),
                          orders: current.orders.map(order =>
                              localResult.completedOrderIds?.includes(order.id)
                                  ? { ...order, status: 'completed' }
                                  : order
                          ),
                      }
                    : current
            );
            toast.success(
                `${localResult.truthLabel ?? 'Settlement recorded'} and closed table ${selectedTable.table_number}`
            );
            setProviderReference('');
            setSelectedOrderId(null);
            setSplitPayload(null);
            await loadOverview();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to close table');
        } finally {
            setCapturingId(null);
        }
    };

    if (managedDevice.loading) {
        return (
            <div className="font-inter flex min-h-screen items-center justify-center bg-[#F7F5F2] p-10 tracking-[-0.04em]">
                <div className="flex flex-col items-center gap-6 rounded-3xl border border-gray-100 bg-white p-12">
                    <div className="h-12 w-12 animate-spin rounded-full border-2 border-gray-100 border-t-[#DDF853]" />
                    <p className="text-[11px] font-black tracking-[0.2em] text-[#1A1C1E] uppercase">
                        Booting Terminal
                    </p>
                </div>
            </div>
        );
    }

    if (managedDevice.requiresPairing) {
        return (
            <div className="font-inter flex min-h-screen flex-col items-center justify-center bg-[#F7F5F2] p-10 tracking-[-0.04em]">
                <div className="w-full max-w-md space-y-8 rounded-[2rem] border border-gray-100 bg-white p-12 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F7F5F2] text-[#1A1C1E]">
                        <AlertCircle className="h-8 w-8" />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-3xl font-bold text-[#1A1C1E]">Not Paired.</h1>
                        <p className="leading-relaxed font-medium text-gray-500">
                            Pair this tablet from the merchant device provisioning flow before using
                            the cashier terminal.
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/device')}
                        className="w-full rounded-xl bg-[#1A1C1E] py-4 text-sm font-bold text-white"
                    >
                        Go to Pairing Shell
                    </button>
                </div>
            </div>
        );
    }

    if (managedDevice.isIdentityRevoked) {
        return (
            <div className="font-inter flex min-h-screen flex-col items-center justify-center bg-[#F7F5F2] p-10 tracking-[-0.04em]">
                <div className="w-full max-w-md space-y-8 rounded-[2rem] border border-gray-100 bg-white p-12 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                        <AlertCircle className="h-8 w-8" />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-3xl font-bold text-[#1A1C1E]">Identity Revoked.</h1>
                        <p className="leading-relaxed font-medium text-gray-500">
                            Re-pair this cashier terminal from merchant device management before it
                            can continue trading.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (managedDevice.hasProfileMismatch) {
        return (
            <div className="font-inter flex min-h-screen flex-col items-center justify-center bg-[#F7F5F2] p-10 tracking-[-0.04em]">
                <div className="w-full max-w-md space-y-8 rounded-[2rem] border border-gray-100 bg-white p-12 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                        <AlertCircle className="h-8 w-8" />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-3xl font-bold text-[#1A1C1E]">Wrong Role.</h1>
                        <p className="leading-relaxed font-medium text-gray-500">
                            This tablet is paired as {getDeviceTypeLabel(deviceInfo?.device_type)}.
                            Re-provision it as a cashier terminal to access `/terminal`.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (!managedDevice.hasOutageAccess) {
        return (
            <div className="font-inter flex min-h-screen flex-col items-center justify-center bg-[#F7F5F2] p-10 tracking-[-0.04em]">
                <div className="w-full max-w-md space-y-8 rounded-[2rem] border border-gray-100 bg-white p-12 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
                        <AlertCircle className="h-8 w-8" />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-3xl font-bold text-[#1A1C1E]">Access Expired.</h1>
                        <p className="leading-relaxed font-medium text-gray-500">
                            {managedDevice.outageAccess.reason ??
                                'This cashier terminal needs fresh online authorization before more settlement work.'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="font-inter flex min-h-screen flex-col bg-[#F7F5F2] tracking-[-0.04em] text-[#1A1C1E]">
            <div className="border-b border-gray-100 bg-white px-10 py-10">
                <ManagedDeviceBanner session={deviceInfo} routeLabel="Cashier Terminal" />
                <div className="mt-10 flex flex-col justify-between gap-8 md:flex-row md:items-end">
                    <div>
                        <div className="mb-2 flex items-center gap-3">
                            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#DDF853]" />
                            <p className="text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase">
                                Operational Node
                            </p>
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight text-[#1A1C1E] md:text-6xl">
                            {overview?.device.metadata?.station_name ||
                                overview?.device.name ||
                                'Terminal'}
                        </h1>
                        <p className="mt-4 max-w-2xl text-lg leading-relaxed font-medium text-gray-500">
                            Unified settlement interface for cashier operations. Manage open tables
                            and record digital/cash tender.
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden text-right md:block">
                            <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">
                                System Status
                            </p>
                            <p className="text-sm font-bold text-emerald-500">
                                Live & Synchronized
                            </p>
                        </div>
                        <button
                            onClick={() => void loadOverview()}
                            disabled={loading}
                            className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-white text-[#1A1C1E] transition-all hover:border-gray-200 active:scale-95 disabled:opacity-50"
                        >
                            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            <main className="grid flex-1 grid-cols-1 gap-10 p-10 xl:grid-cols-[400px_1fr]">
                {/* Tables Sidebar */}
                <aside className="flex flex-col space-y-8">
                    <div className="flex flex-1 flex-col overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white p-10">
                        <div className="mb-8 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold">Active Tables.</h3>
                                <p className="text-sm font-medium text-gray-400">
                                    Tables with pending bills
                                </p>
                            </div>
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F5F2] text-sm font-black">
                                {overview?.tables.length ?? 0}
                            </span>
                        </div>

                        <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto pr-2">
                            {(overview?.tables ?? []).map(table => {
                                const isSelected = selectedTableNumber === table.table_number;
                                return (
                                    <button
                                        key={table.id}
                                        onClick={() => setSelectedTableNumber(table.table_number)}
                                        className={`group w-full rounded-3xl border p-8 text-left transition-all ${
                                            isSelected
                                                ? 'border-[#1A1C1E] bg-[#1A1C1E] text-white'
                                                : 'border-gray-50 bg-white text-[#1A1C1E] hover:border-gray-200'
                                        }`}
                                    >
                                        <div className="mb-6 flex items-center justify-between">
                                            <span
                                                className={`text-[10px] font-black tracking-widest uppercase ${isSelected ? 'text-gray-500' : 'text-gray-400'}`}
                                            >
                                                Table Identification
                                            </span>
                                            <div
                                                className={`h-2 w-2 rounded-full ${table.outstanding_total > 0 ? 'bg-[#DDF853]' : 'bg-gray-100'}`}
                                            />
                                        </div>
                                        <div className="flex items-end justify-between">
                                            <div>
                                                <h4 className="text-5xl font-black tracking-tighter tabular-nums">
                                                    {table.table_number}
                                                </h4>
                                                <p
                                                    className={`mt-2 text-xs font-bold tracking-widest uppercase ${isSelected ? 'text-gray-400' : 'text-gray-400'}`}
                                                >
                                                    {table.active_order_count} Orders
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p
                                                    className={`text-2xl font-bold tracking-tight ${isSelected ? 'text-[#DDF853]' : 'text-emerald-600'}`}
                                                >
                                                    {formatCurrencyCompact(
                                                        table.outstanding_total ?? 0
                                                    )}
                                                </p>
                                                <p
                                                    className={`text-[10px] font-black tracking-widest uppercase ${isSelected ? 'text-gray-500' : 'text-gray-400'}`}
                                                >
                                                    ETB Due
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                            {!loading && (overview?.tables.length ?? 0) === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-center opacity-30 grayscale">
                                    <Store className="mb-4 h-12 w-12" />
                                    <p className="text-lg font-bold">No active tables.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Settlement Area */}
                <div className="flex flex-col space-y-10">
                    {!selectedTable ? (
                        <div className="flex flex-1 flex-col items-center justify-center rounded-[3rem] border border-gray-100 bg-white p-20 text-center">
                            <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-[#F7F5F2] text-gray-300">
                                <Receipt className="h-10 w-10" />
                            </div>
                            <h2 className="text-3xl font-bold text-[#1A1C1E]">Select Workspace.</h2>
                            <p className="mt-4 max-w-sm text-lg font-medium text-gray-400">
                                Select an active table from the sidebar to begin the settlement
                                process.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Workspace Header */}
                            <div className="flex flex-col justify-between gap-8 rounded-[2.5rem] border border-gray-100 bg-white p-10 lg:flex-row lg:items-center">
                                <div>
                                    <div className="mb-2 flex items-center gap-3">
                                        <div className="h-2.5 w-2.5 rounded-full bg-[#DDF853]" />
                                        <p className="text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase">
                                            Active Workspace
                                        </p>
                                    </div>
                                    <h2 className="text-4xl font-bold tracking-tight">
                                        Table {selectedTable.table_number}
                                    </h2>
                                    <div className="mt-4 flex items-center gap-4">
                                        <span className="rounded-lg bg-[#1A1C1E] px-3 py-1 text-[10px] font-black tracking-widest text-white uppercase">
                                            {selectedTable.status.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-sm font-bold text-gray-400">
                                            Opened{' '}
                                            {formatCurrencyCompact(selectedTable.outstanding_total)}{' '}
                                            total
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 rounded-3xl border border-gray-50 bg-[#F7F5F2] p-2">
                                    {(overview?.payment_options ?? []).map(option => (
                                        <button
                                            key={option.method}
                                            onClick={() => setPaymentMethod(option.method)}
                                            className={`flex h-14 items-center gap-3 rounded-2xl px-6 font-bold transition-all ${
                                                paymentMethod === option.method
                                                    ? 'bg-[#1A1C1E] text-white shadow-xl'
                                                    : 'bg-transparent text-gray-400 hover:bg-white hover:text-[#1A1C1E]'
                                            }`}
                                        >
                                            {METHOD_ICONS[option.method]}
                                            <span className="text-sm tracking-widest uppercase">
                                                {option.method}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid min-h-0 flex-1 grid-cols-1 gap-10 lg:grid-cols-[400px_1fr]">
                                {/* Order Selection */}
                                <div className="flex flex-col rounded-[2.5rem] border border-gray-100 bg-white p-10">
                                    <h3 className="mb-8 text-xl font-bold">Checks.</h3>
                                    <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto pr-2">
                                        {tableOrders.map(order => {
                                            const isOrderSelected = order.id === selectedOrderId;
                                            return (
                                                <button
                                                    key={order.id}
                                                    onClick={() => setSelectedOrderId(order.id)}
                                                    className={`w-full rounded-3xl border p-6 text-left transition-all ${
                                                        isOrderSelected
                                                            ? 'border-[#DDF853] bg-[#DDF853] text-[#1A1C1E]'
                                                            : 'border-transparent bg-[#F7F5F2] text-[#1A1C1E] hover:border-gray-200'
                                                    }`}
                                                >
                                                    <div className="mb-4 flex items-center justify-between">
                                                        <span className="text-[10px] font-black tracking-widest uppercase opacity-40">
                                                            Check #{order.order_number}
                                                        </span>
                                                        <span
                                                            className={`text-[10px] font-black tracking-widest uppercase ${isOrderSelected ? 'bg-[#1A1C1E] text-[#DDF853]' : 'bg-white text-gray-400'} rounded-lg px-2 py-0.5`}
                                                        >
                                                            {order.status}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-2xl font-bold tracking-tight">
                                                        {formatCurrencyCompact(order.total_price)}
                                                    </h4>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Settlement Controls */}
                                <div className="flex min-h-0 flex-col space-y-10">
                                    {!selectedOrder ? (
                                        <div className="flex flex-1 flex-col items-center justify-center rounded-[2.5rem] border border-gray-100 bg-white p-10 text-center">
                                            <p className="font-medium text-gray-400">
                                                Select a check to proceed with payment.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid flex-1 grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
                                            {/* Split Logic */}
                                            <div className="flex flex-col rounded-[2.5rem] border border-gray-100 bg-white p-10">
                                                <div className="mb-10 flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-2xl font-bold">
                                                            Split tender.
                                                        </h4>
                                                        <p className="mt-1 text-sm font-medium text-gray-400">
                                                            Distribute total across guests
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <select
                                                            value={splitGuestCount}
                                                            onChange={e =>
                                                                setSplitGuestCount(
                                                                    Number(e.target.value)
                                                                )
                                                            }
                                                            className="h-14 w-28 cursor-pointer appearance-none rounded-2xl border-none bg-[#F7F5F2] px-6 text-sm font-bold text-[#1A1C1E] transition-all outline-none hover:bg-gray-100"
                                                        >
                                                            {[2, 3, 4, 5, 6].map(count => (
                                                                <option key={count} value={count}>
                                                                    {count} Guests
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            onClick={() => void createEvenSplit()}
                                                            disabled={capturingId === 'split-setup'}
                                                            className="h-14 rounded-2xl bg-[#1A1C1E] px-8 text-sm font-black tracking-widest text-white uppercase transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                                                        >
                                                            {capturingId === 'split-setup'
                                                                ? '...'
                                                                : 'Split'}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto pr-2">
                                                    {(splitPayload?.splits ?? []).length > 0 ? (
                                                        splitPayload!.splits.map(split => {
                                                            const paid =
                                                                splitPaidById.get(split.id) ?? 0;
                                                            const remaining = Number(
                                                                Math.max(
                                                                    0,
                                                                    split.computed_amount - paid
                                                                ).toFixed(2)
                                                            );
                                                            const isPaid = remaining <= 0;
                                                            return (
                                                                <div
                                                                    key={split.id}
                                                                    className="flex items-center justify-between gap-10 rounded-[2rem] border border-gray-50 bg-[#F7F5F2] p-8"
                                                                >
                                                                    <div className="flex-1">
                                                                        <div className="mb-2 flex items-center gap-3">
                                                                            <h5 className="text-xl font-bold">
                                                                                {split.split_label ||
                                                                                    `Guest ${split.split_index + 1}`}
                                                                            </h5>
                                                                            {isPaid && (
                                                                                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                                                            )}
                                                                        </div>
                                                                        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white">
                                                                            <div
                                                                                className="h-full bg-[#1A1C1E] transition-all duration-700"
                                                                                style={{
                                                                                    width: `${(paid / split.computed_amount) * 100}%`,
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <p className="text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase">
                                                                            {formatCurrencyCompact(
                                                                                paid
                                                                            )}{' '}
                                                                            of{' '}
                                                                            {formatCurrencyCompact(
                                                                                split.computed_amount
                                                                            )}{' '}
                                                                            paid
                                                                        </p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() =>
                                                                            void capturePayment({
                                                                                splitId: split.id,
                                                                                amount:
                                                                                    remaining ||
                                                                                    split.computed_amount,
                                                                                label:
                                                                                    split.split_label ||
                                                                                    `Guest ${split.split_index + 1}`,
                                                                            })
                                                                        }
                                                                        disabled={
                                                                            isPaid ||
                                                                            capturingId === split.id
                                                                        }
                                                                        className={`h-16 rounded-2xl px-8 text-sm font-black tracking-widest uppercase transition-all ${
                                                                            isPaid
                                                                                ? 'border border-emerald-50 bg-white text-emerald-500'
                                                                                : 'bg-[#1A1C1E] text-[#DDF853] shadow-xl hover:scale-105 active:scale-95'
                                                                        } disabled:opacity-80`}
                                                                    >
                                                                        {capturingId === split.id
                                                                            ? '...'
                                                                            : isPaid
                                                                              ? 'Settled'
                                                                              : `Pay ${formatCurrencyCompact(remaining)}`}
                                                                    </button>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="flex flex-1 flex-col items-center justify-center py-20 text-center opacity-40 grayscale">
                                                            <UserX className="mb-6 h-12 w-12" />
                                                            <p className="text-lg font-bold">
                                                                Check not split.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Settle Final */}
                                            <div className="flex flex-col justify-between rounded-[2.5rem] border border-gray-100 bg-white p-10">
                                                <div className="mb-10">
                                                    <h4 className="text-2xl font-bold">
                                                        Total Settlement.
                                                    </h4>
                                                    <div className="mt-8 rounded-3xl border border-gray-50 bg-[#F7F5F2] p-8">
                                                        <p className="mb-2 text-[10px] font-black tracking-widest text-gray-400 uppercase">
                                                            Total Due
                                                        </p>
                                                        <p className="text-5xl font-black tracking-tighter text-[#1A1C1E] tabular-nums">
                                                            {fullOrderRemaining.toFixed(2)}
                                                            <span className="ml-2 text-lg font-black text-gray-300">
                                                                ETB
                                                            </span>
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="space-y-6">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">
                                                            Payment Reference
                                                        </label>
                                                        <input
                                                            value={providerReference}
                                                            onChange={e =>
                                                                setProviderReference(e.target.value)
                                                            }
                                                            placeholder="Transaction ID / Note"
                                                            className="h-14 w-full rounded-2xl border-none bg-[#F7F5F2] px-6 font-bold text-[#1A1C1E] transition-all outline-none placeholder:text-gray-300 focus:bg-gray-100"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => void closeTableSettlement()}
                                                        disabled={
                                                            capturingId ===
                                                            `table-${selectedTable?.id}`
                                                        }
                                                        className="h-20 w-full rounded-3xl bg-[#DDF853] text-lg font-black tracking-widest text-[#1A1C1E] uppercase shadow-xl shadow-[#DDF853]/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                                    >
                                                        {capturingId ===
                                                        `table-${selectedTable?.id}`
                                                            ? 'Processing...'
                                                            : 'Settle & Close Table'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}


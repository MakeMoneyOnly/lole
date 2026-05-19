'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { CheckCircle2, Link2, Loader2, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type DeliveryPartner = {
    id: string;
    provider: string;
    status: string;
    updated_at: string;
    last_sync_at: string | null;
};

type ExternalOrder = {
    id: string;
    provider: string;
    provider_order_id: string;
    source_channel: string;
    normalized_status: string;
    total_amount: number;
    currency: string;
    payload_json: Record<string, unknown>;
    acked_at: string | null;
    created_at: string;
    updated_at: string;
};

interface DeliveryPartnerHubProps {
    loading: boolean;
    partners: DeliveryPartner[];
    orders: ExternalOrder[];
    connecting: boolean;
    acknowledgingId: string | null;
    onConnect: (
        provider: 'beu' | 'deliver_addis' | 'zmall' | 'esoora' | 'custom_local',
        displayName?: string
    ) => Promise<void>;
    onAcknowledge: (externalOrderId: string) => Promise<void>;
}

const PROVIDERS: Array<'beu' | 'deliver_addis' | 'zmall' | 'esoora' | 'custom_local'> = [
    'beu',
    'deliver_addis',
    'zmall',
    'esoora',
    'custom_local',
];
const DASHBOARD_LOCALE = 'en-ET';
function toLabel(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, match => match.toUpperCase());
}

function CustomSelect({
    value,
    onChange,
    options,
    placeholder,
    ariaLabel,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    ariaLabel?: string;
}): React.JSX.Element {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent): void {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(o => o.value === value);

    return (
        <div ref={ref} className="relative w-full">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-label={ariaLabel}
                className="flex h-12 w-full items-center justify-between rounded-xl bg-gray-50 px-4 text-[15px] font-semibold text-gray-800 transition-all outline-none hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-[#98141F]"
            >
                <span>
                    {selectedOption ? selectedOption.label : placeholder || 'Select Provider'}
                </span>
                <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && (
                <div className="absolute z-10 mt-2 flex w-full flex-col overflow-hidden rounded-xl bg-white py-1 shadow-[0px_2px_12px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
                    {options.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setOpen(false);
                            }}
                            className={cn(
                                'flex w-full items-center justify-between px-4 py-3 text-left text-[14px] transition-colors hover:bg-gray-50',
                                value === option.value
                                    ? 'bg-gray-50 font-bold text-[#98141F]'
                                    : 'font-medium text-gray-700'
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

export function DeliveryPartnerHub({
    loading,
    partners,
    orders,
    connecting,
    acknowledgingId,
    onConnect,
    onAcknowledge,
}: DeliveryPartnerHubProps): React.ReactElement {
    const displayNameId = 'delivery-provider-display-name';
    const [providerToConnect, setProviderToConnect] = useState<
        'beu' | 'deliver_addis' | 'zmall' | 'esoora' | 'custom_local'
    >('beu');
    const [displayName, setDisplayName] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [providerFilter, setProviderFilter] = useState<string>('all');

    const visibleOrders = useMemo(() => {
        if (providerFilter === 'all') return orders;
        return orders.filter(order => order.provider === providerFilter);
    }, [orders, providerFilter]);

    return (
        <div className="space-y-6 rounded-3xl bg-white p-6 shadow-[0px_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Delivery Partner Hub</h3>
                    <p className="text-sm text-gray-500">
                        Connect providers and manage external delivery order intake.
                    </p>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="flex flex-col gap-4">
                    <h4 className="text-[17px] font-bold text-gray-900">Connect provider</h4>
                    <div className="flex flex-col gap-3">
                        <CustomSelect
                            value={providerToConnect}
                            onChange={v => setProviderToConnect(v as typeof providerToConnect)}
                            options={PROVIDERS.map(p => ({ value: p, label: toLabel(p) }))}
                            ariaLabel="Connect Provider"
                        />
                        <div>
                            <label htmlFor={displayNameId} className="sr-only">
                                Provider display name
                            </label>
                            <input
                                id={displayNameId}
                                value={displayName}
                                onChange={event => setDisplayName(event.target.value)}
                                placeholder="Store ID / Display Name"
                                className="h-12 w-full rounded-xl border-0 bg-gray-50 px-4 text-[15px] font-bold text-gray-800 transition-all outline-none placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#98141F]"
                            />
                        </div>
                        <div>
                            <label htmlFor="integrationApiKeyId" className="sr-only">
                                Integration API Key
                            </label>
                            <input
                                id="integrationApiKeyId"
                                value={apiKey}
                                onChange={event => setApiKey(event.target.value)}
                                placeholder="Integration API Key"
                                className="h-12 w-full rounded-xl border-0 bg-gray-50 px-4 text-[15px] font-bold text-gray-800 transition-all outline-none placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#98141F]"
                            />
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() =>
                            void onConnect(providerToConnect, displayName.trim() || undefined)
                        }
                        disabled={connecting}
                        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#98141F] text-[15px] font-bold text-white transition-all hover:bg-[#801019] hover:shadow active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                    >
                        {connecting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Link2 className="h-4 w-4" />
                        )}
                        Link Account
                    </button>
                    <div className="mt-5 pb-1 text-center">
                        <a
                            href="#"
                            className="text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700"
                        >
                            Don't have a {toLabel(providerToConnect)} account? Sign up here.
                        </a>
                    </div>
                </div>

                <div className="flex flex-col gap-4 xl:col-span-2">
                    <h4 className="text-[17px] font-bold text-gray-900">Partner status</h4>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {partners.length === 0 && (
                            <p className="text-sm text-gray-500">
                                No delivery partners connected yet.
                            </p>
                        )}
                        {partners.map(partner => (
                            <div
                                key={partner.id}
                                className="flex items-center justify-between rounded-xl bg-gray-50 p-4 transition-all hover:bg-white hover:shadow-none"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                        {toLabel(partner.provider)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Updated{' '}
                                        {new Date(partner.updated_at).toLocaleString(
                                            DASHBOARD_LOCALE
                                        )}
                                    </p>
                                </div>
                                <span
                                    className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                                        partner.status === 'connected'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : partner.status === 'error'
                                              ? 'bg-amber-100 text-amber-700'
                                              : 'bg-gray-100 text-gray-700'
                                    }`}
                                >
                                    {toLabel(partner.status)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-10 flex flex-col gap-4">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <h4 className="text-[17px] font-bold text-gray-900">External orders</h4>
                    <div className="w-full md:w-64">
                        <CustomSelect
                            value={providerFilter}
                            onChange={v => setProviderFilter(v)}
                            options={[
                                { value: 'all', label: 'All Providers' },
                                ...PROVIDERS.map(p => ({ value: p, label: toLabel(p) })),
                            ]}
                            ariaLabel="External Orders"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="mt-2 h-32 animate-pulse rounded-lg bg-gray-50" />
                ) : visibleOrders.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">
                        No external orders found for this provider filter.
                    </p>
                ) : (
                    <div className="mt-2 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <caption className="sr-only">
                                External delivery orders by provider with acknowledgment actions.
                            </caption>
                            <thead className="text-xs tracking-wide text-gray-500 uppercase">
                                <tr>
                                    <th scope="col" className="py-2">
                                        Provider
                                    </th>
                                    <th scope="col" className="py-2">
                                        Order Ref
                                    </th>
                                    <th scope="col" className="py-2">
                                        Status
                                    </th>
                                    <th scope="col" className="py-2">
                                        Amount
                                    </th>
                                    <th scope="col" className="py-2">
                                        Created
                                    </th>
                                    <th scope="col" className="py-2">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleOrders.map(order => (
                                    <tr key={order.id} className="border-t border-gray-100">
                                        <td className="py-2 font-semibold text-gray-900">
                                            {toLabel(order.provider)}
                                        </td>
                                        <td className="py-2 font-mono text-xs text-gray-700">
                                            {order.provider_order_id}
                                        </td>
                                        <td className="py-2 text-gray-700">
                                            {toLabel(order.normalized_status)}
                                        </td>
                                        <td className="py-2 text-gray-700">
                                            {new Intl.NumberFormat(DASHBOARD_LOCALE, {
                                                style: 'currency',
                                                currency: order.currency || 'ETB',
                                                minimumFractionDigits: 0,
                                                maximumFractionDigits: 0,
                                            }).format(Number(order.total_amount ?? 0))}
                                        </td>
                                        <td className="py-2 text-gray-500">
                                            {new Date(order.created_at).toLocaleString(
                                                DASHBOARD_LOCALE
                                            )}
                                        </td>
                                        <td className="py-2">
                                            {order.acked_at ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Acked
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => void onAcknowledge(order.id)}
                                                    disabled={acknowledgingId === order.id}
                                                    aria-label={`Acknowledge external order ${order.provider_order_id}`}
                                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#98141F] px-3 text-xs font-bold text-white transition-all hover:bg-[#801019] hover:shadow active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                                                >
                                                    {acknowledgingId === order.id ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                    )}
                                                    Ack
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

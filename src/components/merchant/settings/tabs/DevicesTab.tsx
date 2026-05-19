'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, FileText, Monitor, Printer, Signal, Tablet, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { readPrinterSpoolerStatus, type PrinterSpoolerStatus } from '@/lib/sync/printerFallback';
import type { PrinterHealthState } from '@/lib/printer/contracts';

const EMPTY_STATUS: PrinterSpoolerStatus = {
    stats: {
        pending: 0,
        printing: 0,
        completed: 0,
        failed: 0,
        rerouted: 0,
    },
    printers: [],
    queue: [],
 };

function statusTone(state: PrinterHealthState): string {
     switch (state) {
         case 'healthy':
             return 'bg-green-50 text-green-700';
         case 'degraded':
             return 'bg-amber-50 text-amber-700';
         case 'offline':
             return 'bg-red-50 text-red-700';
         default:
             return 'bg-gray-100 text-gray-600';
     }
 }

export function DevicesTab(): React.JSX.Element {
    const [spooler, setSpooler] = useState<PrinterSpoolerStatus>(EMPTY_STATUS);

    useEffect(() => {
        let cancelled = false;

        const load = async (): Promise<void> => {
            const next = await readPrinterSpoolerStatus();
            if (!cancelled) {
                setSpooler(next);
            }
        };

        void load();
        const interval = window.setInterval(() => {
            void load();
        }, 10_000);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, []);

    const onlinePrinters = spooler.printers.filter(printer => printer.state === 'healthy').length;
    const degradedPrinters = spooler.printers.filter(printer => printer.state !== 'healthy').length;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div>
                <h2 className="text-xl font-bold text-gray-900">Devices & Hardware</h2>
                <p className="text-sm text-gray-500">
                    Gateway spooler health, queue state, and device fault visibility.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {[
                    {
                        label: 'POS Terminals',
                        count: 0,
                        active: 0,
                        icon: Tablet,
                        color: 'text-blue-600',
                        bg: 'bg-blue-50',
                    },
                    {
                        label: 'KDS Screens',
                        count: 0,
                        active: 0,
                        icon: Monitor,
                        color: 'text-brand-accent-text',
                        bg: 'bg-brand-accent/30',
                    },
                    {
                        label: 'Printer Routes',
                        count: spooler.printers.length,
                        active: onlinePrinters,
                        icon: Printer,
                        color: 'text-black',
                        bg: 'bg-[#DDF853] text-black',
                    },
                ].map(card => (
                    <div
                        key={card.label}
                        className="rounded-3xl border border-gray-100 bg-white p-6"
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <div
                                className={cn(
                                    'flex h-10 w-10 items-center justify-center rounded-xl',
                                    card.bg
                                )}
                            >
                                <card.icon className={cn('h-5 w-5', card.color)} />
                            </div>
                            <span
                                className={cn(
                                    'flex items-center gap-1.5 text-[10px] font-bold',
                                    card.count === card.active ? 'text-green-600' : 'text-amber-600'
                                )}
                            >
                                <div
                                    className={cn(
                                        'h-1.5 w-1.5 rounded-full',
                                        card.count === card.active ? 'bg-green-600' : 'bg-amber-600'
                                    )}
                                />
                                {card.active}/{card.count} Healthy
                            </span>
                        </div>
                        <p className="text-sm font-medium text-gray-400">{card.label}</p>
                        <p className="text-xl font-bold text-gray-900">{card.count} Linked</p>
                    </div>
                ))}
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Printer className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">
                                Gateway Print Spooler
                            </h3>
                            <p className="text-[11px] font-medium text-gray-500">
                                Pending {spooler.stats.pending} • Printing {spooler.stats.printing}{' '}
                                • Failed {spooler.stats.failed} • Rerouted {spooler.stats.rerouted}
                            </p>
                        </div>
                    </div>
                    {degradedPrinters > 0 ? (
                        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
                            <AlertTriangle className="h-4 w-4" />
                            {degradedPrinters} printer routes need attention
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-[11px] font-bold text-green-700">
                            <Signal className="h-4 w-4" />
                            All visible routes healthy
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    {spooler.printers.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-5 py-6 text-sm font-medium text-gray-500">
                            No local printer routes discovered yet.
                        </div>
                    ) : (
                        spooler.printers.map(printer => (
                            <div
                                key={`${printer.printerDeviceId}-${printer.routeKeys.join(',')}`}
                                className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/20 px-6 py-4"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#DDF853] text-black ring-1 ring-gray-100">
                                        {printer.state === 'offline' ? (
                                            <WifiOff className="h-5 w-5 text-red-600" />
                                        ) : (
                                            <FileText className="h-5 w-5 text-gray-500" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-bold text-gray-900">
                                                {printer.printerName}
                                            </h4>
                                            <span
                                                className={cn(
                                                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                                                    statusTone(printer.state)
                                                )}
                                            >
                                                {printer.state}
                                            </span>
                                        </div>
                                        <p className="text-[11px] font-medium text-gray-500">
                                            {printer.driverKind} • routes{' '}
                                            {printer.routeKeys.join(', ')} • queue{' '}
                                            {printer.queueDepth}
                                        </p>
                                        <p className="text-[11px] font-medium text-gray-500">
                                            pending {printer.pendingJobs} • printing{' '}
                                            {printer.printingJobs} • failed {printer.failedJobs}
                                            {printer.lastError ? ` • ${printer.lastError}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right text-[11px] font-medium text-gray-500">
                                    <p>{printer.printerDeviceId}</p>
                                    <p>
                                        {printer.lastHeartbeatAt
                                            ? `heartbeat ${new Date(printer.lastHeartbeatAt).toLocaleTimeString()}`
                                            : 'no heartbeat yet'}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <h3 className="mb-6 text-lg font-bold text-gray-900">Recent Spool Queue</h3>
                <div className="space-y-3">
                    {spooler.queue.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-5 py-6 text-sm font-medium text-gray-500">
                            No queued print intents.
                        </div>
                    ) : (
                        spooler.queue.slice(0, 8).map(job => (
                            <div
                                key={job.id}
                                className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/20 px-5 py-4"
                            >
                                <div>
                                    <p className="text-sm font-bold text-gray-900">
                                        {job.route_key} • {job.station} • {job.status}
                                    </p>
                                    <p className="text-[11px] font-medium text-gray-500">
                                        attempts {job.attempts}/{job.max_attempts}
                                        {job.rerouted_from_job_id
                                            ? ` • rerouted from ${job.rerouted_from_job_id}`
                                            : ''}
                                        {job.status_reason ? ` • ${job.status_reason}` : ''}
                                    </p>
                                </div>
                                <div className="text-right text-[11px] font-medium text-gray-500">
                                    <p>{job.printer_name ?? 'unassigned printer'}</p>
                                    <p>{job.last_error ?? 'no error'}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

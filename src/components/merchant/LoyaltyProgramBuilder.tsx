'use client';

import { useMemo, useState } from 'react';
import { Loader2, Plus, Crown, Edit2, Pause, Play, Trash2 } from 'lucide-react';
import { formatLocalizedDate } from '@/lib/format/et';
import type { AppLocale } from '@/lib/i18n/locale';
import { cn } from '@/lib/utils';

export type LoyaltyProgramRow = {
    id: string;
    name: string;
    status: 'draft' | 'active' | 'paused' | 'archived';
    created_at: string;
    points_rule_json?: {
        points_per_currency_unit: number;
        currency_unit: number;
    };
};

interface LoyaltyProgramBuilderProps {
    programs: LoyaltyProgramRow[];
    loading: boolean;
    creating: boolean;
    locale: AppLocale;
    onCreate: (payload: {
        name: string;
        status: LoyaltyProgramRow['status'];
        points_rule_json?: Record<string, unknown>;
    }) => Promise<void>;
    onStatusChange?: (id: string, status: LoyaltyProgramRow['status']) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    onEdit?: (id: string) => void;
}

export function LoyaltyProgramBuilder({
    programs,
    loading,
    creating: isOperationLoading,
    locale,
    onCreate,
    onStatusChange,
    onDelete,
    onEdit: _onEdit,
}: LoyaltyProgramBuilderProps) {
    const [name, setName] = useState('');
    const [status, setStatus] = useState<LoyaltyProgramRow['status']>('draft');
    const [spendAmount, setSpendAmount] = useState('100');
    const [earnPoints, setEarnPoints] = useState('10');
    const [editingId, setEditingId] = useState<string | null>(null);

    const activeCount = useMemo(
        () => programs.filter(program => program.status === 'active').length,
        [programs]
    );

    const handleEditInternal = (id: string) => {
        const program = programs.find(p => p.id === id);
        if (!program) return;

        setEditingId(id);
        setName(program.name);
        setStatus(program.status);
        setSpendAmount(program.points_rule_json?.currency_unit?.toString() ?? '100');
        setEarnPoints(program.points_rule_json?.points_per_currency_unit?.toString() ?? '10');

        // Scroll to form on mobile or for focus
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setName('');
        setStatus('draft');
        setSpendAmount('100');
        setEarnPoints('10');
    };

    const submit = async () => {
        const trimmed = name.trim();
        if (trimmed.length < 2) return;

        const spend = Number(spendAmount);
        const earn = Number(earnPoints);
        if (!Number.isFinite(spend) || spend <= 0) return;
        if (!Number.isFinite(earn) || earn < 0) return;

        await onCreate({
            ...(editingId ? { id: editingId } : {}), // Add ID if updating
            name: trimmed,
            status,
            points_rule_json: {
                points_per_currency_unit: earn,
                currency_unit: spend,
            },
        });

        if (editingId) {
            setEditingId(null);
        }
        setName('');
        setStatus('draft');
        setSpendAmount('100');
        setEarnPoints('10');
    };

    return (
        <div className="grid min-h-[500px] grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Creation/Edit Form */}
            <div className="flex flex-col rounded-2xl bg-white p-6 shadow-xl shadow-gray-200/50 lg:col-span-4">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl leading-tight font-bold text-gray-900">
                            {editingId ? 'Edit program' : 'Create program'}
                        </h3>
                        <p className="mt-1 text-sm font-medium text-gray-500">
                            {editingId
                                ? 'Modify your existing loyalty rule.'
                                : 'Configure a new loyalty rule for your guests.'}
                        </p>
                    </div>
                    {editingId && (
                        <button
                            onClick={cancelEdit}
                            className="text-xs font-bold text-gray-400 underline underline-offset-4 transition-all hover:text-gray-900"
                        >
                            Cancel
                        </button>
                    )}
                </div>

                <div className="flex-1 space-y-5 rounded-4xl border border-gray-100 bg-gray-50/40 p-5">
                    <div className="space-y-1.5">
                        <label className="ml-1 text-xs font-bold tracking-tight text-gray-400">
                            Program name
                        </label>
                        <input
                            value={name}
                            onChange={event => setName(event.target.value)}
                            placeholder="e.g. VIP Rewards"
                            className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold transition-all outline-none placeholder:text-gray-300 focus:border-gray-400 focus:ring-4 focus:ring-gray-100/50"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="ml-1 text-xs font-bold tracking-tight text-gray-400">
                            Points calculation
                        </label>
                        <div className="mt-3 flex items-center gap-3">
                            <div className="relative flex-1">
                                <input
                                    value={spendAmount}
                                    onChange={event => setSpendAmount(event.target.value)}
                                    className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-center text-sm font-bold transition-all outline-none focus:border-gray-400"
                                />
                                <div className="absolute -top-2 left-4 bg-gray-50 px-1.5 text-[9px] font-bold tracking-wider text-gray-400 uppercase">
                                    Spend (ETB)
                                </div>
                            </div>
                            <div className="shrink-0 text-gray-300">
                                <Plus className="h-4 w-4 rotate-45" />
                            </div>
                            <div className="relative flex-1">
                                <input
                                    value={earnPoints}
                                    onChange={event => setEarnPoints(event.target.value)}
                                    className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-center text-sm font-bold text-emerald-600 transition-all outline-none focus:border-emerald-400"
                                />
                                <div className="absolute -top-2 left-4 bg-gray-50 px-1.5 text-[9px] font-bold tracking-wider text-gray-400 uppercase">
                                    Earn (Pts)
                                </div>
                            </div>
                        </div>
                        <p className="text-center text-[10px] font-medium text-gray-400">
                            Guest spends{' '}
                            <span className="font-bold text-gray-900">{spendAmount} ETB</span> and
                            earns{' '}
                            <span className="font-bold text-emerald-600">{earnPoints} pts</span>.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="ml-1 text-xs font-bold tracking-tight text-gray-400">
                            Status
                        </label>
                        <select
                            value={status}
                            onChange={event =>
                                setStatus(event.target.value as LoyaltyProgramRow['status'])
                            }
                            className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold transition-all outline-none focus:border-gray-400"
                        >
                            <option value="draft">Draft</option>
                            <option value="active">Active (Live)</option>
                            {editingId && <option value="paused">Paused</option>}
                        </select>
                    </div>

                    <div className="mt-auto">
                        <button
                            type="button"
                            onClick={submit}
                            disabled={isOperationLoading || name.trim().length < 2}
                            className={cn(
                                'flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-black shadow-xl transition-all active:scale-[0.98] disabled:opacity-50',
                                editingId
                                    ? 'bg-gray-900 shadow-gray-900/10'
                                    : 'bg-brand-accent shadow-crimson-900/10'
                            )}
                        >
                            {isOperationLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin text-white/70" />
                            ) : editingId ? (
                                <Edit2 className="h-5 w-5" />
                            ) : (
                                <Plus className="h-5 w-5" />
                            )}
                            {editingId ? 'Update program' : 'Create program'}
                        </button>
                        <p className="mt-3 text-center text-[11px] font-medium text-gray-400">
                            {editingId
                                ? 'Changes take effect immediately for all guests.'
                                : 'Programs can be modified or paused later.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Right: Management List */}
            <div className="flex flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-xl shadow-gray-200/50 lg:col-span-8">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl leading-tight font-bold text-gray-900">
                            Active programs
                        </h3>
                        <p className="mt-1 text-sm font-medium text-gray-500">
                            Currently running {activeCount} active loyalty campaigns.
                        </p>
                    </div>
                    {activeCount > 0 && (
                        <div className="flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">
                            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                            {activeCount} active
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-hidden">
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4].map(i => (
                                <div
                                    key={i}
                                    className="h-16 w-full animate-pulse rounded-xl bg-gray-50"
                                />
                            ))}
                        </div>
                    ) : programs.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center rounded-4xl border border-dashed border-gray-200 bg-gray-50/30 py-20">
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                                <Crown className="h-6 w-6 text-gray-300" />
                            </div>
                            <p className="text-sm font-bold text-gray-500">No programs yet</p>
                            <p className="mt-1 text-xs font-medium text-gray-400">
                                Start by creating your first loyalty program.
                            </p>
                        </div>
                    ) : (
                        <div className="no-scrollbar h-[400px] space-y-3 overflow-y-auto pr-2 pb-4">
                            {programs.map(program => {
                                const pts = program.points_rule_json?.points_per_currency_unit ?? 1;
                                const cur = program.points_rule_json?.currency_unit ?? 1;
                                return (
                                    <div
                                        key={program.id}
                                        className="group flex items-center justify-between rounded-xl border-none bg-white p-4 shadow-sm transition-all hover:shadow-md"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={cn(
                                                    'rounded-1.5xl flex h-11 w-11 items-center justify-center shadow-sm transition-all',
                                                    program.status === 'active'
                                                        ? 'bg-emerald-50 text-emerald-600'
                                                        : 'bg-gray-100 text-gray-400'
                                                )}
                                            >
                                                <Crown className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-md leading-tight font-bold text-gray-900">
                                                    {program.name}
                                                </p>
                                                <div className="mt-1 flex items-center gap-2">
                                                    <p className="text-xs font-medium text-gray-400">
                                                        Created{' '}
                                                        {formatLocalizedDate(
                                                            program.created_at,
                                                            locale
                                                        )}
                                                    </p>
                                                    <div className="h-1 w-1 rounded-full bg-gray-200" />
                                                    <p className="text-xs font-bold text-gray-500">
                                                        {pts} pts / {cur} ETB
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span
                                                className={cn(
                                                    'rounded-xl border px-2.5 py-1 text-[10px] font-bold capitalize transition-all',
                                                    program.status === 'active'
                                                        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                                        : program.status === 'paused'
                                                          ? 'border-amber-100 bg-amber-50 text-amber-700'
                                                          : 'border-gray-200 bg-gray-100 text-gray-600'
                                                )}
                                            >
                                                {program.status}
                                            </span>

                                            <div className="ml-4 flex items-center gap-1">
                                                <button
                                                    onClick={() => handleEditInternal(program.id)}
                                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-400 shadow-sm transition-all hover:bg-gray-100 hover:text-gray-900 active:scale-[0.92] active:bg-gray-200"
                                                    title="Edit program"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                {onStatusChange && (
                                                    <button
                                                        onClick={() =>
                                                            void onStatusChange(
                                                                program.id,
                                                                program.status === 'active'
                                                                    ? 'paused'
                                                                    : 'active'
                                                            )
                                                        }
                                                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-400 shadow-sm transition-all hover:bg-gray-100 hover:text-gray-900 active:scale-[0.92] active:bg-gray-200"
                                                        title={
                                                            program.status === 'active'
                                                                ? 'Pause program'
                                                                : 'Activate program'
                                                        }
                                                    >
                                                        {program.status === 'active' ? (
                                                            <Pause className="h-4 w-4" />
                                                        ) : (
                                                            <Play className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button
                                                        onClick={() => void onDelete(program.id)}
                                                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-400 shadow-sm transition-all hover:bg-red-50 hover:text-red-600 active:scale-[0.92] active:bg-red-100"
                                                        title="Delete program"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

'use client';

export interface OnlineOrderingSettings {
    enabled: boolean;
    accepts_scheduled_orders: boolean;
    auto_accept_orders: boolean;
    prep_time_minutes: number;
    max_daily_orders: number;
    service_hours: { start: string; end: string };
    order_throttling_enabled: boolean;
    throttle_limit_per_15m: number;
}

interface OnlineOrderingSettingsPanelProps {
    loading: boolean;
    saving: boolean;
    error: string | null;
    settings: OnlineOrderingSettings;
    restaurantSlug: string | null;
    onChange: (settings: OnlineOrderingSettings) => void;
    onSave: () => void;
}

export function OnlineOrderingSettingsPanel({
    loading,
    saving,
    error,
    settings,
    restaurantSlug,
    onChange,
    onSave,
}: OnlineOrderingSettingsPanelProps): React.ReactElement {
    if (loading) {
        return (
            <section className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 w-48 rounded bg-gray-200" />
                    <div className="h-4 w-full rounded bg-gray-100" />
                    <div className="h-4 w-3/4 rounded bg-gray-100" />
                </div>
            </section>
        );
    }

    return (
        <section className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Online Ordering</h2>
                    {restaurantSlug && (
                        <p className="mt-1 text-sm text-gray-500">
                            Slug: <span className="font-mono">{restaurantSlug}</span>
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={saving}
                    className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="space-y-4">
                <label className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={settings.enabled}
                        onChange={e => onChange({ ...settings, enabled: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Accept online orders</span>
                </label>

                <label className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={settings.auto_accept_orders}
                        onChange={e =>
                            onChange({ ...settings, auto_accept_orders: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Auto-accept orders</span>
                </label>

                <label className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={settings.accepts_scheduled_orders}
                        onChange={e =>
                            onChange({ ...settings, accepts_scheduled_orders: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">
                        Accept scheduled orders
                    </span>
                </label>

                <label className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={settings.order_throttling_enabled}
                        onChange={e =>
                            onChange({ ...settings, order_throttling_enabled: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">
                        Enable order throttling
                    </span>
                </label>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Prep time (min)
                        </label>
                        <input
                            type="number"
                            value={settings.prep_time_minutes}
                            onChange={e =>
                                onChange({
                                    ...settings,
                                    prep_time_minutes: Number(e.target.value),
                                })
                            }
                            min={1}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Max daily orders
                        </label>
                        <input
                            type="number"
                            value={settings.max_daily_orders}
                            onChange={e =>
                                onChange({ ...settings, max_daily_orders: Number(e.target.value) })
                            }
                            min={1}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Service start
                        </label>
                        <input
                            type="time"
                            value={settings.service_hours.start}
                            onChange={e =>
                                onChange({
                                    ...settings,
                                    service_hours: {
                                        ...settings.service_hours,
                                        start: e.target.value,
                                    },
                                })
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Service end
                        </label>
                        <input
                            type="time"
                            value={settings.service_hours.end}
                            onChange={e =>
                                onChange({
                                    ...settings,
                                    service_hours: {
                                        ...settings.service_hours,
                                        end: e.target.value,
                                    },
                                })
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                    </div>
                </div>

                {settings.order_throttling_enabled && (
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Throttle limit (per 15 min)
                        </label>
                        <input
                            type="number"
                            value={settings.throttle_limit_per_15m}
                            onChange={e =>
                                onChange({
                                    ...settings,
                                    throttle_limit_per_15m: Number(e.target.value),
                                })
                            }
                            min={1}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                    </div>
                )}
            </div>
        </section>
    );
}

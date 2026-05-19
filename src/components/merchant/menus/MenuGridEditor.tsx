'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Edit2, Image as ImageIcon, Loader2, Plus, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyCompact } from '@/lib/utils/monetary';
import type { CategoryWithItems, MenuItemSummary } from '@/lib/services/dashboardDataService';

export interface InlineMenuItemPatch {
    name: string;
    price: number;
    description: string | null;
    is_available: boolean;
}

export interface BulkPriceUpdate {
    id: string;
    price: number;
}

interface MenuGridEditorProps {
    category: CategoryWithItems;
    readOnly?: boolean;
    onAddItem: (category: CategoryWithItems) => void;
    onOpenAdvancedEdit: (category: CategoryWithItems, item: MenuItemSummary) => void;
    onSaveInline: (item: MenuItemSummary, patch: InlineMenuItemPatch) => Promise<void>;
    onBulkAvailabilityUpdate: (itemIds: string[], isAvailable: boolean) => Promise<void>;
    onBulkPriceUpdate: (updates: BulkPriceUpdate[]) => Promise<void>;
}

interface FormState {
    name: string;
    price: string;
    description: string;
    is_available: boolean;
}

export function MenuGridEditor({
    category,
    readOnly = false,
    onAddItem,
    onOpenAdvancedEdit,
    onSaveInline,
    onBulkAvailabilityUpdate,
    onBulkPriceUpdate,
}: MenuGridEditorProps): React.JSX.Element {
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [formState, setFormState] = useState<FormState | null>(null);
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkSaving, setIsBulkSaving] = useState(false);
    const [isBulkPriceModalOpen, setIsBulkPriceModalOpen] = useState(false);
    const [bulkPriceMode, setBulkPriceMode] = useState<'set' | 'increase_percent'>('set');
    const [bulkPriceValue, setBulkPriceValue] = useState('');
    const [bulkPriceError, setBulkPriceError] = useState<string | null>(null);

    const editingItem = useMemo(
        () => (category.items ?? []).find(item => item.id === editingItemId) ?? null,
        [category.items, editingItemId]
    );
    const selectedCount = selectedIds.length;
    const selectedItems = useMemo(
        () => (category.items ?? []).filter(item => selectedIds.includes(item.id)),
        [category.items, selectedIds]
    );

    useEffect(() => {
        setIsSelectionMode(false);
        setSelectedIds([]);
    }, [category.id]);

const startInlineEdit = (item: MenuItemSummary): void => {
         if (readOnly) return;
         setEditingItemId(item.id);
         setFieldError(null);
         setFormState({
             name: item.name,
             price: (item.price ?? 0).toString(),
             description: item.description ?? '',
             is_available: item.is_available ?? true,
         });
     };

     const cancelInlineEdit = (): void => {
         if (isSaving) return;
         setEditingItemId(null);
         setFormState(null);
         setFieldError(null);
     };

    const validateInlineForm = (): InlineMenuItemPatch | null => {
        if (!formState) return null;

        const trimmedName = formState.name.trim();
        if (!trimmedName) {
            setFieldError('Name is required.');
            return null;
        }
        if (trimmedName.length > 200) {
            setFieldError('Name is too long (max 200).');
            return null;
        }

        const parsedPrice = Number.parseFloat(formState.price);
        if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
            setFieldError('Price must be greater than 0.');
            return null;
        }
        if (parsedPrice > 999999.99) {
            setFieldError('Price is too high.');
            return null;
        }

        const normalizedDescription = formState.description.trim();
        if (normalizedDescription.length > 1000) {
            setFieldError('Description is too long (max 1000).');
            return null;
        }

        return {
            name: trimmedName,
            price: parsedPrice,
            description: normalizedDescription.length > 0 ? normalizedDescription : null,
            is_available: formState.is_available,
        };
    };

    const saveInlineEdit = async (): Promise<void> => {
        if (!editingItem || !formState) return;

        const payload = validateInlineForm();
        if (!payload) return;

        try {
            setIsSaving(true);
            setFieldError(null);
            await onSaveInline(editingItem, payload);
            setEditingItemId(null);
            setFormState(null);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save menu item.';
            setFieldError(message);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleSelection = (itemId: string): void => {
        setSelectedIds(previous =>
            previous.includes(itemId) ? previous.filter(id => id !== itemId) : [...previous, itemId]
        );
    };

    const runBulkAvailabilityUpdate = async (isAvailable: boolean): Promise<void> => {
        if (selectedIds.length === 0) return;
        try {
            setIsBulkSaving(true);
            await onBulkAvailabilityUpdate(selectedIds, isAvailable);
            setSelectedIds([]);
            setIsSelectionMode(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Bulk update failed.';
            setFieldError(message);
        } finally {
            setIsBulkSaving(false);
        }
    };

    const computeBulkPriceUpdates = useCallback((): {
        updates: BulkPriceUpdate[] | null;
        error: string | null;
    } => {
        const parsedValue = Number.parseFloat(bulkPriceValue);
        if (!Number.isFinite(parsedValue)) {
            return { updates: null, error: 'Enter a valid number.' };
        }

        if (bulkPriceMode === 'set' && parsedValue <= 0) {
            return { updates: null, error: 'Set price must be greater than 0.' };
        }

        if (bulkPriceMode === 'increase_percent' && parsedValue < -90) {
            return { updates: null, error: 'Percent decrease cannot be less than -90%.' };
        }

        const updates = selectedItems.map(item => {
            const currentPrice = item.price ?? 0;
            const nextPrice =
                bulkPriceMode === 'set' ? parsedValue : currentPrice * (1 + parsedValue / 100);

            return {
                id: item.id,
                price: Number(nextPrice.toFixed(2)),
            };
        });

        if (updates.some(update => update.price <= 0)) {
            return { updates: null, error: 'Calculated price must remain above 0.' };
        }

        return { updates, error: null };
    }, [bulkPriceMode, bulkPriceValue, selectedItems]);

    const previewResult = useMemo(() => computeBulkPriceUpdates(), [computeBulkPriceUpdates]);

    const applyBulkPriceUpdates = async (): Promise<void> => {
        const result = computeBulkPriceUpdates();
        if (result.error) {
            setBulkPriceError(result.error);
            return;
        }
        if (!result.updates || result.updates.length === 0) return;

        try {
            setIsBulkSaving(true);
            setBulkPriceError(null);
            await onBulkPriceUpdate(result.updates);
            setIsBulkPriceModalOpen(false);
            setIsSelectionMode(false);
            setSelectedIds([]);
            setBulkPriceValue('');
            setBulkPriceMode('set');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Bulk price update failed.';
            setBulkPriceError(message);
        } finally {
            setIsBulkSaving(false);
        }
    };

    return (
        <div className="space-y-3">
            {!readOnly && (
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => {
                            setIsSelectionMode(value => !value);
                            setSelectedIds([]);
                            setFieldError(null);
                        }}
                        className="h-9 rounded-xl bg-white px-3 text-xs font-semibold text-gray-700 shadow-none transition-shadow hover:shadow-none"
                    >
                        {isSelectionMode ? 'Cancel Selection' : 'Select Multiple'}
                    </button>
                    {isSelectionMode && selectedCount > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500">
                                {selectedCount} selected
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setBulkPriceError(null);
                                    setIsBulkPriceModalOpen(true);
                                }}
                                disabled={isBulkSaving}
                                className="h-9 rounded-xl bg-white px-3 text-xs font-semibold text-gray-700 shadow-none transition-shadow hover:shadow-none disabled:opacity-50"
                            >
                                Bulk Price
                            </button>
                            <button
                                type="button"
                                onClick={() => runBulkAvailabilityUpdate(true)}
                                disabled={isBulkSaving}
                                className="h-9 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {isBulkSaving ? 'Updating...' : 'Mark In Stock'}
                            </button>
                            <button
                                type="button"
                                onClick={() => runBulkAvailabilityUpdate(false)}
                                disabled={isBulkSaving}
                                className="h-9 rounded-xl bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-black disabled:opacity-50"
                            >
                                {isBulkSaving ? 'Updating...' : 'Mark Sold Out'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <button
                    onClick={() => onAddItem(category)}
                    className="group flex h-[340px] w-full flex-col items-center justify-center gap-4 rounded-3xl border border-gray-100 bg-gray-50 shadow-none transition-all hover:bg-white"
                >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-none transition-transform group-hover:scale-110">
                        <Plus className="h-5 w-5 text-gray-400 group-hover:text-black" />
                    </div>
                    <span className="font-bold text-gray-400 group-hover:text-black">
                        Add New Item
                    </span>
                </button>

                {(category.items ?? []).map(item => {
                    const isEditing = item.id === editingItemId;
                    return (
                        <div
                            key={item.id}
                            className="group relative flex h-[340px] flex-col gap-4 overflow-hidden rounded-3xl border border-gray-100 bg-white p-5 shadow-none transition-all"
                        >
                            {isSelectionMode && (
                                <label className="absolute top-3 right-3 z-10 cursor-pointer rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold text-gray-700 shadow-none">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(item.id)}
                                        onChange={() => toggleSelection(item.id)}
                                        disabled={isBulkSaving}
                                        className="mr-1"
                                    />
                                    Pick
                                </label>
                            )}

                            <div className="relative h-40 w-full flex-shrink-0 overflow-hidden rounded-[1.5rem] bg-gray-50">
                                {item.image_url ? (
                                    <Image
                                        src={item.image_url}
                                        alt={item.name}
                                        fill
                                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                                        <ImageIcon className="h-8 w-8" />
                                    </div>
                                )}
                                <div className="absolute top-3 left-3">
                                    <span
                                        className={cn(
                                            'rounded-full px-2 py-1 text-[10px] font-bold',
                                            (item.is_available ?? true)
                                                ? 'bg-green-50 text-green-600'
                                                : 'bg-gray-100 text-gray-600'
                                        )}
                                    >
                                        {(item.is_available ?? true) ? 'In Stock' : 'Sold Out'}
                                    </span>
                                </div>
                            </div>

                            {!isEditing && (
                                <>
                                    <div className="space-y-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="line-clamp-1 leading-tight font-bold text-gray-900">
                                                {item.name}
                                            </h3>
                                            <span className="font-bold whitespace-nowrap text-black">
                                                {formatCurrencyCompact(item.price ?? 0)}
                                            </span>
                                        </div>
                                        <p className="line-clamp-2 text-xs leading-relaxed font-medium text-gray-500">
                                            {item.description || 'No description provided.'}
                                        </p>
                                    </div>
                                    <div className="mt-auto flex items-center justify-between gap-2 px-1">
                                        <button
                                            type="button"
                                            onClick={() => startInlineEdit(item)}
                                            disabled={readOnly || isSelectionMode}
                                            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-gray-100 bg-white text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 hover:text-black disabled:opacity-50"
                                        >
                                            <Edit2 className="h-3.5 w-3.5" />
                                            Inline Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onOpenAdvancedEdit(category, item)}
                                            disabled={isSelectionMode}
                                            className="h-9 flex-1 rounded-2xl border border-gray-100 bg-white text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 hover:text-black disabled:opacity-50"
                                        >
                                            Advanced
                                        </button>
                                    </div>
                                </>
                            )}

                            {isEditing && formState && (
                                <div className="space-y-2">
                                    <input
                                        value={formState.name}
                                        onChange={event =>
                                            setFormState(prev =>
                                                prev ? { ...prev, name: event.target.value } : prev
                                            )
                                        }
                                        placeholder="Item name"
                                        maxLength={200}
                                        disabled={isSaving}
                                        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-gray-400"
                                    />
                                    <input
                                        type="number"
                                        value={formState.price}
                                        onChange={event =>
                                            setFormState(prev =>
                                                prev ? { ...prev, price: event.target.value } : prev
                                            )
                                        }
                                        placeholder="Price"
                                        min="0.01"
                                        step="0.01"
                                        disabled={isSaving}
                                        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-gray-400"
                                    />
                                    <textarea
                                        value={formState.description}
                                        onChange={event =>
                                            setFormState(prev =>
                                                prev
                                                    ? { ...prev, description: event.target.value }
                                                    : prev
                                            )
                                        }
                                        placeholder="Description"
                                        maxLength={1000}
                                        disabled={isSaving}
                                        className="min-h-16 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-gray-400"
                                    />
                                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={formState.is_available}
                                            onChange={event =>
                                                setFormState(prev =>
                                                    prev
                                                        ? {
                                                              ...prev,
                                                              is_available: event.target.checked,
                                                          }
                                                        : prev
                                                )
                                            }
                                            disabled={isSaving}
                                        />
                                        Available
                                    </label>

                                    {fieldError && (
                                        <p className="text-xs text-red-600">{fieldError}</p>
                                    )}

                                    <div className="flex items-center gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={cancelInlineEdit}
                                            disabled={isSaving}
                                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-semibold text-gray-700 shadow-none transition-shadow hover:shadow-none disabled:opacity-50"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={saveInlineEdit}
                                            disabled={isSaving}
                                            className="bg-brand-accent inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-black hover:brightness-105 disabled:opacity-50"
                                        >
                                            {isSaving ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Save className="h-3.5 w-3.5" />
                                            )}
                                            Save
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {isBulkPriceModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-gray-900">Bulk price update</h3>
                        <p className="text-sm text-gray-600">
                            Review price changes for {selectedCount} selected item(s) before
                            applying.
                        </p>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <label className="space-y-1">
                                <span className="text-xs font-semibold text-gray-600">
                                    Update mode
                                </span>
                                <select
                                    value={bulkPriceMode}
                                    onChange={event => {
                                        setBulkPriceMode(
                                            event.target.value as 'set' | 'increase_percent'
                                        );
                                        setBulkPriceError(null);
                                    }}
                                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                                >
                                    <option value="set">Set absolute price</option>
                                    <option value="increase_percent">Adjust by percent (%)</option>
                                </select>
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-semibold text-gray-600">
                                    {bulkPriceMode === 'set' ? 'New price' : 'Percent adjustment'}
                                </span>
                                <input
                                    type="number"
                                    value={bulkPriceValue}
                                    onChange={event => {
                                        setBulkPriceValue(event.target.value);
                                        setBulkPriceError(null);
                                    }}
                                    step="0.01"
                                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                                />
                            </label>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-3 shadow-inner">
                            <div className="mb-2 text-xs font-semibold text-gray-500">Preview</div>
                            <div className="max-h-44 space-y-1 overflow-y-auto">
                                {(previewResult.updates ?? []).slice(0, 8).map(update => {
                                    const original = selectedItems.find(
                                        item => item.id === update.id
                                    );
                                    if (!original) return null;
                                    return (
                                        <div
                                            key={update.id}
                                            className="flex items-center justify-between text-sm"
                                        >
                                            <span className="line-clamp-1 pr-2 text-gray-700">
                                                {original.name}
                                            </span>
                                            <span className="font-semibold text-gray-900">
                                                {formatCurrencyCompact(original.price ?? 0)}
                                                {' -> '}
                                                {formatCurrencyCompact(update.price)}
                                            </span>
                                        </div>
                                    );
                                })}
                                {selectedCount > 8 && (
                                    <p className="pt-1 text-xs text-gray-500">
                                        + {selectedCount - 8} more item(s)
                                    </p>
                                )}
                            </div>
                        </div>

                        {(bulkPriceError || previewResult.error) && (
                            <p className="text-sm text-red-600">
                                {bulkPriceError || previewResult.error}
                            </p>
                        )}

                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsBulkPriceModalOpen(false)}
                                disabled={isBulkSaving}
                                className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-gray-700 shadow-none transition-shadow hover:shadow-none disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={applyBulkPriceUpdates}
                                disabled={isBulkSaving}
                                className="bg-brand-accent inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-black hover:brightness-105 disabled:opacity-50"
                            >
                                {isBulkSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                                Apply Prices
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

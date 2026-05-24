'use client';

import React from 'react';
import { Building2, FileText, MapPin, BadgeCheck } from 'lucide-react';

import { ModernSelect } from '../../shared/ModernSelect';

export function BusinessInfoTab(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Business Information</h2>
                    <p className="text-sm text-gray-500">
                        Legal and tax compliance details for your restaurant entity.
                    </p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-[#DDF853]/20 bg-[#DDF853] px-3 py-1 text-[11px] font-bold text-black">
                    <BadgeCheck className="h-3 w-3" />
                    Verified Merchant
                </div>
            </div>

            {/* Legal Entity Details */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                        <FileText className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Legal Entity</h3>
                </div>

                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">
                            Legal Business Name
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                            placeholder="e.g. Lucia Hospitality Plc"
                            defaultValue="Lucia Hospitality Plc"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Tin Number 🇪🇹</label>
                        <input
                            type="text"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                            placeholder="0001234567"
                            defaultValue="0001234567"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">
                            Tax Registration Type
                        </label>
                        <ModernSelect
                            options={[
                                { value: 'vat', label: 'Vat Registered (15%)' },
                                { value: 'none', label: 'Non-registered' },
                            ]}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">
                            Business License #
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                            placeholder="AB/123/2016"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">
                            Trade Registration #
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                            placeholder="MT/AA/1/0001234/2008"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Entity Type</label>
                        <ModernSelect
                            options={[
                                { value: 'plc', label: 'Private Limited Company (Plc)' },
                                { value: 'sole', label: 'Sole Proprietorship' },
                                { value: 'share', label: 'Share Company (SC)' },
                            ]}
                        />
                    </div>
                </div>
            </div>

            {/* Control Person / Fayda ID */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <BadgeCheck className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">
                            Control Person (Ownership)
                        </h3>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Full Name</label>
                        <input
                            type="text"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                            placeholder="Abebe Bikila"
                            defaultValue="Abebe Bikila"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">
                            Fayda National ID 🇪🇹
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                            placeholder="1234 5678 9012"
                            defaultValue="1234 5678 9012"
                        />
                    </div>
                    <div className="flex flex-col justify-end space-y-2">
                        <label className="text-sm font-medium text-gray-400">
                            Fayda Verification Status
                        </label>
                        <div className="flex h-11 items-center justify-between rounded-xl border border-green-100 bg-green-50/30 px-4">
                            <span className="text-sm font-bold text-green-700">
                                Verified by NIDP
                            </span>
                            <BadgeCheck className="h-5 w-5 text-green-600" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Contact Email</label>
                        <input
                            type="email"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                            placeholder="owner@cafelucia.com"
                            defaultValue="owner@cafelucia.com"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Contact Phone</label>
                        <input
                            type="tel"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                            placeholder="+251 911 234 567"
                            defaultValue="+251 911 234 567"
                        />
                    </div>
                </div>
            </div>

            {/* Official Headquarters Address */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                        <MapPin className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Registered Address</h3>
                </div>

                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Region / City</label>
                        <ModernSelect
                            options={[
                                { value: 'aa', label: 'Addis Ababa' },
                                { value: 'or', label: 'Oromia' },
                                { value: 'am', label: 'Amhara' },
                                { value: 'sn', label: 'SNNPR' },
                                { value: 'ti', label: 'Tigray' },
                            ]}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Sub-city 🇪🇹</label>
                        <ModernSelect
                            options={[
                                { value: 'bole', label: 'Bole' },
                                { value: 'yeka', label: 'Yeka' },
                                { value: 'kirkos', label: 'Kirkos' },
                                { value: 'arada', label: 'Arada' },
                                { value: 'lideta', label: 'Lideta' },
                                { value: 'nifas', label: 'Nifas Silk-Lafto' },
                                { value: 'kolfe', label: 'Kolfe Keranio' },
                                { value: 'akaki', label: 'Akaki Kality' },
                                { value: 'gullele', label: 'Gullele' },
                                { value: 'addis', label: 'Addis Ketema' },
                            ]}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Woreda / Kebele</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="w-1/3 rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                placeholder="Woreda"
                            />
                            <input
                                type="text"
                                className="w-2/3 rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                placeholder="Kebele / House #"
                            />
                        </div>
                    </div>
                    <div className="space-y-2 md:col-span-2 lg:col-span-3">
                        <label className="text-sm font-medium text-gray-400">
                            Landmark / Specific Location 🇪🇹
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                            placeholder="e.g. Behind Edna Mall, Next to Mafi Building"
                        />
                    </div>
                </div>
            </div>

            {/* Compliance Documents */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Building2 className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Compliance Documents</h3>
                    </div>
                    <button className="text-[11px] font-bold text-blue-600 transition-colors hover:text-blue-700">
                        View All Uploads
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <FileText className="h-4 w-4 text-gray-400" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-900">
                                    Vat Registration Cert
                                </p>
                                <p className="text-[10px] text-gray-500">
                                    upload_vat_cert_2026.pdf
                                </p>
                            </div>
                        </div>
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-600">
                            Verified
                        </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <FileText className="h-4 w-4 text-gray-400" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-900">
                                    EFDA Safety Certificate
                                </p>
                                <p className="text-[10px] text-gray-500">Missing</p>
                            </div>
                        </div>
                        <button className="text-[10px] font-bold text-blue-600 hover:underline">
                            Upload Now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

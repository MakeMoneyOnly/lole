'use client';

import { CheckCircle2, FileText } from 'lucide-react';

export interface ActivityItemData {
    id: string;
    type: 'order' | 'kitchen' | 'request' | 'staff';
    user: string;
    action: string;
    target: string;
    time: string;
    hasMessage?: boolean;
    message?: string;
    hasFile?: boolean;
    fileName?: string;
    fileSize?: string;
}

interface ActivityItemProps {
    item: ActivityItemData;
}

export function ActivityItem({ item }: ActivityItemProps): React.JSX.Element {
    const dotColorClass =
        item.type === 'order'
            ? 'bg-red-500 shadow-none shadow-red-200'
            : item.type === 'kitchen'
              ? 'bg-green-500 shadow-none shadow-green-200'
              : item.type === 'request'
                ? 'bg-orange-500 shadow-none shadow-orange-200'
                : 'bg-blue-500 shadow-none shadow-blue-200';

    return (
        <div className="group animate-in slide-in-from-bottom-2 relative pl-12 duration-300">
            {/* Dot Color based on activity type */}
            <div
                className={`absolute top-1.5 left-0 z-10 h-3 w-3 rounded-full ring-4 ring-white ${dotColorClass} transition-all group-hover:scale-125`}
            />

            <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-gray-900 transition-colors group-hover:text-black">
                        {item.user}
                    </h4>
                </div>
                <span className="rounded-md bg-gray-50 px-2 py-1 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                    {item.time}
                </span>
            </div>

            <p className="mb-4 text-sm leading-relaxed font-medium text-gray-500">
                {item.action}{' '}
                <span className="cursor-pointer font-bold text-blue-600 decoration-2 underline-offset-2 hover:underline">
                    {item.target}
                </span>
            </p>

            {item.hasMessage && (
                <div className="relative mb-2 rounded-xl rounded-tl-none bg-[#EEF2FF] p-4 text-sm leading-relaxed font-medium text-[#4F46E5] transition-shadow group-hover:shadow-none">
                    "{item.message}"
                    <div className="absolute -right-2 -bottom-2 rounded-full border-4 border-white bg-yellow-400 p-1.5 shadow-none">
                        <span role="img" aria-label="note" className="block text-xs">
                            📝
                        </span>
                    </div>
                </div>
            )}

            {item.hasFile && (
                <div className="group/file flex cursor-pointer items-center gap-4 rounded-xl border border-green-100 bg-green-50 p-4 transition-colors hover:bg-green-100">
                    <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black shadow-none shadow-black/10 transition-transform group-hover/file:scale-110">
                        <FileText className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="flex-1">
                        <p className="line-clamp-1 text-sm font-bold text-gray-900">
                            {item.fileName}
                        </p>
                        <p className="mt-0.5 text-[10px] font-bold text-gray-400 uppercase">
                            {item.fileSize}
                        </p>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-green-200 bg-white text-green-500 shadow-none">
                        <CheckCircle2 className="h-4 w-4" />
                    </div>
                </div>
            )}
        </div>
    );
}

'use client';

import { Skeleton } from '@/components/ui/Skeleton';
import { ActivityItem, ActivityItemData } from './RightPanelActivityItem';

interface ActivityStreamProps {
    activities: ActivityItemData[];
    loading: boolean;
}

export function ActivityStream({ activities, loading }: ActivityStreamProps): React.JSX.Element {
    return (
        <div className="no-scrollbar relative flex-1 space-y-8 overflow-y-auto pr-2 pb-4">
            {/* Vertical Line */}
            <div className="absolute top-4 bottom-4 left-[18px] w-[2px] bg-gray-100/50" />

            {loading ? (
                /* Skeleton Loader */
                <div className="space-y-10 pt-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="relative pl-12">
                            <Skeleton className="absolute top-1 left-0 h-3 w-3 rounded-full" />
                            <div className="mb-3 flex items-center justify-between">
                                <Skeleton className="h-4 w-24 rounded-md" />
                                <Skeleton className="h-3 w-12 rounded-md" />
                            </div>
                            <Skeleton className="mb-3 h-4 w-full rounded-md" />
                            <Skeleton className="h-16 w-full rounded-xl" />
                        </div>
                    ))}
                </div>
            ) : activities.length === 0 ? (
                <div className="py-10 pl-8 text-center">
                    <p className="text-sm font-medium text-gray-400">No recent activity.</p>
                </div>
            ) : (
                activities.map(item => <ActivityItem key={item.id} item={item} />)
            )}
        </div>
    );
}

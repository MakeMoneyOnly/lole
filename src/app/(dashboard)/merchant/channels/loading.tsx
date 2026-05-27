import { Skeleton } from '@/components/ui/Skeleton';

export default function ChannelsLoading() {
    return (
        <div className="min-h-screen space-y-6 pb-20">
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-10 w-36 rounded-xl" />
                    <Skeleton className="h-4 w-64 rounded-lg" />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Skeleton className="h-64 rounded-[2rem]" />
                <Skeleton className="h-64 rounded-[2rem]" />
            </div>

            <Skeleton className="h-[400px] rounded-[2.5rem]" />
        </div>
    );
}

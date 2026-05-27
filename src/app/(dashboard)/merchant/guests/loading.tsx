import { Skeleton } from '@/components/ui/Skeleton';

export default function GuestsLoading() {
    return (
        <div className="min-h-screen space-y-6 pb-20">
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-10 w-36 rounded-xl" />
                    <Skeleton className="h-4 w-64 rounded-lg" />
                </div>
                <Skeleton className="h-10 w-32 rounded-full" />
            </div>

            <div className="flex gap-4">
                <Skeleton className="h-10 w-64 rounded-xl" />
                <Skeleton className="h-10 w-32 rounded-full" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <Skeleton key={i} className="h-48 rounded-[2rem]" />
                ))}
            </div>
        </div>
    );
}

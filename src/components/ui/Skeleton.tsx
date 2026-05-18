import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

function Skeleton({ className, ...props }: SkeletonProps): React.JSX.Element {
    return <div className={cn('animate-pulse rounded-md bg-gray-200/80', className)} {...props} />;
}

export { Skeleton };

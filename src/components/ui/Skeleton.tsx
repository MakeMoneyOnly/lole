import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
}

function Skeleton({
    className,
    ...props
}: SkeletonProps & React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
    return <div className={cn('animate-pulse rounded-md bg-gray-200/80', className)} {...props} />;
}

export { Skeleton };

import Link from 'next/link';

export default function DashboardNotFound(): React.JSX.Element {
    return (
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
            <h1 className="text-brand-primary mb-2 text-5xl font-bold">404</h1>
            <h2 className="text-brand-ink mb-1 text-xl font-semibold">Page Not Found</h2>
            <p className="mb-6 max-w-sm text-sm text-neutral-500">
                This page doesn&apos;t exist in your merchant dashboard.
            </p>
            <Link
                href="/merchant"
                className="bg-brand-primary hover:bg-brand-primary/90 rounded-full px-5 py-2 text-sm font-medium text-white transition-colors"
            >
                Back to Dashboard
            </Link>
        </div>
    );
}




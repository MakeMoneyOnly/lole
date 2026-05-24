import Link from 'next/link';

export default function NotFound(): React.JSX.Element {
    return (
        <div className="bg-brand-canvas flex min-h-screen flex-col items-center justify-center px-4 text-center">
            <h1 className="text-brand-primary mb-4 text-6xl font-bold">404</h1>
            <h2 className="text-brand-ink mb-2 text-2xl font-semibold">Page Not Found</h2>
            <p className="mb-8 max-w-md text-neutral-500">
                The page you are looking for does not exist or has been moved.
            </p>
            <div className="flex gap-4">
                <Link
                    href="/"
                    className="bg-brand-primary hover:bg-brand-primary/90 rounded-full px-6 py-3 text-sm font-medium text-white transition-colors"
                >
                    Go Home
                </Link>
                <Link
                    href="/login"
                    className="text-brand-ink rounded-full border border-neutral-200 px-6 py-3 text-sm font-medium transition-colors hover:bg-neutral-50"
                >
                    Sign In
                </Link>
            </div>
        </div>
    );
}

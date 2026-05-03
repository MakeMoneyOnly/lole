import Link from 'next/link';

export default function GuestNotFound() {
    return (
        <div className="bg-brand-canvas flex min-h-screen flex-col items-center justify-center px-4 text-center">
            <h1 className="text-brand-primary mb-3 text-4xl font-bold">Restaurant Not Found</h1>
            <p className="text-brand-ink mb-2 text-lg">
                We couldn&apos;t find a restaurant at this address.
            </p>
            <p className="mb-8 max-w-md text-sm text-neutral-500">
                Please check the URL or scan the QR code again. If you believe this is an error,
                contact the restaurant directly.
            </p>
            <Link
                href="/"
                className="bg-brand-primary hover:bg-brand-primary/90 rounded-full px-6 py-3 text-sm font-medium text-white transition-colors"
            >
                Visit Lole
            </Link>
        </div>
    );
}

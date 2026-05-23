import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SENTRY_HOST = 'o1000000.ingest.sentry.io';

export async function POST(request: NextRequest): Promise<NextResponse> {
    const envelope = await request.text();

    const projectId = process.env.NEXT_PUBLIC_SENTRY_DSN?.split('/').pop()?.split('?')[0];
    if (!projectId) {
        return NextResponse.json({ error: 'Sentry not configured' }, { status: 500 });
    }

    const sentryUrl = `https://${SENTRY_HOST}/api/${projectId}/envelope/`;

    const response = await fetch(sentryUrl, {
        method: 'POST',
        body: envelope,
        headers: {
            'Content-Type': 'application/x-sentry-envelope',
        },
    });

    return new NextResponse(response.body, {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
    });
}

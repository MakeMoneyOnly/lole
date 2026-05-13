import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    return NextResponse.json({ error: 'Use /api/v1/devices/pair instead' }, { status: 404 });
}

import { NextResponse } from 'next/server';

export async function GET() {
    const restaurants = [
        { id: '1', name: 'Ramen Lord', cuisine: 'Japanese', rating: 4.8 },
        { id: '2', name: 'Loco Chino', cuisine: 'Mexican', rating: 4.5 },
    ];

    return NextResponse.json({ data: restaurants });
}

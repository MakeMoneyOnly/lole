import { calculateFee } from '@/features/operations/delivery';

export async function GET(request: Request): Promise<Response> {
    return calculateFee(request as never);
}

export async function POST(request: Request): Promise<Response> {
    return calculateFee(request as never);
}

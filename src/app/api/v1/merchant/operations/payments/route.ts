import { createSession } from '@/features/operations/payments';

export async function POST(request: Request): Promise<Response> {
    return createSession(request);
}

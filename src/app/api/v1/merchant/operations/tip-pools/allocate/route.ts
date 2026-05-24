import { allocatePools } from '@/features/operations/tip-pools';

export async function POST(request: Request): Promise<Response> {
    return allocatePools(request);
}

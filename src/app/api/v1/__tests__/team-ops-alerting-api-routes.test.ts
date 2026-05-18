import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';

import {
    GET as getStaffSchedule,
    POST as postStaffSchedule,
} from '@/app/api/v1/merchant/core/staff/schedule/route';
import { POST as postStaffClock } from '@/app/api/v1/merchant/core/staff/time-entries/clock/route';
import {
    GET as getAlertRules,
    POST as postAlertRules,
} from '@/app/api/v1/internal/alerts/alerts/rules/route';
import { PATCH as patchAlertRule } from '@/app/api/v1/internal/alerts/alerts/rules/[ruleId]/route';
import {
    GET as getDashboardPresets,
    PATCH as patchDashboardPresets,
} from '@/app/api/v1/merchant/core/dashboard-presets/route';

vi.mock('@/lib/api/authz', () => ({
    getAuthenticatedUser: vi.fn(),
    getAuthorizedRestaurantContext: vi.fn(),
}));

const getAuthenticatedUserMock = vi.mocked(getAuthenticatedUser);
const getAuthorizedRestaurantContextMock = vi.mocked(getAuthorizedRestaurantContext);

function setAuthUnauthorized(): React.JSX.Element {
    getAuthenticatedUserMock.mockResolvedValue({
        ok: false,
        response: apiError('Unauthorized', 401, 'UNAUTHORIZED'),
    } as any);
}
function setAuthAndContextOk(): React.JSX.Element | void {
    getAuthenticatedUserMock.mockResolvedValue({
        ok: true,
        user: { id: 'user-1' },
        supabase: {},
    } as any);
    getAuthorizedRestaurantContextMock.mockResolvedValue({
        ok: true,
        restaurantId: 'resto-1',
        supabase,
    } as any);
}

describe('P1 Team Operations and Alerting API routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /api/v1/merchant/core/staff/schedule returns 401 when unauthorized', async () => {
        setAuthUnauthorized();

        const response = await getStaffSchedule(
            new Request('http://localhost/api/v1/merchant/core/staff/schedule')
        );

        expect(response.status).toBe(401);
    });

    it('POST /api/staff/schedule returns 400 for invalid payload', async () => {
        setAuthAndContextOk();

        const response = await postStaffSchedule(
            new Request('http://localhost/api/v1/merchant/core/staff/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staff_id: 'bad' }),
            })
        );

        expect(response.status).toBe(400);
    });

    it('POST /api/staff/time-entries/clock returns 400 for invalid payload', async () => {
        setAuthAndContextOk();

        const response = await postStaffClock(
            new Request('http://localhost/api/v1/merchant/core/staff/time-entries/clock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staff_id: 'bad', action: 'in' }),
            })
        );

        expect(response.status).toBe(400);
    });

    it('GET /api/alerts/rules returns 401 when unauthorized', async () => {
        setAuthUnauthorized();

        const response = await getAlertRules();

        expect(response.status).toBe(401);
    });

    it('POST /api/alerts/rules returns 400 for invalid payload', async () => {
        setAuthAndContextOk();

        const response = await postAlertRules(
            new Request('http://localhost/api/v1/internal/alerts/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'x', severity: 'medium' }),
            })
        );

        expect(response.status).toBe(400);
    });

    it('PATCH /api/alerts/rules/:id returns 400 for invalid id', async () => {
        setAuthAndContextOk();

        const response = await patchAlertRule(
            new Request('http://localhost/api/v1/internal/alerts/rules/not-a-uuid', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: true }),
            }),
            { params: Promise.resolve({ ruleId: 'not-a-uuid' }) }
        );

        expect(response.status).toBe(400);
    });

    it('GET /api/v1/merchant/core/dashboard-presets returns 401 when unauthorized', async () => {
        setAuthUnauthorized();

        const response = await getDashboardPresets();

        expect(response.status).toBe(401);
    });

    it('PATCH /api/v1/merchant/core/dashboard-presets returns 400 for invalid payload', async () => {
        setAuthAndContextOk();

        const response = await patchDashboardPresets(
            new Request('http://localhost/api/v1/merchant/core/dashboard-presets', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preset: 'invalid' }),
            })
        );

        expect(response.status).toBe(400);
    });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/authz', () => ({
    getAuthenticatedUser: vi.fn(),
    getAuthorizedRestaurantContext: vi.fn(),
}));

import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { POST as postSessionOpen } from '@/app/api/v1/merchant/operations/table-sessions/open/route';
import { POST as postSessionTransfer } from '@/app/api/v1/merchant/operations/table-sessions/[sessionId]/transfer/route';
import { POST as postSessionClose } from '@/app/api/v1/merchant/operations/table-sessions/[sessionId]/close/route';

type Row = Record<string, any>;
type TableStore = Record<string, Row[]>;

class QueryBuilder {
    private filters: Array<(row: Row) => boolean> = [];
    private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    private payload: Row | Row[] | null = null;

    constructor(
        private readonly table: string,
        private readonly store: TableStore
    ) {}

    select() {
        return this;
    }

    insert(payload: Row | Row[]) {
        this.op = 'insert';
        this.payload = payload;
        return this;
    }

    update(payload: Row) {
        this.op = 'update';
        this.payload = payload;
        return this;
    }

    delete() {
        this.op = 'delete';
        return this;
    }

    eq(field: string, value: unknown) {
        this.filters.push(row => row[field] === value);
        return this;
    }

    maybeSingle() {
        return Promise.resolve(this.executeSingle(false));
    }

    single() {
        return Promise.resolve(this.executeSingle(true));
    }

    then<TResult1 = any, TResult2 = never>(
        onfulfilled?:
            | ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>)
            | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
        return Promise.resolve(this.execute()).then(onfulfilled as any, onrejected as any);
    }

    private executeSingle(required: boolean) {
        const res = this.execute();
        const first = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
        if (required && !first) {
            return { data: null, error: { message: 'Row not found' } };
        }
        return { data: first, error: null };
    }

    private execute() {
        const tableRows = this.store[this.table] ?? [];
        const matched = tableRows.filter(row => this.filters.every(fn => fn(row)));

        if (this.op === 'insert') {
            const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(row => ({
                ...(row ?? {}),
                id: row?.id ?? crypto.randomUUID(),
                created_at: row?.created_at ?? new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }));
            tableRows.push(...rows);
            this.store[this.table] = tableRows;
            return { data: rows, error: null };
        }

        if (this.op === 'update') {
            const updated = matched.map(row =>
                Object.assign(row, this.payload ?? {}, { updated_at: new Date().toISOString() })
            );
            return { data: updated, error: null };
        }

        if (this.op === 'delete') {
            this.store[this.table] = tableRows.filter(row => !matched.includes(row));
            return { data: null, error: null };
        }

        return { data: matched, error: null };
    }
}

function createHarness() {
    const store: TableStore = {
        tables: [
            {
                id: '11111111-1111-4111-8111-111111111111',
                restaurant_id: 'rest-1',
                table_number: 'T1',
                status: 'available',
            },
            {
                id: '22222222-2222-4222-8222-222222222222',
                restaurant_id: 'rest-1',
                table_number: 'T2',
                status: 'available',
            },
        ],
        table_sessions: [],
    };

    const supabase = {
        from: (table: string) => new QueryBuilder(table, store),
    } as any;

    return { store, supabase };
}

describe('Table session lifecycle integration', () => {
    const getAuthenticatedUserMock = vi.mocked(getAuthenticatedUser);
    const getAuthorizedRestaurantContextMock = vi.mocked(getAuthorizedRestaurantContext);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('executes open -> transfer -> close lifecycle and updates table statuses', async () => {
        const harness = createHarness();
        getAuthenticatedUserMock.mockResolvedValue({
            ok: true,
            user: { id: 'staff-user-1' },
            supabase: harness.supabase,
        } as any);
        getAuthorizedRestaurantContextMock.mockResolvedValue({
            ok: true,
            restaurantId: 'rest-1',
            supabase: harness.supabase,
        } as any);

        const openResponse = await postSessionOpen(
            new Request('http://localhost/api/v1/merchant/operations/table-sessions/open', {
                method: 'POST',
                body: JSON.stringify({
                    table_id: '11111111-1111-4111-8111-111111111111',
                    guest_count: 2,
                    notes: 'walk-in',
                }),
                headers: { 'content-type': 'application/json' },
            })
        );
        expect(openResponse.status).toBe(201);
        const openBody = await openResponse.json();
        expect(openBody.data.status).toBe('open');
        expect(
            harness.store.tables.find(t => t.id === '11111111-1111-4111-8111-111111111111')?.status
        ).toBe('occupied');

        const transferResponse = await postSessionTransfer(
            new Request('http://localhost/api/v1/merchant/operations/table-sessions/session/transfer', {
                method: 'POST',
                body: JSON.stringify({
                    to_table_id: '22222222-2222-4222-8222-222222222222',
                    notes: 'moved to window',
                }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ sessionId: openBody.data.id }) }
        );
        expect(transferResponse.status).toBe(200);
        const transferBody = await transferResponse.json();
        expect(transferBody.data.previous_session_id).toBe(openBody.data.id);
        expect(transferBody.data.new_session.status).toBe('open');

        const oldSession = harness.store.table_sessions.find(s => s.id === openBody.data.id);
        expect(oldSession?.status).toBe('transferred');
        expect(
            harness.store.tables.find(t => t.id === '11111111-1111-4111-8111-111111111111')?.status
        ).toBe('available');
        expect(
            harness.store.tables.find(t => t.id === '22222222-2222-4222-8222-222222222222')?.status
        ).toBe('occupied');

        const closeResponse = await postSessionClose(
            new Request('http://localhost/api/v1/merchant/operations/table-sessions/session/close', {
                method: 'POST',
                body: JSON.stringify({ notes: 'bill settled' }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ sessionId: transferBody.data.new_session.id }) }
        );
        expect(closeResponse.status).toBe(200);
        const closeBody = await closeResponse.json();
        expect(closeBody.data.status).toBe('closed');
        expect(
            harness.store.tables.find(t => t.id === '22222222-2222-4222-8222-222222222222')?.status
        ).toBe('available');
    });

    it('rejects opening a table session when one is already open', async () => {
        const harness = createHarness();
        harness.store.table_sessions.push({
            id: '33333333-3333-4333-8333-333333333333',
            restaurant_id: 'rest-1',
            table_id: '11111111-1111-4111-8111-111111111111',
            status: 'open',
        });

        getAuthenticatedUserMock.mockResolvedValue({
            ok: true,
            user: { id: 'staff-user-1' },
            supabase: harness.supabase,
        } as any);
        getAuthorizedRestaurantContextMock.mockResolvedValue({
            ok: true,
            restaurantId: 'rest-1',
            supabase: harness.supabase,
        } as any);

        const response = await postSessionOpen(
            new Request('http://localhost/api/v1/merchant/operations/table-sessions/open', {
                method: 'POST',
                body: JSON.stringify({
                    table_id: '11111111-1111-4111-8111-111111111111',
                }),
                headers: { 'content-type': 'application/json' },
            })
        );
        const body = await response.json();

        expect(response.status).toBe(409);
        // Response has nested error object: { error: { code, message, requestId } }
        expect(body.error?.code).toBe('TABLE_SESSION_ALREADY_OPEN');
    });

    it('rejects transfer when destination table already has open session', async () => {
        const harness = createHarness();
        harness.store.table_sessions.push(
            {
                id: '44444444-4444-4444-8444-444444444444',
                restaurant_id: 'rest-1',
                table_id: '11111111-1111-4111-8111-111111111111',
                status: 'open',
            },
            {
                id: '55555555-5555-4555-8555-555555555555',
                restaurant_id: 'rest-1',
                table_id: '22222222-2222-4222-8222-222222222222',
                status: 'open',
            }
        );

        getAuthenticatedUserMock.mockResolvedValue({
            ok: true,
            user: { id: 'staff-user-1' },
            supabase: harness.supabase,
        } as any);
        getAuthorizedRestaurantContextMock.mockResolvedValue({
            ok: true,
            restaurantId: 'rest-1',
            supabase: harness.supabase,
        } as any);

        const response = await postSessionTransfer(
            new Request('http://localhost/api/v1/merchant/operations/table-sessions/session/transfer', {
                method: 'POST',
                body: JSON.stringify({
                    to_table_id: '22222222-2222-4222-8222-222222222222',
                }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ sessionId: '44444444-4444-4444-8444-444444444444' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(409);
        // Response has nested error object: { error: { code, message, requestId } }
        expect(body.error?.code).toBe('DESTINATION_TABLE_OCCUPIED');
    });
});

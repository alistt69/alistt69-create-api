import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    inFlightQueries,
    queryAbortControllers,
    queryEndpointByKey,
    queryGcTimeouts,
    queryKeySerializers,
    queryKeysByEndpoint,
    queryKeysByTag,
    queryListeners,
    queryRunners,
    queryStore,
    querySubscriptionsCount,
    queryTagResolvers,
    queryTagsByKey,
} from '../model/queryStore.js';
import { BaseQueryArgs, createApi } from './createApi.js';
import { fetchBaseQuery } from './fetchBaseQuery.js';
import type { BaseQueryResult } from '../model/types.js';

interface Ticket {
    id: string;
    title: string;
}

interface TicketsListResponse {
    page: number;
    items: Ticket[];
    callNo: number;
    servedAt: string;
}

interface TicketDetailResponse {
    id: string;
    title: string;
    callNo: number;
    servedAt: string;
}

interface EditTicketResponse {
    ok: true;
    editCallNo: number;
    ticket: Ticket;
    servedAt: string;
}

function resetQueryStore() {
    queryGcTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    queryStore.clear();
    queryListeners.clear();
    inFlightQueries.clear();
    queryRunners.clear();
    queryKeysByEndpoint.clear();
    queryEndpointByKey.clear();
    queryKeysByTag.clear();
    queryTagsByKey.clear();
    querySubscriptionsCount.clear();
    queryGcTimeouts.clear();
    queryAbortControllers.clear();
    queryKeySerializers.clear();
    queryTagResolvers.clear();
}

function wait(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(resolve, ms);

        signal?.addEventListener(
            'abort',
            () => {
                clearTimeout(timeoutId);
                reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
        );
    });
}

async function advance(ms: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

function setupApi() {
    const db: { tickets: Ticket[] } = {
        tickets: [
            { id: '1', title: 'Alpha' },
            { id: '2', title: 'Beta' },
            { id: '3', title: 'Gamma' },
            { id: '4', title: 'Delta' },
            { id: '5', title: 'Epsilon' },
            { id: '6', title: 'Zeta' },
        ],
    };

    const listCallsByPage = new Map<number, number>();
    const detailCallsById = new Map<string, number>();
    let editCalls = 0;

    const inc = (map: Map<number | string, number>, key: number | string) => {
        const next = (map.get(key) ?? 0) + 1;
        map.set(key, next);
        return next;
    };

    const baseQuery = async (args: BaseQueryArgs): Promise<BaseQueryResult<unknown>> => {
        const { url, method = 'GET', params, body, signal } = args;

        if (url === '/tickets' && method === 'GET') {
            const page = Number(params?.page ?? 1);
            await wait(page === 1 ? 1000 : 300, signal);

            if (page === 13) {
                return {
                    error: {
                        status: 400,
                        data: { message: 'Page 13 is forced to fail' },
                    },
                };
            }

            const callNo = inc(listCallsByPage, page);
            const pageSize = 2;
            const startIndex = (page - 1) * pageSize;
            const items = db.tickets.slice(startIndex, startIndex + pageSize);

            return {
                data: {
                    page,
                    items,
                    callNo,
                    servedAt: new Date().toISOString(),
                } satisfies TicketsListResponse,
            };
        }

        if (url.startsWith('/tickets/') && method === 'GET') {
            const id = url.split('/').pop() ?? '';
            await wait(id === '2' ? 200 : 100, signal);

            const callNo = inc(detailCallsById, id);
            const ticket = db.tickets.find((item) => item.id === id);

            if (!ticket) {
                return {
                    error: {
                        status: 404,
                        data: { message: `Ticket ${id} not found` },
                    },
                };
            }

            return {
                data: {
                    ...ticket,
                    callNo,
                    servedAt: new Date().toISOString(),
                } satisfies TicketDetailResponse,
            };
        }

        if (url.startsWith('/tickets/') && method === 'PATCH') {
            const id = url.split('/').pop() ?? '';
            const payload = body as { title: string; delayMs?: number } | undefined;
            await wait(payload?.delayMs ?? 100, signal);

            const ticket = db.tickets.find((item) => item.id === id);

            if (!ticket) {
                return {
                    error: {
                        status: 404,
                        data: { message: `Ticket ${id} not found` },
                    },
                };
            }

            if (!payload?.title?.trim()) {
                return {
                    error: {
                        status: 400,
                        data: { message: 'Title is empty' },
                    },
                };
            }

            ticket.title = payload.title;
            editCalls += 1;

            return {
                data: {
                    ok: true,
                    editCallNo: editCalls,
                    ticket: { ...ticket },
                    servedAt: new Date().toISOString(),
                } satisfies EditTicketResponse,
            };
        }

        return {
            error: {
                status: 500,
                data: { message: `Unhandled request: ${method} ${url}` },
            },
        };
    };

    const api = createApi({
        baseQuery,
        endpoints: (builder) => ({
            getTickets: builder.query<TicketsListResponse, { page: number }>({
                query: (args) => ({ url: '/tickets', method: 'GET', params: args }),
                keepUnusedDataFor: 5000,
            }),
            getTicketById: builder.query<TicketDetailResponse, string>({
                query: (id) => ({ url: `/tickets/${id}`, method: 'GET' }),
                serializeArgs: (id) => id,
                staleTime: 2000,
                keepUnusedDataFor: 10000,
                providesTags: (_result, arg) => [`Ticket/${arg}`],
            }),
            editTicket: builder.mutation<EditTicketResponse, { id: string; title: string; delayMs?: number }>({
                query: (payload) => ({ url: `/tickets/${payload.id}`, method: 'PATCH', body: payload }),
                invalidates: ['getTickets'],
                invalidatesTags: (_result, arg) => [`Ticket/${arg.id}`],
            }),
        }),
    });

    return { api, calls: { listCallsByPage, detailCallsById } };
}

describe('createApi core', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetQueryStore();
    });

    afterEach(() => {
        resetQueryStore();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('dedupes same query key across consumers', async () => {
        const { api, calls } = setupApi();

        const first = renderHook(() => api.useGetTicketsQuery({ page: 1 }));
        const second = renderHook(() => api.useGetTicketsQuery({ page: 1 }));

        expect(calls.listCallsByPage.get(1)).toBeUndefined();

        await advance(1000);

        expect(first.result.current.data?.callNo).toBe(1);
        expect(second.result.current.data?.callNo).toBe(1);
        expect(calls.listCallsByPage.get(1)).toBe(1);
    });

    it('does not refetch fresh cached data on remount before staleTime', async () => {
        const { api, calls } = setupApi();

        const first = renderHook(() => api.useGetTicketByIdQuery('2'));
        await advance(200);
        expect(first.result.current.data?.callNo).toBe(1);

        first.unmount();
        await advance(1000);

        const second = renderHook(() => api.useGetTicketByIdQuery('2'));

        expect(second.result.current.data?.callNo).toBe(1);
        expect(second.result.current.isFetching).toBe(false);
        expect(calls.detailCallsById.get('2')).toBe(1);
    });

    it('uses cached stale data immediately and background-refetches on remount after staleTime', async () => {
        const { api, calls } = setupApi();

        const first = renderHook(() => api.useGetTicketByIdQuery('2'));
        await advance(200);
        expect(first.result.current.data?.callNo).toBe(1);

        first.unmount();
        await advance(4000);

        const second = renderHook(() => api.useGetTicketByIdQuery('2'));

        expect(second.result.current.data?.callNo).toBe(1);
        expect(second.result.current.isFetching).toBe(true);

        await advance(200);

        expect(second.result.current.data?.callNo).toBe(2);
        expect(second.result.current.isFetching).toBe(false);
        expect(calls.detailCallsById.get('2')).toBe(2);
    });

    it('drops cache after keepUnusedDataFor and performs initial load again', async () => {
        const { api, calls } = setupApi();

        const first = renderHook(() => api.useGetTicketByIdQuery('2'));
        await advance(200);
        expect(first.result.current.data?.callNo).toBe(1);

        first.unmount();
        await advance(11000);

        const second = renderHook(() => api.useGetTicketByIdQuery('2'));

        expect(second.result.current.isLoading).toBe(true);
        expect(second.result.current.data).toBeUndefined();

        await advance(200);
        expect(second.result.current.data?.callNo).toBe(2);
        expect(calls.detailCallsById.get('2')).toBe(2);
    });

    it('lazy query keeps last visible state but allows older request to populate cache', async () => {
        const { api } = setupApi();

        const lazy = renderHook(() => api.useLazyGetTicketsQuery());

        act(() => {
            void lazy.result.current[0]({ page: 1 }).catch(() => undefined);
            void lazy.result.current[0]({ page: 2 }).catch(() => undefined);
        });

        await advance(300);
        expect(lazy.result.current[1].data?.page).toBe(2);
        expect(api.util.getQueryData<TicketsListResponse>('getTickets', { page: 1 })).toBeUndefined();

        await advance(700);
        expect(lazy.result.current[1].data?.page).toBe(2);
        expect(api.util.getQueryData<TicketsListResponse>('getTickets', { page: 1 })?.page).toBe(1);
        expect(api.util.getQueryData<TicketsListResponse>('getTickets', { page: 2 })?.page).toBe(2);
    });

    it('lazy query does not abort in-flight request on unmount', async () => {
        const { api } = setupApi();

        const lazy = renderHook(() => api.useLazyGetTicketsQuery());

        act(() => {
            void lazy.result.current[0]({ page: 1 });
        });

        lazy.unmount();
        await advance(1000);

        expect(api.util.getQueryData<TicketsListResponse>('getTickets', { page: 1 })?.page).toBe(1);
    });

    it('mutation state is latest-wins', async () => {
        const { api } = setupApi();

        const mutation = renderHook(() => api.useEditTicketMutation());

        act(() => {
            void mutation.result.current[0]({ id: '1', title: 'slow', delayMs: 1000 }).catch(() => undefined);
            void mutation.result.current[0]({ id: '1', title: 'fast', delayMs: 200 }).catch(() => undefined);
        });

        await advance(200);
        expect(mutation.result.current[1].data?.ticket.title).toBe('fast');

        await advance(800);
        expect(mutation.result.current[1].data?.ticket.title).toBe('fast');
    });

    it('does not run query when enabled is false', async () => {
        const { api, calls } = setupApi();

        const query = renderHook(() => api.useGetTicketByIdQuery('2', { enabled: false }));

        await advance(500);

        expect(query.result.current.data).toBeUndefined();
        expect(query.result.current.isLoading).toBe(false);
        expect(calls.detailCallsById.get('2')).toBeUndefined();
    });

    it('allows manual refetch when enabled is false', async () => {
        const { api, calls } = setupApi();

        const query = renderHook(() => api.useGetTicketByIdQuery('2', { enabled: false }));

        await act(async () => {
            void query.result.current.refetch();
        });

        await advance(200);

        expect(query.result.current.data?.id).toBe('2');
        expect(calls.detailCallsById.get('2')).toBe(1);
    });

    it('stores query error when baseQuery returns error', async () => {
        const { api } = setupApi();

        const query = renderHook(() => api.useGetTicketsQuery({ page: 13 }));

        await advance(1000);

        expect(query.result.current.data).toBeUndefined();
        expect(query.result.current.error).toEqual({
            status: 400,
            data: { message: 'Page 13 is forced to fail' },
        });
        expect(query.result.current.isLoading).toBe(false);
    });

    it('stores mutation error when mutation fails', async () => {
        const { api } = setupApi();

        const mutation = renderHook(() => api.useEditTicketMutation());

        act(() => {
            void mutation.result.current[0]({ id: '1', title: '', delayMs: 100 }).catch(() => undefined);
        });

        await advance(100);

        expect(mutation.result.current[1].data).toBeUndefined();
        expect(mutation.result.current[1].error).toEqual({
            status: 400,
            data: { message: 'Title is empty' },
        });
    });

    it('resets mutation state', async () => {
        const { api } = setupApi();

        const mutation = renderHook(() => api.useEditTicketMutation());

        act(() => {
            void mutation.result.current[0]({ id: '1', title: 'reset-me', delayMs: 100 }).catch(() => undefined);
        });

        await advance(100);

        expect(mutation.result.current[1].data?.ticket.title).toBe('reset-me');

        act(() => {
            mutation.result.current[1].reset();
        });

        expect(mutation.result.current[1].data).toBeUndefined();
        expect(mutation.result.current[1].error).toBeUndefined();
        expect(mutation.result.current[1].isLoading).toBe(false);
    });

    it('supports util setQueryData and updateQueryData', async () => {
        const { api } = setupApi();

        act(() => {
            api.util.setQueryData<TicketDetailResponse>('getTicketById', '2', {
                id: '2',
                title: 'Local',
                callNo: 999,
                servedAt: 'now',
            });
        });

        expect(api.util.getQueryData<TicketDetailResponse>('getTicketById', '2')?.title).toBe('Local');

        act(() => {
            api.util.updateQueryData<TicketDetailResponse>('getTicketById', '2', (prev) => ({
                ...prev!,
                title: 'Updated Local',
            }));
        });

        expect(api.util.getQueryData<TicketDetailResponse>('getTicketById', '2')?.title).toBe('Updated Local');
    });

    it('supports blob response via custom responseHandler', async () => {
        const bytes = new Uint8Array([1, 2, 3, 4]);

        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: vi.fn(async () => new Response(bytes, {
                status: 200,
                headers: { 'content-type': 'application/octet-stream' },
            })) as typeof fetch,
        });

        const result = await baseQuery({
            url: '/file',
            responseHandler: (response) => response.blob(),
        });

        expect('data' in result).toBe(true);

        if ('data' in result) {
            const blobLike = result.data as Blob;
            expect(typeof blobLike.arrayBuffer).toBe('function');
            expect(blobLike.size).toBe(4);
            expect(blobLike.type).toBe('application/octet-stream');
        }
    });

    it('content-type responseHandler falls back to text for non-json binary content', async () => {
        const bytes = new Uint8Array([65, 66, 67]);

        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: vi.fn(async () => new Response(bytes, {
                status: 200,
                headers: { 'content-type': 'application/octet-stream' },
            })) as typeof fetch,
        });

        const result = await baseQuery({
            url: '/binary',
            responseHandler: 'content-type',
        });

        expect('data' in result).toBe(true);

        if ('data' in result) {
            expect(typeof result.data).toBe('string');
        }
    });

    it('does not json-stringify Blob body', async () => {
        const bodyBlob = new Blob(['hello'], { type: 'text/plain' });

        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            expect(String(input)).toBe('https://api.example.com/upload-blob');
            expect(init?.headers).toBeDefined();

            const headers = new Headers(init?.headers);
            expect(headers.get('content-type')).not.toBe('application/json');

            expect(init?.body).toBe(bodyBlob);

            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        });

        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: fetchMock as typeof fetch,
        });

        const result = await baseQuery({
            url: '/upload-blob',
            method: 'POST',
            body: bodyBlob,
        });

        expect('data' in result && result.data).toEqual({ ok: true });
    });

    it('lazy query transforms error response only once', async () => {
        const transformErrorResponse = vi.fn((error) => ({
            wrapped: error,
        }));

        const api = createApi({
            baseQuery: async () => ({
                error: { status: 500, data: { message: 'fail' } },
            }),
            endpoints: (builder) => ({
                getBroken: builder.query<unknown, string>({
                    query: (id) => ({ url: `/broken/${id}` }),
                    transformErrorResponse,
                }),
            }),
        });

        const lazy = renderHook(() => api.useLazyGetBrokenQuery());

        await act(async () => {
            await expect(lazy.result.current[0]('1')).rejects.toEqual({
                wrapped: { status: 500, data: { message: 'fail' } },
            });
        });

        expect(transformErrorResponse).toHaveBeenCalledTimes(1);
        expect(lazy.result.current[1].error).toEqual({
            wrapped: { status: 500, data: { message: 'fail' } },
        });
    });

    it('setQueryData refreshes cache freshness and notifies subscribers', async () => {
        vi.useFakeTimers();
        const { api, calls } = setupApi();

        const first = renderHook(() => api.useGetTicketByIdQuery('2'));
        await advance(200);

        expect(first.result.current.data?.callNo).toBe(1);

        await advance(3000); // staleTime = 2000

        act(() => {
            api.util.setQueryData<TicketDetailResponse>('getTicketById', '2', {
                id: '2',
                title: 'Local Fresh',
                callNo: 999,
                servedAt: 'local',
            });
        });

        expect(first.result.current.data?.title).toBe('Local Fresh');
        expect(first.result.current.data?.callNo).toBe(999);

        first.unmount();

        const second = renderHook(() => api.useGetTicketByIdQuery('2'));

        expect(second.result.current.data?.title).toBe('Local Fresh');
        expect(second.result.current.isFetching).toBe(false);
        expect(calls.detailCallsById.get('2')).toBe(1);

        await advance(200);

        expect(calls.detailCallsById.get('2')).toBe(1);
    });

    it('invalidates unused cached queries kept by keepUnusedDataFor', async () => {
        const { api, calls } = setupApi();

        const query = renderHook(() => api.useGetTicketsQuery({ page: 1 }));
        await advance(1000);

        expect(query.result.current.data?.callNo).toBe(1);

        query.unmount();

        const mutation = renderHook(() => api.useEditTicketMutation());

        act(() => {
            void mutation.result.current[0]({ id: '1', title: 'After Mutation', delayMs: 100 });
        });

        await advance(100);
        await advance(1000);
        expect(calls.listCallsByPage.get(1)).toBe(2);

        const remounted = renderHook(() => api.useGetTicketsQuery({ page: 1 }));

        expect(remounted.result.current.data?.callNo).toBe(2);
        expect(remounted.result.current.data?.items[0]?.title).toBe('After Mutation');
    });

    it('keeps query runner bound to the original arg snapshot for old cache keys', async () => {
        const { api } = setupApi();

        const query = renderHook(
            ({ id }) => api.useGetTicketByIdQuery(id),
            { initialProps: { id: '1' } },
        );

        await advance(100);
        expect(api.util.getQueryData<TicketDetailResponse>('getTicketById', '1')?.id).toBe('1');

        query.rerender({ id: '2' });
        await advance(200);
        expect(api.util.getQueryData<TicketDetailResponse>('getTicketById', '2')?.id).toBe('2');

        act(() => {
            void query.result.current.refetch();
        });

        await advance(200);

        expect(api.util.getQueryData<TicketDetailResponse>('getTicketById', '1')?.id).toBe('1');
        expect(api.util.getQueryData<TicketDetailResponse>('getTicketById', '2')?.id).toBe('2');
    });

    it('setQueryData refreshes cache freshness and notifies subscribers', async () => {
        const { api, calls } = setupApi();

        const first = renderHook(() => api.useGetTicketByIdQuery('2'));
        await advance(200);
        expect(first.result.current.data?.callNo).toBe(1);

        await advance(3000);

        act(() => {
            api.util.setQueryData<TicketDetailResponse>('getTicketById', '2', {
                id: '2',
                title: 'Local Fresh',
                callNo: 999,
                servedAt: 'local',
            });
        });

        expect(first.result.current.data?.title).toBe('Local Fresh');
        expect(first.result.current.data?.callNo).toBe(999);

        first.unmount();

        const second = renderHook(() => api.useGetTicketByIdQuery('2'));

        expect(second.result.current.data?.title).toBe('Local Fresh');
        expect(second.result.current.isFetching).toBe(false);
        expect(calls.detailCallsById.get('2')).toBe(1);
    });
});

describe('fetchBaseQuery', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('returns data and meta for successful json response', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            expect(String(input)).toBe('https://api.example.com/tickets?page=2&search=bug');
            expect(init?.method).toBe('GET');

            return new Response(
                JSON.stringify({ ok: true, items: [{ id: '1', title: 'Alpha' }] }),
                {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                },
            );
        });

        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: fetchMock as typeof fetch,
        });

        const result = await baseQuery({
            url: '/tickets',
            params: { page: 2, search: 'bug' },
        });

        expect(result).toHaveProperty('data');
        if ('data' in result) {
            expect(result.data).toEqual({
                ok: true,
                items: [{ id: '1', title: 'Alpha' }],
            });
            expect(result.meta?.request.url).toBe('https://api.example.com/tickets?page=2&search=bug');
        }

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns http error object for non-2xx response', async () => {
        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: vi.fn(async () => new Response(
                JSON.stringify({ message: 'Not found' }),
                {
                    status: 404,
                    headers: { 'content-type': 'application/json' },
                },
            )) as typeof fetch,
        });

        const result = await baseQuery({
            url: '/tickets/999',
        });

        expect(result).toEqual({
            error: {
                status: 404,
                data: { message: 'Not found' },
            },
            meta: expect.objectContaining({
                request: expect.any(Request),
                response: expect.any(Response),
            }),
        });
    });

    it('applies prepareHeaders and serializes json body', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            expect(String(input)).toBe('https://api.example.com/tickets/1');

            const headers = new Headers(init?.headers);
            expect(headers.get('authorization')).toBe('Bearer token');
            expect(headers.get('content-type')).toBe('application/json');
            expect(init?.body).toBe(JSON.stringify({ title: 'Updated' }));

            return new Response(
                JSON.stringify({ ok: true }),
                {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                },
            );
        });

        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: fetchMock as typeof fetch,
            prepareHeaders: (headers) => {
                headers.set('authorization', 'Bearer token');
                return headers;
            },
        });

        const result = await baseQuery({
            url: '/tickets/1',
            method: 'PATCH',
            body: { title: 'Updated' },
        });

        expect(result).toHaveProperty('data');
        if ('data' in result) {
            expect(result.data).toEqual({ ok: true });
        }
    });

    it('returns parsing error when json parsing fails', async () => {
        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: vi.fn(async () => new Response(
                'not-json',
                {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                },
            )) as typeof fetch,
        });

        const result = await baseQuery({
            url: '/broken',
        });

        expect(result).toEqual({
            error: expect.objectContaining({
                status: 'PARSING_ERROR',
                originalStatus: 200,
                data: 'not-json',
            }),
            meta: expect.objectContaining({
                request: expect.any(Request),
                response: expect.any(Response),
            }),
        });
    });

    it('returns timeout error when request exceeds timeout', async () => {
        vi.useFakeTimers();

        const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const request = input as Request;
            const signal = init?.signal ?? request.signal;

            return new Promise<Response>((_resolve, reject) => {
                signal?.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'));
                }, { once: true });
            });
        });

        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: fetchMock as typeof fetch,
            timeout: 100,
        });

        const promise = baseQuery({
            url: '/slow',
        });

        await advance(100);

        await expect(promise).resolves.toEqual({
            error: {
                status: 'TIMEOUT_ERROR',
                error: 'Request timed out',
            },
        });
    });

    it('returns fetch error when fetch throws', async () => {
        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: vi.fn(async () => {
                throw new TypeError('Failed to fetch');
            }) as typeof fetch,
        });

        const result = await baseQuery({
            url: '/offline',
        });

        expect(result).toEqual({
            error: {
                status: 'FETCH_ERROR',
                error: 'Failed to fetch',
            },
        });
    });

    it('returns null data for 204 no content', async () => {
        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: vi.fn(async () => new Response(null, { status: 204 })) as typeof fetch,
        });

        const result = await baseQuery({ url: '/empty' });

        expect(result).toEqual({
            data: null,
            meta: expect.objectContaining({
                request: expect.any(Request),
                response: expect.any(Response),
            }),
        });
    });

    it('parses text response when responseHandler is text', async () => {
        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: vi.fn(async () => new Response('plain-text', {
                status: 200,
                headers: { 'content-type': 'text/plain' },
            })) as typeof fetch,
        });

        const result = await baseQuery({
            url: '/text',
            responseHandler: 'text',
        });

        expect('data' in result && result.data).toBe('plain-text');
    });

    it('uses content-type response handler', async () => {
        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'content-type': 'application/json; charset=utf-8' },
            })) as typeof fetch,
        });

        const result = await baseQuery({
            url: '/auto',
            responseHandler: 'content-type',
        });

        expect('data' in result && result.data).toEqual({ ok: true });
    });

    it('supports custom responseHandler', async () => {
        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: vi.fn(async () => new Response('abc', { status: 200 })) as typeof fetch,
        });

        const result = await baseQuery({
            url: '/custom',
            responseHandler: async (response) => (await response.text()).toUpperCase(),
        });

        expect('data' in result && result.data).toBe('ABC');
    });

    it('returns error when validateStatus returns false for 200 response', async () => {
        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: vi.fn(async () => new Response(JSON.stringify({ success: false }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })) as typeof fetch,
        });

        const result = await baseQuery({
            url: '/weird',
            validateStatus: (_response, body) => (body as { success?: boolean }).success === true,
        });

        expect(result).toEqual({
            error: {
                status: 200,
                data: { success: false },
            },
            meta: expect.objectContaining({
                request: expect.any(Request),
                response: expect.any(Response),
            }),
        });
    });

    it('uses custom paramsSerializer', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const request = input as Request;
            expect(request.url).toBe('https://api.example.com/items?tags=a|b|c');

            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        });

        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: fetchMock as typeof fetch,
            paramsSerializer: (params) => `tags=${(params.tags as string[]).join('|')}`,
        });

        await baseQuery({
            url: '/items',
            params: { tags: ['a', 'b', 'c'] },
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not json-stringify FormData body', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const request = input as Request;

            expect(request.headers.get('content-type')).not.toBe('application/json');

            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        });

        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: fetchMock as typeof fetch,
        });

        const formData = new FormData();
        formData.set('title', 'Hello');

        await baseQuery({
            url: '/upload',
            method: 'POST',
            body: formData,
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns fetch error when externally aborted', async () => {
        const controller = new AbortController();

        const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const request = input as Request;
            const signal = init?.signal ?? request.signal;

            return new Promise<Response>((_resolve, reject) => {
                signal?.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'));
                }, { once: true });
            });
        });

        const baseQuery = fetchBaseQuery({
            baseUrl: 'https://api.example.com',
            fetchFn: fetchMock as typeof fetch,
        });

        const promise = baseQuery({
            url: '/abort',
            signal: controller.signal,
        });

        controller.abort();

        await expect(promise).resolves.toEqual({
            error: {
                status: 'FETCH_ERROR',
                error: 'AbortError: Aborted',
            },
        });
    });
});

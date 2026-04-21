import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryAbortControllers, queryEndpointByKey, queryGcTimeouts, queryKeysByEndpoint, queryKeysByTag, queryKeySerializers, queryListeners, queryRunners, queryStore, querySubscriptionsCount, queryTagResolvers, queryTagsByKey, inFlightQueries, } from '../model/queryStore.js';
import { createApi } from './createApi.js';
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
function wait(ms, signal) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
    });
}
async function advance(ms) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}
function setupApi() {
    const db = {
        tickets: [
            { id: '1', title: 'Alpha' },
            { id: '2', title: 'Beta' },
            { id: '3', title: 'Gamma' },
            { id: '4', title: 'Delta' },
            { id: '5', title: 'Epsilon' },
            { id: '6', title: 'Zeta' },
        ],
    };
    const listCallsByPage = new Map();
    const detailCallsById = new Map();
    let editCalls = 0;
    const inc = (map, key) => {
        const next = (map.get(key) ?? 0) + 1;
        map.set(key, next);
        return next;
    };
    const baseQuery = async (args) => {
        const { url, method = 'GET', params, body, signal } = args;
        if (url === '/tickets' && method === 'GET') {
            const page = Number(params?.page ?? 1);
            await wait(page === 1 ? 1000 : 300, signal);
            if (page === 13) {
                throw new Error('Page 13 is forced to fail');
            }
            const callNo = inc(listCallsByPage, page);
            const pageSize = 2;
            const startIndex = (page - 1) * pageSize;
            const items = db.tickets.slice(startIndex, startIndex + pageSize);
            return {
                page,
                items,
                callNo,
                servedAt: new Date().toISOString(),
            };
        }
        if (url.startsWith('/tickets/') && method === 'GET') {
            const id = url.split('/').pop() ?? '';
            await wait(id === '2' ? 200 : 100, signal);
            const callNo = inc(detailCallsById, id);
            const ticket = db.tickets.find((item) => item.id === id);
            if (!ticket) {
                throw new Error(`Ticket ${id} not found`);
            }
            return {
                ...ticket,
                callNo,
                servedAt: new Date().toISOString(),
            };
        }
        if (url.startsWith('/tickets/') && method === 'PATCH') {
            const id = url.split('/').pop() ?? '';
            const payload = body;
            await wait(payload?.delayMs ?? 100, signal);
            const ticket = db.tickets.find((item) => item.id === id);
            if (!ticket) {
                throw new Error(`Ticket ${id} not found`);
            }
            if (!payload?.title?.trim()) {
                throw new Error('Title is empty');
            }
            ticket.title = payload.title;
            editCalls += 1;
            return {
                ok: true,
                editCallNo: editCalls,
                ticket: { ...ticket },
                servedAt: new Date().toISOString(),
            };
        }
        throw new Error(`Unhandled request: ${method} ${url}`);
    };
    const api = createApi({
        baseQuery,
        endpoints: (builder) => ({
            getTickets: builder.query({
                query: (args) => ({ url: '/tickets', method: 'GET', params: args }),
                keepUnusedDataFor: 5000,
            }),
            getTicketById: builder.query({
                query: (id) => ({ url: `/tickets/${id}`, method: 'GET' }),
                serializeArgs: (id) => id,
                staleTime: 2000,
                keepUnusedDataFor: 10000,
                providesTags: (_result, arg) => [`Ticket/${arg}`],
            }),
            editTicket: builder.mutation({
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
        expect(api.util.getQueryData('getTickets', { page: 1 })).toBeUndefined();
        await advance(700);
        expect(lazy.result.current[1].data?.page).toBe(2);
        expect(api.util.getQueryData('getTickets', { page: 1 })?.page).toBe(1);
        expect(api.util.getQueryData('getTickets', { page: 2 })?.page).toBe(2);
    });
    it('lazy query does not abort in-flight request on unmount', async () => {
        const { api } = setupApi();
        const lazy = renderHook(() => api.useLazyGetTicketsQuery());
        act(() => {
            void lazy.result.current[0]({ page: 1 });
        });
        lazy.unmount();
        await advance(1000);
        expect(api.util.getQueryData('getTickets', { page: 1 })?.page).toBe(1);
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
});
//# sourceMappingURL=createApi.test.js.map
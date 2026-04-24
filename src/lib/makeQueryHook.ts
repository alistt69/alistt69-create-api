import { useCallback, useEffect, useRef } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import {
    initQueryState,
    setQueryRunner,
    subscribeToQuery,
    registerQueryKey,
    setInFlightQuery,
    clearQueryRunner,
    getInFlightQuery,
    updateQueryState,
    setTagsForQueryKey,
    unregisterQueryKey,
    clearInFlightQuery,
    setQueryAbortController,
    clearQueryAbortController,
} from '../model/queryStore.js';
import { BaseQueryFn, QueryBuilderDefinition, QueryHookOptions } from '../model/types.js';

type MakeQueryHookProps<R, A, Raw = R> = {
    endpointName: string;
    baseQuery: BaseQueryFn<Raw>;
} & Omit<QueryBuilderDefinition<R, A, Raw>, 'type'>;

export function makeQueryHook<R, A, Raw = R>({
    query,
    baseQuery,
    endpointName,
    providesTags,
    serializeArgs,
    staleTime = 0,
    transformResponse,
    keepUnusedDataFor = 0,
    transformErrorResponse,
}: MakeQueryHookProps<R, A, Raw>) {
    return function useGeneratedQuery(arg: A, options?: QueryHookOptions) {
        const enabled = options?.enabled ?? true;
        const refetchOnMount = options?.refetchOnMount ?? true;

        const serializedArg = serializeArgs ? serializeArgs(arg) : JSON.stringify(arg);
        const key = `${endpointName}::${serializedArg}`;

        const argRef = useRef(arg);
        argRef.current = arg;

        const state = useSyncExternalStore(
            (onStoreChange) => subscribeToQuery(key, onStoreChange, keepUnusedDataFor),
            () => initQueryState(key),
            () => initQueryState(key),
        );

        const run = useCallback(() => {
            const existingPromise = getInFlightQuery<R>(key);

            if (existingPromise) {
                return existingPromise;
            }

            const controller = new AbortController();
            setQueryAbortController(key, controller);

            let promise!: Promise<R>;

            // eslint-disable-next-line prefer-const
            promise = (async () => {
                updateQueryState(key, (prevState) => ({
                    ...prevState,
                    error: undefined,
                    ...(prevState.data !== undefined
                        ? { isFetching: true, isLoading: false }
                        : { isLoading: true, isFetching: false }),
                }));

                try {
                    const request = query(argRef.current);
                    const result = await baseQuery({
                        ...request,
                        signal: controller.signal,
                    });

                    if ('error' in result) {
                        const transformedError = transformErrorResponse
                            ? transformErrorResponse(result.error, argRef.current)
                            : result.error;

                        throw transformedError;
                    }

                    const raw = result.data;
                    const data = transformResponse ? transformResponse(raw, argRef.current) : raw as unknown as R;

                    if (!controller.signal.aborted) {
                        updateQueryState(key, (prevState) => ({
                            ...prevState,
                            data,
                            error: undefined,
                            fulfilledAt: Date.now(),
                        }));

                        if (providesTags) {
                            setTagsForQueryKey(key, providesTags(data, argRef.current));
                        }
                    }

                    return data;
                }
                catch (error) {
                    if (controller.signal.aborted) {
                        throw error;
                    }

                    updateQueryState(key, (prevState) => ({
                        ...prevState,
                        data: undefined,
                        error,
                    }));

                    throw error;
                }
                finally {
                    if (!controller.signal.aborted) {
                        updateQueryState(key, (prevState) => ({
                            ...prevState,
                            isLoading: false,
                            isFetching: false,
                        }));
                    }

                    clearInFlightQuery(key, promise);
                    clearQueryAbortController(key, controller);
                }
            })();

            setInFlightQuery(key, promise);

            return promise;
        }, [
            key,
            query,
            baseQuery,
            providesTags,
            transformResponse,
            transformErrorResponse,
        ]);

        const refetch = useCallback(() => {
            return run();
        }, [run]);

        useEffect(() => {
            registerQueryKey(endpointName, key);
            setQueryRunner(key, run);

            return () => {
                clearQueryRunner(key);
                unregisterQueryKey(endpointName, key);
            };
        }, [endpointName, key, run]);

        useEffect(() => {
            if (!enabled) {
                return;
            }

            const currentState = initQueryState(key);

            if (currentState.data === undefined || currentState.fulfilledAt === undefined) {
                void run().catch(() => undefined);
                return;
            }

            if (!refetchOnMount) {
                return;
            }

            const isFresh = Date.now() - currentState.fulfilledAt < staleTime;

            if (!isFresh) {
                void run().catch(() => undefined);
            }
        }, [enabled, key, run, staleTime, refetchOnMount]);

        return { ...state, refetch };
    };
}

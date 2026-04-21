import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import {
    clearInFlightQuery,
    clearQueryAbortController,
    clearQueryRunner,
    getInFlightQuery,
    initQueryState,
    registerQueryKey,
    scheduleCleanupIfUnused,
    setInFlightQuery,
    setQueryAbortController,
    setQueryRunner,
    setTagsForQueryKey,
    subscribeToQuery,
    unregisterQueryKey,
    updateQueryState,
} from '../model/queryStore.js';
import { InferQueryState } from '../model/types.js';
import { BaseQueryArgs, BaseQueryFn } from './createApi.js';

export function makeLazyQueryHook<R, A, Raw = R>(
    endpointName: string,
    query: (arg: A) => BaseQueryArgs,
    baseQuery: BaseQueryFn<Raw>,
    serializeArgs?: (args: A) => string,
    providesTags?: (result: R, arg: A) => string[],
    transformResponse?: (response: Raw, arg: A) => R,
    transformErrorResponse?: (error: unknown, arg: A) => unknown,
    keepUnusedDataFor = 0,
) {
    return function useGeneratedLazyQuery() {
        const [currentArg, setCurrentArg] = useState<A | undefined>(undefined);

        const currentKey = useMemo(() => {
            if (currentArg === undefined) {
                return null;
            }

            const serializedArg = serializeArgs
                ? serializeArgs(currentArg)
                : JSON.stringify(currentArg);

            return `${endpointName}::${serializedArg}`;
        }, [currentArg, endpointName, serializeArgs]);

        const argRef = useRef<A | undefined>(currentArg);
        argRef.current = currentArg;
        const ownedKeyRef = useRef<string | null>(null);

        const emptyState: InferQueryState<R> = {
            data: undefined,
            isLoading: false,
            isFetching: false,
            error: undefined,
            fulfilledAt: undefined,
        };

        const state = useSyncExternalStore(
            (onStoreChange) => {
                if (!currentKey) {
                    return () => undefined;
                }

                return subscribeToQuery(currentKey, onStoreChange, keepUnusedDataFor);
            },
            () => {
                if (!currentKey) {
                    return emptyState;
                }

                return initQueryState(currentKey);
            },
            () => {
                if (!currentKey) {
                    return emptyState;
                }

                return initQueryState(currentKey);
            },
        );

        const run = useCallback((arg: A) => {
            const serializedArg = serializeArgs
                ? serializeArgs(arg)
                : JSON.stringify(arg);

            const key = `${endpointName}::${serializedArg}`;
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
                    const request = query(arg);
                    const raw = await baseQuery({
                        ...request,
                        signal: controller.signal,
                    });

                    const data = transformResponse
                        ? transformResponse(raw, arg)
                        : (raw as R);

                    if (!controller.signal.aborted) {
                        updateQueryState(key, (prevState) => ({
                            ...prevState,
                            data,
                            error: undefined,
                            fulfilledAt: Date.now(),
                        }));

                        if (providesTags) {
                            setTagsForQueryKey(key, providesTags(data, arg));
                        }
                    }

                    return data;
                }
                catch (error) {
                    if (controller.signal.aborted) {
                        throw error;
                    }

                    const transformedError = transformErrorResponse
                        ? transformErrorResponse(error, arg)
                        : error;

                    updateQueryState(key, (prevState) => ({
                        ...prevState,
                        data: undefined,
                        error: transformedError,
                    }));

                    throw transformedError;
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
            baseQuery,
            endpointName,
            providesTags,
            query,
            serializeArgs,
            transformErrorResponse,
            transformResponse,
        ]);

        const trigger = useCallback((arg: A) => {
            const serializedArg = serializeArgs
                ? serializeArgs(arg)
                : JSON.stringify(arg);

            const nextKey = `${endpointName}::${serializedArg}`;
            const prevOwnedKey = ownedKeyRef.current;

            if (prevOwnedKey && prevOwnedKey !== nextKey) {
                clearQueryRunner(prevOwnedKey);
                unregisterQueryKey(endpointName, prevOwnedKey);
                scheduleCleanupIfUnused(prevOwnedKey, keepUnusedDataFor);
            }

            registerQueryKey(endpointName, nextKey);

            setQueryRunner(nextKey, () => run(arg));

            ownedKeyRef.current = nextKey;
            setCurrentArg(arg);

            return run(arg);
        }, [endpointName, keepUnusedDataFor, run, serializeArgs]);

        const refetch = useCallback(() => {
            if (argRef.current === undefined) {
                return undefined;
            }

            return run(argRef.current);
        }, [run]);

        useEffect(() => {
            if (!currentKey) {
                return;
            }

            return () => {
                clearQueryRunner(currentKey);
                unregisterQueryKey(endpointName, currentKey);
                scheduleCleanupIfUnused(currentKey, keepUnusedDataFor);

                if (ownedKeyRef.current === currentKey) {
                    ownedKeyRef.current = null;
                }
            };
        }, [currentKey, endpointName, keepUnusedDataFor]);

        return [trigger, { ...state, refetch }] as const;
    };
}

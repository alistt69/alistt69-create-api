import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { clearInFlightQuery, clearQueryAbortController, clearQueryRunner, getInFlightQuery, initQueryState, registerQueryKey, scheduleCleanupIfUnused, setInFlightQuery, setQueryAbortController, setQueryRunner, setTagsForQueryKey, subscribeToQuery, unregisterQueryKey, updateQueryState, } from '../model/queryStore.js';
export function makeLazyQueryHook(endpointName, query, baseQuery, serializeArgs, providesTags, transformResponse, transformErrorResponse, keepUnusedDataFor = 0) {
    return function useGeneratedLazyQuery() {
        const [currentArg, setCurrentArg] = useState(undefined);
        const currentKey = useMemo(() => {
            if (currentArg === undefined) {
                return null;
            }
            const serializedArg = serializeArgs
                ? serializeArgs(currentArg)
                : JSON.stringify(currentArg);
            return `${endpointName}::${serializedArg}`;
        }, [currentArg, endpointName, serializeArgs]);
        const argRef = useRef(currentArg);
        argRef.current = currentArg;
        const ownedKeyRef = useRef(null);
        const emptyState = {
            data: undefined,
            isLoading: false,
            isFetching: false,
            error: undefined,
            fulfilledAt: undefined,
        };
        const state = useSyncExternalStore((onStoreChange) => {
            if (!currentKey) {
                return () => undefined;
            }
            return subscribeToQuery(currentKey, onStoreChange, keepUnusedDataFor);
        }, () => {
            if (!currentKey) {
                return emptyState;
            }
            return initQueryState(currentKey);
        }, () => {
            if (!currentKey) {
                return emptyState;
            }
            return initQueryState(currentKey);
        });
        const run = useCallback((arg) => {
            const serializedArg = serializeArgs
                ? serializeArgs(arg)
                : JSON.stringify(arg);
            const key = `${endpointName}::${serializedArg}`;
            const existingPromise = getInFlightQuery(key);
            if (existingPromise) {
                return existingPromise;
            }
            const controller = new AbortController();
            setQueryAbortController(key, controller);
            let promise;
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
                        : raw;
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
        const trigger = useCallback((arg) => {
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
        return [trigger, { ...state, refetch }];
    };
}
//# sourceMappingURL=makeLazyQueryHook.js.map
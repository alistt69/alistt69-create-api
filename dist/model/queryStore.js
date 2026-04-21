export const querySubscriptionsCount = new Map();
export const queryEndpointByKey = new Map();
export const queryGcTimeouts = new Map();
export function incrementQuerySubscriptions(key) {
    const currentCount = querySubscriptionsCount.get(key) ?? 0;
    const nextCount = currentCount + 1;
    querySubscriptionsCount.set(key, nextCount);
    return nextCount;
}
export function decrementQuerySubscriptions(key) {
    const currentCount = querySubscriptionsCount.get(key) ?? 0;
    const nextCount = Math.max(0, currentCount - 1);
    querySubscriptionsCount.set(key, nextCount);
    return nextCount;
}
export const queryKeySerializers = new Map();
export function setQueryKeySerializer(endpointName, serializer) {
    queryKeySerializers.set(endpointName, serializer);
}
export function getQueryKeyByEndpointArg(endpointName, arg) {
    const serializer = queryKeySerializers.get(endpointName);
    const serializedArg = serializer ? serializer(arg) : JSON.stringify(arg);
    return `${endpointName}::${serializedArg}`;
}
export function getQueryData(endpointName, arg) {
    const key = getQueryKeyByEndpointArg(endpointName, arg);
    return getQueryState(key)?.data;
}
export function setQueryData(endpointName, arg, data) {
    const key = getQueryKeyByEndpointArg(endpointName, arg);
    updateQueryState(key, (prevState) => ({
        ...prevState,
        data,
        error: undefined,
        isLoading: false,
        isFetching: false,
        fulfilledAt: prevState.fulfilledAt ?? Date.now(),
    }));
    const tags = getQueryTagsForData(endpointName, data, arg);
    setTagsForQueryKey(key, tags);
}
export const queryListeners = new Map();
export function subscribeToQuery(key, listener, keepUnusedDataFor) {
    if (!queryListeners.has(key)) {
        queryListeners.set(key, []);
    }
    incrementQuerySubscriptions(key);
    const gcTimeout = queryGcTimeouts.get(key);
    if (gcTimeout) {
        clearTimeout(gcTimeout);
        queryGcTimeouts.delete(key);
    }
    queryListeners.get(key).push(listener);
    return function unsubscribe() {
        const listeners = queryListeners.get(key);
        if (listeners) {
            queryListeners.set(key, listeners.filter((currentListener) => currentListener !== listener));
        }
        const nextCount = decrementQuerySubscriptions(key);
        if (nextCount === 0) {
            scheduleCleanupIfUnused(key, keepUnusedDataFor);
        }
    };
}
export function notifyQueryListeners(key) {
    const listeners = queryListeners.get(key) ?? [];
    listeners.forEach((listener) => {
        listener();
    });
}
export const queryStore = new Map();
export function getQueryState(key) {
    return queryStore.get(key);
}
export function setQueryState(key, state) {
    queryStore.set(key, state);
    notifyQueryListeners(key);
}
export function getQueryKey(endpointName, args) {
    return `${endpointName}::${JSON.stringify(args)}`;
}
export function initQueryState(key) {
    if (!queryStore.has(key)) {
        const newValue = {
            data: undefined,
            isLoading: false,
            isFetching: false,
            error: undefined,
            fulfilledAt: undefined,
        };
        queryStore.set(key, newValue);
    }
    return queryStore.get(key);
}
export function updateQueryState(key, updater) {
    const newState = updater(initQueryState(key));
    queryStore.set(key, newState);
    notifyQueryListeners(key);
    return newState;
}
export const inFlightQueries = new Map();
export function getInFlightQuery(key) {
    return inFlightQueries.get(key);
}
export function setInFlightQuery(key, promise) {
    inFlightQueries.set(key, promise);
}
export function clearInFlightQuery(key, promise) {
    if (promise && inFlightQueries.get(key) !== promise) {
        return;
    }
    inFlightQueries.delete(key);
}
export const queryRunners = new Map();
export function setQueryRunner(key, runner) {
    queryRunners.set(key, runner);
}
export function getQueryRunner(key) {
    return queryRunners.get(key);
}
export function refetchQueryByKey(key) {
    const runner = queryRunners.get(key);
    return runner?.();
}
export function refetchQueriesByEndpoint(endpointName) {
    const keys = queryKeysByEndpoint.get(endpointName);
    if (!keys) {
        return [];
    }
    return Array.from(keys)
        .map((key) => refetchQueryByKey(key))
        .filter((value) => value !== undefined);
}
export function clearQueryRunner(key) {
    queryRunners.delete(key);
}
export const queryKeysByEndpoint = new Map();
export function registerQueryKey(endpointName, key) {
    if (!queryKeysByEndpoint.has(endpointName)) {
        queryKeysByEndpoint.set(endpointName, new Set());
    }
    queryEndpointByKey.set(key, endpointName);
    queryKeysByEndpoint.get(endpointName)?.add(key);
}
export function unregisterQueryKey(endpointName, key) {
    const keys = queryKeysByEndpoint.get(endpointName);
    if (!keys) {
        return;
    }
    keys.delete(key);
    queryEndpointByKey.delete(key);
    if (keys.size === 0) {
        queryKeysByEndpoint.delete(endpointName);
    }
}
export function cleanupQuery(key) {
    abortQueryByKey(key);
    clearTagsForQueryKey(key);
    const endpointName = queryEndpointByKey.get(key);
    if (endpointName) {
        const keys = queryKeysByEndpoint.get(endpointName);
        if (keys) {
            keys.delete(key);
            if (keys.size === 0) {
                queryKeysByEndpoint.delete(endpointName);
            }
        }
        queryEndpointByKey.delete(key);
    }
    queryStore.delete(key);
    inFlightQueries.delete(key);
    queryListeners.delete(key);
    queryRunners.delete(key);
    queryGcTimeouts.delete(key);
    querySubscriptionsCount.delete(key);
}
export const queryKeysByTag = new Map();
export const queryTagsByKey = new Map();
export function clearTagsForQueryKey(key) {
    const tags = queryTagsByKey.get(key);
    if (!tags) {
        return;
    }
    tags.forEach((tag) => {
        const keys = queryKeysByTag.get(tag);
        if (!keys) {
            return;
        }
        keys.delete(key);
        if (keys.size === 0) {
            queryKeysByTag.delete(tag);
        }
    });
    queryTagsByKey.delete(key);
}
export function setTagsForQueryKey(key, tags) {
    clearTagsForQueryKey(key);
    const uniqueTags = new Set(tags);
    queryTagsByKey.set(key, uniqueTags);
    uniqueTags.forEach((tag) => {
        if (!queryKeysByTag.has(tag)) {
            queryKeysByTag.set(tag, new Set());
        }
        queryKeysByTag.get(tag).add(key);
    });
}
export function getQueryKeysByTag(tag) {
    return Array.from(queryKeysByTag.get(tag) ?? []);
}
export const queryTagResolvers = new Map();
export function setQueryTagResolver(endpointName, resolver) {
    if (!resolver) {
        queryTagResolvers.delete(endpointName);
        return;
    }
    queryTagResolvers.set(endpointName, resolver);
}
export function getQueryTagsForData(endpointName, data, arg) {
    const resolver = queryTagResolvers.get(endpointName);
    if (!resolver) {
        return [];
    }
    return resolver(data, arg);
}
export function updateQueryData(endpointName, arg, updater) {
    const key = getQueryKeyByEndpointArg(endpointName, arg);
    const prevData = getQueryState(key)?.data;
    const nextData = updater(prevData);
    updateQueryState(key, (prevState) => ({
        ...prevState,
        data: nextData,
        error: undefined,
        isLoading: false,
        isFetching: false,
        fulfilledAt: prevState.fulfilledAt ?? Date.now(),
    }));
    const tags = getQueryTagsForData(endpointName, nextData, arg);
    setTagsForQueryKey(key, tags);
    return nextData;
}
export const queryAbortControllers = new Map();
export function setQueryAbortController(key, controller) {
    queryAbortControllers.set(key, controller);
}
export function getQueryAbortController(key) {
    return queryAbortControllers.get(key);
}
export function clearQueryAbortController(key, controller) {
    if (controller && queryAbortControllers.get(key) !== controller) {
        return;
    }
    queryAbortControllers.delete(key);
}
export function abortQueryByKey(key) {
    const controller = queryAbortControllers.get(key);
    if (!controller) {
        return;
    }
    controller.abort();
    queryAbortControllers.delete(key);
}
export function scheduleCleanupIfUnused(key, keepUnusedDataFor) {
    const subscriptionsCount = querySubscriptionsCount.get(key) ?? 0;
    if (subscriptionsCount > 0) {
        return;
    }
    const existingTimeout = queryGcTimeouts.get(key);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
    }
    const timeout = setTimeout(() => {
        cleanupQuery(key);
    }, keepUnusedDataFor);
    queryGcTimeouts.set(key, timeout);
}
//# sourceMappingURL=queryStore.js.map
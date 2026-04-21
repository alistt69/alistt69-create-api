import { useCallback, useMemo, useRef, useState } from 'react';
import { getQueryKeysByTag, refetchQueriesByEndpoint, refetchQueryByKey } from '../model/queryStore.js';
export function makeMutationHook(query, baseQuery, invalidates, invalidatesTags, transformResponse, transformErrorResponse) {
    return function useGeneratedMutation() {
        const initialState = useMemo(() => ({
            data: undefined,
            isLoading: false,
            error: undefined,
        }), []);
        const [state, setState] = useState(initialState);
        const requestIdRef = useRef(0);
        const reset = useCallback(() => {
            setState((prevState) => ({
                ...prevState,
                ...initialState,
            }));
        }, [initialState]);
        const trigger = useCallback(async (arg) => {
            const requestId = requestIdRef.current + 1;
            requestIdRef.current = requestId;
            setState((prevState) => ({
                ...prevState,
                isLoading: true,
                error: undefined,
                data: undefined,
            }));
            try {
                const request = query(arg);
                const raw = await baseQuery(request);
                const data = transformResponse ? transformResponse(raw, arg) : raw;
                if (requestIdRef.current === requestId) {
                    setState({
                        data,
                        isLoading: false,
                        error: undefined,
                    });
                }
                invalidates?.forEach((endpointName) => {
                    refetchQueriesByEndpoint(endpointName);
                });
                if (invalidatesTags) {
                    const tags = invalidatesTags(data, arg);
                    const keys = new Set(tags.flatMap((tag) => getQueryKeysByTag(tag)));
                    keys.forEach((key) => {
                        refetchQueryByKey(key);
                    });
                }
                return data;
            }
            catch (error) {
                const transformedError = transformErrorResponse
                    ? transformErrorResponse(error, arg)
                    : error;
                if (requestIdRef.current === requestId) {
                    setState({
                        data: undefined,
                        isLoading: false,
                        error: transformedError,
                    });
                }
                throw transformedError;
            }
            finally {
                if (requestIdRef.current === requestId) {
                    setState((prevState) => ({
                        ...prevState,
                        isLoading: false,
                    }));
                }
            }
        }, [
            baseQuery,
            invalidates,
            invalidatesTags,
            query,
            transformErrorResponse,
            transformResponse,
        ]);
        return [trigger, { ...state, reset }];
    };
}
//# sourceMappingURL=makeMutationHook.js.map
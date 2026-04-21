import { useCallback, useMemo, useRef, useState } from 'react';
import { getQueryKeysByTag, refetchQueriesByEndpoint, refetchQueryByKey } from '../model/queryStore.js';
import { InferMutationState, MutationTagsResolver } from '../model/types.js';
import { BaseQueryArgs, BaseQueryFn } from './createApi.js';

export function makeMutationHook<R, A, Raw = R>(
    query: (arg: A) => BaseQueryArgs,
    baseQuery: BaseQueryFn<Raw>,
    invalidates?: string[],
    invalidatesTags?: MutationTagsResolver<R, A>,
    transformResponse?: (response: Raw, arg: A) => R,
    transformErrorResponse?: (error: unknown, arg: A) => unknown,
) {
    return function useGeneratedMutation() {
        const initialState: InferMutationState<R> = useMemo(() => ({
            data: undefined,
            isLoading: false,
            error: undefined,
        }), []);

        const [state, setState] = useState<InferMutationState<R>>(initialState);
        const requestIdRef = useRef(0);

        const reset = useCallback(() => {
            setState((prevState) => ({
                ...prevState,
                ...initialState,
            }));
        }, [initialState]);

        const trigger = useCallback(async (arg: A) => {
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
                const data = transformResponse ? transformResponse(raw, arg) : (raw as R);

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

        return [trigger, { ...state, reset }] as const;
    };
}

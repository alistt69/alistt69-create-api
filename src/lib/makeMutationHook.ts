import { useCallback, useMemo, useRef, useState } from 'react';
import {
    getQueryKeysByTag,
    refetchQueryByKey,
    refetchQueriesByEndpoint,
} from '../model/queryStore.js';
import { BaseQueryFn, InferMutationState, MutationBuilderDefinition } from '../model/types.js';

interface MakeMutationHookProps<R, A, Raw = R> extends Omit<MutationBuilderDefinition<R, A, Raw>, 'type'> {
    baseQuery: BaseQueryFn<Raw>,
}

export function makeMutationHook<R, A, Raw = R>({
    query,
    baseQuery,
    invalidates,
    invalidatesTags,
    transformResponse,
    transformErrorResponse,
}: MakeMutationHookProps<R, A, Raw>) {
    return function useGeneratedMutation() {
        const initialState: InferMutationState<R> = useMemo(() => ({
            data: undefined,
            error: undefined,
            isLoading: false,
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
                data: undefined,
                error: undefined,
                isLoading: true,
            }));

            try {
                const request = query(arg);
                const raw = await baseQuery(request);
                const data = transformResponse ? transformResponse(raw, arg) : (raw as R);

                if (requestIdRef.current === requestId) {
                    setState({
                        data,
                        error: undefined,
                        isLoading: false,
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
            query,
            baseQuery,
            invalidates,
            invalidatesTags,
            transformResponse,
            transformErrorResponse,
        ]);

        return [trigger, { ...state, reset }] as const;
    };
}

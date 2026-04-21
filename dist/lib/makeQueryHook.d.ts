import { QueryHookOptions } from '../model/types.js';
import { BaseQueryArgs, BaseQueryFn } from './createApi.js';
export declare function makeQueryHook<R, A, Raw = R>(endpointName: string, query: (arg: A) => BaseQueryArgs, baseQuery: BaseQueryFn<Raw>, serializeArgs?: (args: A) => string, providesTags?: (result: R, arg: A) => string[], transformResponse?: (response: Raw, arg: A) => R, transformErrorResponse?: (error: unknown, arg: A) => unknown, staleTime?: number, keepUnusedDataFor?: number): (arg: A, options?: QueryHookOptions) => {
    refetch: () => Promise<R>;
    data?: unknown;
    isLoading: boolean;
    isFetching: boolean;
    error?: unknown;
    fulfilledAt?: number;
};
//# sourceMappingURL=makeQueryHook.d.ts.map
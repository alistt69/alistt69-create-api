import { BaseQueryArgs, BaseQueryFn } from './createApi.js';
export declare function makeLazyQueryHook<R, A, Raw = R>(endpointName: string, query: (arg: A) => BaseQueryArgs, baseQuery: BaseQueryFn<Raw>, serializeArgs?: (args: A) => string, providesTags?: (result: R, arg: A) => string[], transformResponse?: (response: Raw, arg: A) => R, transformErrorResponse?: (error: unknown, arg: A) => unknown, keepUnusedDataFor?: number): () => readonly [(arg: A) => Promise<R>, {
    readonly refetch: () => Promise<R> | undefined;
    readonly data?: unknown;
    readonly isLoading: boolean;
    readonly isFetching: boolean;
    readonly error?: unknown;
    readonly fulfilledAt?: number;
}];
//# sourceMappingURL=makeLazyQueryHook.d.ts.map
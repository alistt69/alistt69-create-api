import { MutationTagsResolver } from '../model/types.js';
import { BaseQueryArgs, BaseQueryFn } from './createApi.js';
export declare function makeMutationHook<R, A, Raw = R>(query: (arg: A) => BaseQueryArgs, baseQuery: BaseQueryFn<Raw>, invalidates?: string[], invalidatesTags?: MutationTagsResolver<R, A>, transformResponse?: (response: Raw, arg: A) => R, transformErrorResponse?: (error: unknown, arg: A) => unknown): () => readonly [(arg: A) => Promise<R>, {
    readonly reset: () => void;
    readonly data?: R | undefined;
    readonly isLoading: boolean;
    readonly error?: unknown;
}];
//# sourceMappingURL=makeMutationHook.d.ts.map
import { QueryBuilderDefinition } from './types.js';

type QuerySignature<R, A, Raw = R> = Omit<QueryBuilderDefinition<R, A, Raw>, 'type'>;

export function query<R, A, Raw = R>(signature: QuerySignature<R, A, Raw>): QueryBuilderDefinition<R, A, Raw> {
    return {
        type: 'query',
        query: signature.query,
        staleTime: signature.staleTime,
        providesTags: signature.providesTags,
        serializeArgs: signature.serializeArgs,
        keepUnusedDataFor: signature.keepUnusedDataFor,
        transformResponse: signature.transformResponse,
        transformErrorResponse: signature.transformErrorResponse,
    };
}

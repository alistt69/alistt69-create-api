import { MutationBuilderDefinition } from './types.js';

type MutationSignature<R, A, Raw = R> = Omit<MutationBuilderDefinition<R, A, Raw>, 'type'>;

export function mutation<R, A, Raw = R>(signature: MutationSignature<R, A, Raw>): MutationBuilderDefinition<R, A, Raw> {
    return {
        type: 'mutation',
        query: signature.query,
        invalidates: signature.invalidates,
        invalidatesTags: signature.invalidatesTags,
        transformResponse: signature.transformResponse,
        transformErrorResponse: signature.transformErrorResponse,
    };
}

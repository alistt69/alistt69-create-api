export function query(signature) {
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
//# sourceMappingURL=query.js.map
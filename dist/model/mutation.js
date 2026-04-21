export function mutation(signature) {
    return {
        type: 'mutation',
        query: signature.query,
        invalidates: signature.invalidates,
        invalidatesTags: signature.invalidatesTags,
        transformResponse: signature.transformResponse,
        transformErrorResponse: signature.transformErrorResponse,
    };
}
//# sourceMappingURL=mutation.js.map
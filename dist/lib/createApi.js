import { mutation as BuilderMutation } from '../model/mutation.js';
import { query as BuilderQuery } from '../model/query.js';
import { getQueryData, setQueryData, setQueryKeySerializer, setQueryTagResolver, updateQueryData, } from '../model/queryStore.js';
import { getHookName } from './getHookName.js';
import { makeLazyQueryHook } from './makeLazyQueryHook.js';
import { makeMutationHook } from './makeMutationHook.js';
import { makeQueryHook } from './makeQueryHook.js';
import { typedObjectKeys } from './typedObjectKeys.js';
export const builder = {
    query: BuilderQuery,
    mutation: BuilderMutation,
};
export function createApi(config) {
    const endpoints = config.endpoints(builder);
    const keys = typedObjectKeys(endpoints);
    const apiResult = {};
    keys.forEach((key) => {
        const definition = endpoints[key];
        if (definition.type === 'query') {
            setQueryKeySerializer(key, (arg) => definition.serializeArgs
                ? definition.serializeArgs(arg)
                : JSON.stringify(arg));
            setQueryTagResolver(key, definition.providesTags
                ? (data, arg) => definition.providesTags?.(data, arg) || []
                : undefined);
            apiResult[getHookName(key, definition.type, 'Lazy')] = makeLazyQueryHook(key, definition.query, config.baseQuery, definition.serializeArgs, definition.providesTags, definition.transformResponse, definition.transformErrorResponse, definition.keepUnusedDataFor);
        }
        apiResult[getHookName(key, definition.type, '')] = definition.type === 'query'
            ? (makeQueryHook(key, definition.query, config.baseQuery, definition.serializeArgs, definition.providesTags, definition.transformResponse, definition.transformErrorResponse, definition.staleTime, definition.keepUnusedDataFor)) : (makeMutationHook(definition.query, config.baseQuery, definition.invalidates, definition.invalidatesTags, definition.transformResponse, definition.transformErrorResponse));
    });
    const util = {
        getQueryData,
        setQueryData,
        updateQueryData,
    };
    return { ...apiResult, util };
}
//# sourceMappingURL=createApi.js.map
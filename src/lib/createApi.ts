import { mutation } from '../model/mutation.js';
import { query } from '../model/query.js';
import {
    getQueryData,
    setQueryData,
    updateQueryData,
    setQueryTagResolver,
    setQueryKeySerializer,
} from '../model/queryStore.js';
import { getHookName } from './getHookName.js';
import { makeQueryHook } from './makeQueryHook.js';
import { typedObjectKeys } from './typedObjectKeys.js';
import { makeMutationHook } from './makeMutationHook.js';
import { makeLazyQueryHook } from './makeLazyQueryHook.js';
import { BaseQueryFn, CreateApiResult, CreateApiUtil, GeneralDefinition } from '../model/types.js';

export interface BaseQueryArgs {
    url: string;
    body?: unknown;
    method?: string;
    signal?: AbortSignal;
    params?: Record<string, unknown>;
}

interface CreateApiConfig<T extends Record<string, GeneralDefinition>> {
    baseQuery: BaseQueryFn;
    endpoints: (builder: { query: typeof query; mutation: typeof mutation }) => T;
}

export function createApi<T extends Record<string, GeneralDefinition>>({
    endpoints,
    baseQuery
}: CreateApiConfig<T>): CreateApiResult<T> {
    const transformedEndpoints = endpoints({ query, mutation });

    const keys = typedObjectKeys(transformedEndpoints);
    const apiResult: Record<string, unknown> = {};

    keys.forEach((endpointName) => {
        const definition = transformedEndpoints[endpointName];

        const makeHookProps = {
            baseQuery,
            endpointName,
            ...definition,
        };

        if (definition.type === 'query') {
            setQueryKeySerializer(
                endpointName,
                (arg) => definition.serializeArgs
                    ? definition.serializeArgs(arg)
                    : JSON.stringify(arg),
            );

            setQueryTagResolver(
                endpointName,
                definition.providesTags
                    ? (data, arg) => definition.providesTags?.(data, arg) || []
                    : undefined,
            );

            apiResult[getHookName(endpointName, definition.type, 'Lazy')] = makeLazyQueryHook(makeHookProps);
        }

        apiResult[getHookName(endpointName, definition.type, '')] = definition.type === 'query'
            ? (
                makeQueryHook(makeHookProps)
            ) : (
                makeMutationHook(makeHookProps)
            );
    });

    const util: CreateApiUtil = {
        getQueryData,
        setQueryData,
        updateQueryData,
    };

    return { ...apiResult, util } as CreateApiResult<T>;
}

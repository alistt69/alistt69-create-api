import { mutation as BuilderMutation } from '../model/mutation.js';
import { query as BuilderQuery } from '../model/query.js';
import {
    getQueryData,
    setQueryData,
    setQueryKeySerializer,
    setQueryTagResolver,
    updateQueryData,
} from '../model/queryStore.js';
import { CreateApiResult, CreateApiUtil, GeneralDefinition } from '../model/types.js';
import { getHookName } from './getHookName.js';
import { makeLazyQueryHook } from './makeLazyQueryHook.js';
import { makeMutationHook } from './makeMutationHook.js';
import { makeQueryHook } from './makeQueryHook.js';
import { typedObjectKeys } from './typedObjectKeys.js';

interface Builder {
    query: typeof BuilderQuery;
    mutation: typeof BuilderMutation;
}

export interface BaseQueryArgs {
    url: string;
    body?: unknown;
    method?: string;
    params?: Record<string, unknown>;
    signal?: AbortSignal;
}

export type BaseQueryFn<R = unknown> = (args: BaseQueryArgs) => Promise<R>;

export const builder: Builder = {
    query: BuilderQuery,
    mutation: BuilderMutation,
};

interface CreateApiConfig<T extends Record<string, GeneralDefinition>> {
    baseQuery: BaseQueryFn;
    endpoints: (builder: Builder) => T;
}

export function createApi<T extends Record<string, GeneralDefinition>>(
    config: CreateApiConfig<T>,
): CreateApiResult<T> {
    const endpoints = config.endpoints(builder);
    const keys = typedObjectKeys(endpoints);
    const apiResult: Record<string, unknown> = {};

    keys.forEach((key) => {
        const definition = endpoints[key];

        if (definition.type === 'query') {
            setQueryKeySerializer(
                key,
                (arg) => definition.serializeArgs
                    ? definition.serializeArgs(arg)
                    : JSON.stringify(arg),
            );

            setQueryTagResolver(
                key,
                definition.providesTags
                    ? (data, arg) => definition.providesTags?.(data, arg) || []
                    : undefined,
            );

            apiResult[getHookName(key, definition.type, 'Lazy')] = makeLazyQueryHook(
                key,
                definition.query,
                config.baseQuery,
                definition.serializeArgs,
                definition.providesTags,
                definition.transformResponse,
                definition.transformErrorResponse,
                definition.keepUnusedDataFor,
            );
        }

        apiResult[getHookName(key, definition.type, '')] = definition.type === 'query'
            ? (
                makeQueryHook(
                    key,
                    definition.query,
                    config.baseQuery,
                    definition.serializeArgs,
                    definition.providesTags,
                    definition.transformResponse,
                    definition.transformErrorResponse,
                    definition.staleTime,
                    definition.keepUnusedDataFor,
                )
            ) : (
                makeMutationHook(
                    definition.query,
                    config.baseQuery,
                    definition.invalidates,
                    definition.invalidatesTags,
                    definition.transformResponse,
                    definition.transformErrorResponse,
                )
            );
    });

    const util: CreateApiUtil = {
        getQueryData,
        setQueryData,
        updateQueryData,
    };

    return { ...apiResult, util } as CreateApiResult<T>;
}

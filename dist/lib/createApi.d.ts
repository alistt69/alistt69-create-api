import { mutation as BuilderMutation } from '../model/mutation.js';
import { query as BuilderQuery } from '../model/query.js';
import { CreateApiResult, GeneralDefinition } from '../model/types.js';
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
export declare const builder: Builder;
interface CreateApiConfig<T extends Record<string, GeneralDefinition>> {
    baseQuery: BaseQueryFn;
    endpoints: (builder: Builder) => T;
}
export declare function createApi<T extends Record<string, GeneralDefinition>>(config: CreateApiConfig<T>): CreateApiResult<T>;
export {};
//# sourceMappingURL=createApi.d.ts.map
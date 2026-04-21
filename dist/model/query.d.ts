import { QueryBuilderDefinition } from './types.js';
type QuerySignature<R, A, Raw = R> = Omit<QueryBuilderDefinition<R, A, Raw>, 'type'>;
export declare function query<R, A, Raw = R>(signature: QuerySignature<R, A, Raw>): QueryBuilderDefinition<R, A, Raw>;
export {};
//# sourceMappingURL=query.d.ts.map
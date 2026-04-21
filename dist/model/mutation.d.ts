import { MutationBuilderDefinition } from './types.js';
type MutationSignature<R, A, Raw = R> = Omit<MutationBuilderDefinition<R, A, Raw>, 'type'>;
export declare function mutation<R, A, Raw = R>(signature: MutationSignature<R, A, Raw>): MutationBuilderDefinition<R, A, Raw>;
export {};
//# sourceMappingURL=mutation.d.ts.map
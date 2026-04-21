import { typedCapitalize } from './typedCapitalize.js';
export function getHookName(key, type, lazy) {
    return `use${lazy}${typedCapitalize(key)}${typedCapitalize(type)}`;
}
//# sourceMappingURL=getHookName.js.map
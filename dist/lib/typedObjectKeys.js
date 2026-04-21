export function typedObjectKeys(obj) {
    const result = [];
    for (const keys in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, keys)) {
            result.push(keys);
        }
    }
    return result;
}
//# sourceMappingURL=typedObjectKeys.js.map
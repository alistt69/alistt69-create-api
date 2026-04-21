export function typedObjectKeys<T extends Record<string, unknown>>(obj: T): Extract<keyof T, string>[] {
    const result: Extract<keyof T, string>[] = [];

    for (const keys in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, keys)) {
            result.push(keys);
        }
    }

    return result;
}

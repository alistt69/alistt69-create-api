export function typedCapitalize<T extends string>(value: T): Capitalize<T> {
    return value.charAt(0).toUpperCase() + value.slice(1) as Capitalize<T>;
}

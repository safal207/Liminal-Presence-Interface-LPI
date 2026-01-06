const warned = new Set<string>();

export function warnDeprecated(name: string, replacement: string): void {
  if (warned.has(name)) {
    return;
  }

  warned.add(name);
  // eslint-disable-next-line no-console
  console.warn(`${name} is deprecated. Use ${replacement} instead.`);
}

export function createDeprecatedFunction<T extends (...args: never[]) => unknown>(
  name: string,
  replacement: string,
  fn: T
): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    warnDeprecated(name, replacement);
    return fn(...args);
  }) as T;
}

export function createDeprecatedClass<T extends new (...args: never[]) => unknown>(
  name: string,
  replacement: string,
  Klass: T
): T {
  return class Deprecated extends (Klass as new (...args: never[]) => unknown) {
    constructor(...args: Parameters<T>) {
      warnDeprecated(name, replacement);
      super(...args);
    }
  } as T;
}

export function resetDeprecatedWarnings(): void {
  warned.clear();
}

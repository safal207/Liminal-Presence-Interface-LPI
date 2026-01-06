const warned = new Set<string>();

export function warnDeprecated(name: string, replacement: string): void {
  if (process.env.LPI_NO_DEPRECATION_WARNINGS === '1') {
    return;
  }

  if (warned.has(name)) {
    return;
  }

  warned.add(name);
  // eslint-disable-next-line no-console
  console.warn(`[node-lri] ${name} is deprecated. Use ${replacement} instead.`);
}

export function createDeprecatedFunction<T extends (...args: any[]) => any>(
  name: string,
  replacement: string,
  fn: T
): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    warnDeprecated(name, replacement);
    return fn(...args);
  }) as T;
}

export function createDeprecatedClass<T extends new (...args: any[]) => any>(
  name: string,
  replacement: string,
  Klass: T
): T {
  return class Deprecated extends (Klass as new (...args: any[]) => any) {
    constructor(...args: ConstructorParameters<T>) {
      warnDeprecated(name, replacement);
      super(...args);
    }
  } as unknown as T;
}

export function resetDeprecatedWarnings(): void {
  warned.clear();
}

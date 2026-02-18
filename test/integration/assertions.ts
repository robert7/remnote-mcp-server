/**
 * Lightweight assertion functions for integration tests.
 * Each throws a descriptive error on failure — no vitest dependency.
 */

export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

export function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

export function assertTruthy(value: unknown, label: string): void {
  if (!value) {
    throw new AssertionError(`${label}: expected truthy value, got ${JSON.stringify(value)}`);
  }
}

export function assertContains(str: string, substr: string, label: string): void {
  if (!str.includes(substr)) {
    throw new AssertionError(
      `${label}: expected string to contain ${JSON.stringify(substr)}, got ${JSON.stringify(str)}`
    );
  }
}

export function assertHasField(obj: Record<string, unknown>, key: string, label: string): void {
  if (!(key in obj)) {
    throw new AssertionError(
      `${label}: expected object to have field "${key}", keys: [${Object.keys(obj).join(', ')}]`
    );
  }
}

export function assertIsArray(value: unknown, label: string): void {
  if (!Array.isArray(value)) {
    throw new AssertionError(`${label}: expected array, got ${typeof value}`);
  }
}

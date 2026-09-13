/**
 * Extract human-readable error message from any error type.
 * Preserves the original message without wrapping.
 */
export function extractActualErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error);
      return extractActualErrorMessage(parsed);
    } catch {
      return error;
    }
  }

  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;

    // Google API format: { error: { error: { message: "..." } } }
    if (obj.error && typeof obj.error === 'object') {
      const innerError = obj.error as Record<string, unknown>;
      if (innerError.error && typeof innerError.error === 'object') {
        const deepError = innerError.error as Record<string, unknown>;
        if (typeof deepError.message === 'string') return deepError.message;
      }
      // OpenAI format: { error: { message: "..." } }
      if (typeof innerError.message === 'string') return innerError.message;
      // Plain error string: { error: "..." }
      if (typeof innerError.error === 'string') return innerError.error;
    }

    // Direct message: { message: "..." }
    if (typeof obj.message === 'string') return obj.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

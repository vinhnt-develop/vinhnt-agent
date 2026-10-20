import * as path from 'node:path';

/**
 * True when `target` is the same as, or nested under, `root`.
 *
 * Uses `path.relative` (not `startsWith`) so `C:\root-evil` is not treated as
 * inside `C:\root`. On Windows the comparison is case-insensitive, matching the
 * filesystem's own semantics.
 */
export function isPathInside(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}

/** Absolute, normalized comparison key for path equality. */
export function pathKey(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function isSamePath(a: string, b: string): boolean {
  return pathKey(a) === pathKey(b);
}

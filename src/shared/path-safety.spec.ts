import * as path from 'node:path';
import { isPathInside, isSamePath, pathKey } from './path-safety';

const ROOT = path.resolve('D:/workspace/app');

describe('isPathInside', () => {
  it('accepts the root itself and nested paths', () => {
    expect(isPathInside(ROOT, ROOT)).toBe(true);
    expect(isPathInside(ROOT, path.join(ROOT, 'src', 'main.ts'))).toBe(true);
  });

  it('rejects parent traversal and sibling prefixes', () => {
    expect(isPathInside(ROOT, path.dirname(ROOT))).toBe(false);
    expect(isPathInside(ROOT, path.join(ROOT, '..', 'app-evil'))).toBe(false);
  });

  it('is case-insensitive on Windows', () => {
    if (process.platform !== 'win32') return;
    expect(isPathInside(ROOT, ROOT.toUpperCase())).toBe(true);
  });
});

describe('pathKey / isSamePath', () => {
  it('normalizes dot segments', () => {
    expect(pathKey(path.join(ROOT, '.', 'src', '..'))).toBe(pathKey(ROOT));
  });

  it('compares equal paths', () => {
    expect(isSamePath(ROOT, `${ROOT}${path.sep}`)).toBe(true);
  });
});

import * as path from 'node:path';
import { isUsableDirectory, resolveProjectPathFromDeps } from './project-path';

const WR = 'D:/ws-root';

function deps(over: Partial<{ project: Record<string, unknown>; workspace: Record<string, unknown>; session: Record<string, unknown> }> = {}) {
  return {
    session: { projectId: 'p1', ...(over.session || {}) },
    project: { name: 'app', workspaceId: 'w1', ...(over.project || {}) },
    workspace: { ...(over.workspace || {}) },
  } as never;
}

describe('isUsableDirectory', () => {
  it('rejects filesystem roots and dot values', () => {
    for (const v of ['/', '\\', '.', './', '.\\', '', '   ', null, undefined]) {
      expect(isUsableDirectory(v)).toBe(false);
    }
  });
  it('accepts real paths', () => {
    expect(isUsableDirectory('D:/code/app')).toBe(true);
    expect(isUsableDirectory('relative/sub')).toBe(true);
    expect(isUsableDirectory(' /tmp/x ')).toBe(true);
  });
});

describe('resolveProjectPathFromDeps', () => {
  it('uses absolute project.directory as-is (normalized)', () => {
    expect(resolveProjectPathFromDeps(deps({ project: { directory: 'D:/code/app' } }), WR)).toBe(
      path.normalize('D:/code/app'),
    );
  });

  it('resolves relative project.directory against workspaceRoot', () => {
    expect(resolveProjectPathFromDeps(deps({ project: { directory: 'sub' } }), WR)).toBe(
      path.resolve(WR, 'sub'),
    );
  });

  it('treats "/" project.directory as unset (no drive root)', () => {
    expect(resolveProjectPathFromDeps(deps({ project: { directory: '/' } }), WR)).toBeUndefined();
  });

  it('returns undefined when project.directory unset (no workspace fallback)', () => {
    expect(resolveProjectPathFromDeps(deps({ project: { directory: null } }), WR)).toBeUndefined();
    expect(
      resolveProjectPathFromDeps(deps({ project: { directory: '/' } }), WR),
    ).toBeUndefined();
  });

  it('returns undefined without projectId', () => {
    expect(resolveProjectPathFromDeps(deps({ session: { projectId: null } }), WR)).toBeUndefined();
  });
});

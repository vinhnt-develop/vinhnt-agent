import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { FilesystemService } from './filesystem.service';

describe('FilesystemService', () => {
  let tmp: string;
  let outside: string;
  let home: string;
  let service: FilesystemService;
  const originalRoots = process.env.AGENT_BROWSE_ROOTS;
  const originalHome = process.env.AGENT_BROWSE_HOME;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vinhnt-fs-'));
    outside = await fs.mkdtemp(path.join(os.tmpdir(), 'vinhnt-fs-out-'));
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'vinhnt-home-'));
    process.env.AGENT_BROWSE_HOME = home;
    await fs.mkdir(path.join(tmp, 'project-a'));
    await fs.mkdir(path.join(tmp, '.hidden'));
    await fs.writeFile(path.join(tmp, 'notes.txt'), 'x');

    process.env.AGENT_BROWSE_ROOTS = tmp;
    service = new FilesystemService({
      getWorkspaceRoot: () => tmp,
    } as never);
  });

  afterEach(async () => {
    if (originalHome === undefined) delete process.env.AGENT_BROWSE_HOME;
    else process.env.AGENT_BROWSE_HOME = originalHome;
    if (originalRoots === undefined) delete process.env.AGENT_BROWSE_ROOTS;
    else process.env.AGENT_BROWSE_ROOTS = originalRoots;
    await fs.rm(tmp, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
    await fs.rm(home, { recursive: true, force: true });
  });

  it('exposes the workspace root as an allowed root', async () => {
    const roots = await service.getRoots();
    const workspace = roots.find((root) => root.kind === 'workspace');
    expect(workspace?.path.toLowerCase()).toBe(
      (await fs.realpath(tmp)).toLowerCase(),
    );
  });

  it('uses saved runtime roots/home over the env seed', async () => {
    const extra = await fs.mkdtemp(path.join(os.tmpdir(), 'vinhnt-fs-extra-'));
    try {
      service = new FilesystemService({
        getWorkspaceRoot: () => tmp,
        getBrowseRoots: () => [extra],
        getBrowseHome: () => home,
      } as never);
      const roots = await service.getRoots();
      expect(roots.find((root) => root.kind === 'home')?.path.toLowerCase()).toBe(
        (await fs.realpath(home)).toLowerCase(),
      );
      expect(roots.find((root) => root.kind === 'custom')?.path.toLowerCase()).toBe(
        (await fs.realpath(extra)).toLowerCase(),
      );
    } finally {
      await fs.rm(extra, { recursive: true, force: true });
    }
  });

  it('lists only child directories and marks the workspace root', async () => {
    const result = await service.listDirectories(tmp);
    expect(result.isRoot).toBe(true);
    expect(result.parent).toBeUndefined();
    expect(result.entries.map((entry) => entry.name)).toEqual(['project-a']);
  });

  it('navigates to a child and reports its parent', async () => {
    const result = await service.listDirectories(
      path.join(tmp, 'project-a'),
    );
    expect(result.isRoot).toBe(false);
    expect(result.parent?.toLowerCase()).toBe(
      (await fs.realpath(tmp)).toLowerCase(),
    );
  });

  it('rejects paths outside the allowed roots', async () => {
    await expect(service.listDirectories(outside)).rejects.toMatchObject({
      status: 403,
      response: { errorCode: 'PATH_NOT_ALLOWED' },
    });
  });

  it('rejects traversal through a parent directory', async () => {
    await expect(
      service.listDirectories(path.join(tmp, '..')),
    ).rejects.toMatchObject({
      status: 403,
      response: { errorCode: 'PATH_NOT_ALLOWED' },
    });
  });

  it('creates a folder inside an allowed parent', async () => {
    const result = await service.createFolder(tmp, 'project-b');
    expect(result.path).toBe(path.join(await fs.realpath(tmp), 'project-b'));
    await expect(fs.stat(result.path)).resolves.toMatchObject({});
  });

  it('refuses folder names that escape the parent', async () => {
    for (const name of ['..', '../escape', '..\\escape', 'a/b']) {
      await expect(service.createFolder(tmp, name)).rejects.toMatchObject({
        status: 400,
        response: { errorCode: 'INVALID_FOLDER_NAME' },
      });
    }
  });

  it('refuses to create a duplicate folder', async () => {
    await expect(
      service.createFolder(tmp, 'project-a'),
    ).rejects.toMatchObject({
      status: 409,
      response: { errorCode: 'FOLDER_EXISTS' },
    });
  });

  it('validates a missing path that is inside an allowed root', async () => {
    await expect(
      service.validateDirectory(path.join(tmp, 'not-yet')),
    ).resolves.toMatchObject({ exists: false, isDirectory: false });
  });

  it('validates an existing directory', async () => {
    await expect(
      service.validateDirectory(path.join(tmp, 'project-a')),
    ).resolves.toMatchObject({
      exists: true,
      isDirectory: true,
      readable: true,
    });
  });
});

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { FileExplorerService } from './file-explorer.service';

describe('FileExplorerService', () => {
  let root: string;
  let outside: string;
  let service: FileExplorerService;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vinhnt-tree-'));
    outside = await fs.mkdtemp(path.join(os.tmpdir(), 'vinhnt-tree-out-'));
    await fs.mkdir(path.join(root, 'src'));
    await fs.writeFile(path.join(root, 'src', 'main.ts'), 'export {}');
    await fs.writeFile(path.join(root, 'readme.md'), '# hi');
    await fs.writeFile(path.join(outside, 'secret.txt'), 'x');
    service = new FileExplorerService();
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });

  it('lists a directory with root-relative posix paths', async () => {
    const nodes = await service.getTree(root);
    expect(nodes.map((node) => node.path)).toContain('src');
    expect(nodes.map((node) => node.path)).toContain('readme.md');
    const nested = await service.getTree(root, 'src');
    expect(nested.map((node) => node.path)).toEqual(['src/main.ts']);
  });

  it('accepts an absolute path inside the root', async () => {
    const nodes = await service.getTree(root, path.join(root, 'src'));
    expect(nodes.map((node) => node.name)).toEqual(['main.ts']);
  });

  it('rejects parent traversal', async () => {
    await expect(service.getTree(root, '..')).rejects.toMatchObject({
      status: 403,
      response: { errorCode: 'PATH_OUTSIDE_ROOT' },
    });
  });

  it('rejects absolute paths outside the root', async () => {
    await expect(service.getTree(root, outside)).rejects.toMatchObject({
      status: 403,
      response: { errorCode: 'PATH_OUTSIDE_ROOT' },
    });
  });

  it('rejects sibling prefixes that merely start with the root name', async () => {
    const sibling = `${root}-evil`;
    await fs.mkdir(sibling);
    try {
      await expect(service.getTree(root, sibling)).rejects.toMatchObject({
        status: 403,
      });
    } finally {
      await fs.rm(sibling, { recursive: true, force: true });
    }
  });

  it('does not read files outside the root', async () => {
    await expect(
      service.getFileContent(root, path.join(outside, 'secret.txt')),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('reads a file inside the root', async () => {
    await expect(service.getFileContent(root, 'readme.md')).resolves.toMatchObject(
      { content: '# hi', mimeType: 'text/markdown' },
    );
  });

  it('returns 404 for missing paths', async () => {
    await expect(service.getTree(root, 'missing')).rejects.toMatchObject({
      status: 404,
    });
  });
});

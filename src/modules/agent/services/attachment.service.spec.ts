import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  AttachmentService,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_TOTAL_CHARS,
} from './attachment.service';

describe('AttachmentService', () => {
  let root: string;
  let outside: string;
  let service: AttachmentService;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vinhnt-attach-'));
    outside = await fs.mkdtemp(path.join(os.tmpdir(), 'vinhnt-outside-'));
    service = new AttachmentService();
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });

  it('inlines a small text file and keeps the original prompt', async () => {
    await fs.writeFile(path.join(root, 'hello.ts'), 'export const x = 1;\n');

    const prompt = await service.preparePrompt(
      'Summarise this.',
      ['hello.ts'],
      root,
    );

    expect(prompt).toContain('Summarise this.');
    expect(prompt).toContain('## Attached files');
    expect(prompt).toContain('### hello.ts (20 bytes)');
    expect(prompt).toContain('```ts');
    expect(prompt).toContain('export const x = 1;');
  });

  it('uses a longer fence when the file contains triple backticks', async () => {
    await fs.writeFile(path.join(root, 'notes.md'), '```ts\ncode\n```\n');

    const prompt = await service.preparePrompt('Read', ['notes.md'], root);

    expect(prompt).toContain('````markdown');
    expect(prompt).toContain('````');
  });

  it('rejects files outside the project root', async () => {
    await fs.writeFile(path.join(outside, 'secret.txt'), 'nope');

    await expect(
      service.preparePrompt('Read', ['../secret.txt'], root),
    ).rejects.toMatchObject({
      response: { errorCode: 'ATTACHMENT_INVALID' },
    });

    await expect(
      service.preparePrompt(
        'Read',
        [path.join(outside, 'secret.txt')],
        root,
      ),
    ).rejects.toMatchObject({
      response: { errorCode: 'ATTACHMENT_INVALID' },
    });
  });

  it('rejects missing paths and directories', async () => {
    await fs.mkdir(path.join(root, 'src'));

    await expect(
      service.preparePrompt('Read', ['missing.txt'], root),
    ).rejects.toThrow('does not exist');

    await expect(
      service.preparePrompt('Read', ['src'], root),
    ).rejects.toThrow('not a file');
  });

  it('attaches images as multimodal content', async () => {
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl6sAAAAASUVORK5CYII=';
    await fs.writeFile(path.join(root, 'pixel.png'), Buffer.from(png, 'base64'));

    const prepared = await service.prepareInput('Look', ['pixel.png'], root);

    expect(prepared.prompt).toContain('Image attached as multimodal content');
    expect(prepared.images).toEqual([
      {
        dataUrl: `data:image/png;base64,${png}`,
        mimeType: 'image/png',
        name: 'pixel.png',
      },
    ]);
  });

  it('does not inline large or binary files and points to read_file', async () => {
    await fs.writeFile(
      path.join(root, 'large.txt'),
      Buffer.alloc(256 * 1024 + 1, 0x61),
    );
    await fs.writeFile(path.join(root, 'bin.dat'), Buffer.from([0, 1, 2]));

    const prompt = await service.preparePrompt(
      'Inspect',
      ['large.txt', 'bin.dat'],
      root,
    );

    expect(prompt).toContain('File too large to inline');
    expect(prompt).toContain('Binary file not inlined');
    expect(prompt).toContain('read_file');
  });

  it('caps the total inlined text budget', async () => {
    await fs.writeFile(
      path.join(root, 'big.txt'),
      'a'.repeat(MAX_ATTACHMENT_TOTAL_CHARS + 500),
    );

    const prompt = await service.preparePrompt('Read', ['big.txt'], root);

    expect(prompt).toContain('[Truncated: total attachment text budget reached]');
    expect(prompt.length).toBeLessThan(MAX_ATTACHMENT_TOTAL_CHARS + 1_000);
  });

  it('deduplicates repeated paths and rejects too many attachments', async () => {
    await fs.writeFile(path.join(root, 'a.txt'), 'a');

    const prompt = await service.preparePrompt(
      'Read',
      ['a.txt', './a.txt'],
      root,
    );
    expect(prompt.match(/### a\.txt/g)).toHaveLength(1);

    await expect(
      service.preparePrompt(
        'Read',
        Array.from({ length: MAX_ATTACHMENTS + 1 }, () => 'a.txt'),
        root,
      ),
    ).rejects.toThrow(`max ${MAX_ATTACHMENTS}`);
  });

  it('saves uploads under the project .vinhnt directory', async () => {
    const saved = await service.saveUpload(
      { originalname: 'notes.txt', buffer: Buffer.from('hello upload') },
      root,
      'session-1',
    );

    expect(saved.path).toBe('.vinhnt/uploads/session-1/' + saved.path.split('/').pop());
    expect(saved.name).toBe('notes.txt');
    expect(saved.size).toBe(12);
    await expect(
      fs.readFile(path.join(root, saved.path), 'utf8'),
    ).resolves.toBe('hello upload');
  });

  it('sanitizes upload names and rejects path traversal segments', async () => {
    const saved = await service.saveUpload(
      { originalname: '../evil.txt', buffer: Buffer.from('x') },
      root,
      '../escape',
    );

    expect(saved.path).not.toContain('..');
    expect(saved.path).toContain('.vinhnt/uploads/_escape/');
    expect(saved.name).toBe('evil.txt');
    expect(saved.path).toContain('evil.txt');
  });

  it('rejects empty uploads', async () => {
    await expect(
      service.saveUpload(
        { originalname: 'empty.txt', buffer: Buffer.alloc(0) },
        root,
        'session-1',
      ),
    ).rejects.toMatchObject({
      response: { errorCode: 'ATTACHMENT_INVALID' },
    });
  });
});

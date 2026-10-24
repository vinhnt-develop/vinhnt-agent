import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createPagedReadFileTool, readFileRange } from './paged-read-file.tool';

describe('paged read_file', () => {
  let root: string;
  let file: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'paged-read-'));
    file = join(root, 'sample.txt');
    await writeFile(file, ['one', 'two', 'three', 'four', 'five'].join('\n'), 'utf8');
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('reads the whole file by default', async () => {
    const result = await readFileRange(file, { filePath: 'sample.txt' });

    expect(result.content).toBe('one\ntwo\nthree\nfour\nfive');
    expect(result.startLine).toBe(1);
    expect(result.endLine).toBe(5);
    expect(result.lines).toBe(5);
    expect(result.truncated).toBe(false);
    expect(result.totalLines).toBe(5);
    expect(result.nextOffset).toBeUndefined();
  });

  it('returns a line range with nextOffset', async () => {
    const result = await readFileRange(file, {
      filePath: 'sample.txt',
      offset: 2,
      limit: 2,
    });

    expect(result.content).toBe('two\nthree');
    expect(result.startLine).toBe(2);
    expect(result.endLine).toBe(3);
    expect(result.truncated).toBe(true);
    expect(result.nextOffset).toBe(4);
    expect(result.totalLines).toBeUndefined();
  });

  it('does not mark the file truncated when the limit lands at EOF', async () => {
    const result = await readFileRange(file, {
      filePath: 'sample.txt',
      offset: 2,
      limit: 4,
    });

    expect(result.content).toBe('two\nthree\nfour\nfive');
    expect(result.truncated).toBe(false);
    expect(result.totalLines).toBe(5);
  });

  it('rejects binary files', async () => {
    const binary = join(root, 'binary.dat');
    await writeFile(binary, Buffer.from([0x61, 0x00, 0x62]));

    await expect(
      readFileRange(binary, { filePath: 'binary.dat' }),
    ).rejects.toThrow('Cannot read binary file as text');
  });

  it('registers as a read_file tool and tracks the read', async () => {
    const trackRead = jest.fn().mockResolvedValue(undefined);
    const tool = createPagedReadFileTool(root, { trackRead } as never);

    const result = (await tool.execute(
      { filePath: 'sample.txt', offset: 1, limit: 1 },
      {
        ask: jest.fn().mockResolvedValue('once'),
        sanitizeLimitChars: 100_000,
      } as never,
    )) as { content: string; nextOffset?: number };

    expect(tool.id).toBe('read_file');
    expect(result.content).toBe('one');
    expect(result.nextOffset).toBe(2);
    expect(trackRead).toHaveBeenCalledWith(file, expect.anything());
  });
});

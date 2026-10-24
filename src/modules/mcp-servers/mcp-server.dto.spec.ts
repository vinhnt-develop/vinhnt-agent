import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { CreateMcpServerDto, UpdateMcpServerDto } from './dto';

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const bodyMeta = (metatype: new () => unknown): ArgumentMetadata => ({
  type: 'body',
  metatype,
});

describe('MCP server DTO validation', () => {
  it('keeps headers and timeoutMs when whitelisting create bodies', async () => {
    const out = (await pipe.transform(
      {
        name: 'remote',
        transport: 'streamable-http',
        url: 'http://localhost:3001/mcp',
        headers: { Authorization: 'Bearer test' },
        timeoutMs: '45000',
      },
      bodyMeta(CreateMcpServerDto),
    )) as CreateMcpServerDto;

    expect(out.headers).toEqual({ Authorization: 'Bearer test' });
    expect(out.timeoutMs).toBe(45_000);
  });

  it('keeps headers and timeoutMs when whitelisting update bodies', async () => {
    const out = (await pipe.transform(
      {
        headers: { 'X-Api-Key': 'secret' },
        timeoutMs: 60_000,
      },
      bodyMeta(UpdateMcpServerDto),
    )) as UpdateMcpServerDto;

    expect(out.headers).toEqual({ 'X-Api-Key': 'secret' });
    expect(out.timeoutMs).toBe(60_000);
  });

  it('keeps nested governance when whitelisting create bodies', async () => {
    const out = (await pipe.transform(
      {
        name: 'remote',
        transport: 'sse',
        url: 'http://x',
        governance: {
          allowedTools: ['read_file'],
          deniedTools: ['delete_file'],
          maxOutputBytes: 0,
          spillDir: 'C:/tmp/spill',
          searchThreshold: 10,
        },
      },
      bodyMeta(CreateMcpServerDto),
    )) as CreateMcpServerDto;

    expect(out.governance).toMatchObject({
      allowedTools: ['read_file'],
      deniedTools: ['delete_file'],
      maxOutputBytes: 0,
      spillDir: 'C:/tmp/spill',
      searchThreshold: 10,
    });
  });

  it('rejects a timeout outside the supported range', async () => {
    await expect(
      pipe.transform(
        { name: 'remote', transport: 'sse', url: 'http://x', timeoutMs: 500 },
        bodyMeta(CreateMcpServerDto),
      ),
    ).rejects.toThrow();
  });

  it('rejects malformed governance values', async () => {
    await expect(
      pipe.transform(
        {
          name: 'remote',
          transport: 'sse',
          url: 'http://x',
          governance: { allowedTools: 'read_file', searchThreshold: 0 },
        },
        bodyMeta(CreateMcpServerDto),
      ),
    ).rejects.toThrow();
  });
});

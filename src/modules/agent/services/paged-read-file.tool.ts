import { createReadStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

import {
  ensurePathAccess,
  resolveToolRoot,
  type FileReadTracker,
  type ToolDefinition,
} from '@vinhnt-sdk/tools';
import { ValidationError } from '@vinhnt-sdk/schema';
import { sanitizeForLLM } from '@vinhnt-sdk/guard';

const DEFAULT_LINE_LIMIT = 2_000;
const MAX_LINE_LIMIT = 5_000;
const BINARY_SNIFF_BYTES = 8_192;

export interface ReadFileRangeInput {
  filePath: string;
  offset?: number;
  limit?: number;
  stripTrailingNewline?: boolean;
}

export interface ReadFileRangeResult {
  filePath: string;
  startLine: number;
  endLine: number;
  lines: number;
  bytes: number;
  truncated: boolean;
  totalLines?: number;
  nextOffset?: number;
  content: string;
}

function normalizePositiveInteger(
  value: unknown,
  field: string,
  fallback?: number,
): number | undefined {
  if (value === undefined || value === null) return fallback;
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (
    typeof parsed !== 'number' ||
    !Number.isFinite(parsed) ||
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
  return parsed;
}

async function assertTextFile(target: string): Promise<Stats> {
  const st = await stat(target);
  if (!st.isFile()) {
    throw new ValidationError(`Not a file: ${target}`);
  }

  const handle = await open(target, 'r');
  try {
    const sniff = Buffer.alloc(Math.min(BINARY_SNIFF_BYTES, st.size));
    if (sniff.length > 0) {
      await handle.read(sniff, 0, sniff.length, 0);
      if (sniff.includes(0)) {
        throw new ValidationError(
          `Cannot read binary file as text: ${target}. Use an image/binary-specific tool instead.`,
        );
      }
    }
  } finally {
    await handle.close();
  }

  return st;
}

export async function readFileRange(
  target: string,
  input: ReadFileRangeInput,
  maxChars = 120_000,
): Promise<ReadFileRangeResult> {
  const offset = normalizePositiveInteger(input.offset, 'offset', 1) as number;
  const requestedLimit = normalizePositiveInteger(input.limit, 'limit', DEFAULT_LINE_LIMIT) as number;
  const limit = Math.min(requestedLimit, MAX_LINE_LIMIT);
  const st = await assertTextFile(target);

  const startLine = offset;
  const collected: string[] = [];
  let endLine = startLine - 1;
  let truncated = false;
  let totalLines: number | undefined;
  let chars = 0;
  let lineNumber = 0;
  const budget = Math.max(1_000, maxChars);

  const stream = createReadStream(target, { encoding: 'utf8' });
  const reader = createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const rawLine of reader) {
      lineNumber += 1;
      if (lineNumber < startLine) continue;

      const line = input.stripTrailingNewline ? rawLine.replace(/\r$/, '') : rawLine;
      if (collected.length >= limit || chars + line.length + 1 > budget) {
        truncated = true;
        break;
      }

      collected.push(line);
      chars += line.length + 1;
      endLine = lineNumber;
    }
  } finally {
    reader.close();
    stream.destroy();
  }

  if (!truncated) {
    totalLines = lineNumber;
  } else if (endLine < startLine) {
    endLine = startLine - 1;
  }

  const content = collected.join('\n');
  const sanitized = sanitizeForLLM(content);

  return {
    filePath: target,
    startLine,
    endLine,
    lines: collected.length,
    bytes: st.size,
    truncated,
    ...(totalLines !== undefined ? { totalLines } : {}),
    ...(truncated && collected.length > 0 ? { nextOffset: endLine + 1 } : {}),
    content: sanitized,
  };
}

export function createPagedReadFileTool(
  workspaceRoot: string | (() => string),
  tracker: FileReadTracker,
): ToolDefinition {
  return {
    id: 'read_file',
    name: 'Read File',
    description:
      'Read a UTF-8 text file. Use offset/limit for large files; the result reports truncated, nextOffset, and totalLines so you can continue without re-reading the whole file.',
    risk: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file, relative to the workspace root or absolute.',
        },
        path: {
          type: 'string',
          description: 'Alias for filePath.',
        },
        offset: {
          type: 'number',
          description: 'First line to read (1-based). Defaults to 1.',
        },
        limit: {
          type: 'number',
          description: `Maximum lines to return (default ${DEFAULT_LINE_LIMIT}, max ${MAX_LINE_LIMIT}).`,
        },
        stripTrailingNewline: {
          type: 'boolean',
          description: 'Remove a trailing CR from each returned line.',
        },
      },
      required: ['filePath'],
    },
    async execute(args, ctx) {
      const input = args as unknown as ReadFileRangeInput & { path?: string };
      const filePath =
        typeof input?.filePath === 'string' && input.filePath.trim() !== ''
          ? input.filePath
          : typeof input?.path === 'string'
            ? input.path
            : '';
      if (!filePath) {
        throw new ValidationError('filePath is required');
      }

      const root = resolveToolRoot(workspaceRoot, ctx);
      const safeTarget = await ensurePathAccess(
        resolve(root, filePath),
        root,
        `read ${filePath}`,
        ctx,
        undefined,
      );
      const result = await readFileRange(
        safeTarget,
        { ...input, filePath },
        ctx.sanitizeLimitChars ?? 120_000,
      );
      await tracker.trackRead(safeTarget, await stat(safeTarget));
      return result;
    },
  };
}

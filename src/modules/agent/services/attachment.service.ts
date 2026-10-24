import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { isPathInside, pathKey } from '@/shared/path-safety';
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  MAX_IMAGE_TOTAL_BYTES,
  type ImageAttachmentInput,
} from './image-attachment.service';

export const MAX_ATTACHMENTS = 20;
export const MAX_ATTACHMENT_TOTAL_CHARS = 200_000;
export const MAX_ATTACHMENT_FILE_BYTES = 256 * 1024;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface UploadedFileInput {
  originalname?: string;
  size?: number;
  buffer?: Buffer;
}

export interface SavedUpload {
  path: string;
  name: string;
  size: number;
  mimeType?: string;
}

const IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.png',
  '.webp',
]);

interface PreparedFile {
  displayPath: string;
  absolutePath: string;
  size: number;
  content?: string;
  note?: string;
}

function attachmentError(message: string): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    error: 'ATTACHMENT_INVALID',
    errorCode: 'ATTACHMENT_INVALID',
    message,
  });
}

function languageFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const aliases: Record<string, string> = {
    ts: 'ts',
    tsx: 'tsx',
    js: 'js',
    jsx: 'jsx',
    py: 'python',
    rs: 'rust',
    sh: 'bash',
    yml: 'yaml',
    md: 'markdown',
  };
  return aliases[ext] ?? ext;
}

function fenceFor(content: string): string {
  let longest = 0;
  let current = 0;
  for (const char of content) {
    if (char === '`') {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return '`'.repeat(Math.max(3, longest + 1));
}

function looksBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  return sample.includes(0);
}

function isImage(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function imageMimeType(filePath: string): string | undefined {
  switch (path.extname(filePath).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return undefined;
  }
}

export interface PreparedAttachmentInput {
  prompt: string;
  images: ImageAttachmentInput[];
}

@Injectable()
export class AttachmentService {
  /**
   * Resolve composer attachments inside the project root, pre-read small text
   * files, and append them to the prompt. Large/binary files are never
   * inlined; the model gets an explicit pointer to read_file/read_image.
   */
  async preparePrompt(
    prompt: string,
    attachments: string[] | undefined,
    rootDir: string,
  ): Promise<string> {
    return (await this.prepareInput(prompt, attachments, rootDir)).prompt;
  }

  async prepareInput(
    prompt: string,
    attachments: string[] | undefined,
    rootDir: string,
  ): Promise<PreparedAttachmentInput> {
    if (!attachments || attachments.length === 0) {
      return { prompt, images: [] };
    }

    if (!Array.isArray(attachments)) {
      throw attachmentError('attachments must be an array of project-relative paths');
    }
    if (attachments.length > MAX_ATTACHMENTS) {
      throw attachmentError(
        `Too many attachments (max ${MAX_ATTACHMENTS})`,
      );
    }

    let root: string;
    try {
      root = await fs.realpath(path.resolve(rootDir));
    } catch {
      throw attachmentError(`Project directory is not available: ${rootDir}`);
    }

    const files: PreparedFile[] = [];
    const seen = new Set<string>();

    for (const requested of attachments) {
      if (typeof requested !== 'string' || requested.trim().length === 0) {
        throw attachmentError('Attachment paths must be non-empty strings');
      }

      const candidate = path.isAbsolute(requested)
        ? path.normalize(requested)
        : path.resolve(root, requested);

      let target: string;
      try {
        target = await fs.realpath(candidate);
      } catch {
        throw attachmentError(`Attachment does not exist: ${requested}`);
      }

      if (!isPathInside(root, target)) {
        throw attachmentError(
          `Attachment is outside the project directory: ${requested}`,
        );
      }
      if (seen.has(pathKey(target))) continue;

      let stat: Awaited<ReturnType<typeof fs.stat>>;
      try {
        stat = await fs.stat(target);
      } catch {
        throw attachmentError(`Attachment is not readable: ${requested}`);
      }
      if (!stat.isFile()) {
        throw attachmentError(`Attachment is not a file: ${requested}`);
      }

      seen.add(pathKey(target));
      files.push({
        displayPath: path.relative(root, target).split(path.sep).join('/'),
        absolutePath: target,
        size: stat.size,
      });
    }

    if (files.length === 0) return { prompt, images: [] };

    const images: ImageAttachmentInput[] = [];
    let imageBytes = 0;
    let remaining = MAX_ATTACHMENT_TOTAL_CHARS;

    for (const file of files) {
      if (isImage(file.absolutePath)) {
        const mimeType = imageMimeType(file.absolutePath);
        if (!mimeType) {
          file.note = `Unsupported image format. Use read_image with path "${file.displayPath}" if needed.`;
          continue;
        }
        if (images.length >= MAX_IMAGES_PER_MESSAGE) {
          file.note = `Skipped: at most ${MAX_IMAGES_PER_MESSAGE} images can be attached per message.`;
          continue;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          file.note = `Image too large to attach (${file.size} bytes, max ${MAX_IMAGE_BYTES}).`;
          continue;
        }
        if (imageBytes + file.size > MAX_IMAGE_TOTAL_BYTES) {
          file.note = `Skipped: the total image payload budget is exhausted.`;
          continue;
        }

        let buffer: Buffer;
        try {
          buffer = await fs.readFile(file.absolutePath);
        } catch {
          file.note = `Unreadable image. Use read_image with path "${file.displayPath}".`;
          continue;
        }
        images.push({
          dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
          mimeType,
          name: file.displayPath,
        });
        imageBytes += buffer.length;
        file.note = `Image attached as multimodal content (${mimeType}, ${file.size} bytes).`;
        continue;
      }

      if (remaining <= 0) {
        file.note = 'Skipped: the total attachment text budget is exhausted.';
        continue;
      }
      if (file.size > MAX_ATTACHMENT_FILE_BYTES) {
        file.note = `File too large to inline (${file.size} bytes). Use read_file with path "${file.displayPath}" if you need its contents.`;
        continue;
      }

      let buffer: Buffer;
      try {
        buffer = await fs.readFile(file.absolutePath);
      } catch {
        file.note = `Unreadable file. Use read_file with path "${file.displayPath}".`;
        continue;
      }
      if (looksBinary(buffer)) {
        file.note = `Binary file not inlined. Use read_file with path "${file.displayPath}" if needed.`;
        continue;
      }

      let content = buffer.toString('utf8').replace(/^\uFEFF/, '');
      if (content.length > remaining) {
        content = content.slice(0, remaining);
        content += '\n\n[Truncated: total attachment text budget reached]';
      }
      remaining -= Math.min(content.length, remaining);
      file.content = content;
    }

    const blocks = files.map((file) => {
      const header = `### ${file.displayPath} (${file.size} bytes)`;
      if (file.note) return `${header}\n${file.note}`;

      const content = file.content ?? '';
      const fence = fenceFor(content);
      const language = languageFor(file.absolutePath);
      return `${header}\n${fence}${language}\n${content}\n${fence}`;
    });

    return {
      prompt: [
        prompt,
        '',
        '## Attached files',
        '',
        'The user attached the following project files. Contents are inlined for this message; use the file tools if a file was skipped or truncated.',
        '',
        blocks.join('\n\n'),
      ].join('\n'),
      images,
    };
  }

  /**
   * Persist a browser upload inside the project so the existing attachment
   * pipeline can read it by relative path. Files live under
   * `.vinhnt/uploads/<sessionId>/` and never escape the project root.
   */
  async saveUpload(
    file: UploadedFileInput,
    rootDir: string,
    sessionId: string,
  ): Promise<SavedUpload> {
    if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw attachmentError('Upload is empty.');
    }
    if (file.buffer.length > MAX_UPLOAD_BYTES) {
      throw attachmentError(
        `Upload is too large (${file.buffer.length} bytes, max ${MAX_UPLOAD_BYTES}).`,
      );
    }

    const sessionSegment = sanitizeName(sessionId, 'session');
    let root: string;
    try {
      root = await fs.realpath(path.resolve(rootDir));
    } catch {
      throw attachmentError(`Project directory is not available: ${rootDir}`);
    }

    const uploadDir = path.join(root, '.vinhnt', 'uploads', sessionSegment);
    if (!isPathInside(root, uploadDir)) {
      throw attachmentError('Invalid upload directory.');
    }
    await fs.mkdir(uploadDir, { recursive: true });

    const originalName = sanitizeName(
      path.basename(file.originalname || 'upload.bin'),
      'upload.bin',
    );
    const ext = path.extname(originalName).slice(0, 20);
    const stem = path.basename(originalName, ext).slice(0, 80) || 'upload';
    const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${stem}${ext}`;
    const target = path.join(uploadDir, fileName);

    if (!isPathInside(root, target)) {
      throw attachmentError('Invalid upload path.');
    }

    await fs.writeFile(target, file.buffer, { flag: 'wx' });
    const relativePath = path.relative(root, target).split(path.sep).join('/');

    return {
      path: relativePath,
      name: originalName,
      size: file.buffer.length,
    };
  }
}

function sanitizeName(value: string, fallback: string): string {
  const cleaned = value
    .normalize('NFKC')
    .replace(/\p{Cc}/gu, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : fallback;
}

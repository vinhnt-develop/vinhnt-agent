import { ValidationError } from '@vinhnt-sdk/schema';
import type { ContentPart } from '@vinhnt-sdk/core';

export const MAX_IMAGES_PER_MESSAGE = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_TOTAL_BYTES = 10 * 1024 * 1024;

export interface ImageAttachmentInput {
  dataUrl: string;
  mimeType?: string;
  name?: string;
}

interface DecodedImage {
  mimeType: SupportedImageMime;
  base64: string;
  bytes: number;
}

type SupportedImageMime =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/gif';

const DATA_URL_PATTERN =
  /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/;

const MIME_ALIASES: Record<string, SupportedImageMime> = {
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
};

function normalizeMime(value: string): SupportedImageMime {
  const normalized = MIME_ALIASES[value.toLowerCase()];
  if (!normalized) {
    throw new ValidationError(
      `Unsupported image type "${value}". Use PNG, JPEG, WebP, or GIF.`,
    );
  }
  return normalized;
}

function hasMagicBytes(buffer: Buffer, mimeType: SupportedImageMime): boolean {
  if (mimeType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
    );
  }
  if (mimeType === 'image/jpeg') {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }
  if (mimeType === 'image/gif') {
    const header = buffer.subarray(0, 6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  }
  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

function decodeImage(input: ImageAttachmentInput, index: number): DecodedImage {
  const label = input.name?.trim() || `image ${index + 1}`;
  if (!input || typeof input.dataUrl !== 'string') {
    throw new ValidationError(`${label}: dataUrl must be a base64 data URL`);
  }

  const match = DATA_URL_PATTERN.exec(input.dataUrl.trim());
  if (!match) {
    throw new ValidationError(
      `${label}: expected data:image/(png|jpeg|webp|gif);base64,...`,
    );
  }

  const declaredMime = normalizeMime(input.mimeType ?? match[1]);
  const dataUrlMime = normalizeMime(match[1]);
  if (declaredMime !== dataUrlMime) {
    throw new ValidationError(
      `${label}: mimeType "${declaredMime}" does not match data URL "${dataUrlMime}"`,
    );
  }

  const base64 = match[2].replace(/\s+/g, '');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) {
    throw new ValidationError(`${label}: image data is empty`);
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ValidationError(
      `${label}: image is too large (${buffer.length} bytes, max ${MAX_IMAGE_BYTES})`,
    );
  }
  if (!hasMagicBytes(buffer, declaredMime)) {
    throw new ValidationError(
      `${label}: file contents are not a valid ${declaredMime} image`,
    );
  }

  return { mimeType: declaredMime, base64, bytes: buffer.length };
}

export function prepareUserContentParts(
  prompt: string,
  images: ImageAttachmentInput[] | undefined,
): ContentPart[] | undefined {
  if (!images || images.length === 0) return undefined;
  if (!Array.isArray(images)) {
    throw new ValidationError('images must be an array');
  }
  if (images.length > MAX_IMAGES_PER_MESSAGE) {
    throw new ValidationError(
      `Too many images (max ${MAX_IMAGES_PER_MESSAGE})`,
    );
  }

  let totalBytes = 0;
  const decoded = images.map((image, index) => {
    const result = decodeImage(image, index);
    totalBytes += result.bytes;
    return result;
  });
  if (totalBytes > MAX_IMAGE_TOTAL_BYTES) {
    throw new ValidationError(
      `Image payload is too large (${totalBytes} bytes, max ${MAX_IMAGE_TOTAL_BYTES})`,
    );
  }

  return [
    { type: 'text', text: prompt },
    ...decoded.map(
      (image): ContentPart => ({
        type: 'image_url',
        image_url: {
          url: `data:${image.mimeType};base64,${image.base64}`,
          detail: 'auto',
        },
      }),
    ),
  ];
}

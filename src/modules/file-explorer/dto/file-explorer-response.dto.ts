import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class FileTreeNodeResponseDto {
  @ApiProperty({ description: 'Node name', example: 'src', name: 'name', type: String })
  @Expose({ name: 'name' })
  name!: string;

  @ApiProperty({ description: 'Node path', example: 'src', name: 'path', type: String })
  @Expose({ name: 'path' })
  path!: string;

  @ApiProperty({ description: 'Node type', enum: ['file', 'directory'], example: 'directory', name: 'type', type: String })
  @Expose({ name: 'type' })
  type!: 'file' | 'directory';

  @ApiPropertyOptional({ description: 'File size in bytes', example: 1024, name: 'size', type: Number })
  @Expose({ name: 'size' })
  size?: number;

  @ApiPropertyOptional({ description: 'Last modified timestamp (ISO 8601)', example: '2026-09-03T00:00:00.000Z', name: 'modifiedAt', type: String })
  @Expose({ name: 'modifiedAt' })
  modifiedAt?: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true, name: 'metadata' })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class FileContentResponseDto {
  @ApiProperty({ description: 'File content', example: 'export function main() {}', name: 'content', type: String })
  @Expose({ name: 'content' })
  content!: string;

  @ApiProperty({ description: 'File size in bytes', example: 1024, name: 'size', type: Number })
  @Expose({ name: 'size' })
  size!: number;

  @ApiProperty({ description: 'MIME type', example: 'text/typescript', name: 'mimeType', type: String })
  @Expose({ name: 'mimeType' })
  mimeType!: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true, name: 'metadata' })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

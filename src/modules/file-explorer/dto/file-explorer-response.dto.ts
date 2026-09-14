import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class FileTreeNodeResponseDto {
  @ApiProperty({ description: 'Node name', example: 'src' })
  @Expose({ name: 'name' })
  name!: string;

  @ApiProperty({ description: 'Node path', example: 'src' })
  @Expose({ name: 'path' })
  path!: string;

  @ApiProperty({ description: 'Node type', enum: ['file', 'directory'], example: 'directory' })
  @Expose({ name: 'type' })
  type!: 'file' | 'directory';

  @ApiPropertyOptional({ description: 'File size in bytes', example: 1024 })
  @Expose({ name: 'size' })
  size?: number;

  @ApiPropertyOptional({ description: 'Last modified timestamp (ISO 8601)', example: '2026-09-03T00:00:00.000Z' })
  @Expose({ name: 'modified_at' })
  @Transform(({ obj }) => obj.modified_at ?? obj.modifiedAt)
  modifiedAt?: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class FileContentResponseDto {
  @ApiProperty({ description: 'File content', example: 'export function main() {}' })
  @Expose({ name: 'content' })
  content!: string;

  @ApiProperty({ description: 'File size in bytes', example: 1024 })
  @Expose({ name: 'size' })
  size!: number;

  @ApiProperty({ description: 'MIME type', example: 'text/typescript' })
  @Expose({ name: 'mime_type' })
  mimeType!: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}
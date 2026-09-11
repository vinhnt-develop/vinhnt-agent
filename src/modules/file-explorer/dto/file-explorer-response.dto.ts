import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class FileTreeNodeResponseDto {
  @ApiProperty({ name: 'name', type: 'string', example: 'src' })
  @Expose({ name: 'name' })
  name!: string;

  @ApiProperty({ name: 'path', type: 'string', example: 'src' })
  @Expose({ name: 'path' })
  path!: string;

  @ApiProperty({ name: 'type', type: 'string', enum: ['file', 'directory'] })
  @Expose({ name: 'type' })
  type!: 'file' | 'directory';

  @ApiPropertyOptional({ name: 'size', type: 'number', example: 1024 })
  @Expose({ name: 'size' })
  size?: number;

  @ApiPropertyOptional({
    name: 'modified_at',
    type: 'string',
    example: '2026-09-03T00:00:00.000Z',
  })
  @Expose({ name: 'modified_at' })
  modifiedAt?: string;
}

export class FileContentResponseDto {
  @ApiProperty({ name: 'content', type: 'string', example: 'export function main() {}' })
  @Expose({ name: 'content' })
  content!: string;

  @ApiProperty({ name: 'size', type: 'number', example: 1024 })
  @Expose({ name: 'size' })
  size!: number;

  @ApiProperty({ name: 'mime_type', type: 'string', example: 'text/typescript' })
  @Expose({ name: 'mime_type' })
  mimeType!: string;
}

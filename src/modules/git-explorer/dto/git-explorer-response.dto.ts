import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class GitDiffResponseDto {
  @ApiProperty({ name: 'diff', type: String, description: 'Git diff output', example: 'diff --git a/src/main.ts b/src/main.ts...' })
  @Expose({ name: 'diff' })
  diff!: string;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class GitStatusFileResponseDto {
  @ApiProperty({ name: 'path', type: String, description: 'File path', example: 'src/main.ts' })
  @Expose({ name: 'path' })
  path!: string;

  @ApiProperty({ name: 'status', type: String, description: 'File status', example: 'M' })
  @Expose({ name: 'status' })
  status!: string;

  @ApiProperty({ name: 'indexStatus', type: String, description: 'Index status', example: 'M' })
  @Expose({ name: 'indexStatus' })
  indexStatus!: string;

  @ApiProperty({ name: 'workTreeStatus', type: String, description: 'Work tree status', example: ' ' })
  @Expose({ name: 'workTreeStatus' })
  workTreeStatus!: string;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class GitLogEntryResponseDto {
  @ApiProperty({ name: 'hash', type: String, description: 'Commit hash', example: 'abc123' })
  @Expose({ name: 'hash' })
  hash!: string;

  @ApiProperty({ name: 'message', type: String, description: 'Commit message', example: 'feat: add login' })
  @Expose({ name: 'message' })
  message!: string;

  @ApiProperty({ name: 'author', type: String, description: 'Author name', example: 'John Doe' })
  @Expose({ name: 'author' })
  author!: string;

  @ApiProperty({ name: 'date', type: String, description: 'Commit date (ISO 8601)', example: '2026-09-03T00:00:00.000Z' })
  @Expose({ name: 'date' })
  date!: string;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

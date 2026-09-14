import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

export class GitDiffResponseDto {
  @ApiProperty({ description: 'Git diff output', example: 'diff --git a/src/main.ts b/src/main.ts...' })
  @Expose({ name: 'diff' })
  diff!: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class GitStatusFileResponseDto {
  @ApiProperty({ description: 'File path', example: 'src/main.ts' })
  @Expose({ name: 'path' })
  path!: string;

  @ApiProperty({ description: 'File status', example: 'M' })
  @Expose({ name: 'status' })
  status!: string;

  @ApiProperty({ description: 'Index status', example: 'M' })
  @Expose({ name: 'index_status' })
  @Transform(({ obj }) => obj.index_status ?? obj.indexStatus)
  indexStatus!: string;

  @ApiProperty({ description: 'Work tree status', example: ' ' })
  @Expose({ name: 'work_tree_status' })
  @Transform(({ obj }) => obj.work_tree_status ?? obj.workTreeStatus)
  workTreeStatus!: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class GitLogEntryResponseDto {
  @ApiProperty({ description: 'Commit hash', example: 'abc123' })
  @Expose({ name: 'hash' })
  hash!: string;

  @ApiProperty({ description: 'Commit message', example: 'feat: add login' })
  @Expose({ name: 'message' })
  message!: string;

  @ApiProperty({ description: 'Author name', example: 'John Doe' })
  @Expose({ name: 'author' })
  author!: string;

  @ApiProperty({ description: 'Commit date (ISO 8601)', example: '2026-09-03T00:00:00.000Z' })
  @Expose({ name: 'date' })
  date!: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}
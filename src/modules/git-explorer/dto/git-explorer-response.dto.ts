import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class GitDiffResponseDto {
  @Expose({ name: 'diff' })
  diff!: string;
}

export class GitStatusFileResponseDto {
  @ApiProperty({ name: 'path', type: 'string', example: 'src/main.ts' })
  @Expose({ name: 'path' })
  path!: string;

  @ApiProperty({ name: 'status', type: 'string', example: 'M' })
  @Expose({ name: 'status' })
  status!: string;

  @ApiProperty({ name: 'index_status', type: 'string', example: 'M' })
  @Expose({ name: 'index_status' })
  @Transform(({ obj }) => obj.index_status ?? obj.indexStatus)
  indexStatus!: string;

  @ApiProperty({ name: 'work_tree_status', type: 'string', example: ' ' })
  @Expose({ name: 'work_tree_status' })
  @Transform(({ obj }) => obj.work_tree_status ?? obj.workTreeStatus)
  workTreeStatus!: string;
}

export class GitLogEntryResponseDto {
  @ApiProperty({ name: 'hash', type: 'string', example: 'abc123' })
  @Expose({ name: 'hash' })
  hash!: string;

  @ApiProperty({ name: 'message', type: 'string', example: 'feat: add login' })
  @Expose({ name: 'message' })
  message!: string;

  @ApiProperty({ name: 'author', type: 'string', example: 'John Doe' })
  @Expose({ name: 'author' })
  author!: string;

  @ApiProperty({ name: 'date', type: 'string', example: '2026-09-03' })
  @Expose({ name: 'date' })
  date!: string;
}

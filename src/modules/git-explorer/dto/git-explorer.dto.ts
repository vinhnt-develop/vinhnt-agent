import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type, Expose } from 'class-transformer';

export class GitDiffQueryDto {
  @ApiPropertyOptional({
    name: 'path',
    type: 'string',
    example: 'src/main.ts',
    description: 'File path to get diff for (optional, all files if omitted)',
  })
  @IsOptional()
  @IsString()
  @Expose({ name: 'path' })
  path?: string;
}

export class GitLogQueryDto {
  @ApiPropertyOptional({
    name: 'limit',
    type: 'number',
    example: 20,
    description: 'Number of log entries to return (default: 20, max: 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @Expose({ name: 'limit' })
  limit?: number;
}
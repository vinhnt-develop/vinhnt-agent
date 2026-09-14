import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { Expose } from 'class-transformer';

export class FileTreeQueryDto {
  @ApiPropertyOptional({
    name: 'path',
    type: 'string',
    example: 'src',
    description: 'Relative path from project root (default: root)',
  })
  @IsOptional()
  @IsString()
  @Expose({ name: 'path' })
  path?: string;
}

export class FileContentQueryDto {
  @ApiPropertyOptional({
    name: 'path',
    type: 'string',
    example: 'src/main.ts',
    description: 'Relative path to the file',
  })
  @IsString()
  @Expose({ name: 'path' })
  path!: string;
}
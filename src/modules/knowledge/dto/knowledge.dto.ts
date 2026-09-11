import { IsString, IsNotEmpty, IsOptional, IsArray, IsIn, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class CreateKnowledgeDto {
  @ApiProperty({ description: 'Knowledge key', example: 'project-setup' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  key!: string;

  @ApiProperty({ description: 'Knowledge value', example: 'How to setup the project...' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiProperty({ description: 'Knowledge source', enum: ['system', 'user', 'imported'], default: 'user' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['system', 'user', 'imported'])
  source!: string;

  @ApiPropertyOptional({ description: 'Source reference (file path, URL, etc.)' })
  @IsOptional()
  @IsString()
  sourceRef?: string;

  @ApiPropertyOptional({ description: 'Knowledge tier', enum: ['stable', 'volatile', 'working', 'session', 'long-term'] })
  @IsOptional()
  @IsString()
  tier?: string;

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Is editable (false for system knowledge)', default: true })
  @IsOptional()
  isEditable?: boolean;
}

export class UpdateKnowledgeDto {
  @ApiPropertyOptional({ description: 'Knowledge key' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  key?: string;

  @ApiPropertyOptional({ description: 'Knowledge value' })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ description: 'Knowledge source' })
  @IsOptional()
  @IsString()
  @IsIn(['system', 'user', 'imported'])
  source?: string;

  @ApiPropertyOptional({ description: 'Source reference' })
  @IsOptional()
  @IsString()
  sourceRef?: string;

  @ApiPropertyOptional({ description: 'Knowledge tier', enum: ['stable', 'volatile', 'working', 'session', 'long-term'] })
  @IsOptional()
  @IsString()
  tier?: string;

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Is editable' })
  @IsOptional()
  isEditable?: boolean;
}

export class KnowledgeResponseDto {
  @Expose({ name: 'id' }) id!: string;
  @Expose({ name: 'key' }) key!: string;
  @Expose({ name: 'value' }) value!: string;
  @Expose({ name: 'source' }) source!: string;
  @Expose({ name: 'source_ref' })
  @Transform(({ obj }) => obj.source_ref ?? obj.sourceRef)
  sourceRef?: string;
  @Expose({ name: 'tier' }) tier?: string;
  @Expose({ name: 'tags' }) tags?: string[];
  @Expose({ name: 'content_hash' })
  @Transform(({ obj }) => obj.content_hash ?? obj.contentHash)
  contentHash?: string;
  @Expose({ name: 'file_path' })
  @Transform(({ obj }) => obj.file_path ?? obj.filePath)
  filePath?: string;
  @Expose({ name: 'is_editable' })
  @Transform(({ obj }) => obj.is_editable ?? obj.isEditable)
  isEditable?: boolean;
  @Expose({ name: 'created_at' })
  @Transform(({ obj }) => obj.created_at ?? obj.createdAt)
  createdAt?: string;
  @Expose({ name: 'updated_at' })
  @Transform(({ obj }) => obj.updated_at ?? obj.updatedAt)
  updatedAt?: string;
  @Expose({ name: 'deleted_at' })
  @Transform(({ obj }) => obj.deleted_at ?? obj.deletedAt)
  deletedAt?: string;
}

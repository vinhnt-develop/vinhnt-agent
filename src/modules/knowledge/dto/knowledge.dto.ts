import { IsString, IsNotEmpty, IsOptional, IsArray, IsIn, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CreateKnowledgeDto {
  @ApiProperty({ description: 'Knowledge key', example: 'project-setup', name: 'key', type: String })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  @Expose({ name: 'key' })
  key!: string;

  @ApiProperty({ description: 'Knowledge value', example: 'How to setup the project...', name: 'value', type: String })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'value' })
  value!: string;

  @ApiProperty({ description: 'Knowledge source', enum: ['system', 'user', 'imported'], default: 'user', name: 'source', type: String })
  @IsString()
  @IsNotEmpty()
  @IsIn(['system', 'user', 'imported'])
  @Expose({ name: 'source' })
  source!: string;

  @ApiPropertyOptional({ description: 'Source reference (file path, URL, etc.)', name: 'sourceRef', type: String })
  @IsOptional()
  @IsString()
  @Expose({ name: 'sourceRef' })
  sourceRef?: string;

  @ApiPropertyOptional({ description: 'Knowledge tier', enum: ['stable', 'volatile', 'working', 'session', 'long-term'], name: 'tier', type: String })
  @IsOptional()
  @IsString()
  @Expose({ name: 'tier' })
  tier?: string;

  @ApiPropertyOptional({ description: 'Tags', isArray: true, type: String, name: 'tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Expose({ name: 'tags' })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Is editable (false for system knowledge)', default: true, name: 'isEditable', type: Boolean })
  @IsOptional()
  @Expose({ name: 'isEditable' })
  isEditable?: boolean;
}

export class UpdateKnowledgeDto {
  @ApiPropertyOptional({ description: 'Knowledge key', name: 'key', type: String })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  @Expose({ name: 'key' })
  key?: string;

  @ApiPropertyOptional({ description: 'Knowledge value', name: 'value', type: String })
  @IsOptional()
  @IsString()
  @Expose({ name: 'value' })
  value?: string;

  @ApiPropertyOptional({ description: 'Knowledge source', enum: ['system', 'user', 'imported'], name: 'source', type: String })
  @IsOptional()
  @IsString()
  @IsIn(['system', 'user', 'imported'])
  @Expose({ name: 'source' })
  source?: string;

  @ApiPropertyOptional({ description: 'Source reference', name: 'sourceRef', type: String })
  @IsOptional()
  @IsString()
  @Expose({ name: 'sourceRef' })
  sourceRef?: string;

  @ApiPropertyOptional({ description: 'Knowledge tier', enum: ['stable', 'volatile', 'working', 'session', 'long-term'], name: 'tier', type: String })
  @IsOptional()
  @IsString()
  @Expose({ name: 'tier' })
  tier?: string;

  @ApiPropertyOptional({ description: 'Tags', isArray: true, type: String, name: 'tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Expose({ name: 'tags' })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Is editable', name: 'isEditable', type: Boolean })
  @IsOptional()
  @Expose({ name: 'isEditable' })
  isEditable?: boolean;
}

export class KnowledgeResponseDto {
  @ApiProperty({ description: 'Knowledge ID', example: '123e4567-e89b-12d3-a456-426614174000', name: 'id', type: String })
  @Expose({ name: 'id' })
  id!: string;

  @ApiProperty({ description: 'Knowledge key', example: 'project-setup', name: 'key', type: String })
  @Expose({ name: 'key' })
  key!: string;

  @ApiProperty({ description: 'Knowledge value', example: 'How to setup the project...', name: 'value', type: String })
  @Expose({ name: 'value' })
  value!: string;

  @ApiProperty({ description: 'Knowledge source', enum: ['system', 'user', 'imported'], name: 'source', type: String })
  @Expose({ name: 'source' })
  source!: string;

  @ApiPropertyOptional({ description: 'Source reference', name: 'sourceRef', type: String })
  @Expose({ name: 'sourceRef' })
  sourceRef?: string;

  @ApiPropertyOptional({ description: 'Knowledge tier', enum: ['stable', 'volatile', 'working', 'session', 'long-term'], name: 'tier', type: String })
  @Expose({ name: 'tier' })
  tier?: string;

  @ApiPropertyOptional({ description: 'Tags', isArray: true, type: String, name: 'tags' })
  @Expose({ name: 'tags' })
  tags?: string[];

  @ApiProperty({ description: 'Content hash', example: 'sha256:abc123...', name: 'contentHash', type: String })
  @Expose({ name: 'contentHash' })
  contentHash?: string;

  @ApiPropertyOptional({ description: 'File path', example: '/path/to/file.md', name: 'filePath', type: String })
  @Expose({ name: 'filePath' })
  filePath?: string;

  @ApiProperty({ description: 'Is editable', example: true, name: 'isEditable', type: Boolean })
  @Expose({ name: 'isEditable' })
  isEditable?: boolean;

  @ApiProperty({ description: 'Creation timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z', name: 'createdAt', type: String })
  @Expose({ name: 'createdAt' })
  createdAt?: string;

  @ApiProperty({ description: 'Last update timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z', name: 'updatedAt', type: String })
  @Expose({ name: 'updatedAt' })
  updatedAt?: string;

  @ApiPropertyOptional({ description: 'Deletion timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z', name: 'deletedAt', type: String })
  @Expose({ name: 'deletedAt' })
  deletedAt?: string;
}

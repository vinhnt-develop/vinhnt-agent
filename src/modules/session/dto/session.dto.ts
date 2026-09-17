import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class CreateSessionDto {
  @ApiPropertyOptional({ name: 'title', type: String, description: 'Session title', example: 'Help with debugging' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'title' })
  title?: string;

  @ApiPropertyOptional({ name: 'projectId', type: String, description: 'Project ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'projectId' })
  projectId?: string;

  @ApiPropertyOptional({ name: 'model', type: String, description: 'Model to use', example: 'gpt-4o' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'model' })
  model?: string;

  @ApiPropertyOptional({ name: 'provider', type: String, description: 'Provider name', example: 'openai' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'provider' })
  provider?: string;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @IsOptional()
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class UpdateSessionDto {
  @ApiPropertyOptional({ name: 'title', type: String, description: 'Session title', example: 'Updated title' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'title' })
  title?: string;

  @ApiPropertyOptional({ name: 'isActive', type: Boolean, description: 'Is active', example: true })
  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'isActive' })
  isActive?: boolean;

  @ApiPropertyOptional({ name: 'model', type: String, description: 'Model to use', example: 'gpt-4o' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'model' })
  model?: string;

  @ApiPropertyOptional({ name: 'provider', type: String, description: 'Provider name', example: 'openai' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'provider' })
  provider?: string;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @IsOptional()
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class CreateMessageDto {
  @ApiProperty({ name: 'role', type: String, description: 'Message role', enum: ['user', 'assistant', 'system', 'tool'], example: 'user' })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'role' })
  role!: string;

  @ApiPropertyOptional({ name: 'content', type: String, description: 'Message content', example: 'Hello, how can I help?' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'content' })
  content?: string;

  @ApiPropertyOptional({ name: 'toolCallId', type: String, description: 'Tool call ID', example: 'call_123' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'toolCallId' })
  toolCallId?: string;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @IsOptional()
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class SessionResponseDto {
  @ApiProperty({ name: 'id', type: String, description: 'Session ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiPropertyOptional({ name: 'projectId', type: String, description: 'Project ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'projectId' })
  projectId?: string;

  @ApiPropertyOptional({ name: 'title', type: String, description: 'Session title', example: 'Help with debugging' })
  @Expose({ name: 'title' })
  title?: string;

  @ApiPropertyOptional({ name: 'isActive', type: Boolean, description: 'Is active', example: true })
  @Expose({ name: 'isActive' })
  isActive?: boolean;

  @ApiPropertyOptional({ name: 'model', type: String, description: 'Model', example: 'gpt-4o' })
  @Expose({ name: 'model' })
  model?: string;

  @ApiPropertyOptional({ name: 'provider', type: String, description: 'Provider', example: 'openai' })
  @Expose({ name: 'provider' })
  provider?: string;

  @ApiPropertyOptional({ name: 'cost', type: Number, description: 'Total cost', example: 0.0023 })
  @Expose({ name: 'cost' })
  cost?: number;

  @ApiPropertyOptional({ name: 'inputTokens', type: Number, description: 'Input tokens', example: 150 })
  @Expose({ name: 'inputTokens' })
  inputTokens?: number;

  @ApiPropertyOptional({ name: 'outputTokens', type: Number, description: 'Output tokens', example: 200 })
  @Expose({ name: 'outputTokens' })
  outputTokens?: number;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ name: 'createdAt', type: String, description: 'Creation timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'createdAt' })
  createdAt?: string;

  @ApiPropertyOptional({ name: 'updatedAt', type: String, description: 'Last update timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'updatedAt' })
  updatedAt?: string;

  @ApiPropertyOptional({ name: 'deletedAt', type: String, description: 'Deletion timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'deletedAt' })
  deletedAt?: string;
}

export class MessageResponseDto {
  @ApiProperty({ name: 'id', type: String, description: 'Message ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiProperty({ name: 'sessionId', type: String, description: 'Session ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'sessionId' })
  sessionId!: string;

  @ApiProperty({ name: 'role', type: String, description: 'Message role', enum: ['user', 'assistant', 'system', 'tool'], example: 'user' })
  @Expose({ name: 'role' })
  role!: string;

  @ApiPropertyOptional({ name: 'content', type: String, description: 'Message content', example: 'Hello, how can I help?' })
  @Expose({ name: 'content' })
  content?: string;

  @ApiPropertyOptional({ name: 'toolCallId', type: String, description: 'Tool call ID', example: 'call_123' })
  @Expose({ name: 'toolCallId' })
  toolCallId?: string;

  @ApiPropertyOptional({ name: 'inputTokens', type: Number, description: 'Input tokens', example: 150 })
  @Expose({ name: 'inputTokens' })
  inputTokens?: number;

  @ApiPropertyOptional({ name: 'outputTokens', type: Number, description: 'Output tokens', example: 200 })
  @Expose({ name: 'outputTokens' })
  outputTokens?: number;

  @ApiPropertyOptional({ name: 'reasoningTokens', type: Number, description: 'Reasoning tokens', example: 50 })
  @Expose({ name: 'reasoningTokens' })
  reasoningTokens?: number;

  @ApiPropertyOptional({ name: 'model', type: String, description: 'Model', example: 'gpt-4o' })
  @Expose({ name: 'model' })
  model?: string;

  @ApiPropertyOptional({ name: 'provider', type: String, description: 'Provider', example: 'openai' })
  @Expose({ name: 'provider' })
  provider?: string;

  @ApiPropertyOptional({ name: 'cost', type: Number, description: 'Cost', example: 0.0023 })
  @Expose({ name: 'cost' })
  cost?: number;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ name: 'createdAt', type: String, description: 'Creation timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'createdAt' })
  createdAt?: string;
}

export class ListSessionsDto extends PaginationDto {
  @ApiProperty({ name: 'projectId', type: String, description: 'Project ID' })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'projectId' })
  projectId!: string;
}

export class ListMessagesDto extends PaginationDto {
  @ApiPropertyOptional({
    name: 'order',
    enum: ['asc', 'desc'],
    description: 'Message order: asc = oldest first (default), desc = newest first (chat tail)',
    default: 'asc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  @Expose({ name: 'order' })
  order?: 'asc' | 'desc' = 'asc';
}

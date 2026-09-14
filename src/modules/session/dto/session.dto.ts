import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

export class CreateSessionDto {
  @ApiPropertyOptional({ description: 'Session title', example: 'Help with debugging' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'title' })
  title?: string;

  @ApiPropertyOptional({ description: 'Project ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'project_id' })
  projectId?: string;

  @ApiPropertyOptional({ description: 'Model to use', example: 'gpt-4o' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'model' })
  model?: string;

  @ApiPropertyOptional({ description: 'Provider name', example: 'openai' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'provider' })
  provider?: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @IsOptional()
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class UpdateSessionDto {
  @ApiPropertyOptional({ description: 'Session title', example: 'Updated title' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'title' })
  title?: string;

  @ApiPropertyOptional({ description: 'Is active', example: true })
  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'is_active' })
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Model to use', example: 'gpt-4o' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'model' })
  model?: string;

  @ApiPropertyOptional({ description: 'Provider name', example: 'openai' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'provider' })
  provider?: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @IsOptional()
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class CreateMessageDto {
  @ApiProperty({ description: 'Message role', enum: ['user', 'assistant', 'system', 'tool'], example: 'user' })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'role' })
  role!: string;

  @ApiPropertyOptional({ description: 'Message content', example: 'Hello, how can I help?' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'content' })
  content?: string;

  @ApiPropertyOptional({ description: 'Tool call ID', example: 'call_123' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'tool_call_id' })
  toolCallId?: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @IsOptional()
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class SessionResponseDto {
  @ApiProperty({ description: 'Session ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiPropertyOptional({ description: 'Project ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'project_id' })
  @Transform(({ obj }) => obj.project_id ?? obj.projectId)
  projectId?: string;

  @ApiPropertyOptional({ description: 'Session title', example: 'Help with debugging' })
  @Expose({ name: 'title' })
  title?: string;

  @ApiPropertyOptional({ description: 'Is active', example: true })
  @Expose({ name: 'is_active' })
  @Transform(({ obj }) => obj.is_active ?? obj.isActive)
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Model', example: 'gpt-4o' })
  @Expose({ name: 'model' })
  model?: string;

  @ApiPropertyOptional({ description: 'Provider', example: 'openai' })
  @Expose({ name: 'provider' })
  provider?: string;

  @ApiPropertyOptional({ description: 'Total cost', example: 0.0023 })
  @Expose({ name: 'cost' })
  cost?: number;

  @ApiPropertyOptional({ description: 'Input tokens', example: 150 })
  @Expose({ name: 'input_tokens' })
  @Transform(({ obj }) => obj.input_tokens ?? obj.inputTokens)
  inputTokens?: number;

  @ApiPropertyOptional({ description: 'Output tokens', example: 200 })
  @Expose({ name: 'output_tokens' })
  @Transform(({ obj }) => obj.output_tokens ?? obj.outputTokens)
  outputTokens?: number;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Creation timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'created_at' })
  @Transform(({ obj }) => obj.created_at ?? obj.createdAt)
  createdAt?: string;

  @ApiPropertyOptional({ description: 'Last update timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'updated_at' })
  @Transform(({ obj }) => obj.updated_at ?? obj.updatedAt)
  updatedAt?: string;

  @ApiPropertyOptional({ description: 'Deletion timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'deleted_at' })
  @Transform(({ obj }) => obj.deleted_at ?? obj.deletedAt)
  deletedAt?: string;
}

export class MessageResponseDto {
  @ApiProperty({ description: 'Message ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiProperty({ description: 'Session ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'session_id' })
  @Transform(({ obj }) => obj.session_id ?? obj.sessionId)
  sessionId!: string;

  @ApiProperty({ description: 'Message role', enum: ['user', 'assistant', 'system', 'tool'], example: 'user' })
  @Expose({ name: 'role' })
  role!: string;

  @ApiPropertyOptional({ description: 'Message content', example: 'Hello, how can I help?' })
  @Expose({ name: 'content' })
  content?: string;

  @ApiPropertyOptional({ description: 'Tool call ID', example: 'call_123' })
  @Expose({ name: 'tool_call_id' })
  @Transform(({ obj }) => obj.tool_call_id ?? obj.toolCallId)
  toolCallId?: string;

  @ApiPropertyOptional({ description: 'Input tokens', example: 150 })
  @Expose({ name: 'input_tokens' })
  @Transform(({ obj }) => obj.input_tokens ?? obj.inputTokens)
  inputTokens?: number;

  @ApiPropertyOptional({ description: 'Output tokens', example: 200 })
  @Expose({ name: 'output_tokens' })
  @Transform(({ obj }) => obj.output_tokens ?? obj.outputTokens)
  outputTokens?: number;

  @ApiPropertyOptional({ description: 'Reasoning tokens', example: 50 })
  @Expose({ name: 'reasoning_tokens' })
  @Transform(({ obj }) => obj.reasoning_tokens ?? obj.reasoningTokens)
  reasoningTokens?: number;

  @ApiPropertyOptional({ description: 'Model', example: 'gpt-4o' })
  @Expose({ name: 'model' })
  model?: string;

  @ApiPropertyOptional({ description: 'Provider', example: 'openai' })
  @Expose({ name: 'provider' })
  provider?: string;

  @ApiPropertyOptional({ description: 'Cost', example: 0.0023 })
  @Expose({ name: 'cost' })
  cost?: number;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Creation timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'created_at' })
  @Transform(({ obj }) => obj.created_at ?? obj.createdAt)
  createdAt?: string;
}
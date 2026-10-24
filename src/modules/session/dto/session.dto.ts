import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn, IsInt, Min, Max } from 'class-validator';
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

  @ApiPropertyOptional({
    name: 'parentId',
    type: String,
    nullable: true,
    description: 'Parent session id when this session was created by a fork',
  })
  @Expose({ name: 'parentId' })
  parentId?: string | null;

  @ApiPropertyOptional({ name: 'gitBranch', type: String, nullable: true })
  @Expose({ name: 'gitBranch' })
  gitBranch?: string | null;

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

export class ForkSessionDto {
  @ApiPropertyOptional({ name: 'title', type: String, description: 'Fork title (defaults to "<source title> (fork)")' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'title' })
  title?: string;

  @ApiPropertyOptional({
    name: 'atMessageId',
    type: String,
    description: 'Copy this message and everything before it. Omit to copy the full history.',
  })
  @IsOptional()
  @IsString()
  @Expose({ name: 'atMessageId' })
  atMessageId?: string;

  @ApiPropertyOptional({
    name: 'limit',
    type: Number,
    description: 'After applying atMessageId, keep only the newest N messages.',
    minimum: 1,
    maximum: 10000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  @Expose({ name: 'limit' })
  limit?: number;
}

export class ForkSessionResponseDto {
  @ApiProperty({ name: 'session', type: SessionResponseDto, description: 'Newly created child session' })
  @Type(() => SessionResponseDto)
  @Expose({ name: 'session' })
  session!: SessionResponseDto;

  @ApiProperty({ name: 'copiedMessageCount', type: Number, description: 'Number of messages copied into the fork', example: 12 })
  @Expose({ name: 'copiedMessageCount' })
  copiedMessageCount!: number;
}

export class SessionSummaryResponseDto {
  @ApiProperty({ name: 'sessionId', type: String })
  @Expose({ name: 'sessionId' })
  sessionId!: string;

  @ApiPropertyOptional({ name: 'title', type: String, nullable: true })
  @Expose({ name: 'title' })
  title?: string | null;

  @ApiPropertyOptional({ name: 'projectId', type: String, nullable: true })
  @Expose({ name: 'projectId' })
  projectId?: string | null;

  @ApiPropertyOptional({ name: 'parentId', type: String, nullable: true })
  @Expose({ name: 'parentId' })
  parentId?: string | null;

  @ApiPropertyOptional({ name: 'model', type: String, nullable: true })
  @Expose({ name: 'model' })
  model?: string | null;

  @ApiPropertyOptional({ name: 'provider', type: String, nullable: true })
  @Expose({ name: 'provider' })
  provider?: string | null;

  @ApiPropertyOptional({ name: 'gitBranch', type: String, nullable: true })
  @Expose({ name: 'gitBranch' })
  gitBranch?: string | null;

  @ApiProperty({ name: 'messageCount', type: Number })
  @Expose({ name: 'messageCount' })
  messageCount!: number;

  @ApiProperty({ name: 'userMessageCount', type: Number })
  @Expose({ name: 'userMessageCount' })
  userMessageCount!: number;

  @ApiProperty({ name: 'assistantMessageCount', type: Number })
  @Expose({ name: 'assistantMessageCount' })
  assistantMessageCount!: number;

  @ApiProperty({ name: 'toolMessageCount', type: Number })
  @Expose({ name: 'toolMessageCount' })
  toolMessageCount!: number;

  @ApiProperty({ name: 'systemMessageCount', type: Number })
  @Expose({ name: 'systemMessageCount' })
  systemMessageCount!: number;

  @ApiPropertyOptional({ name: 'firstMessageAt', type: String, nullable: true })
  @Expose({ name: 'firstMessageAt' })
  firstMessageAt?: string | null;

  @ApiPropertyOptional({ name: 'lastMessageAt', type: String, nullable: true })
  @Expose({ name: 'lastMessageAt' })
  lastMessageAt?: string | null;

  @ApiProperty({ name: 'runCount', type: Number })
  @Expose({ name: 'runCount' })
  runCount!: number;

  @ApiProperty({
    name: 'runStatusCounts',
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Run counts keyed by status (pending/running/succeeded/failed/cancelled/interrupted)',
  })
  @Expose({ name: 'runStatusCounts' })
  runStatusCounts!: Record<string, number>;

  @ApiProperty({ name: 'inputTokens', type: Number })
  @Expose({ name: 'inputTokens' })
  inputTokens!: number;

  @ApiProperty({ name: 'outputTokens', type: Number })
  @Expose({ name: 'outputTokens' })
  outputTokens!: number;

  @ApiProperty({ name: 'reasoningTokens', type: Number })
  @Expose({ name: 'reasoningTokens' })
  reasoningTokens!: number;

  @ApiProperty({ name: 'totalTokens', type: Number })
  @Expose({ name: 'totalTokens' })
  totalTokens!: number;

  @ApiProperty({ name: 'cost', type: Number })
  @Expose({ name: 'cost' })
  cost!: number;

  @ApiProperty({ name: 'toolCallsCount', type: Number })
  @Expose({ name: 'toolCallsCount' })
  toolCallsCount!: number;

  @ApiPropertyOptional({ name: 'lastRunAt', type: String, nullable: true })
  @Expose({ name: 'lastRunAt' })
  lastRunAt?: string | null;
}

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class CreateSessionDto {
  @ApiPropertyOptional({ description: 'Session title', example: 'Help with debugging' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Project ID' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Model to use', example: 'gpt-4o' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ description: 'Provider name', example: 'openai' })
  @IsOptional()
  @IsString()
  provider?: string;
}

export class UpdateSessionDto {
  @ApiPropertyOptional({ description: 'Session title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Model to use' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ description: 'Provider name' })
  @IsOptional()
  @IsString()
  provider?: string;
}

export class CreateMessageDto {
  @ApiProperty({ description: 'Message role', enum: ['user', 'assistant', 'system', 'tool'] })
  @IsString()
  @IsNotEmpty()
  role!: string;

  @ApiPropertyOptional({ description: 'Message content' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Tool call ID' })
  @IsOptional()
  @IsString()
  toolCallId?: string;
}

export class SessionResponseDto {
  @Expose({ name: 'id' }) id!: string;
  @Expose({ name: 'project_id' })
  @Transform(({ obj }) => obj.project_id ?? obj.projectId)
  projectId?: string;
  @Expose({ name: 'title' }) title?: string;
  @Expose({ name: 'is_active' })
  @Transform(({ obj }) => obj.is_active ?? obj.isActive)
  isActive?: boolean;
  @Expose({ name: 'model' }) model?: string;
  @Expose({ name: 'provider' }) provider?: string;
  @Expose({ name: 'cost' }) cost?: number;
  @Expose({ name: 'input_tokens' })
  @Transform(({ obj }) => obj.input_tokens ?? obj.inputTokens)
  inputTokens?: number;
  @Expose({ name: 'output_tokens' })
  @Transform(({ obj }) => obj.output_tokens ?? obj.outputTokens)
  outputTokens?: number;
  @Expose({ name: 'metadata' }) metadata?: Record<string, unknown>;
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

export class MessageResponseDto {
  @Expose({ name: 'id' }) id!: string;
  @Expose({ name: 'session_id' })
  @Transform(({ obj }) => obj.session_id ?? obj.sessionId)
  sessionId!: string;
  @Expose({ name: 'role' }) role!: string;
  @Expose({ name: 'content' }) content?: string;
  @Expose({ name: 'tool_call_id' })
  @Transform(({ obj }) => obj.tool_call_id ?? obj.toolCallId)
  toolCallId?: string;
  @Expose({ name: 'input_tokens' })
  @Transform(({ obj }) => obj.input_tokens ?? obj.inputTokens)
  inputTokens?: number;
  @Expose({ name: 'output_tokens' })
  @Transform(({ obj }) => obj.output_tokens ?? obj.outputTokens)
  outputTokens?: number;
  @Expose({ name: 'reasoning_tokens' })
  @Transform(({ obj }) => obj.reasoning_tokens ?? obj.reasoningTokens)
  reasoningTokens?: number;
  @Expose({ name: 'model' }) model?: string;
  @Expose({ name: 'provider' }) provider?: string;
  @Expose({ name: 'cost' }) cost?: number;
  @Expose({ name: 'metadata' }) metadata?: Record<string, unknown>;
  @Expose({ name: 'created_at' })
  @Transform(({ obj }) => obj.created_at ?? obj.createdAt)
  createdAt?: string;
}

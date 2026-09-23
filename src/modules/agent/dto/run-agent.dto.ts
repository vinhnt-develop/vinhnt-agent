import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { validateMessage } from '@/common/helpers';
import { VALIDATE_CODES } from '@/common/constants';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Expose, Type } from 'class-transformer';

export class SelectedToolDto {
  @ApiProperty({ name: 'id', type: String, description: 'Tool ID', example: 'read_file' })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'id' })
  id!: string;

  @ApiPropertyOptional({ name: 'name', type: String, description: 'Tool display name', example: 'Read File' })
  @IsString()
  @IsOptional()
  @Expose({ name: 'name' })
  name?: string;

  @ApiPropertyOptional({ name: 'enabled', type: Boolean, description: 'Whether tool is enabled', example: true })
  @IsOptional()
  @Expose({ name: 'enabled' })
  enabled?: boolean;
}

export class SelectedKnowledgeDto {
  @ApiProperty({ name: 'id', type: String, description: 'Knowledge entry ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'id' })
  id!: string;

  @ApiPropertyOptional({ name: 'key', type: String, description: 'Knowledge key', example: 'coding-standards' })
  @IsString()
  @IsOptional()
  @Expose({ name: 'key' })
  key?: string;

  @ApiPropertyOptional({ name: 'enabled', type: Boolean, description: 'Whether knowledge is enabled', example: true })
  @IsOptional()
  @Expose({ name: 'enabled' })
  enabled?: boolean;
}

export class SelectionDto {
  @ApiPropertyOptional({ name: 'tools', type: [SelectedToolDto], description: 'Selected tools' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedToolDto)
  @IsOptional()
  @Expose({ name: 'tools' })
  tools?: SelectedToolDto[];

  @ApiPropertyOptional({ name: 'knowledge', type: [SelectedKnowledgeDto], description: 'Selected knowledge entries' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedKnowledgeDto)
  @IsOptional()
  @Expose({ name: 'knowledge' })
  knowledge?: SelectedKnowledgeDto[];

  @ApiPropertyOptional({ name: 'plugins', type: [String], description: 'Selected plugin IDs', example: ['web-search'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Expose({ name: 'plugins' })
  plugins?: string[];
}

export class RunAgentDto {
  @ApiProperty({
    name: 'sessionId',
    type: 'string',
    description: 'Session ID to run agent in',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString({
    message: validateMessage.string('sessionId'),
    context: {
      errorCode: VALIDATE_CODES.AGENT_SESSION_ID_STRING,
      field: 'sessionId',
    },
  })
  @IsNotEmpty({
    message: validateMessage.required('sessionId'),
    context: {
      errorCode: VALIDATE_CODES.AGENT_SESSION_ID_EMPTY,
      field: 'sessionId',
    },
  })
  @Expose({ name: 'sessionId' })
  sessionId!: string;

  @ApiProperty({
    name: 'prompt',
    type: 'string',
    description: 'Prompt to send to agent',
    example: 'Write a hello world program in TypeScript',
  })
  @IsString({
    message: validateMessage.string('prompt'),
    context: { errorCode: VALIDATE_CODES.AGENT_PROMPT_STRING, field: 'prompt' },
  })
  @IsNotEmpty({
    message: validateMessage.required('prompt'),
    context: { errorCode: VALIDATE_CODES.AGENT_PROMPT_EMPTY, field: 'prompt' },
  })
  @MinLength(1, {
    message: validateMessage.min.string('prompt', 1),
    context: {
      errorCode: VALIDATE_CODES.AGENT_PROMPT_MIN,
      field: 'prompt',
      min: 1,
    },
  })
  @MaxLength(100000, {
    message: validateMessage.max.string('prompt', 100000),
    context: {
      errorCode: VALIDATE_CODES.AGENT_PROMPT_MAX,
      field: 'prompt',
      max: 100000,
    },
  })
  @Expose({ name: 'prompt' })
  prompt!: string;

  @ApiPropertyOptional({
    name: 'model',
    type: 'string',
    description: 'Model override (optional)',
    example: 'gpt-4o',
  })
  @IsString({
    message: validateMessage.string('model'),
    context: { errorCode: VALIDATE_CODES.AGENT_MODEL_STRING, field: 'model' },
  })
  @IsOptional()
  @Expose({ name: 'model' })
  model?: string;

  @ApiPropertyOptional({
    name: 'provider',
    type: 'string',
    description:
      'Provider override — selects which registered provider handles this request (optional)',
    example: 'openai',
  })
  @IsString({
    message: validateMessage.string('provider'),
    context: {
      errorCode: VALIDATE_CODES.AGENT_PROVIDER_STRING,
      field: 'provider',
    },
  })
  @IsOptional()
  @Expose({ name: 'provider' })
  provider?: string;

  @ApiPropertyOptional({
    name: 'workspaceId',
    type: 'string',
    description: 'Workspace ID for context isolation (optional)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString({
    message: validateMessage.string('workspaceId'),
    context: {
      errorCode: VALIDATE_CODES.WORKSPACE_ID_STRING,
      field: 'workspaceId',
    },
  })
  @IsOptional()
  @Expose({ name: 'workspaceId' })
  workspaceId?: string;

  @ApiPropertyOptional({
    name: 'permissionMode',
    type: 'string',
    enum: ['ask', 'edit', 'full'],
    description: 'Per-run permission mode from composer (ask | edit | full)',
    example: 'ask',
  })
  @IsOptional()
  @Expose({ name: 'permissionMode' })
  permissionMode?: 'ask' | 'edit' | 'full';

  @ApiPropertyOptional({
    name: 'selection',
    type: SelectionDto,
    description: 'User-selected resources for this run (tools, knowledge, plugins)',
  })
  @ValidateNested()
  @Type(() => SelectionDto)
  @IsOptional()
  @Expose({ name: 'selection' })
  selection?: SelectionDto;
}

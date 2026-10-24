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
  ArrayMaxSize,
  IsIn,
} from 'class-validator';
import { Expose, Type } from 'class-transformer';
import type { PermissionMode } from '@/shared/permission-mode';
import { KNOWN_PERMISSION_MODES } from '@/shared/permission-mode';

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
}

export class ImageAttachmentDto {
  @ApiProperty({
    name: 'dataUrl',
    type: String,
    description:
      'Base64 data URL for a PNG, JPEG, WebP, or GIF image (max 5 MB decoded).',
    example: 'data:image/png;base64,iVBORw0KGgo...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8_000_000)
  @Expose({ name: 'dataUrl' })
  dataUrl!: string;

  @ApiPropertyOptional({
    name: 'mimeType',
    type: String,
    enum: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    description: 'Optional MIME type; must match the data URL when provided.',
  })
  @IsString()
  @IsIn(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
  @IsOptional()
  @Expose({ name: 'mimeType' })
  mimeType?: string;

  @ApiPropertyOptional({
    name: 'name',
    type: String,
    description: 'Display name for the image.',
    example: 'screenshot.png',
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  @Expose({ name: 'name' })
  name?: string;
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
    name: 'permissionMode',
    type: 'string',
    enum: [...KNOWN_PERMISSION_MODES],
    description:
      'Per-run permission mode override (open union — known modes: ' +
      KNOWN_PERMISSION_MODES.join(' | ') +
      '; composer sends ask | edit | full | auto | plan)',
    example: 'ask',
  })
  @IsOptional()
  @IsString()
  @Expose({ name: 'permissionMode' })
  permissionMode?: PermissionMode;

  @ApiPropertyOptional({
    name: 'selection',
    type: SelectionDto,
    description: 'User-selected resources for this run (tools, knowledge)',
  })
  @ValidateNested()
  @Type(() => SelectionDto)
  @IsOptional()
  @Expose({ name: 'selection' })
  selection?: SelectionDto;

  @ApiPropertyOptional({
    name: 'attachments',
    type: [String],
    description:
      'Project-relative file paths attached to this message (max 20). The server validates containment and inlines small text files.',
    example: ['src/index.ts', 'README.md'],
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  @IsOptional()
  @Expose({ name: 'attachments' })
  attachments?: string[];

  @ApiPropertyOptional({
    name: 'images',
    type: [ImageAttachmentDto],
    description:
      'Pasted images as base64 data URLs (max 5). Sent to vision-capable models as image_url content parts.',
  })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ImageAttachmentDto)
  @IsOptional()
  @Expose({ name: 'images' })
  images?: ImageAttachmentDto[];
}

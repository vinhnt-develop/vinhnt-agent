import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { validateMessage } from '@/common/helpers';
import { VALIDATE_CODES } from '@/common/constants';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';
import { Expose } from 'class-transformer';

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
}

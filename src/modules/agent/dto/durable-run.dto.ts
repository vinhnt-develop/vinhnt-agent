import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { Expose } from 'class-transformer';

export class DurableRunDto {
  @ApiProperty({
    name: 'sessionId',
    type: 'string',
    description: 'Session ID (maps to durable-state threadId)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'sessionId' })
  sessionId!: string;

  @ApiProperty({
    name: 'entryNode',
    type: 'string',
    description: 'Entry node id to start the durable graph',
    example: 'process',
  })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'entryNode' })
  entryNode!: string;

  @ApiPropertyOptional({
    name: 'checkpointId',
    type: 'string',
    description: 'Optional checkpoint id to resume from',
    example: 'cp_abc123',
  })
  @IsString()
  @IsOptional()
  @Expose({ name: 'checkpointId' })
  checkpointId?: string;

  @ApiPropertyOptional({
    name: 'checkpointNs',
    type: 'string',
    description: 'Checkpoint namespace (root graph = empty string)',
    example: '',
  })
  @IsString()
  @IsOptional()
  @Expose({ name: 'checkpointNs' })
  checkpointNs?: string;
}

export class DurableResumeDto {
  @ApiProperty({
    name: 'sessionId',
    type: 'string',
    description: 'Session ID (maps to durable-state threadId)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'sessionId' })
  sessionId!: string;

  @ApiPropertyOptional({
    name: 'resume',
    type: 'string',
    description: 'Resume value to pass back to the interrupted node',
    example: 'user approved',
  })
  @IsString()
  @IsOptional()
  @Expose({ name: 'resume' })
  resume?: string;

  @ApiPropertyOptional({
    name: 'update',
    description: 'State delta to apply before continuing',
    example: { step: 5 },
  })
  @IsObject()
  @IsOptional()
  @Expose({ name: 'update' })
  update?: Record<string, unknown>;

  @ApiPropertyOptional({
    name: 'goto',
    type: 'string',
    description: 'Node to jump to next',
    example: 'next-node',
  })
  @IsString()
  @IsOptional()
  @Expose({ name: 'goto' })
  goto?: string;
}

export class DurableRunResponseDto {
  @ApiProperty({ name: 'runId', type: 'string' })
  @Expose({ name: 'runId' })
  runId!: string;

  @ApiProperty({ name: 'completed', type: Boolean })
  @Expose({ name: 'completed' })
  completed!: boolean;

  @ApiPropertyOptional({ name: 'output' })
  @Expose({ name: 'output' })
  output?: unknown;

  @ApiPropertyOptional({ name: 'interrupt' })
  @Expose({ name: 'interrupt' })
  interrupt?: { id: string; value: unknown; resumed: boolean };
}

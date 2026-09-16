import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class RunAgentResponseDto {
  @ApiProperty({ description: 'Run ID', example: '123e4567-e89b-12d3-a456-426614174000', name: 'runId', type: String })
  @Expose({ name: 'runId' })
  runId!: string;

  @ApiProperty({ description: 'Run status', enum: ['succeeded', 'failed', 'cancelled'], example: 'succeeded', name: 'status', type: String })
  @Expose({ name: 'status' })
  status!: string;

  @ApiPropertyOptional({ description: 'Agent output text', example: 'Here is the solution...', name: 'output', type: String })
  @Expose({ name: 'output' })
  output?: string;

  @ApiProperty({ description: 'Total steps executed', example: 5, name: 'totalSteps', type: Number })
  @Expose({ name: 'totalSteps' })
  totalSteps!: number;

  @ApiPropertyOptional({ description: 'Model used', example: 'gpt-4o', name: 'model', type: String })
  @Expose({ name: 'model' })
  model?: string;

  @ApiPropertyOptional({ description: 'Provider used', example: 'openai', name: 'provider', type: String })
  @Expose({ name: 'provider' })
  provider?: string;

  @ApiPropertyOptional({ description: 'Input tokens', example: 1500, name: 'inputTokens', type: Number })
  @Expose({ name: 'inputTokens' })
  inputTokens?: number;

  @ApiPropertyOptional({ description: 'Output tokens', example: 2000, name: 'outputTokens', type: Number })
  @Expose({ name: 'outputTokens' })
  outputTokens?: number;

  @ApiPropertyOptional({ description: 'Total cost', example: 0.015, name: 'totalCost', type: Number })
  @Expose({ name: 'totalCost' })
  totalCost?: number;

  @ApiPropertyOptional({ description: 'Duration in milliseconds', example: 5000, name: 'durationMs', type: Number })
  @Expose({ name: 'durationMs' })
  durationMs?: number;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true, name: 'metadata' })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class AgentStatsResponseDto {
  @ApiProperty({ description: 'Total runs', example: 100, name: 'totalRuns', type: Number })
  @Expose({ name: 'totalRuns' })
  totalRuns!: number;

  @ApiProperty({ description: 'Total tokens', example: 50000, name: 'totalTokens', type: Number })
  @Expose({ name: 'totalTokens' })
  totalTokens!: number;

  @ApiProperty({ description: 'Total cost', example: 0.5, name: 'totalCost', type: Number })
  @Expose({ name: 'totalCost' })
  totalCost!: number;

  @ApiProperty({ description: 'Average duration in milliseconds', example: 3000, name: 'avgDurationMs', type: Number })
  @Expose({ name: 'avgDurationMs' })
  avgDurationMs!: number;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true, name: 'metadata' })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

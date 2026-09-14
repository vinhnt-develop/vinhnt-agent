import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

export class RunAgentResponseDto {
  @ApiProperty({ description: 'Run ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'run_id' })
  @Transform(({ obj }) => obj.run_id ?? obj.runId)
  runId!: string;

  @ApiProperty({
    description: 'Run status',
    enum: ['succeeded', 'failed', 'cancelled'],
    example: 'succeeded',
  })
  @Expose({ name: 'status' })
  status!: string;

  @ApiPropertyOptional({ description: 'Agent output text', example: 'Here is the solution...' })
  @Expose({ name: 'output' })
  output?: string;

  @ApiProperty({ description: 'Total steps executed', example: 5 })
  @Expose({ name: 'total_steps' })
  @Transform(({ obj }) => obj.total_steps ?? obj.totalSteps)
  totalSteps!: number;

  @ApiPropertyOptional({ description: 'Model used', example: 'gpt-4o' })
  @Expose({ name: 'model' })
  model?: string;

  @ApiPropertyOptional({ description: 'Provider used', example: 'openai' })
  @Expose({ name: 'provider' })
  provider?: string;

  @ApiPropertyOptional({ description: 'Input tokens', example: 1500 })
  @Expose({ name: 'input_tokens' })
  inputTokens?: number;

  @ApiPropertyOptional({ description: 'Output tokens', example: 2000 })
  @Expose({ name: 'output_tokens' })
  outputTokens?: number;

  @ApiPropertyOptional({ description: 'Total cost', example: 0.015 })
  @Expose({ name: 'total_cost' })
  totalCost?: number;

  @ApiPropertyOptional({ description: 'Duration in milliseconds', example: 5000 })
  @Expose({ name: 'duration_ms' })
  durationMs?: number;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class AgentStatsResponseDto {
  @ApiProperty({ description: 'Total runs', example: 100 })
  @Expose({ name: 'total_runs' })
  @Transform(({ obj }) => obj.total_runs ?? obj.totalRuns)
  totalRuns!: number;

  @ApiProperty({ description: 'Total tokens', example: 50000 })
  @Expose({ name: 'total_tokens' })
  @Transform(({ obj }) => obj.total_tokens ?? obj.totalTokens)
  totalTokens!: number;

  @ApiProperty({ description: 'Total cost', example: 0.5 })
  @Expose({ name: 'total_cost' })
  @Transform(({ obj }) => obj.total_cost ?? obj.totalCost)
  totalCost!: number;

  @ApiProperty({ description: 'Average duration in milliseconds', example: 3000 })
  @Expose({ name: 'avg_duration_ms' })
  @Transform(({ obj }) => obj.avg_duration_ms ?? obj.avgDurationMs)
  avgDurationMs!: number;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}
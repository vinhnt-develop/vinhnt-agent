import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class RunAgentResponseDto {
  @ApiProperty({ description: 'Run ID' })
  @Expose({ name: 'run_id' })
  @Transform(({ obj }) => obj.run_id ?? obj.runId)
  runId!: string;

  @ApiProperty({
    description: 'Run status',
    enum: ['succeeded', 'failed', 'cancelled'],
  })
  @Expose({ name: 'status' })
  status!: string;

  @ApiPropertyOptional({ description: 'Agent output text' })
  @Expose({ name: 'output' })
  output?: string;

  @ApiProperty({ description: 'Total steps executed' })
  @Expose({ name: 'total_steps' })
  @Transform(({ obj }) => obj.total_steps ?? obj.totalSteps)
  totalSteps!: number;
}

export class AgentStatsResponseDto {
  @Expose({ name: 'total_runs' })
  @Transform(({ obj }) => obj.total_runs ?? obj.totalRuns)
  totalRuns!: number;
  @Expose({ name: 'total_tokens' })
  @Transform(({ obj }) => obj.total_tokens ?? obj.totalTokens)
  totalTokens!: number;
  @Expose({ name: 'total_cost' })
  @Transform(({ obj }) => obj.total_cost ?? obj.totalCost)
  totalCost!: number;
  @Expose({ name: 'avg_duration_ms' })
  @Transform(({ obj }) => obj.avg_duration_ms ?? obj.avgDurationMs)
  avgDurationMs!: number;
}

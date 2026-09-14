import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

export class ContextBreakdownDto {
  @ApiProperty({ description: 'User tokens', example: 1500 })
  @Expose({ name: 'user_tokens' })
  userTokens!: number;

  @ApiProperty({ description: 'Assistant tokens', example: 2000 })
  @Expose({ name: 'assistant_tokens' })
  assistantTokens!: number;

  @ApiProperty({ description: 'Tool call tokens', example: 500 })
  @Expose({ name: 'tool_call_tokens' })
  toolCallTokens!: number;

  @ApiProperty({ description: 'Other tokens', example: 100 })
  @Expose({ name: 'other_tokens' })
  otherTokens!: number;

  @ApiProperty({ description: 'User percentage', example: 30 })
  @Expose({ name: 'user_percent' })
  userPercent!: number;

  @ApiProperty({ description: 'Assistant percentage', example: 40 })
  @Expose({ name: 'assistant_percent' })
  assistantPercent!: number;

  @ApiProperty({ description: 'Tool call percentage', example: 10 })
  @Expose({ name: 'tool_call_percent' })
  toolCallPercent!: number;

  @ApiProperty({ description: 'Other percentage', example: 20 })
  @Expose({ name: 'other_percent' })
  otherPercent!: number;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class TrajectoryStatsDto {
  @ApiProperty({ description: 'Total runs', example: 10 })
  @Expose({ name: 'total_runs' })
  totalRuns!: number;

  @ApiProperty({ description: 'Total tool calls', example: 50 })
  @Expose({ name: 'total_tool_calls' })
  totalToolCalls!: number;

  @ApiProperty({ description: 'Total input tokens', example: 15000 })
  @Expose({ name: 'total_input_tokens' })
  totalInputTokens!: number;

  @ApiProperty({ description: 'Total output tokens', example: 20000 })
  @Expose({ name: 'total_output_tokens' })
  totalOutputTokens!: number;

  @ApiProperty({ description: 'Total reasoning tokens', example: 1000 })
  @Expose({ name: 'total_reasoning_tokens' })
  totalReasoningTokens!: number;

  @ApiProperty({ description: 'Total cost', example: 0.5 })
  @Expose({ name: 'total_cost' })
  totalCost!: number;

  @ApiProperty({ description: 'Total duration in milliseconds', example: 30000 })
  @Expose({ name: 'total_duration_ms' })
  totalDurationMs!: number;

  @ApiProperty({ description: 'Succeeded runs', example: 8 })
  @Expose({ name: 'succeeded_runs' })
  succeededRuns!: number;

  @ApiProperty({ description: 'Failed runs', example: 2 })
  @Expose({ name: 'failed_runs' })
  failedRuns!: number;

  @ApiProperty({ description: 'Average duration in milliseconds', example: 3000 })
  @Expose({ name: 'avg_duration_ms' })
  avgDurationMs!: number;

  @ApiProperty({ description: 'Context breakdown', type: ContextBreakdownDto })
  @Expose({ name: 'context_breakdown' })
  @Type(() => ContextBreakdownDto)
  contextBreakdown!: ContextBreakdownDto;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class TrajectoryTurnDto {
  @ApiProperty({ description: 'Run ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'run_id' })
  runId!: string;

  @ApiProperty({ description: 'Run status', enum: ['succeeded', 'failed', 'cancelled'], example: 'succeeded' })
  @Expose({ name: 'status' })
  status!: string;

  @ApiPropertyOptional({ description: 'Model', example: 'gpt-4o' })
  @Expose({ name: 'model' })
  model?: string;

  @ApiPropertyOptional({ description: 'Provider', example: 'openai' })
  @Expose({ name: 'provider' })
  provider?: string;

  @ApiProperty({ description: 'Input tokens', example: 1500 })
  @Expose({ name: 'input_tokens' })
  inputTokens!: number;

  @ApiProperty({ description: 'Output tokens', example: 2000 })
  @Expose({ name: 'output_tokens' })
  outputTokens!: number;

  @ApiProperty({ description: 'Reasoning tokens', example: 100 })
  @Expose({ name: 'reasoning_tokens' })
  reasoningTokens!: number;

  @ApiProperty({ description: 'Total cost', example: 0.015 })
  @Expose({ name: 'total_cost' })
  totalCost!: number;

  @ApiProperty({ description: 'Duration in milliseconds', example: 5000 })
  @Expose({ name: 'duration_ms' })
  durationMs!: number;

  @ApiProperty({ description: 'Tool calls count', example: 5 })
  @Expose({ name: 'tool_calls_count' })
  toolCallsCount!: number;

  @ApiPropertyOptional({ description: 'Error message', example: 'API rate limit exceeded' })
  @Expose({ name: 'error_message' })
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Start timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'started_at' })
  startedAt?: string;

  @ApiPropertyOptional({ description: 'Completion timestamp (ISO 8601)', example: '2026-09-01T12:00:05.000Z' })
  @Expose({ name: 'completed_at' })
  completedAt?: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class TrajectoryToolCallDto {
  @ApiProperty({ description: 'Tool call ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiPropertyOptional({ description: 'Run ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'run_id' })
  runId?: string;

  @ApiProperty({ description: 'Tool name', example: 'read_file' })
  @Expose({ name: 'tool_name' })
  toolName!: string;

  @ApiProperty({ description: 'Tool input', type: 'object', additionalProperties: true, example: { path: 'src/main.ts' } })
  @Expose({ name: 'tool_input' })
  toolInput!: Record<string, unknown>;

  @ApiProperty({ description: 'Tool output', type: 'object', additionalProperties: true, example: { content: '...' } })
  @Expose({ name: 'tool_output' })
  toolOutput!: Record<string, unknown>;

  @ApiProperty({ description: 'Tool status', enum: ['completed', 'failed'], example: 'completed' })
  @Expose({ name: 'status' })
  status!: string;

  @ApiPropertyOptional({ description: 'Error message', example: 'File not found' })
  @Expose({ name: 'error_message' })
  errorMessage?: string;

  @ApiProperty({ description: 'Duration in milliseconds', example: 500 })
  @Expose({ name: 'duration_ms' })
  durationMs!: number;

  @ApiPropertyOptional({ description: 'Start timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'started_at' })
  startedAt?: string;

  @ApiPropertyOptional({ description: 'Completion timestamp (ISO 8601)', example: '2026-09-01T12:00:00.500Z' })
  @Expose({ name: 'completed_at' })
  completedAt?: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class TrajectoryEventDto {
  @ApiProperty({ description: 'Event ID', example: 1 })
  @Expose({ name: 'id' })
  id!: number;

  @ApiProperty({ description: 'Run ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'run_id' })
  runId!: string;

  @ApiProperty({ description: 'Event type', example: 'token.streamed' })
  @Expose({ name: 'type' })
  type!: string;

  @ApiProperty({ description: 'Event sequence number', example: 5 })
  @Expose({ name: 'sequence' })
  sequence!: number;

  @ApiProperty({ description: 'Event data', type: 'object', additionalProperties: true })
  @Expose({ name: 'data' })
  data!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Trace ID', example: 'trace-123' })
  @Expose({ name: 'trace_id' })
  traceId?: string;

  @ApiPropertyOptional({ description: 'Occurred at timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'occurred_at' })
  occurredAt?: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class TrajectorySessionDto {
  @ApiProperty({ description: 'Session ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiPropertyOptional({ description: 'Session title', example: 'Help with debugging' })
  @Expose({ name: 'title' })
  title?: string;

  @ApiPropertyOptional({ description: 'Model', example: 'gpt-4o' })
  @Expose({ name: 'model' })
  model?: string;

  @ApiPropertyOptional({ description: 'Provider', example: 'openai' })
  @Expose({ name: 'provider' })
  provider?: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class TrajectoryResponseDto {
  @ApiProperty({ description: 'Session info', type: TrajectorySessionDto })
  @Expose({ name: 'session' })
  @Type(() => TrajectorySessionDto)
  session!: TrajectorySessionDto;

  @ApiProperty({ description: 'List of runs', type: [TrajectoryTurnDto] })
  @Expose({ name: 'runs' })
  @Type(() => TrajectoryTurnDto)
  runs!: TrajectoryTurnDto[];

  @ApiProperty({ description: 'List of tool calls', type: [TrajectoryToolCallDto] })
  @Expose({ name: 'tool_calls' })
  @Type(() => TrajectoryToolCallDto)
  toolCalls!: TrajectoryToolCallDto[];

  @ApiProperty({ description: 'List of events', type: [TrajectoryEventDto] })
  @Expose({ name: 'events' })
  @Type(() => TrajectoryEventDto)
  events!: TrajectoryEventDto[];

  @ApiProperty({ description: 'Statistics', type: TrajectoryStatsDto })
  @Expose({ name: 'stats' })
  @Type(() => TrajectoryStatsDto)
  stats!: TrajectoryStatsDto;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}
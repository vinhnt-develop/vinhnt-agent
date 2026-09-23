import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ContextBreakdownDto {
  @ApiProperty({ name: 'userTokens', type: Number, description: 'User tokens', example: 1500 })
  @Expose({ name: 'userTokens' })
  userTokens!: number;

  @ApiProperty({ name: 'assistantTokens', type: Number, description: 'Assistant tokens', example: 2000 })
  @Expose({ name: 'assistantTokens' })
  assistantTokens!: number;

  @ApiProperty({ name: 'toolCallTokens', type: Number, description: 'Tool call tokens', example: 500 })
  @Expose({ name: 'toolCallTokens' })
  toolCallTokens!: number;

  @ApiProperty({ name: 'otherTokens', type: Number, description: 'Other tokens', example: 100 })
  @Expose({ name: 'otherTokens' })
  otherTokens!: number;

  @ApiProperty({ name: 'userPercent', type: Number, description: 'User percentage', example: 30 })
  @Expose({ name: 'userPercent' })
  userPercent!: number;

  @ApiProperty({ name: 'assistantPercent', type: Number, description: 'Assistant percentage', example: 40 })
  @Expose({ name: 'assistantPercent' })
  assistantPercent!: number;

  @ApiProperty({ name: 'toolCallPercent', type: Number, description: 'Tool call percentage', example: 10 })
  @Expose({ name: 'toolCallPercent' })
  toolCallPercent!: number;

  @ApiProperty({ name: 'otherPercent', type: Number, description: 'Other percentage', example: 20 })
  @Expose({ name: 'otherPercent' })
  otherPercent!: number;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class TrajectoryStatsDto {
  @ApiProperty({ name: 'totalRuns', type: Number, description: 'Total runs', example: 10 })
  @Expose({ name: 'totalRuns' })
  totalRuns!: number;

  @ApiProperty({ name: 'totalToolCalls', type: Number, description: 'Total tool calls', example: 50 })
  @Expose({ name: 'totalToolCalls' })
  totalToolCalls!: number;

  @ApiProperty({ name: 'totalInputTokens', type: Number, description: 'Total input tokens', example: 15000 })
  @Expose({ name: 'totalInputTokens' })
  totalInputTokens!: number;

  @ApiProperty({ name: 'totalOutputTokens', type: Number, description: 'Total output tokens', example: 20000 })
  @Expose({ name: 'totalOutputTokens' })
  totalOutputTokens!: number;

  @ApiProperty({ name: 'totalReasoningTokens', type: Number, description: 'Total reasoning tokens', example: 1000 })
  @Expose({ name: 'totalReasoningTokens' })
  totalReasoningTokens!: number;

  @ApiPropertyOptional({ name: 'totalCacheReadTokens', type: Number, description: 'Total cache read tokens' })
  @Expose({ name: 'totalCacheReadTokens' })
  totalCacheReadTokens?: number;

  @ApiPropertyOptional({ name: 'totalCacheWriteTokens', type: Number, description: 'Total cache write tokens' })
  @Expose({ name: 'totalCacheWriteTokens' })
  totalCacheWriteTokens?: number;

  @ApiPropertyOptional({ name: 'totalAllTokens', type: Number, description: 'Total all tokens' })
  @Expose({ name: 'totalAllTokens' })
  totalAllTokens?: number;

  @ApiProperty({ name: 'totalCost', type: Number, description: 'Total cost', example: 0.5 })
  @Expose({ name: 'totalCost' })
  totalCost!: number;

  @ApiProperty({ name: 'totalDurationMs', type: Number, description: 'Total duration in milliseconds', example: 30000 })
  @Expose({ name: 'totalDurationMs' })
  totalDurationMs!: number;

  @ApiProperty({ name: 'succeededRuns', type: Number, description: 'Succeeded runs', example: 8 })
  @Expose({ name: 'succeededRuns' })
  succeededRuns!: number;

  @ApiProperty({ name: 'failedRuns', type: Number, description: 'Failed runs', example: 2 })
  @Expose({ name: 'failedRuns' })
  failedRuns!: number;

  @ApiProperty({ name: 'avgDurationMs', type: Number, description: 'Average duration in milliseconds', example: 3000 })
  @Expose({ name: 'avgDurationMs' })
  avgDurationMs!: number;

  @ApiProperty({ name: 'contextBreakdown', type: ContextBreakdownDto, description: 'Context breakdown' })
  @Expose({ name: 'contextBreakdown' })
  @Type(() => ContextBreakdownDto)
  contextBreakdown!: ContextBreakdownDto;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class TrajectoryToolCallDto {
  @ApiProperty({ name: 'id', type: String, description: 'Tool call ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiPropertyOptional({ name: 'runId', type: String, description: 'Run ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'runId' })
  runId?: string;

  @ApiProperty({ name: 'toolName', type: String, description: 'Tool name', example: 'read_file' })
  @Expose({ name: 'toolName' })
  toolName!: string;

  @ApiProperty({ name: 'toolInput', type: 'object', description: 'Tool input', additionalProperties: true, example: { path: 'src/main.ts' } })
  @Expose({ name: 'toolInput' })
  toolInput!: Record<string, unknown>;

  @ApiProperty({ name: 'toolOutput', type: 'object', description: 'Tool output', additionalProperties: true, example: { content: '...' } })
  @Expose({ name: 'toolOutput' })
  toolOutput!: Record<string, unknown>;

  @ApiProperty({ name: 'status', type: String, description: 'Tool status', enum: ['completed', 'failed'], example: 'completed' })
  @Expose({ name: 'status' })
  status!: string;

  @ApiPropertyOptional({ name: 'errorMessage', type: String, description: 'Error message', example: 'File not found' })
  @Expose({ name: 'errorMessage' })
  errorMessage?: string;

  @ApiProperty({ name: 'durationMs', type: Number, description: 'Duration in milliseconds', example: 500 })
  @Expose({ name: 'durationMs' })
  durationMs!: number;

  @ApiPropertyOptional({ name: 'startedAt', type: String, description: 'Start timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'startedAt' })
  startedAt?: string;

  @ApiPropertyOptional({ name: 'completedAt', type: String, description: 'Completion timestamp (ISO 8601)', example: '2026-09-01T12:00:00.500Z' })
  @Expose({ name: 'completedAt' })
  completedAt?: string;

  @ApiProperty({ name: 'stepNumber', type: Number, description: 'Step number this tool call belongs to', example: 0 })
  @Expose({ name: 'stepNumber' })
  stepNumber!: number;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class TrajectoryStepDto {
  @ApiProperty({ name: 'stepNumber', type: Number, description: 'Step number', example: 0 })
  @Expose({ name: 'stepNumber' })
  stepNumber!: number;

  @ApiProperty({ name: 'status', type: String, description: 'Step status', enum: ['completed', 'failed', 'timeout'], example: 'completed' })
  @Expose({ name: 'status' })
  status!: 'completed' | 'failed' | 'timeout';

  @ApiProperty({ name: 'toolCalls', type: [TrajectoryToolCallDto], description: 'Tool calls in this step' })
  @Expose({ name: 'toolCalls' })
  @Type(() => TrajectoryToolCallDto)
  toolCalls!: TrajectoryToolCallDto[];

  @ApiProperty({ name: 'inputTokens', type: Number, description: 'Input tokens for this step', example: 500 })
  @Expose({ name: 'inputTokens' })
  inputTokens!: number;

  @ApiProperty({ name: 'outputTokens', type: Number, description: 'Output tokens for this step', example: 200 })
  @Expose({ name: 'outputTokens' })
  outputTokens!: number;

  @ApiProperty({ name: 'durationMs', type: Number, description: 'Duration in milliseconds', example: 1000 })
  @Expose({ name: 'durationMs' })
  durationMs!: number;

  @ApiPropertyOptional({ name: 'thinkingContent', type: String, description: 'Thinking/reasoning content for this step' })
  @Expose({ name: 'thinkingContent' })
  thinkingContent?: string;

  @ApiPropertyOptional({ name: 'llmRetry', type: Object, description: 'LLM retry info (attempt, delay, reason)' })
  @Expose({ name: 'llmRetry' })
  llmRetry?: { attempt?: number; delayMs?: number; reason?: string };

  @ApiPropertyOptional({ name: 'contextCompressed', type: Object, description: 'Context compaction info' })
  @Expose({ name: 'contextCompressed' })
  contextCompressed?: { originalCount?: number; compressedCount?: number; summary?: string };

  @ApiPropertyOptional({ name: 'llmRequest', type: Object, description: 'LLM request details including system prompt, model, temperature, messages, tools, selection' })
  @Expose({ name: 'llmRequest' })
  llmRequest?: {
    model?: string;
    provider?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    messageCount?: number;
    toolCount?: number;
    systemPromptLength?: number;
    systemPrompt?: string;
    messages?: Array<{
      role: string;
      content: string;
      toolCalls?: Array<{ id: string; name: string; arguments: string }>;
      toolCallId?: string;
    }>;
    tools?: Array<{
      name: string;
      description: string;
      parameters?: Record<string, unknown>;
      risk?: string;
    }>;
    selection?: {
      tools?: Array<{ id: string; name?: string; enabled?: boolean }>;
      knowledge?: Array<{ id: string; key?: string; enabled?: boolean }>;
      plugins?: string[];
    };
    agent?: {
      id?: string;
      name?: string;
    };
  };

  @ApiPropertyOptional({ name: 'llmResponse', type: Object, description: 'LLM response details including content, tool calls, usage' })
  @Expose({ name: 'llmResponse' })
  llmResponse?: {
    content?: string;
    toolCalls?: Array<{ id: string; name: string; arguments: string }>;
    finishReason?: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      reasoningTokens?: number;
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
    };
    durationMs?: number;
    model?: string;
    provider?: string;
    step?: number;
  };
}

export class TrajectoryMessageDto {
  @ApiProperty({ name: 'role', type: String, description: 'Message role', enum: ['system', 'user', 'assistant', 'tool'], example: 'user' })
  @Expose({ name: 'role' })
  role!: string;

  @ApiProperty({ name: 'content', type: String, description: 'Message content', example: 'Hello, how are you?' })
  @Expose({ name: 'content' })
  content!: string;

  @ApiPropertyOptional({ name: 'contentBlocks', type: [Object], description: 'Structured content blocks (tool_use, tool_result, thinking)' })
  @Expose({ name: 'contentBlocks' })
  contentBlocks?: unknown[];

  @ApiPropertyOptional({ name: 'model', type: String, description: 'Model used', example: 'gpt-4o' })
  @Expose({ name: 'model' })
  model?: string;

  @ApiPropertyOptional({ name: 'provider', type: String, description: 'Provider', example: 'openai' })
  @Expose({ name: 'provider' })
  provider?: string;

  @ApiPropertyOptional({ name: 'inputTokens', type: Number, description: 'Input tokens' })
  @Expose({ name: 'inputTokens' })
  inputTokens?: number;

  @ApiPropertyOptional({ name: 'outputTokens', type: Number, description: 'Output tokens' })
  @Expose({ name: 'outputTokens' })
  outputTokens?: number;

  @ApiPropertyOptional({ name: 'cost', type: Number, description: 'Cost in USD' })
  @Expose({ name: 'cost' })
  cost?: number;

  @ApiPropertyOptional({ name: 'toolCallId', type: String, description: 'Tool call ID for tool results' })
  @Expose({ name: 'toolCallId' })
  toolCallId?: string;

  @ApiPropertyOptional({ name: 'createdAt', type: String, description: 'Creation timestamp (ISO 8601)' })
  @Expose({ name: 'createdAt' })
  createdAt?: string;
}

export class TrajectoryTurnDto {
  @ApiProperty({ name: 'runId', type: String, description: 'Run ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'runId' })
  runId!: string;

  @ApiProperty({ name: 'status', type: String, description: 'Run status', enum: ['succeeded', 'failed', 'cancelled'], example: 'succeeded' })
  @Expose({ name: 'status' })
  status!: string;

  @ApiPropertyOptional({ name: 'model', type: String, description: 'Model', example: 'gpt-4o' })
  @Expose({ name: 'model' })
  model?: string;

  @ApiPropertyOptional({ name: 'provider', type: String, description: 'Provider', example: 'openai' })
  @Expose({ name: 'provider' })
  provider?: string;

  @ApiProperty({ name: 'inputTokens', type: Number, description: 'Input tokens', example: 1500 })
  @Expose({ name: 'inputTokens' })
  inputTokens!: number;

  @ApiProperty({ name: 'outputTokens', type: Number, description: 'Output tokens', example: 2000 })
  @Expose({ name: 'outputTokens' })
  outputTokens!: number;

  @ApiProperty({ name: 'reasoningTokens', type: Number, description: 'Reasoning tokens', example: 100 })
  @Expose({ name: 'reasoningTokens' })
  reasoningTokens!: number;

  @ApiProperty({ name: 'totalCost', type: Number, description: 'Total cost', example: 0.015 })
  @Expose({ name: 'totalCost' })
  totalCost!: number;

  @ApiProperty({ name: 'durationMs', type: Number, description: 'Duration in milliseconds', example: 5000 })
  @Expose({ name: 'durationMs' })
  durationMs!: number;

  @ApiProperty({ name: 'toolCallsCount', type: Number, description: 'Tool calls count', example: 5 })
  @Expose({ name: 'toolCallsCount' })
  toolCallsCount!: number;

  @ApiPropertyOptional({ name: 'errorMessage', type: String, description: 'Error message', example: 'API rate limit exceeded' })
  @Expose({ name: 'errorMessage' })
  errorMessage?: string;

  @ApiPropertyOptional({ name: 'startedAt', type: String, description: 'Start timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'startedAt' })
  startedAt?: string;

  @ApiPropertyOptional({ name: 'completedAt', type: String, description: 'Completion timestamp (ISO 8601)', example: '2026-09-01T12:00:05.000Z' })
  @Expose({ name: 'completedAt' })
  completedAt?: string;

  @ApiPropertyOptional({ name: 'parentRunId', type: String, description: 'Parent run ID for sub-agents', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'parentRunId' })
  parentRunId?: string;

  @ApiProperty({ name: 'steps', type: [TrajectoryStepDto], description: 'Steps in this run' })
  @Expose({ name: 'steps' })
  @Type(() => TrajectoryStepDto)
  steps!: TrajectoryStepDto[];

  @ApiProperty({ name: 'messages', type: [TrajectoryMessageDto], description: 'Messages in this run (system/user/assistant)' })
  @Expose({ name: 'messages' })
  @Type(() => TrajectoryMessageDto)
  messages!: TrajectoryMessageDto[];

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class TrajectoryEventDto {
  @ApiProperty({ name: 'id', type: Number, description: 'Event ID', example: 1 })
  @Expose({ name: 'id' })
  id!: number;

  @ApiProperty({ name: 'runId', type: String, description: 'Run ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'runId' })
  runId!: string;

  @ApiProperty({ name: 'type', type: String, description: 'Event type', example: 'token.streamed' })
  @Expose({ name: 'type' })
  type!: string;

  @ApiProperty({ name: 'sequence', type: Number, description: 'Event sequence number', example: 5 })
  @Expose({ name: 'sequence' })
  sequence!: number;

  @ApiProperty({ name: 'data', type: 'object', description: 'Event data', additionalProperties: true })
  @Expose({ name: 'data' })
  data!: Record<string, unknown>;

  @ApiPropertyOptional({ name: 'traceId', type: String, description: 'Trace ID', example: 'trace-123' })
  @Expose({ name: 'traceId' })
  traceId?: string;

  @ApiPropertyOptional({ name: 'occurredAt', type: String, description: 'Occurred at timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'occurredAt' })
  occurredAt?: string;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class TrajectorySessionDto {
  @ApiProperty({ name: 'id', type: String, description: 'Session ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiPropertyOptional({ name: 'title', type: String, description: 'Session title', example: 'Help with debugging' })
  @Expose({ name: 'title' })
  title?: string;

  @ApiPropertyOptional({ name: 'model', type: String, description: 'Model', example: 'gpt-4o' })
  @Expose({ name: 'model' })
  model?: string;

  @ApiPropertyOptional({ name: 'provider', type: String, description: 'Provider', example: 'openai' })
  @Expose({ name: 'provider' })
  provider?: string;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class TrajectoryResponseDto {
  @ApiProperty({ name: 'session', type: TrajectorySessionDto, description: 'Session info' })
  @Expose({ name: 'session' })
  @Type(() => TrajectorySessionDto)
  session!: TrajectorySessionDto;

  @ApiProperty({ name: 'runs', type: [TrajectoryTurnDto], description: 'List of runs with hierarchical steps and tool calls' })
  @Expose({ name: 'runs' })
  @Type(() => TrajectoryTurnDto)
  runs!: TrajectoryTurnDto[];

  @ApiProperty({ name: 'events', type: [TrajectoryEventDto], description: 'List of events' })
  @Expose({ name: 'events' })
  @Type(() => TrajectoryEventDto)
  events!: TrajectoryEventDto[];

  @ApiProperty({ name: 'stats', type: TrajectoryStatsDto, description: 'Statistics' })
  @Expose({ name: 'stats' })
  @Type(() => TrajectoryStatsDto)
  stats!: TrajectoryStatsDto;

  @ApiProperty({ name: 'allMessages', type: [TrajectoryMessageDto], description: 'All messages in the session' })
  @Expose({ name: 'allMessages' })
  @Type(() => TrajectoryMessageDto)
  allMessages!: TrajectoryMessageDto[];

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

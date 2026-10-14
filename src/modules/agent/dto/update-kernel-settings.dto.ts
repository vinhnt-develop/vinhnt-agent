import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsString,
  IsBoolean,
  IsIn,
  IsArray,
  IsObject,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { KNOWN_PERMISSION_MODES } from '@/shared/permission-mode';
import type { PermissionMode } from '@/shared/permission-mode';
import {
  APPROVAL_TIMEOUT_MS_MIN,
  APPROVAL_TIMEOUT_MS_MAX,
  MAX_KERNEL_CACHE_SIZE_MIN,
} from '../services/agent-settings.service';

/**
 * PUT body for kernel settings (P4.3).
 *
 * Previously `Partial<KernelSettings>` (an interface) — the global ValidationPipe
 * skips validation for non-class metatypes, so the raw JSON body went straight
 * into the persisted settings file (unknown keys, wrong types, out-of-range values).
 *
 * With this DTO the global pipe (whitelist: true + transform: true) strips
 * unknown keys, implicitly converts string→number, and rejects out-of-range values.
 */
export class UpdateKernelSettingsDto {
  // ── LLM ────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 0.7, minimum: 0, maximum: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({ example: 1, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number;

  @ApiPropertyOptional({ example: 4096, minimum: 1, maximum: 128000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(128000)
  maxTokens?: number;

  @ApiPropertyOptional({ example: 0, minimum: -2, maximum: 2 })
  @IsOptional()
  @IsNumber()
  @Min(-2)
  @Max(2)
  frequencyPenalty?: number;

  @ApiPropertyOptional({ example: 0, minimum: -2, maximum: 2 })
  @IsOptional()
  @IsNumber()
  @Min(-2)
  @Max(2)
  presencePenalty?: number;

  @ApiPropertyOptional({ example: 30, minimum: 1, maximum: 200 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  maxSteps?: number;

  @ApiPropertyOptional({ example: 1024, minimum: 0, maximum: 32000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(32000)
  thinkingBudget?: number;

  @ApiPropertyOptional({ example: 120000, minimum: 1000, maximum: 600000 })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(600000)
  stepTimeout?: number;

  /** Model context window override in tokens; 0 = provider/SDK default (P4.4). */
  @ApiPropertyOptional({ example: 0, minimum: 0, maximum: 1000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  contextLimit?: number;

  // ── Tool behavior ──────────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: ['auto', 'none', 'required'] })
  @IsOptional()
  @IsIn(['auto', 'none', 'required'])
  toolChoice?: 'auto' | 'none' | 'required';

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  parallelToolCalls?: boolean;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxToolCallsPerStep?: number;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxConcurrentToolCalls?: number;

  // ── Permissions ────────────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: [...KNOWN_PERMISSION_MODES] })
  @IsOptional()
  @IsIn([...KNOWN_PERMISSION_MODES])
  permissionMode?: PermissionMode;

  // ── Permissions — runtime knobs (SC1/SC2, promoted from env-only) ───────

  /**
   * L1 auto-approval switch: false → every run resolves to 'ask'. The
   * AGENT_AUTO_APPROVAL=false env kill switch (L2) is checked before this
   * and cannot be bypassed through the API.
   */
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  autoApproval?: boolean;

  /** Fallback project root when a session has no projectPath. */
  @ApiPropertyOptional({ example: '.', maxLength: 1024 })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  workspaceRoot?: string;

  /** Unanswered approval dialog fails the tool after this window (ms). */
  @ApiPropertyOptional({
    example: 120000,
    minimum: APPROVAL_TIMEOUT_MS_MIN,
    maximum: APPROVAL_TIMEOUT_MS_MAX,
  })
  @IsOptional()
  @IsNumber()
  @Min(APPROVAL_TIMEOUT_MS_MIN)
  @Max(APPROVAL_TIMEOUT_MS_MAX)
  approvalTimeoutMs?: number;

  /** Kernel LRU cache capacity — applied at the next evict, no restart. */
  @ApiPropertyOptional({ example: 50, minimum: MAX_KERNEL_CACHE_SIZE_MIN })
  @IsOptional()
  @IsNumber()
  @Min(MAX_KERNEL_CACHE_SIZE_MIN)
  maxKernelCacheSize?: number;

  /** OpenCode-style rules map — deep shape guarded by the service, not here. */
  @ApiPropertyOptional({ example: { shell: 'ask' }, type: Object })
  @IsOptional()
  @IsObject()
  globalPermissionRules?: Record<string, string | Record<string, string>>;

  /** Risk level → effect defaults — deep shape guarded by the service. */
  @ApiPropertyOptional({ example: { destructive: 'ask' }, type: Object })
  @IsOptional()
  @IsObject()
  permissionRiskDefaults?: Record<string, string>;

  // ── Behavior ───────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  selfCorrectOnFailure?: boolean;

  @ApiPropertyOptional({ example: 1, minimum: 0, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maxSelfCorrectAttempts?: number;

  /** P6.6: ratio (0-1) canonical; percent (50-100) accepted for legacy clients/JSON. */
  @ApiPropertyOptional({ example: 0.75, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  compactionThreshold?: number;

  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  doomLoopThreshold?: number;

  @ApiPropertyOptional({ example: 3, minimum: 0, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maxSubAgentDepth?: number;

  /** Most recent messages loaded into context; 0 = unlimited (P4.1). */
  @ApiPropertyOptional({ example: 0, minimum: 0, maximum: 500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  historyLimit?: number;

  // ── Resilience ─────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 3, minimum: 0, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maxRetries?: number;

  @ApiPropertyOptional({ example: 1000, minimum: 100, maximum: 10000 })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(10000)
  backoffMs?: number;

  @ApiPropertyOptional({ example: 30000, minimum: 1000, maximum: 60000 })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(60000)
  maxBackoffMs?: number;

  // ── Sandbox ────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: ['host', 'process', 'container'] })
  @IsOptional()
  @IsIn(['host', 'process', 'container'])
  sandboxMode?: 'host' | 'process' | 'container';

  // ── Guardrails (P3.2) ──────────────────────────────────────────────────

  /** 0 = disabled. */
  @ApiPropertyOptional({ example: 0, minimum: 0, maximum: 1000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  inputGuardrailMaxLength?: number;

  /** Newline-separated regex patterns; '' = disabled. */
  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  guardrailBlocklist?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  secretRedaction?: boolean;

  // ── Model resilience (P4.4) ────────────────────────────────────────────

  /** Fallback model ids tried (in order) when the primary model call fails. */
  @ApiPropertyOptional({ example: ['gpt-4o-mini'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  failoverModels?: string[];

  // ── Observability (P6.4) ────────────────────────────────────────────────

  /** OTLP/HTTP traces endpoint for run spans; '' (or omitted) = disabled. */
  @ApiPropertyOptional({ example: 'http://localhost:4318/v1/traces', maxLength: 2048 })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  otlpEndpoint?: string;

  // ── System ─────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  systemPrompt?: string;
}

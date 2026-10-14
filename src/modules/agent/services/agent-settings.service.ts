import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { KNOWN_PERMISSION_MODES } from '@/shared/permission-mode';
import type { PermissionMode } from '@/shared/permission-mode';
import { KernelSettingsStore } from '@/shared/kernel-settings.store';

/** SC1: approval dialog wait window bounds (also enforced by the DTO). */
export const APPROVAL_TIMEOUT_MS_MIN = 1000;
export const APPROVAL_TIMEOUT_MS_MAX = 600000;
/** SC1: kernel LRU capacity bounds (lower bound only — no natural cap). */
export const MAX_KERNEL_CACHE_SIZE_MIN = 1;

export interface KernelSettings {
  // LLM Settings
  temperature: number;
  topP: number;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
  maxSteps: number;
  thinkingBudget: number;
  stepTimeout: number;
  /** Model context window override in tokens; 0 = provider/SDK default (P4.4). */
  contextLimit: number;
  /** P7.1: unified ContextBudget — max context tokens the kernel budgets for
   *  (seeds `ContextBudget.maxContextTokens`; 0 = disabled → SDK default 128_000). */
  maxContextTokens: number;

  // Tool Behavior
  toolChoice: 'auto' | 'none' | 'required';
  parallelToolCalls: boolean;
  maxToolCallsPerStep: number;
  maxConcurrentToolCalls: number;

  // Permissions — default approval mode when the client doesn't send one
  // (per-run permissionMode from the composer always wins). The vocabulary
  // lives in @vinhnt-sdk/permission (P6.5) - the app never owns it.
  permissionMode: PermissionMode;

  // Permissions — runtime knobs promoted from env-only (SC1, JSON > env > literal)
  /**
   * L1 auto-approval switch: false → resolvePermissionMode always returns
   * 'ask' regardless of override/permissionMode. The AGENT_AUTO_APPROVAL=false
   * env (L2) is a separate ops kill switch checked BEFORE this field — the UI
   * cannot bypass it.
   */
  autoApproval: boolean;
  /** Fallback project root when a session has no projectPath (SC3). */
  workspaceRoot: string;
  /** Unanswered approval dialog fails the tool after this window (ms). */
  approvalTimeoutMs: number;
  /** Kernel LRU cache capacity — read dynamically at evict, no restart (SC3). */
  maxKernelCacheSize: number;
  /** OpenCode-style permission rules; same shape as AGENT_PERMISSION_RULES. */
  globalPermissionRules: Record<string, string | Record<string, string>>;
  /** Risk level → effect defaults; merged with destructive:'allow' on full. */
  permissionRiskDefaults: Record<string, string>;

  // Behavior
  selfCorrectOnFailure: boolean;
  maxSelfCorrectAttempts: number;
  compactionThreshold: number;
  doomLoopThreshold: number;
  maxSubAgentDepth: number;
  /** Most recent messages loaded into context per turn; 0 = unlimited (P4.1). */
  historyLimit: number;

  // Resilience
  maxRetries: number;
  backoffMs: number;
  maxBackoffMs: number;

  // Sandbox
  sandboxMode: 'host' | 'process' | 'container';

  // Guardrails (settings-driven — P3.2)
  /** Input guardrail max chars; 0 = disabled. */
  inputGuardrailMaxLength: number;
  /** Newline-separated regex patterns blocked on input AND output; '' = disabled. */
  guardrailBlocklist: string;
  /** Redact secrets in model output (secret-detection guardrail). */
  secretRedaction: boolean;

  // Model resilience (P4.4)
  /** Fallback model ids tried (in order) when the primary model call fails. */
  failoverModels: string[];

  // Observability (P6.4)
  /** OTLP/HTTP traces endpoint for run spans; '' = export disabled (opt-in). */
  otlpEndpoint: string;

  // System
  systemPrompt: string;
}

const DEFAULT_SETTINGS: KernelSettings = {
  temperature: 0.7,
  topP: 1.0,
  maxTokens: 4096,
  frequencyPenalty: 0,
  presencePenalty: 0,
  maxSteps: 30,
  thinkingBudget: 1024,
  stepTimeout: 120000,
  contextLimit: 0,
  maxContextTokens: 128_000,
  toolChoice: 'auto',
  parallelToolCalls: true,
  maxToolCallsPerStep: 10,
  maxConcurrentToolCalls: 5,
  permissionMode: 'ask',
  autoApproval: true,
  workspaceRoot: '.',
  approvalTimeoutMs: 120000,
  maxKernelCacheSize: 50,
  globalPermissionRules: {},
  permissionRiskDefaults: {},
  selfCorrectOnFailure: true,
  maxSelfCorrectAttempts: 1,
  compactionThreshold: 0.75,
  doomLoopThreshold: 3,
  maxSubAgentDepth: 3,
  historyLimit: 0,
  maxRetries: 3,
  backoffMs: 1000,
  maxBackoffMs: 30000,
  sandboxMode: 'host',
  inputGuardrailMaxLength: 0,
  guardrailBlocklist: '',
  secretRedaction: false,
  failoverModels: [],
  otlpEndpoint: '',
  systemPrompt: '',
};

@Injectable()
export class AgentSettingsService {
  private readonly logger = new Logger(AgentSettingsService.name);
  private readonly settingsPath: string;
  /** Env-seeded defaults — saved kernel-settings.json overrides these (P4.6). */
  private readonly defaults: KernelSettings;
  private settings: KernelSettings;

  constructor(
    private readonly configService: ConfigService,
    private readonly settingsStore: KernelSettingsStore,
  ) {
    const configDir = this.configService.get<string>('CONFIG_DIR', path.join(process.cwd(), 'config'));
    this.settingsPath = path.join(configDir, 'kernel-settings.json');
    // Fallback hierarchy (P4.6): saved kernel-settings.json > env (agent.*) > literal.
    // Env seeds the DEFAULT_SETTINGS literals so operators can pre-set values
    // without editing the JSON (e.g. AGENT_TEMPERATURE=0.2 in a Docker image).
    this.defaults = AgentSettingsService.sanitizeScFields(
      {
        ...DEFAULT_SETTINGS,
        temperature: this.configService.get<number>('agent.temperature', DEFAULT_SETTINGS.temperature),
        topP: this.configService.get<number>('agent.topP', DEFAULT_SETTINGS.topP),
        maxSteps: this.configService.get<number>('agent.maxSteps', DEFAULT_SETTINGS.maxSteps),
        maxTokens: this.configService.get<number>('agent.maxTokens', DEFAULT_SETTINGS.maxTokens),
        stepTimeout: this.configService.get<number>('agent.stepTimeout', DEFAULT_SETTINGS.stepTimeout),
        doomLoopThreshold: this.configService.get<number>('agent.doomLoopThreshold', DEFAULT_SETTINGS.doomLoopThreshold),
        thinkingBudget: this.configService.get<number>('agent.thinkingBudget', DEFAULT_SETTINGS.thinkingBudget),
        // SC1: the 6 env-only knobs become env SEEDS for the JSON-first settings
        // (hierarchy kernel-settings.json > env > literal — same P4.6 pattern).
        autoApproval: this.configService.get<boolean>('agent.autoApproval', DEFAULT_SETTINGS.autoApproval),
        workspaceRoot: this.configService.get<string>('agent.workspaceRoot', DEFAULT_SETTINGS.workspaceRoot),
        approvalTimeoutMs: this.configService.get<number>('agent.approvalTimeoutMs', DEFAULT_SETTINGS.approvalTimeoutMs),
        maxKernelCacheSize: this.configService.get<number>('agent.maxKernelCacheSize', DEFAULT_SETTINGS.maxKernelCacheSize),
        globalPermissionRules:
          this.configService.get<Record<string, string | Record<string, string>>>('agent.globalPermissionRules') ??
          DEFAULT_SETTINGS.globalPermissionRules,
        permissionRiskDefaults:
          this.configService.get<Record<string, string>>('agent.permissionRiskDefaults') ??
          DEFAULT_SETTINGS.permissionRiskDefaults,
        otlpEndpoint: this.configService.get<string>('agent.otlpEndpoint', DEFAULT_SETTINGS.otlpEndpoint),
        // P7.1: 15th env seed — ContextBudget.maxContextTokens.
        maxContextTokens: this.configService.get<number>(
          'agent.maxContextTokens',
          DEFAULT_SETTINGS.maxContextTokens,
        ),
      },
      this.logger,
      'env seed',
    );
    this.settings = { ...this.defaults };
    this.loadSettings();
  }

  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        const saved = JSON.parse(data);
        this.settings = { ...this.defaults, ...saved };
        this.settings.compactionThreshold = AgentSettingsService.normalizeThreshold(this.settings.compactionThreshold);
        // SC1: old JSON files predate the 6 SC fields — the spread fills them
        // from defaults; a corrupt/partial file gets sanitized here.
        AgentSettingsService.sanitizeScFields(this.settings, this.logger, this.settingsPath);
        this.logger.log(`Loaded kernel settings from ${this.settingsPath}`);
        this.syncStore();
      } else {
        this.saveSettings();
      }
    } catch (error) {
      this.logger.warn('Failed to load kernel settings, using defaults', error);
      this.settings = { ...this.defaults };
      this.syncStore();
    }
  }

  private saveSettings(): void {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error('Failed to save kernel settings', error);
    }
    // SC3: update/reset change workspaceRoot in memory — publish even when the
    // disk write failed (in-memory state is what the running process uses).
    this.syncStore();
  }

  /** P6.6: ratio (0-1) is canonical end-to-end (SDK kernel + webui slider);
   *  percent (50-100) stays accepted for legacy saved JSON. */
  private static normalizeThreshold(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return DEFAULT_SETTINGS.compactionThreshold;
    return value > 1 ? Math.min(value / 100, 1) : Math.min(value, 1);
  }

  private static isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * SC1 runtime guard: OpenCode-style rules map — each value is a bare
   * `"allow"|...` string or a nested `{ param: "allow"|... }` record.
   * Returns a sanitized copy, or undefined when the shape is invalid.
   */
  private static sanitizeGlobalRules(
    value: unknown,
  ): Record<string, string | Record<string, string>> | undefined {
    if (!AgentSettingsService.isPlainObject(value)) return undefined;
    const out: Record<string, string | Record<string, string>> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (!key) continue;
      if (typeof entry === 'string') {
        out[key] = entry;
        continue;
      }
      if (
        AgentSettingsService.isPlainObject(entry) &&
        Object.values(entry).every((v) => typeof v === 'string')
      ) {
        out[key] = entry as Record<string, string>;
        continue;
      }
      return undefined;
    }
    return out;
  }

  /** SC1 runtime guard: `{ riskLevel: "allow"|... }` — every value a string. */
  private static sanitizeRiskDefaults(value: unknown): Record<string, string> | undefined {
    if (!AgentSettingsService.isPlainObject(value)) return undefined;
    if (!Object.values(value).every((v) => typeof v === 'string')) return undefined;
    return value as Record<string, string>;
  }

  /**
   * SC1: validate the 6 SC fields in place (mutates, returns the object so it
   * can wrap a spread literal). Invalid values fall back to the literal
   * default; optionally warns so bad env/corrupt JSON is visible.
   */
  private static sanitizeScFields<T extends KernelSettings>(s: T, logger?: Logger, source?: string): T {
    const warn = (field: string) => logger?.warn(`Invalid ${field}${source ? ` (${source})` : ''} — using default`);
    if (typeof s.autoApproval !== 'boolean') {
      s.autoApproval = DEFAULT_SETTINGS.autoApproval;
      warn('autoApproval');
    }
    if (typeof s.workspaceRoot !== 'string' || !s.workspaceRoot.trim()) {
      s.workspaceRoot = DEFAULT_SETTINGS.workspaceRoot;
      warn('workspaceRoot');
    }
    if (
      typeof s.approvalTimeoutMs !== 'number' ||
      !Number.isFinite(s.approvalTimeoutMs) ||
      s.approvalTimeoutMs < APPROVAL_TIMEOUT_MS_MIN ||
      s.approvalTimeoutMs > APPROVAL_TIMEOUT_MS_MAX
    ) {
      s.approvalTimeoutMs = DEFAULT_SETTINGS.approvalTimeoutMs;
      warn('approvalTimeoutMs');
    }
    if (
      typeof s.maxKernelCacheSize !== 'number' ||
      !Number.isFinite(s.maxKernelCacheSize) ||
      s.maxKernelCacheSize < MAX_KERNEL_CACHE_SIZE_MIN
    ) {
      s.maxKernelCacheSize = DEFAULT_SETTINGS.maxKernelCacheSize;
      warn('maxKernelCacheSize');
    }
    if (AgentSettingsService.sanitizeGlobalRules(s.globalPermissionRules) === undefined) {
      s.globalPermissionRules = DEFAULT_SETTINGS.globalPermissionRules;
      warn('globalPermissionRules');
    }
    if (AgentSettingsService.sanitizeRiskDefaults(s.permissionRiskDefaults) === undefined) {
      s.permissionRiskDefaults = DEFAULT_SETTINGS.permissionRiskDefaults;
      warn('permissionRiskDefaults');
    }
    // permissionMode (P6.5) - fail-closed: an unknown/missing mode falls back
    // to 'ask' instead of silently auto-approving. Vocabulary lives in
    // @vinhnt-sdk/permission (KNOWN_PERMISSION_MODES).
    if (
      typeof s.permissionMode !== 'string' ||
      !(KNOWN_PERMISSION_MODES as readonly string[]).includes(s.permissionMode)
    ) {
      s.permissionMode = DEFAULT_SETTINGS.permissionMode;
      warn('permissionMode');
    }
    // otlpEndpoint (P6.4) — trim; a non-empty value must be http(s)://… or the
    // field falls back to '' (export off) so a corrupt value can't opt in.
    if (typeof s.otlpEndpoint !== 'string') {
      s.otlpEndpoint = DEFAULT_SETTINGS.otlpEndpoint;
      warn('otlpEndpoint');
    } else {
      s.otlpEndpoint = s.otlpEndpoint.trim();
      if (s.otlpEndpoint && !/^https?:\/\/\S+$/i.test(s.otlpEndpoint)) {
        s.otlpEndpoint = DEFAULT_SETTINGS.otlpEndpoint;
        warn('otlpEndpoint');
      }
    }
    return s;
  }

  /**
   * Push the saved workspaceRoot into the cross-module store (SC3) so
   * shared/ readers (ProjectPathService) see JSON edits without a restart.
   * Guarded: unit tests build this service via Object.create (no ctor).
   */
  private syncStore(): void {
    if (this.settingsStore) {
      this.settingsStore.setWorkspaceRoot(this.settings.workspaceRoot);
    }
  }

  getSettings(): KernelSettings {
    return { ...this.settings, compactionThreshold: AgentSettingsService.normalizeThreshold(this.settings.compactionThreshold) };
  }

  updateSettings(partial: Partial<KernelSettings>): KernelSettings {
    // Skip undefined values — the DTO (P4.3) produces an instance with every
    // declared key present (undefined when omitted); spreading those would wipe
    // existing settings on a partial update.
    const next: Partial<KernelSettings> = {};
    for (const [key, value] of Object.entries(partial)) {
      if (value !== undefined) {
        (next as Record<string, unknown>)[key] = value;
      }
    }
    if (next.compactionThreshold !== undefined) {
      next.compactionThreshold = AgentSettingsService.normalizeThreshold(next.compactionThreshold);
    }
    // Runtime guards (defense-in-depth) — the HTTP layer now validates via
    // UpdateKernelSettingsDto (P4.3), but these still protect non-HTTP callers
    // (e.g. direct updateSettings from tests / internal code).
    if (
      next.permissionMode !== undefined &&
      !(KNOWN_PERMISSION_MODES as readonly string[]).includes(next.permissionMode)
    ) {
      delete next.permissionMode;
    }
    // Guardrails (P3.2) — drop malformed values (defense-in-depth).
    if (
      next.inputGuardrailMaxLength !== undefined &&
      (!Number.isFinite(next.inputGuardrailMaxLength) || next.inputGuardrailMaxLength < 0)
    ) {
      delete next.inputGuardrailMaxLength;
    }
    if (next.guardrailBlocklist !== undefined && typeof next.guardrailBlocklist !== 'string') {
      delete next.guardrailBlocklist;
    }
    if (next.secretRedaction !== undefined && typeof next.secretRedaction !== 'boolean') {
      delete next.secretRedaction;
    }
    // historyLimit (P4.1) — 0 = unlimited; drop malformed values (defense-in-depth).
    if (
      next.historyLimit !== undefined &&
      (!Number.isFinite(next.historyLimit) || next.historyLimit < 0)
    ) {
      delete next.historyLimit;
    }
    // contextLimit (P4.4) — 0 = provider/SDK default; drop malformed values.
    if (
      next.contextLimit !== undefined &&
      (!Number.isFinite(next.contextLimit) || next.contextLimit < 0)
    ) {
      delete next.contextLimit;
    }
    // maxContextTokens (P7.1) — 0 = disabled (SDK default); drop malformed.
    if (
      next.maxContextTokens !== undefined &&
      (!Number.isFinite(next.maxContextTokens) || next.maxContextTokens < 0)
    ) {
      delete next.maxContextTokens;
    }
    // failoverModels (P4.4) — drop non-array/non-string; trim and drop blanks.
    if (next.failoverModels !== undefined) {
      const fm = next.failoverModels;
      if (!Array.isArray(fm) || fm.some((id) => typeof id !== 'string')) {
        delete next.failoverModels;
      } else {
        next.failoverModels = fm.map((id) => id.trim()).filter(Boolean);
      }
    }
    // otlpEndpoint (P6.4) — trim; '' = off; drop malformed (non-string or a
    // non-empty value that isn't http(s)://…) so a bad value never opts in.
    if (next.otlpEndpoint !== undefined) {
      if (typeof next.otlpEndpoint !== 'string') {
        delete next.otlpEndpoint;
      } else {
        const ep = next.otlpEndpoint.trim();
        if (ep && !/^https?:\/\/\S+$/i.test(ep)) delete next.otlpEndpoint;
        else next.otlpEndpoint = ep;
      }
    }
    // SC1 — autoApproval/workspaceRoot/approvalTimeoutMs/maxKernelCacheSize:
    // drop malformed values (defense-in-depth; the DTO bounds them at HTTP).
    if (next.autoApproval !== undefined && typeof next.autoApproval !== 'boolean') {
      delete next.autoApproval;
    }
    if (
      next.workspaceRoot !== undefined &&
      (typeof next.workspaceRoot !== 'string' || !next.workspaceRoot.trim())
    ) {
      delete next.workspaceRoot;
    }
    if (next.approvalTimeoutMs !== undefined) {
      const t = next.approvalTimeoutMs;
      if (
        typeof t !== 'number' ||
        !Number.isFinite(t) ||
        t < APPROVAL_TIMEOUT_MS_MIN ||
        t > APPROVAL_TIMEOUT_MS_MAX
      ) {
        delete next.approvalTimeoutMs;
      }
    }
    if (next.maxKernelCacheSize !== undefined) {
      const n = next.maxKernelCacheSize;
      if (typeof n !== 'number' || !Number.isFinite(n) || n < MAX_KERNEL_CACHE_SIZE_MIN) {
        delete next.maxKernelCacheSize;
      }
    }
    // SC1 — 2 rules maps: drop bad shapes, keep sanitized copies of good ones.
    if (next.globalPermissionRules !== undefined) {
      const rules = AgentSettingsService.sanitizeGlobalRules(next.globalPermissionRules);
      if (rules === undefined) delete next.globalPermissionRules;
      else next.globalPermissionRules = rules;
    }
    if (next.permissionRiskDefaults !== undefined) {
      const risk = AgentSettingsService.sanitizeRiskDefaults(next.permissionRiskDefaults);
      if (risk === undefined) delete next.permissionRiskDefaults;
      else next.permissionRiskDefaults = risk;
    }
    this.settings = { ...this.settings, ...next };
    this.saveSettings();
    this.logger.log('Kernel settings updated');
    return this.getSettings();
  }

  resetSettings(): KernelSettings {
    this.settings = { ...this.defaults };
    this.saveSettings();
    this.logger.log('Kernel settings reset to defaults');
    return this.getSettings();
  }
}

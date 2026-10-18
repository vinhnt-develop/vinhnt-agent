import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AgentKernelConfig } from '@vinhnt-sdk/core';
import {
  InMemoryAgentRegistry,
  createAgent,
  AgentKernel,
  createContextRegistry,
  createSystemPromptSource,
  createDateSource,
  createWorkspaceSource,
  createInstructionsSource,
  createAgentSource,
  createToolContextSource,
  createCustomSource,
  InMemoryModelRegistry,
  // P7.1: unified ContextBudget — derive full budget from settings, feed both
  // kernelConfig.contextBudget and the compressor (single source).
  deriveContextBudget,
  budgetToCompressorFields,
  // P4.4: skills + sub-agent capability tools
  InMemorySkillDefRegistry,
  SkillParser,
  SkillFileLoader,
  createSkillTool,
  createSkillSearchTool,
  createSkillGuidanceSource,
  createSpawnAgentTool,
  createDelegateTool,
  createCreateAgentTool,
  createListAgentsTool,
  createHandoffTool,
} from '@vinhnt-sdk/core';
import { ToolProviderRegistry } from '@vinhnt-sdk/tools';
import type { AgentId, ModelProvider } from '@vinhnt-sdk/schema';
import type { PermissionMode } from '@/shared/permission-mode';
import type {
  RequestId,
  TraceId,
  ToolDefinitionLike,
} from '@vinhnt-sdk/schema';
import { InMemoryEventBus } from '@vinhnt-sdk/event';
import { createMemorySearchTool, ContextCompressor } from '@vinhnt-sdk/knowledge';
import { InMemorySessionState, loadSessionHistory, createDefaultSessionTitleGenerator } from '@vinhnt-sdk/session';
import { SqliteSessionStore } from '@/infrastructure/storage/sqlite-session-store';
import { buildKernelGuardrails } from './agent-guardrails';
import { createMemorySource } from './memory-context-source';
import { SqliteMemoryStore } from '@/infrastructure/storage/sqlite-memory-store';
import { SqliteRunEventStore } from '@/infrastructure/storage/sqlite-run-event-store';
import {
  ProviderFactory,
} from '@/infrastructure/model/provider-factory';
import { AgentToolkit } from './agent-toolkit';
import { AgentRunTrackingService } from './agent-run-tracking.service';
import { AgentKnowledgeService } from '@/modules/knowledge/services/agent-knowledge.service';
import { extractActualErrorMessage } from '@/shared/error-utils';
import { resolveSystemToolIds, withSystemTools } from '@/shared/tool-selection';
import { KernelSettings, AgentSettingsService } from './agent-settings.service';

/**
 * Minimal PluginManager that fires hooks from the toolkit's plugin registry.
 * Replaces the previous no-op stub so kernel/step-executor hooks actually run.
 * Structural types only — dual @vinhnt-sdk/core versions in the tree make
 * nominal Plugin typing unreliable here.
 */
class ToolkitPluginManager {
  constructor(
    private readonly registry: {
      list(): Array<{ manifest?: { id?: string }; hooks?: Record<string, unknown> }>;
      get(id: string): { manifest?: { id?: string }; hooks?: Record<string, unknown> } | undefined;
    },
  ) {}

  async register(): Promise<void> { /* plugins live in toolkit registry */ }
  async activate(): Promise<void> { /* activation handled by toolkit */ }
  async deactivate(): Promise<void> { /* deactivation handled by toolkit */ }
  list(): readonly unknown[] { return this.registry.list(); }
  get(id: string): unknown { return this.registry.get(id); }
  getActivePlugins(): readonly unknown[] { return this.registry.list(); }

  async fireHook(name: string, data: unknown): Promise<unknown> {
    let current = data;
    let mutation: { modified: unknown } | null = null;
    const mutationHooks = new Set([
      'onToolInvoked', 'onToolCompleted', 'onPermissionAsk',
      'onChatParams', 'onShellEnv', 'onBeforeModelCall',
      'onAfterModelCall', 'onBeforeToolExecution', 'onAfterToolExecution',
    ]);
    for (const plugin of this.registry.list()) {
      const hooks = plugin.hooks as Record<string, ((d: unknown) => Promise<unknown>) | undefined> | undefined;
      const fn = hooks?.[name];
      if (!fn) continue;
      try {
        const result = await fn(current);
        if (
          result !== null &&
          result !== undefined &&
          typeof result === 'object' &&
          'modified' in (result as Record<string, unknown>)
        ) {
          mutation = result as { modified: unknown };
          if (mutationHooks.has(name)) {
            current = { ...(current as object), ...((result as { modified: Record<string, unknown> }).modified) };
          }
        }
      } catch {
        /* hook errors must not break the run */
      }
    }
    return mutationHooks.has(name) ? mutation : undefined;
  }
}

export interface RunAgentInput {
  sessionId: string;
  prompt: string;
  model?: string;
  provider?: string;
  settings?: Partial<KernelSettings>;
  projectPath?: string;
  /** Per-run permission mode from composer: ask | edit | full. */
  permissionMode?: PermissionMode;
  selection?: {
    tools?: Array<{ id: string; name?: string; enabled?: boolean }>;
    knowledge?: Array<{ id: string; key?: string; enabled?: boolean }>;
  };
}

/** Input for resuming a crashed/interrupted run (P4.2). */
export interface ResumeRunInput {
  runId: string;
  /** Optional steering prompt; empty = pure continuation from checkpoint. */
  prompt?: string;
  model?: string;
  provider?: string;
  settings?: Partial<KernelSettings>;
  projectPath?: string;
  permissionMode?: PermissionMode;
  selection?: RunAgentInput['selection'];
}

export interface RunAgentResult {
  runId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  output?: string;
  error?: string;
  totalSteps: number;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  totalCost?: number;
  durationMs?: number;
  stopReason?: string;
  usage?: {
    totalSteps?: number;
    provider?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    totalTokens?: number;
    cost?: number;
    durationMs?: number;
    stopReason?: string;
  };
}

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private kernels = new Map<
    string,
    { kernel: any; sessionState?: InMemorySessionState; lastAccess: number }
  >();
  /** Active run handles keyed by runId for run-specific cancellation.
   *  `isCancelled` is a getter on the kernel handle — assignment throws. */
  private activeHandles = new Map<string, { cancel: () => void; readonly isCancelled: boolean }>();
  /** P4.5: per-session knowledge-id filter from the composer selection.
   *  Absent/empty = include all knowledge entries (previous behaviour). */
  private readonly knowledgeFilterBySession = new Map<string, string[]>();
  private readonly eventBus = new InMemoryEventBus();
  private readonly agentRegistry = new InMemoryAgentRegistry();
  private readonly pluginManager: ToolkitPluginManager;

  constructor(
    private readonly sessionStore: SqliteSessionStore,
    private readonly memoryStore: SqliteMemoryStore,
    private readonly runEventStore: SqliteRunEventStore,
    private readonly providerFactory: ProviderFactory,
    private readonly configService: ConfigService,
    private readonly agentToolkit: AgentToolkit,
    private readonly trackingService: AgentRunTrackingService,
    private readonly knowledgeService: AgentKnowledgeService,
    private readonly settingsService: AgentSettingsService,
  ) {
    this.pluginManager = new ToolkitPluginManager({
      list: () =>
        this.agentToolkit.getPluginRegistry().list() as Array<{
          manifest?: { id?: string };
          hooks?: Record<string, unknown>;
        }>,
      get: (id) =>
        this.agentToolkit.getPluginRegistry().get(id) as
          | { manifest?: { id?: string }; hooks?: Record<string, unknown> }
          | undefined,
    });
    this.agentToolkit.setPluginManager(this.pluginManager as never);
  }

  /**
   * Boot recovery (P4.2): after a crash the DB still has agent_runs rows with
   * status='running' but activeHandles is empty. Log them as resumable so the
   * client can call POST /agent/resume; do NOT auto-restart (the kernel is
   * per-provider/model and we don't know the original settings without the
   * client payload).
   */
  async onModuleInit(): Promise<void> {
    try {
      const orphaned = this.trackingService.findRunningRuns();
      if (orphaned.length > 0) {
        this.logger.warn(
          `Boot: ${orphaned.length} run(s) still marked 'running' in DB (likely interrupted by restart) — resumable via POST /agent/resume: ${orphaned.map((r) => r.id).join(', ')}`,
        );
      }
    } catch (error) {
      this.logger.warn(`Boot recovery scan failed (non-fatal): ${extractActualErrorMessage(error)}`);
    }
  }

  getEventBus() { return this.eventBus; }
  getAgentToolkit() { return this.agentToolkit; }
  getApprovalStore() { return this.agentToolkit.getApprovalStore(); }

  private getKernelCacheKey(providerName?: string, modelId?: string): string {
    return `${providerName || 'default'}|${modelId || 'default'}`;
  }

  private evictOldestKernel(): void {
    // SC3: capacity is a live settings read — UI/JSON edits apply to the next
    // evict without a restart (was ctor-cached from env).
    const maxKernelCacheSize = this.settingsService.getSettings().maxKernelCacheSize;
    // P13: evict when the cache is at/over capacity BEFORE inserting the new
    // kernel (call site is pre-insert) — the old `<=` let the map grow to
    // max+1 and only trimmed on the next request.
    if (this.kernels.size < maxKernelCacheSize) return;
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.kernels) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }
    if (oldestKey) this.kernels.delete(oldestKey);
  }

  private getSettingsHash(settings?: Partial<KernelSettings>): string {
    if (!settings) return '';
    // Every field that affects ModelCaller / system prompt / kernel behavior.
    // Missing a field here reuses a stale kernel and lies about the request.
    const relevant = {
      temperature: settings.temperature,
      topP: settings.topP,
      maxTokens: settings.maxTokens,
      frequencyPenalty: settings.frequencyPenalty,
      presencePenalty: settings.presencePenalty,
      maxSteps: settings.maxSteps,
      thinkingBudget: settings.thinkingBudget,
      stepTimeout: settings.stepTimeout,
      contextLimit: settings.contextLimit,
      toolChoice: settings.toolChoice,
      parallelToolCalls: settings.parallelToolCalls,
      maxToolCallsPerStep: settings.maxToolCallsPerStep,
      maxConcurrentToolCalls: settings.maxConcurrentToolCalls,
      selfCorrectOnFailure: settings.selfCorrectOnFailure,
      maxSelfCorrectAttempts: settings.maxSelfCorrectAttempts,
      compactionThreshold: settings.compactionThreshold,
      doomLoopThreshold: settings.doomLoopThreshold,
      maxSubAgentDepth: settings.maxSubAgentDepth,
      maxRetries: settings.maxRetries,
      backoffMs: settings.backoffMs,
      maxBackoffMs: settings.maxBackoffMs,
      sandboxMode: settings.sandboxMode,
      failoverModels: settings.failoverModels,
      systemPrompt: settings.systemPrompt,
      // SC3: baked into kernel config at creation — a settings edit must not
      // reuse a stale kernel (approvalTimeout/rules took effect only after
      // restart before this).
      approvalTimeoutMs: settings.approvalTimeoutMs,
      globalPermissionRules: settings.globalPermissionRules,
      permissionRiskDefaults: settings.permissionRiskDefaults,
    };
    return JSON.stringify(relevant);
  }

  /** 'ask' | 'edit' | 'full' — the approval mode resolved for a kernel instance. */
  private resolvePermissionMode(
    settings?: Partial<KernelSettings>,
    override?: PermissionMode,
  ): PermissionMode {
    // L2 (SC1 decision): AGENT_AUTO_APPROVAL=false is an ops kill switch —
    // checked FIRST, before any settings/UI value, so the API cannot bypass it.
    const envAutoApproval = this.configService.get<boolean>('agent.autoApproval', true);
    if (envAutoApproval === false) return 'ask';
    // L1: settings.autoApproval (JSON/Settings UI toggle) — false → always ask.
    const autoApproval =
      settings?.autoApproval ?? this.settingsService.getSettings().autoApproval;
    if (autoApproval === false) return 'ask';
    // Per-run composer choice > saved kernel settings > ask (opt-in via UI).
    return override ?? settings?.permissionMode ?? 'ask';
  }

  /**
   * Reset the kernel's SessionRuntimeState from the persisted transcript so a
   * new run receives prior-turn history instead of a fresh single-turn array.
   * Step/tool counters are cleared: they describe ONE run, and a hydrated
   * state must start the run at step 0 (otherwise maxSteps is pre-consumed).
   */
  private async hydrateSessionState(
    sessionState: InMemorySessionState,
    sessionId: string,
    historyLimit?: number,
  ): Promise<void> {
    try {
      let history = await loadSessionHistory(this.sessionStore, sessionId);
      // P4.1 historyLimit — keep only the most recent N messages for this turn
      // (nothing is deleted from the store). session@0.4.6 accepts
      // loadSessionHistory(store, id, { limit }); until the app upgrades past
      // the published 0.4.5, trim here — the transcript is already
      // pair-repaired, so the only breakage a tail cut can cause is orphaned
      // tool rows at the window head (their declaration fell outside), which
      // we drop.
      if (historyLimit !== undefined && historyLimit > 0 && history.length > historyLimit) {
        history = history.slice(-historyLimit);
        while (history.length > 0 && history[0]!.role === 'tool') {
          history = history.slice(1);
        }
      }
      sessionState.resetMessages(history);
      sessionState.step = 0;
      sessionState.toolCallCount = 0;
      sessionState.isRunning = false;
    } catch (error) {
      // Degrade to whatever state is already in memory — never block the run.
      this.logger.error(
        `Failed to hydrate history for session ${sessionId}: ${extractActualErrorMessage(error)}`,
      );
    }
  }

  private async getKernel(
    modelId?: string,
    providerName?: string,
    settings?: Partial<KernelSettings>,
    permissionModeOverride?: PermissionMode,
    sessionId?: string,
    projectPath?: string,
  ): Promise<any> {
    const permissionMode = this.resolvePermissionMode(settings, permissionModeOverride);
    const cacheKey = this.getKernelCacheKey(providerName, modelId);
    const settingsHash = this.getSettingsHash(settings);
    const permissionKey = `|pm:${permissionMode}`;
    // One kernel (and one SessionRuntimeState) per session: sessionState is
    // mutable conversation state, so sharing it across sessions would leak
    // history between them. The settings-eviction prefix below still matches.
    const sessionSegment = sessionId ? `|sid:${sessionId}` : '';
    // P0-6: instructions/workspace context sources and kernelConfig.workspaceRoot
    // are BOUND at construction — a kernel built for one project root must not
    // be reused for another (system prompt cwd would disagree with tool cwd).
    // SC3: workspaceRoot resolves settings-first (per-run > saved JSON > literal).
    const root =
      projectPath ??
      settings?.workspaceRoot ??
      this.settingsService.getSettings().workspaceRoot;
    const rootSegment = `|root:${root}`;
    const fullCacheKey = settingsHash ? `${cacheKey}${sessionSegment}${rootSegment}|${settingsHash}${permissionKey}` : `${cacheKey}${sessionSegment}${rootSegment}${permissionKey}`;

    const cached = this.kernels.get(fullCacheKey);
    if (cached) {
      cached.lastAccess = Date.now();
      if (cached.sessionState && sessionId) {
        await this.hydrateSessionState(cached.sessionState, sessionId, settings?.historyLimit);
      }
      return cached.kernel;
    }

    // Evict non-default cached kernels for same provider/model when settings differ
    if (settingsHash) {
      for (const [key] of this.kernels) {
        if (key.startsWith(cacheKey + '|')) {
          this.kernels.delete(key);
        }
      }
    }

    this.evictOldestKernel();

    try {
      // Refresh custom tools from disk so CRUD changes are visible without restart
      await this.agentToolkit.loadCustomToolsFromStore().catch(() => undefined);
      const tools = this.agentToolkit.getToolsAsDefinitions() as ToolDefinitionLike[];

      // Register memory search tool — included in pool; memory_search is a
      // system tool and is force-included in every run selection whitelist
      // (withSystemTools), so it can never be filtered out.
      const memorySearchTool = createMemorySearchTool(this.sessionStore as any);
      const allTools = [...tools, memorySearchTool as any];

      // P4.4: discover skills from conventional dirs (~/.vnt/skills, workspace
      // .vnt/.claude/.agents skills/) and register skill + skill_search tools.
      // Workspace overrides global by name (SkillFileLoader.discover dedup).
      const skillRegistry = new InMemorySkillDefRegistry(new SkillParser());
      let discoveredSkillCount = 0;
      try {
        const skills = await new SkillFileLoader().discover(root);
        await skillRegistry.load(skills);
        discoveredSkillCount = skills.length;
        if (skills.length > 0) {
          this.logger.log(`P4.4: discovered ${skills.length} skill(s): ${skills.map((s) => s.manifest.name).join(', ')}`);
        }
      } catch (err) {
        this.logger.warn(`P4.4: skill discovery failed (non-fatal): ${extractActualErrorMessage(err)}`);
      }
      allTools.push(
        createSkillTool(skillRegistry) as any,
        createSkillSearchTool(skillRegistry) as any,
      );

      // Register code-reviewer sub-agent + handoff tool (P4.4: the roster is
      // only reachable when a handoff/delegate tool exists — previously the
      // registry was a dead end).
      const codeReviewer = createAgent({
        id: 'code-reviewer' as AgentId,
        profile: {
          name: 'Code Reviewer',
          description: 'Reviews code for security issues, bugs, and best practices',
        },
        systemPrompt: 'You are a code review specialist. Focus on security, correctness, and best practices. Provide actionable feedback.',
        capabilities: { tools: ['read_file', 'grep_files', 'glob_files'] },
        permissions: { mode: 'subagent', maxSteps: 10 },
      });
      await this.agentRegistry.register(codeReviewer);
      allTools.push(
        createHandoffTool({
          agentId: 'code-reviewer' as AgentId,
          toolDescription:
            'Hand off to the code-reviewer sub-agent for a focused security/correctness review of code, diffs, or design decisions. Returns actionable findings.',
        }) as any,
      );

      const provider = await this.providerFactory.getModelProvider(providerName);

      // P4.4 contextLimit — settings override (0 = provider/SDK default).
      // Wrap (not mutate) the cached provider so the shared cache stays clean.
      const contextLimit = settings?.contextLimit ?? 0;
      const effectiveProvider: ModelProvider =
        contextLimit > 0
          ? (Object.assign(Object.create(provider), { contextLimit }) as ModelProvider)
          : provider;

      // P4.4 failoverModels — build a model registry ONLY when configured, so
      // the default path (no registry) behaves exactly as before.
      const failoverModels = (settings?.failoverModels ?? []).filter(Boolean);
      let modelRegistry: InMemoryModelRegistry | undefined;
      let modelRouting: { failoverModels: string[] } | undefined;
      if (failoverModels.length > 0) {
        modelRegistry = new InMemoryModelRegistry();
        // Seed the PRIMARY model first — getByProvider falls back to the first
        // registered entry, so primary-first prevents a failover id from being
        // silently selected as the primary by a composer override miss.
        modelRegistry.register(effectiveProvider.model, effectiveProvider);
        const providerConfig = await this.providerFactory.getProviderConfigFromDB(providerName).catch(() => null);
        if (providerConfig) {
          for (const id of failoverModels) {
            if (id === effectiveProvider.model) continue;
            try {
              modelRegistry.register(id, this.providerFactory.buildProvider({ ...providerConfig, defaultModel: id }));
            } catch (err) {
              this.logger.warn(`Failed to build failover provider for model ${id}: ${extractActualErrorMessage(err)}`);
            }
          }
        } else {
          this.logger.warn('failoverModels configured but provider config unavailable — failover disabled');
          modelRegistry = undefined;
        }
        if (modelRegistry) {
          modelRouting = { failoverModels };
        }
      }

      // P0-6: bind context sources to the session's project root (falls back
      // to the global workspaceRoot) — NOT always the global config value.
      const workspaceRoot = root;

      // Per-session runtime state — fed into the kernel so the run loop joins
      // prior-turn history (P0-1). Hydrated from the DB transcript below.
      const sessionState = new InMemorySessionState();
      if (sessionId) {
        await this.hydrateSessionState(sessionState, sessionId, settings?.historyLimit);
      }

      // P7.1: unified ContextBudget — computed once, fed to kernelConfig
      // (normalized + frozen by kernel) and the compressor (tokenBudget =
      // maxContextTokens × compactionThreshold, aligning its internal trigger
      // with the run-loop's window×ratio).
      const contextBudget = deriveContextBudget({
        ...(settings?.maxContextTokens && settings.maxContextTokens > 0
          ? { maxContextTokens: settings.maxContextTokens }
          : {}),
        compactionThreshold:
          settings?.compactionThreshold ?? this.settingsService.getSettings().compactionThreshold,
      });

      const kernelConfig: AgentKernelConfig = {
        model: effectiveProvider,
        store: this.runEventStore,
        sessionStore: this.sessionStore,
        sessionState,
        eventBus: this.eventBus,
        tools: allTools.length > 0 ? (allTools as any) : undefined,

        // Model settings (nested pattern — aligned with SDK v0.7.0)
        modelSettings: {
          temperature: settings?.temperature ?? 0.7,
          topP: settings?.topP ?? 1.0,
          ...(settings?.toolChoice !== undefined ? { toolChoice: settings.toolChoice } : {}),
          parallelToolCalls: settings?.parallelToolCalls ?? true,
          ...(settings?.frequencyPenalty !== undefined ? { frequencyPenalty: settings.frequencyPenalty } : {}),
          ...(settings?.presencePenalty !== undefined ? { presencePenalty: settings.presencePenalty } : {}),
        },

        // Limits (env is seeded into AgentSettingsService defaults — P4.6;
        // the configService legs here were dead: settings always full).
        maxSteps: settings?.maxSteps ?? 30,
        maxTokens: settings?.maxTokens ?? 4096,
        stepTimeout: settings?.stepTimeout ?? 120_000,
        maxToolCallsPerStep: settings?.maxToolCallsPerStep ?? 10,
        maxConcurrentToolCalls: settings?.maxConcurrentToolCalls ?? 5,

        // Resilience
        circuitBreaker: this.agentToolkit.getCircuitBreaker() as any,
        doomLoopThreshold: settings?.doomLoopThreshold ?? 3,
        maxRetries: settings?.maxRetries ?? 3,
        retryBackoffMs: settings?.backoffMs ?? 1000,
        maxRetryBackoffMs: settings?.maxBackoffMs ?? 30000,

        // Self-correction
        selfCorrectOnFailure: settings?.selfCorrectOnFailure ?? true,
        maxSelfCorrectAttempts: settings?.maxSelfCorrectAttempts ?? 1,

        // Thinking
        thinkingBudget: settings?.thinkingBudget ?? 1024,

        // Context management (P6.6: ratio 0-1; live default instead of a
        // silent 0.75 literal)
        compactionThreshold:
          settings?.compactionThreshold ?? this.settingsService.getSettings().compactionThreshold,
        // P7.1: unified ContextBudget — single source for kernel normalization
        // + compressor (computed once above). maxContextTokens seeds the
        // budget window; 0/undefined → SDK default 128_000. Other budget
        // fields (sanitizeLimitChars, maxToolOutputChars, maxSubagentOutputChars)
        // keep SDK defaults until per-field settings are added.
        contextBudget: contextBudget,
        // P7.1: compressor tokenBudget = maxContextTokens × compactionThreshold
        // (aligns its internal trigger with the run-loop's window×ratio).
        compactor: new ContextCompressor(budgetToCompressorFields(contextBudget)),

        // Sub-agents
        maxSubAgentDepth: settings?.maxSubAgentDepth ?? 3,

        // Workspace
        workspaceRoot,

        // Guardrails — settings-driven (P3.2)
        ...(() => {
          const built = buildKernelGuardrails(settings ?? {});
          if (built.invalidPatterns.length > 0) {
            this.logger.warn(
              `Skipping invalid guardrail blocklist patterns: ${built.invalidPatterns.join(' | ')}`,
            );
          }
          return built.config;
        })(),

        // Permissions (SC3: live from settings — env is only their seed)
        permissions: {
          approvalStore: this.agentToolkit.getApprovalStore(),
          autoApprovalEnabled: permissionMode !== 'ask',
          approvalTimeoutMs:
            settings?.approvalTimeoutMs ?? this.settingsService.getSettings().approvalTimeoutMs,
          globalPermissionRules: {
            // The HITL `question` tool is never privileged — asking the user is
            // not a side-effecting action, so allow it in every mode. Explicit
            // user rules still win (spread last).
            question: 'allow',
            ...(settings?.globalPermissionRules ??
              this.settingsService.getSettings().globalPermissionRules),
          },
          permissionRiskDefaults:
            permissionMode === 'full'
              ? {
                  ...(settings?.permissionRiskDefaults ??
                    this.settingsService.getSettings().permissionRiskDefaults),
                  // "Full access" label means what it says — lift the destructive
                  // floor (still subject to the AGENT_AUTO_APPROVAL kill switch).
                  destructive: 'allow',
                }
              : (settings?.permissionRiskDefaults ??
                this.settingsService.getSettings().permissionRiskDefaults),
        },

        // Human-in-the-loop questions (Phase 1): the kernel wires
        // `ToolContext.askQuestion` to this store; the user's reply arrives
        // over REST/WS and resumes the blocked run.
        questions: {
          questionStore: this.agentToolkit.getQuestionStore(),
        },

        // Sub-agents
        agentRegistry: this.agentRegistry,

        // Sandbox
        sandbox: {
          mode: settings?.sandboxMode ?? 'host',
        },

        // P4.4 sessionTitleGenerator — generates a real title from the first
        // prompt (SDK guard replaces empty/"New Session" titles after a
        // successful run; the generator costs ~30 tokens once per session).
        sessionTitleGenerator: createDefaultSessionTitleGenerator(effectiveProvider),

        // P4.4 failoverModels — only wired when configured (see above).
        ...(modelRegistry ? { modelRegistry, modelRouting } : {}),

        // Plugins — real manager (fireHook wired to registered plugins)
        pluginManager: this.pluginManager as never,

        // System context — layered composition from SDK
        systemContext: (() => {
          const registry = createContextRegistry();

          // Priority 0: System prompt — user custom OR SDK default
          const customPrompt = settings?.systemPrompt;
          if (customPrompt) {
            // User-provided system prompt overrides SDK default
            registry.register(createCustomSource({
              key: 'core.system-prompt',
              value: customPrompt,
              priority: 0,
            }));
          } else {
            // SDK's model-specific default prompt
            registry.register(createSystemPromptSource(() => modelId));
          }

          // Priority 5: Tool index — names only (descriptions/schemas ride tools[] API)
          registry.register(createToolContextSource(() =>
            allTools.map((t: any) => ({
              name: t.name ?? t.id,
              id: t.id,
              risk: t.risk,
            })),
          ));

          // Priority 10: Project instructions (reads AGENTS.md)
          registry.register(createInstructionsSource(workspaceRoot));

          // Priority 20: Agent roster
          registry.register(createAgentSource(this.agentRegistry, () => null));

          // Priority 30: Current date/time
          registry.register(createDateSource());

          // Priority 40: Workspace info (cwd, OS, arch, etc.)
          registry.register(createWorkspaceSource(workspaceRoot));

          // Priority 45: Memory — session/working tiers + knowledge base (P3.4)
          if (sessionId) {
            registry.register(
              createMemorySource(() => this.knowledgeService.buildMemoryBlock(sessionId, this.knowledgeFilterBySession.get(sessionId))),
            );
          }

          // Priority 50: Skill index (P4.4) — <available_skills> in system prompt
          // so the LLM knows which skill names exist without calling skill_search.
          registry.register(createSkillGuidanceSource(() => [...skillRegistry.list()]));

          return registry;
        })(),
      };

      const kernel = new AgentKernel(kernelConfig);

      // P4.4: register sub-agent capability tools AFTER kernel creation —
      // spawn/delegate/create/list need the live kernel instance. These give
      // the LLM a path to the agentRegistry roster (previously a dead end:
      // code-reviewer was registered but unreachable). Opt-in per SDK design
      // (wireAgentAndSkillTools doc: never grant sub-agent powers implicitly).
      try {
        kernel.registerTool(createSpawnAgentTool(kernel) as any);
        kernel.registerTool(createDelegateTool(kernel) as any);
        kernel.registerTool(createCreateAgentTool(kernel) as any);
        kernel.registerTool(createListAgentsTool(kernel) as any);
      } catch (err) {
        this.logger.warn(`P4.4: failed to register sub-agent tools (non-fatal): ${extractActualErrorMessage(err)}`);
      }

      this.kernels.set(fullCacheKey, { kernel, sessionState, lastAccess: Date.now() });
      this.logger.log(`AgentKernel initialized: provider=${providerName || 'default'} model=${modelId || 'default'} tools=${allTools.length} skills=${discoveredSkillCount} workspace=${workspaceRoot}`);
      return kernel;
    } catch (error) {
      this.logger.error('Failed to initialize AgentKernel', error);
      throw error;
    }
  }

  private buildRequestContext(provider?: string, model?: string, workspaceRoot?: string, selection?: RunAgentInput['selection']) {
    // System tools are always active: force them into the selection whitelist
    // so the kernel filter can never drop them (see withSystemTools).
    const resolvedSelection = withSystemTools(
      selection,
      resolveSystemToolIds(
        this.agentToolkit.getToolsAsDefinitions() as Array<{
          id?: string;
          name?: string;
          metadata?: { source?: string };
        }>,
      ),
    );
    return {
      requestId: crypto.randomUUID() as RequestId,
      traceId: crypto.randomUUID() as TraceId,
      actorId: 'local-user',
      tenantId: 'local',
      overrides: {
        ...(provider ? { provider } : {}),
        ...(model ? { model } : {}),
        ...(workspaceRoot ? { workspaceRoot } : {}),
        ...(resolvedSelection ? { selection: resolvedSelection } : {}),
      },
    };
  }

  async runAgent(input: RunAgentInput): Promise<RunAgentResult> {
    const { sessionId, prompt, model, provider, settings, projectPath } = input;
    this.logger.log(`Running agent for session ${sessionId}, model=${model}, provider=${provider}`);

    if (!sessionId) {
      this.logger.error('runAgent called without sessionId');
      return { runId: '', status: 'failed', output: 'Session ID is required', totalSteps: 0 };
    }

    // One live run per session — rejects double-starts (e.g. duplicate send
    // via silent HTTP fallback while a WS run is already going).
    const activeRun = this.trackingService.findActiveRunForSession(sessionId);
    if (activeRun) {
      const msg = `A run is already in progress for this session (run ${activeRun.id})`;
      this.logger.warn(`runAgent rejected for session ${sessionId}: ${msg}`);
      return { runId: '', status: 'failed', output: msg, totalSteps: 0 };
    }

    const existingMessages = await this.sessionStore.listMessages(sessionId);
    if (existingMessages.length === 0) {
      this.logger.warn(`Session ${sessionId} has no messages - session may not exist in DB`);
    }

    const runStartedAt = Date.now();
    // Permission mode: per-run composer choice > saved kernel settings >
    // AGENT_AUTO_APPROVAL — resolved inside getKernel.
      const kernel = await this.getKernel(model, provider, settings, input.permissionMode, sessionId, projectPath);
    const ctx = this.buildRequestContext(provider, model, projectPath, input.selection);

    // Fallback: no projectPath → workspaceRoot with explicit warn (not silent monorepo root).
    if (!projectPath) {
      const ws = settings?.workspaceRoot ?? this.settingsService.getSettings().workspaceRoot;
      this.logger.warn(
        `No projectPath for session ${sessionId} — falling back to workspaceRoot=${ws}`,
      );
      if (ctx.overrides && !ctx.overrides.workspaceRoot) {
        (ctx.overrides as Record<string, unknown>).workspaceRoot = ws;
      }
    }

    // P4.5: apply the composer knowledge selection for this run (absent/empty
    // = all entries). Read by the memory source during systemContext reconcile.
    const knowledgeIds = input.selection?.knowledge?.map((k) => k.id).filter(Boolean);
    if (knowledgeIds && knowledgeIds.length > 0) {
      this.knowledgeFilterBySession.set(sessionId, knowledgeIds);
    } else {
      this.knowledgeFilterBySession.delete(sessionId);
    }

    // runId MUST equal handle.runId so agent_runs joins run_events in trajectory.
    const handle = kernel.createRunHandle(prompt, ctx, sessionId);
    const runId = handle.runId as string;

    this.trackingService.startRun({
      runId,
      sessionId,
      model,
      provider,
      triggerType: 'http',
    });

    // Register the handle so HTTP-path runs are cancellable too — previously
    // only the WS path registered handles, leaving POST /agent/run runs
    // unstoppable (LM Studio kept generating after cancel).
    this.activeHandles.set(runId, handle);
    handle.completed.then(
      () => {
        this.activeHandles.delete(runId);
        this.knowledgeFilterBySession.delete(sessionId);
      },
      () => {
        this.activeHandles.delete(runId);
        this.knowledgeFilterBySession.delete(sessionId);
      },
    ).catch(() => {
      this.activeHandles.delete(runId);
      this.knowledgeFilterBySession.delete(sessionId);
    });

    try {
      // Tool executions are tracked by AgentGateway's eventBus subscription
      // (handle.events() only yields agent.started/completed/error — tool.*
      // flows through the EventBus, so draining here would never see them).
      const result = await handle.completed;

      const durationMs = Date.now() - runStartedAt;

      // Cancelled runs must return early with a terminal 'cancelled' status —
      // falling through would record a bogus 'succeeded' over the cancel.
      if (result.status === 'cancelled' || (result as { cancelled?: boolean }).cancelled === true) {
        this.logger.log(`Agent run cancelled for session ${sessionId}`);
        this.trackingService.completeRunFromResult({
          runId,
          status: 'cancelled',
          result,
          durationMs,
          errorMessage: 'Run cancelled by user',
          stopReason: 'cancelled',
        });
        return {
          runId,
          status: 'cancelled',
          output: 'Run cancelled by user',
          totalSteps: 0,
        };
      }

      if (result.status === 'failed') {
        const errorMsg = extractActualErrorMessage(result.error || 'Agent run failed');
        
        this.logger.error(`Agent run failed for session ${sessionId}`, errorMsg);

        this.trackingService.completeRunFromResult({
          runId,
          status: 'failed',
          result,
          durationMs,
          errorMessage: errorMsg,
        });

      return {
        runId,
        status: 'failed',
        output: errorMsg,
        error: errorMsg,
        totalSteps: 0,
      };
    }

    const messages = await this.sessionStore.listMessages(sessionId);
    const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');

    // P6.1: ONE payload builder — kernel usage > EventBus aggregates >
    // last-assistant message (lowest priority). The returned payload feeds
    // CostMeter, the persisted run row AND the HTTP response, so WS/HTTP
    // runs report identical payload fields.
    const payload = this.trackingService.completeRunFromResult({
      runId,
      result,
      durationMs,
      fallback: {
        inputTokens: lastAssistantMsg?.tokens?.input,
        outputTokens: lastAssistantMsg?.tokens?.output,
        reasoningTokens: lastAssistantMsg?.tokens?.reasoning,
        cost: lastAssistantMsg?.cost,
        model: lastAssistantMsg?.model,
        provider: lastAssistantMsg?.provider,
      },
    });

    const inputTokens = payload.inputTokens ?? 0;
    const outputTokens = payload.outputTokens ?? 0;
    const reasoningTokens = payload.reasoningTokens ?? 0;

    this.logger.log(`Agent run completed for session ${sessionId}: tokens in=${inputTokens}, out=${outputTokens}, cost=${payload.totalCost || 0}`);

    // Process turn to extract facts into memory
    try {
      const turnMessages = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content || '' }));
      await this.knowledgeService.processTurn(sessionId, turnMessages);
    } catch (memError) {
      this.logger.warn(`Memory processing failed for session ${sessionId}`, memError);
    }

    const totalSteps = result.usage?.totalSteps ?? result.totalSteps ?? 0;
    const stopReason = payload.stopReason;
    const totalTokens = payload.totalTokens ?? inputTokens + outputTokens + reasoningTokens;

    return {
      runId,
      status: 'succeeded',
      output: result.output || lastAssistantMsg?.content,
      totalSteps,
      provider: payload.provider,
      model: payload.model,
      inputTokens,
      outputTokens,
      reasoningTokens,
      totalTokens,
      totalCost: payload.totalCost,
      durationMs: payload.durationMs ?? durationMs,
      stopReason,
      // Nested usage block matching webui RunAgentResponse.usage
      usage: {
        totalSteps,
        provider: payload.provider,
        model: payload.model,
        inputTokens,
        outputTokens,
        reasoningTokens,
        totalTokens,
        cost: payload.totalCost,
        durationMs: payload.durationMs ?? durationMs,
        stopReason,
      },
    };
  } catch (error) {
    const errorMsg = extractActualErrorMessage(error);
    this.logger.error(`Agent run failed for session ${sessionId}`, errorMsg);
    const durationMs = Date.now() - runStartedAt;

    this.trackingService.completeRunFromResult({
      runId,
      status: 'failed',
      durationMs,
      errorMessage: errorMsg,
    });

    return {
      runId,
      status: 'failed',
      output: errorMsg,
      error: errorMsg,
      totalSteps: 0,
    };
  } finally {
    this.agentToolkit.cleanupRun(runId);
  }
}

  async runAgentStreaming(input: RunAgentInput): Promise<{ handle: any; runId: string }> {
    const { sessionId, prompt, model, provider, settings, projectPath } = input;
    this.logger.log(`Running agent (streaming) for session ${sessionId}`);

    // One live run per session (same guard as HTTP path) — thrown error is
    // surfaced to the client as run:error by the gateway's catch block.
    const activeRun = this.trackingService.findActiveRunForSession(sessionId);
    if (activeRun) {
      throw new Error(
        `A run is already in progress for this session (run ${activeRun.id})`,
      );
    }

    try {
      const kernel = await this.getKernel(
        model,
        provider,
        settings,
        input.permissionMode,
        sessionId,
        projectPath,
      );
      const ctx = this.buildRequestContext(provider, model, projectPath, input.selection);
      if (!projectPath) {
        const ws = settings?.workspaceRoot ?? this.settingsService.getSettings().workspaceRoot;
        this.logger.warn(
          `No projectPath for streaming session ${sessionId} — falling back to workspaceRoot=${ws}`,
        );
        if (ctx.overrides && !ctx.overrides.workspaceRoot) {
          (ctx.overrides as Record<string, unknown>).workspaceRoot = ws;
        }
      }
      // P4.5: apply the composer knowledge selection for this run.
      const knowledgeIds = input.selection?.knowledge?.map((k) => k.id).filter(Boolean);
      if (knowledgeIds && knowledgeIds.length > 0) {
        this.knowledgeFilterBySession.set(sessionId, knowledgeIds);
      } else {
        this.knowledgeFilterBySession.delete(sessionId);
      }
      const handle = kernel.createRunHandle(prompt, ctx, sessionId);

      const runId = handle.runId as string;

      this.trackingService.startRun({
        runId,
        sessionId,
        model,
        provider,
        triggerType: 'websocket',
      });

      this.activeHandles.set(runId, handle);

      handle.completed.then(
        () => {
          this.activeHandles.delete(runId);
          this.knowledgeFilterBySession.delete(sessionId);
        },
        () => {
          this.activeHandles.delete(runId);
          this.knowledgeFilterBySession.delete(sessionId);
        },
      ).catch((err) => {
        this.logger.error(`Stream handle error for run ${runId}`, err);
        this.activeHandles.delete(runId);
        this.knowledgeFilterBySession.delete(sessionId);
      });

      return { handle, runId };
    } catch (error) {
      const errorMsg = extractActualErrorMessage(error);
      this.logger.error(`Failed to start streaming run for session ${sessionId}: ${errorMsg}`);
      throw error;
    }
  }

  async cancelRun(runId: string): Promise<{ cancelled: boolean; status: string }> {
    const handle = this.activeHandles.get(runId);
    if (handle && !handle.isCancelled) {
      // handle.cancel() flips the kernel's internal cancelled flag + aborts the
      // run (kernel.ts createRunHandle). Writing handle.isCancelled directly
      // throws (getter-only) and was silently killing the whole cancel flow.
      handle.cancel();
      // Persist terminal state NOW — if the in-flight LLM call never unwinds
      // (or the process dies mid-cancel), the run must not stay "running".
      // The completion path re-writes the same terminal status later.
      this.trackingService.completeRunFromResult({
        runId,
        status: 'cancelled',
        errorMessage: 'Run cancelled by user',
        stopReason: 'cancelled',
      });
      this.logger.log(`Cancelled run: ${runId}`);
      return { cancelled: true, status: 'cancelled' };
    }

    const status = this.trackingService.getRunStatus(runId);
    if (status === 'running' || !status) {
      // No live handle but the row still says running (lost handle registry /
      // zombie row) — persist a terminal status so the UI is never stuck.
      this.trackingService.completeRunFromResult({
        runId,
        status: 'cancelled',
        errorMessage: 'Run cancelled by user',
        stopReason: 'cancelled',
      });
      this.logger.warn(`No active handle for run ${runId} — persisted status set to cancelled`);
      return { cancelled: true, status: 'cancelled' };
    }
    this.logger.warn(`Run ${runId} already ${status} — cannot cancel`);
    return { cancelled: false, status };
  }

  /** Cancel by runId, falling back to the session's active run. */
  async cancelActiveRun(input: {
    runId?: string;
    sessionId?: string;
  }): Promise<{ cancelled: boolean; status: string; runId?: string }> {
    let runId = input.runId;
    if (!runId && input.sessionId) {
      const active = this.trackingService.findActiveRunForSession(input.sessionId);
      if (!active) return { cancelled: false, status: 'idle' };
      runId = active.id;
    }
    if (!runId) return { cancelled: false, status: 'idle' };
    const result = await this.cancelRun(runId);
    return { ...result, runId };
  }

  /** True when this process holds a live handle for the run (P4.2 attach gate). */
  isRunActive(runId: string): boolean {
    return this.activeHandles.has(runId);
  }

  /**
   * Resume a crashed/interrupted run from its durable checkpoint (P4.2).
   *
   * The SDK's `kernel.resumeRun` restores session state from run_events
   * snapshots + messages (no run.started, no re-injection of the original
   * prompt). An empty `prompt` = pure continuation; a non-empty prompt is a
   * steering message appended as the latest user turn.
   *
   * Guards:
   * - run row must exist and be status='running' (or missing → treat as
   *   interrupted); terminal statuses → 409-style error.
   * - reject if this process already holds a live handle (double-resume).
   * - reject if a *different* live run is active for the same session.
   *
   * Does NOT call trackingService.startRun (row already exists → PK conflict).
   */
  async resumeRun(input: ResumeRunInput): Promise<RunAgentResult> {
    const { runId, prompt = '', model, provider, settings, projectPath } = input;
    this.logger.log(`Resuming run ${runId} (prompt=${prompt ? 'steering' : 'pure-continuation'})`);

    const row = this.trackingService.getRunRow(runId);
    if (!row) {
      return { runId, status: 'failed', output: 'Run not found', totalSteps: 0 };
    }
    const status = row.status;
    if (status && status !== 'running') {
      return {
        runId,
        status: status as RunAgentResult['status'],
        output: `Run already ${status} — cannot resume`,
        totalSteps: 0,
      };
    }
    if (this.activeHandles.has(runId)) {
      return { runId, status: 'failed', output: 'Run is already active in this process', totalSteps: 0 };
    }
    const sessionId = row.sessionId ?? undefined;
    if (!sessionId) {
      return { runId, status: 'failed', output: 'Run has no sessionId — cannot resume', totalSteps: 0 };
    }
    const activeRun = this.trackingService.findActiveRunForSession(sessionId);
    if (activeRun && activeRun.id !== runId) {
      return {
        runId,
        status: 'failed',
        output: `A different run (${activeRun.id}) is already active for session ${sessionId}`,
        totalSteps: 0,
      };
    }

    const runStartedAt = Date.now();
    const resolvedModel = model ?? row.model ?? undefined;
    const resolvedProvider = provider ?? row.provider ?? undefined;
    // Do NOT hydrateSessionState — resumeRun restores its own per-run state.
    const kernel = await this.getKernel(
      resolvedModel,
      resolvedProvider,
      settings,
      input.permissionMode,
      sessionId,
      projectPath,
    );
    const ctx = this.buildRequestContext(resolvedProvider, resolvedModel, projectPath, input.selection);

    try {
      const handle = await kernel.resumeRun(runId as never, prompt, ctx, sessionId);

      // Adapt SDK RunHandle {completed: Promise<void>, abort()} to the
      // activeHandles shape {cancel, isCancelled} that cancelRun expects.
      let cancelledFlag = false;
      const adapted = {
        cancel: () => {
          cancelledFlag = true;
          handle.abort();
        },
        get isCancelled() {
          return cancelledFlag;
        },
      };
      this.activeHandles.set(runId, adapted);

      handle.completed.then(
        () => {
          this.activeHandles.delete(runId);
          this.knowledgeFilterBySession.delete(sessionId);
        },
        () => {
          this.activeHandles.delete(runId);
          this.knowledgeFilterBySession.delete(sessionId);
        },
      ).catch((err: unknown) => {
        this.logger.error(`Resume handle error for run ${runId}`, err as never);
        this.activeHandles.delete(runId);
        this.knowledgeFilterBySession.delete(sessionId);
      });

      // resumeRun returns Promise<void> — no AgentRunResult. Wait for
      // completion and derive terminal status; usage was already recorded
      // by the EventBus subscription (recordRunUsage).
      await handle.completed;
      this.activeHandles.delete(runId);
      this.knowledgeFilterBySession.delete(sessionId);

      const finalStatus = cancelledFlag ? 'cancelled' : 'succeeded';
      // Row already terminal from the EventBus run.completed path in most
      // cases; this is a safety net for edge paths (e.g. empty continuation
      // that exits immediately).
      if (this.trackingService.getRunStatus(runId) === 'running') {
        this.trackingService.completeRunFromResult({
          runId,
          status: finalStatus,
          durationMs: Date.now() - runStartedAt,
        });
      }
      return { runId, status: finalStatus, totalSteps: 0 };
    } catch (error) {
      const errorMsg = extractActualErrorMessage(error);
      this.logger.error(`Failed to resume run ${runId}: ${errorMsg}`);
      this.activeHandles.delete(runId);
      if (this.trackingService.getRunStatus(runId) === 'running') {
        this.trackingService.completeRunFromResult({
          runId,
          status: 'failed',
          errorMessage: errorMsg,
        });
      }
      return { runId, status: 'failed', output: errorMsg, totalSteps: 0 };
    } finally {
      this.agentToolkit.cleanupRun(runId);
    }
  }

  async getSessionMessages(sessionId: string) {
    return this.sessionStore.listMessages(sessionId);
  }

  async getRunStats() {
    return this.sessionStore.getSessionStats();
  }
}

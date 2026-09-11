# ISSUE: Review vinhnt-sdk — Đã sẵn sàng cho Agent Core?

## Kết luận ngắn
**vinhnt-sdk ĐÃ là library đúng chuẩn** — 18 packages, clean architecture, exports tốt. ToolDefinition contract đã có và phù hợp. Cần refactor nhỏ, KHÔNG cần build lại từ đầu.

---

## 1. vinhnt-sdk hiện tại có gì?

### 18 Packages đã có

| Package | Version | Purpose | Đánh giá |
|---------|---------|---------|----------|
| `@vinhnt-sdk/schema` | 0.2.1 | Core types, Zod schemas, branded IDs | ✅ Solid |
| `@vinhnt-sdk/config` | 0.1.5 | Credential refs, env resolution | ✅ Solid |
| `@vinhnt-sdk/security` | 0.1.3 | Secret redaction, injection protection | ✅ Solid |
| `@vinhnt-sdk/event` | 0.1.3 | Typed event bus | ✅ Solid |
| `@vinhnt-sdk/permission` | 0.1.3 | Rule-based permission matching | ✅ Solid |
| `@vinhnt-sdk/session` | 0.2.0 | Session runtime state | ✅ Solid |
| `@vinhnt-sdk/sandbox` | 0.1.4 | Process isolation | ✅ Solid |
| `@vinhnt-sdk/tools` | 0.2.0 | Tool definition, registry, built-in tools | ✅ Solid |
| `@vinhnt-sdk/llm` | 0.1.5 | LLM adapter abstraction | ✅ Solid |
| `@vinhnt-sdk/knowledge` | 0.1.3 | Memory, context compression | ✅ Solid |
| `@vinhnt-sdk/guard` | 0.1.4 | Circuit breaker, loop detection | ✅ Solid |
| `@vinhnt-sdk/trace` | 0.1.3 | OpenTelemetry spans | ✅ Solid |
| `@vinhnt-sdk/mcp` | 0.2.0 | MCP client/server | ✅ Solid |
| `@vinhnt-sdk/lsp` | 0.1.3 | Language Server Protocol | ✅ Solid |
| `@vinhnt-sdk/step-executor` | 0.1.6 | Tool lifecycle, permission gating | ✅ Solid |
| `@vinhnt-sdk/plugin` | 0.1.4 | Plugin SDK | ✅ Solid |
| `@vinhnt-sdk/provider-openai-compatible` | 0.1.3 | OpenAI-compatible fetch | ✅ Solid |
| `@vinhnt-sdk/core` | 0.2.0 | AgentKernel — main orchestrator | ⚠️ Bloat |

---

## 2. Tool System — So sánh với OpenCode/Claude Code

### vinhnt-sdk ToolContract

```typescript
// define-tool.ts
interface ToolConfig<TInput, TOutput> {
  name: string;
  description: string;
  risk: ToolRisk;
  input: z.ZodType<TInput>;
  output?: z.ZodType<TOutput>;
  execute(input: TInput, ctx: ToolContext): Promise<TOutput>;
}

// definitions.ts
interface ToolDefinition<TInput, TOutput> {
  readonly id: string;
  readonly description: string;
  readonly inputSchema?: NestedJsonSchema;
  readonly risk: ToolRisk;
  readonly inputZodSchema?: z.ZodType<TInput>;
  readonly execute(input: TInput, ctx: ToolContext): Promise<TOutput>;
}
```

### So sánh

| Aspect | vinhnt-sdk | OpenCode | Claude Code |
|--------|-----------|----------|-------------|
| **Contract name** | `ToolDefinition` | `Tool.Def` | `Tool<Input, Output>` |
| **Zod integration** | ✅ Native | ✅ Native | ✅ Native |
| **JSON Schema derivation** | ✅ Auto từ Zod | ✅ Auto | ✅ Auto |
| **ToolContext** | ✅ Có (session, run, signal, ask) | ✅ Có | ✅ Có |
| **Risk levels** | ✅ Có (read/write/destructive) | ❌ Không có | ✅ Có (isReadOnly, isConcurrencySafe) |
| **Deferred loading** | ✅ `LazyToolRegistry` | ❌ Không | ✅ ToolSearch |
| **Provider abstraction** | ✅ `ToolProviderRegistry` | ❌ Không | ❌ Không |

**Kết luận: ToolDefinition của vinhnt-sdk ĐÃ tương đương hoặc tốt hơn OpenCode/Claude Code.**

---

## 3. AgentKernel — So sánh

### vinhnt-sdk AgentKernel

```typescript
// 1170+ lines, 30+ private fields
class AgentKernel {
  async run(prompt, ctx, sessionId?): Promise<RunHandle>
  async resumeRun(runId): Promise<RunHandle>
  async streamRun(prompt, ctx): AsyncIterable<RunEvent>
  async runAgent(agentId, prompt, ctx): Promise<RunHandle>
  async spawnAgent(params): Promise<AgentRunHandle>
  // ... 20+ more methods
}
```

### So sánh

| Aspect | vinhnt-sdk | OpenCode | Claude Code |
|--------|-----------|----------|-------------|
| **Core loop** | ✅ `runLoop()` trong kernel | ✅ `SessionPrompt.loop()` | ✅ `query()` generator |
| **Step execution** | ✅ `StepExecutor` | ✅ Session processor | ✅ 7-phase pipeline |
| **Permission gating** | ✅ `PermissionGate` | ✅ Permission rules | ✅ `canUseTool()` |
| **Doom-loop detection** | ✅ `LoopDetector` | ❌ Không | ❌ Không |
| **Circuit breaker** | ✅ `CircuitBreaker` | ❌ Không | ❌ Không |
| **Sub-agent spawning** | ✅ `spawnAgent()` | ✅ Task tool | ✅ AgentTool |
| **Event sourcing** | ✅ `RunEventStore` | ✅ Event bus | ❌ Không |
| **Context compaction** | ✅ `ContextCompressor` | ❌ Không | ✅ Compaction |
| **Durable resume** | ✅ `resumeRun()` | ❌ Không | ❌ Không |

**Kết luận: AgentKernel của vinhnt-sdk CÓ NHIỀU FEATURES hơn OpenCode/Claude Code.**

---

## 4. Plugin System — So sánh

### vinhnt-sdk Plugin

```typescript
interface Plugin {
  readonly manifest: PluginManifest;
  readonly hooks?: PluginHooks;
  activate(ctx: PluginContext): Promise<void>;
  deactivate?(): Promise<void>;
}

interface PluginHooks {
  // Observation
  onRunStarted, onStepStarted, onToolCompleted, onRunCompleted
  // Mutation
  onToolInvoked, onPermissionAsk, onChatParams
  // Model interception
  onBeforeModelCall, onAfterModelCall
  // Tool lifecycle
  onBeforeToolExecution, onAfterToolExecution
}
```

### So sánh

| Aspect | vinhnt-sdk | OpenCode | Claude Code |
|--------|-----------|----------|-------------|
| **Plugin type** | Class-based (manifest + hooks) | Async function | Hook-based |
| **Tool injection** | ✅ `registerTool()` | ✅ `tool` hook | ❌ Không |
| **Agent registration** | ✅ `registerAgent()` | ❌ Không | ❌ Không |
| **Lifecycle hooks** | ✅ 12+ hooks | ✅ 10+ hooks | ✅ 2 hooks |
| **Context sources** | ✅ `registerContextSource()` | ❌ Không | ❌ Không |

**Kết luận: Plugin system của vinhnt-sdk TỐT HƠN OpenCode.**

---

## 5. Issues cần fix

### Critical Issues

| # | Issue | Severity | Recommendation |
|---|-------|----------|----------------|
| 1 | **AgentKernel bloat** (~1170 lines, 30+ fields) | High | Decompose thành `RunManager`, `ToolResolver`, `SessionManager` |
| 2 | **Circular dependency** plugin↔core | Medium | Move plugin types to `@vinhnt-sdk/plugin-types` hoặc keep trong schema |
| 3 | **Version drift** giữa packages | Medium | Run `pnpm outdated`, bump tất cả versions |
| 4 | **ToolRisk is string** | Low | Use `type ToolRisk = "read" | "write" | "destructive" | (string & {})` |

### Minor Issues

| # | Issue | Severity | Recommendation |
|---|-------|----------|----------------|
| 5 | No `peerDependencies` for zod | Low | Add zod as peerDep trong packages expose Zod types |
| 6 | Inconsistent description formatting | Low | Enforce via lint rule |
| 7 | No coverage thresholds | Low | Add vitest coverage config |

---

## 6. Plan — Tiếp tục hay refactor?

### Khuyến nghị: TIẾP TỤC với vinhnt-sdk, refactor dần

```
KHÔNG cần build lại từ đầu
├── ToolDefinition contract ĐÃ có và tốt
├── AgentKernel ĐÃ có và đầy đủ features
├── Plugin system ĐÃ có và tốt hơn OpenCode
├── Permission system ĐÃ có và đầy đủ
├── MCP integration ĐÃ có
└── 18 packages đã decomposed đúng

CẦN refactor dần
├── Decompose AgentKernel (Phase 1)
├── Fix version drift (Phase 1)
├── Fix circular dependency (Phase 2)
├── Add deferred tool loading (Phase 2)
└── Add ToolRisk type safety (Phase 3)
```

### Updated Plan

```
Phase 1: vinhnt-sdk Refactor (1-2 tuần)
├── Decompose AgentKernel thành các concern riêng
├── Fix version alignment across packages
├── Add Zod as peerDependency
└── Fix ToolRisk type

Phase 2: vinhnt-sdk Enhancement (2-3 tuần)
├── Add ToolSearch meta-tool (deferred loading)
├── Resolve plugin↔core circular dependency
├── Add integration tests
└── Publish docs

Phase 3: vinhnt-agent Integration (2-3 tuần)
├── Update agent-toolkit.ts để dùng ToolDefinition properly
├── Wrap MCP tools vào ToolDefinition
├── Implement two-tier loading
└── Update schemas (source, mcp_servers, etc.)

Phase 4: vinhnt-agent Features (3-4 tuần)
├── Plugin system integration
├── Knowledge system (AGENTS.md, MEMORY.md, Skills)
├── Tool categories (builtin/mcp/custom)
└── Plugin categories (builtin/community/custom)
```

---

## 7. Tại sao KHÔNG cần build lại?

1. **ToolDefinition contract đã chuẩn** — tương đương OpenCode/Claude Code
2. **AgentKernel đã đầy đủ** — run loop, step execution, permission, event sourcing
3. **Plugin system đã tốt** — hơn cả OpenCode
4. **18 packages đã decomposed** — mỗi package một responsibility
5. **Type safety tốt** — branded IDs, Zod validation throughout
6. **MCP integration sẵn** — không cần viết lại

**Refactor > Rewrite.** vinhnt-sdk đã có foundation tốt, chỉ cần polish và decompose AgentKernel.

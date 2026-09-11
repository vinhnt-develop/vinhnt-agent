# ISSUE: So sánh Architecture — Tool, Plugin, Knowledge System

## Mục tiêu
Phân tích cách các dự án lớn (OpenCode, Claude Code) xử lý Tool, Plugin, Knowledge — rút bài học cho vinhnt-agent.

---

## 1. OpenCode Architecture

### 1.1 Tool System

**Cấu trúc:**
```
packages/opencode/src/tool/
├── tool.ts              # Tool.Def internal contract
├── registry.ts          # ToolRegistry — manages all tools
├── bash.ts, read.ts...  # 22+ built-in tools
└── mcp/                 # MCP client integration
```

**Key Design Decisions:**

| Quyết định | Chi tiết |
|------------|----------|
| **Internal Contract** | `Tool.Def` là contract nội bộ — KHÔNG dùng schema từ AI SDK/MCP trực tiếp |
| **Lazy Initialization** | `init()` chỉ gọi khi tool được sử dụng lần đầu |
| **Model-Aware Filtering** | Tool filtering thay đổi theo model (GPT dùng `apply_patch`, khác dùng `edit`) |
| **MCP as First-Class** | MCP tools convert sang `Tool.Def` — LLM không phân biệt built-in hay MCP |
| **Plugin Tools** | Plugin tools cũng wrap trong `Tool.Def` —统一 interface |

**Tool Registry Flow:**
```
1. Built-in tools (hardcoded)
2. Custom tools (from .opencode/tool/*.ts)
3. Plugin tools (from plugins)
4. MCP tools (from MCP servers)
   ↓
ToolRegistry.tools(model, agent)
   ↓
Filter by: agent permissions, model capabilities, runtime flags
   ↓
Final tool catalog for LLM
```

### 1.2 Plugin System

**Cấu trúc:**
```
packages/plugin/
├── src/
│   ├── index.ts         # Plugin type definitions
│   └── tool.ts          # ToolDefinition for plugins
└── package.json         # @opencode-ai/plugin (types only)
```

**Plugin Interface:**
```typescript
type Plugin = (input: PluginInput) => Promise<Hooks>

interface Hooks {
  event?: (input) => Promise<void>
  config?: (input) => Promise<void>
  tool?: { [key: string]: ToolDefinition }
  auth?: AuthHook
  "chat.message"?: (input, output) => Promise<void>
  "chat.params"?: (input, output) => Promise<void>
  "tool.execute.before"?: (input, output) => Promise<void>
  "tool.execute.after"?: (input, output) => Promise<void>
  // ... more hooks
}
```

**Key Design:**
- Plugin là async function, KHÔNG phải class
- `PluginInput` có `client` để tương tác với OpenCode API
- Hooks dùng input/output pattern — plugin mutate output, không return
- Plugin tools được wrap thành `Tool.Def` nội bộ

### 1.3 Knowledge/Skill System

**Cấu trúc:**
```
~/.config/opencode/skills/
~/.claude/skills/
.opencode/skills/
.agents/skills/
```

**Skill Format:**
```markdown
---
name: git-release
description: Guide for creating git releases
---

# Instructions here...
```

**Key Design:**
- Skills là Markdown files với YAML frontmatter
- Loaded on-demand qua `skill` tool
- Multiple scopes: global → project → compatibility
- Permission-based: allow/deny/ask per skill
- Skills convert thành commands để invoke từ CLI

---

## 2. Claude Code Architecture

### 2.1 Tool System

**Cấu trúc:**
```
src/
├── Tool.ts              # Tool interface + buildTool()
├── tools.ts             # getAllBaseTools() registration
├── tools/
│   ├── BashTool/        # 40+ built-in tools
│   ├── FileReadTool/
│   ├── AgentTool/
│   └── ...
└── services/tools/      # Dispatch, permissions, execution
```

**Tool Interface:**
```typescript
interface Tool<Input, Output> {
  id: string
  description: string
  inputSchema: ZodSchema
  isReadOnly: boolean
  isConcurrencySafe: boolean
  call(input, context): Promise<Output>
  checkPermissions(input): PermissionResult
  prompt(): string  // LLM-facing description
}
```

**Key Design Decisions:**

| Quyết định | Chi tiết |
|------------|----------|
| **Fail-Closed Defaults** | Tool mới assumed unsafe — phải opt-in vào concurrency, read-only |
| **Two-Tier Loading** | Core tools (always loaded) + Deferred tools (loaded via ToolSearch) |
| **MCP as Same Interface** | MCP tools wrap thành Tool interface giống built-in |
| **7-Phase Pipeline** | Validate → Hook → Permission → Safety → Execute → Post-hook → Result |
| **Alphabetical Sorting** | Tools sort alphabetically trong registry để preserve prompt cache |

**Tool Loading Strategy:**
```
Core Tools (14): Bash, Read, Edit, Write, Glob, Grep, Agent, SendMessage...
   → Always in system prompt

Deferred Tools (25+): TodoWrite, WebFetch, TaskCreate, Skill...
   → Listed by name only, full schema loaded via ToolSearch

MCP Tools: mcp__server__tool
   → Dynamically registered at runtime
```

### 2.2 Knowledge/Memory System

**Cấu trúc:**
```
~/.claude/
├── CLAUDE.md                    # User-level instructions
├── projects/<hash>/memory/
│   ├── MEMORY.md                # Pointer index (200 lines max)
│   ├── debugging.md             # Topic files
│   ├── patterns.md
│   └── ...
└── settings.json

./CLAUDE.md                      # Project-level instructions
./CLAUDE.local.md                # Local overrides
./.claude/rules/                 # Path-scoped rules
```

**Key Design:**

| Layer | Loại | Ai viết | Load khi nào |
|-------|------|---------|--------------|
| **CLAUDE.md** | Instructions | Human | Mỗi session start |
| **Auto Memory** | Learnings | Agent | MEMORY.md index load start, topic files on-demand |
| **Session Transcripts** | Raw logs | System | Grep only (last resort) |

**Memory Types:**
```yaml
type: user        # User preferences
type: feedback    # Corrections from user
type: project     # Project conventions
type: reference   # Documentation
```

**Auto Memory Flow:**
```
Session end → Background extraction agent (forked)
   ↓
Read existing memory files
   ↓
Extract patterns from conversation
   ↓
Write topic files + update MEMORY.md index
   ↓
Next session → MEMORY.md loaded (200 lines)
   ↓
Sonnet selects up to 5 relevant memories
   ↓
Injected as attachments (not tool calls)
```

---

## 3. So sánh và Rút Bài Học

### 3.1 Tool System Comparison

| Aspect | OpenCode | Claude Code | vinhnt-agent hiện tại |
|--------|----------|-------------|----------------------|
| **Internal Contract** | `Tool.Def` (custom) | `Tool<Input, Output>` (custom) | Không có — dùng SDK directly |
| **Built-in Tools** | 22+ | 40+ | 10 (từ SDK) |
| **MCP Integration** | Wrap thành Tool.Def | Wrap thành Tool | Có nhưng chưa wrap |
| **Custom Tools** | Load từ project dir | Không support | Webhook/Mock |
| **Tool Loading** | Lazy init | Two-tier (core/deferred) | Load hết vào registry |
| **Permission** | Permission rules | 7-phase pipeline | InMemoryApprovalStore |
| **Model Filtering** | Có | Có | Không |

### 3.2 Plugin System Comparison

| Aspect | OpenCode | Claude Code | vinhnt-agent hiện tại |
|--------|----------|-------------|----------------------|
| **Plugin Type** | Async function | Hook-based | Không có |
| **Tool Injection** | Có (wrap trong Tool.Def) | Không | Không |
| **Lifecycle Hooks** | 10+ hooks | PreToolUse/PostToolUse | Không |
| **Plugin Discovery** | Config-based | Marketplace | Không |

### 3.3 Knowledge System Comparison

| Aspect | OpenCode | Claude Code | vinhnt-agent hiện tại |
|--------|----------|-------------|----------------------|
| **Instructions** | SKILL.md files | CLAUDE.md files | Không có |
| **Auto Learning** | Không | Auto Memory + Dreams | Không |
| **Memory Index** | Không | MEMORY.md (200 lines) | Không |
| **Retrieval** | On-demand via skill tool | LLM-routed (Sonnet) | Vector search (pgvector) |
| **Persistence** | File-based | File-based | SQLite |

---

## 4. Đề xuất cho vinhnt-agent

### 4.1 Tool System — Cần có

```
┌─────────────────────────────────────────────────────────────┐
│  TOOL ARCHITECTURE PROPOSAL                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. INTERNAL CONTRACT (như OpenCode/Claude Code)            │
│     - Định nghĩa Tool.Def nội bộ                           │
│     - KHÔNG dùng schema từ SDK trực tiếp                    │
│     - Wrap mọi tool (built-in, MCP, custom) vào contract    │
│                                                              │
│  2. TWO-TIER LOADING (như Claude Code)                      │
│     - Core tools: always loaded (file, git, shell)          │
│     - Deferred tools: loaded on-demand via ToolSearch       │
│     - MCP tools: dynamically registered                     │
│                                                              │
│  3. TOOL CATEGORIES (mới)                                   │
│     - source: 'builtin' | 'mcp' | 'custom'                 │
│     - version tracking cho built-in                         │
│     - MCP server metadata                                   │
│     - Custom tool manifest                                  │
│                                                              │
│  4. PERMISSION PIPELINE (như Claude Code)                   │
│     - Deny rules → Tool-specific → Safety → Allow           │
│     - Fail-closed defaults                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Plugin System — Cần có

```
┌─────────────────────────────────────────────────────────────┐
│  PLUGIN ARCHITECTURE PROPOSAL                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. PLUGIN INTERFACE (như OpenCode)                         │
│     - Plugin = async function                               │
│     - Input: context (client, config, logger)               │
│     - Output: Hooks object                                  │
│                                                              │
│  2. HOOK SYSTEM                                              │
│     - tool.execute.before/after                             │
│     - chat.params                                           │
│     - chat.message                                          │
│     - event                                                 │
│                                                              │
│  3. PLUGIN CATEGORIES (mới)                                 │
│     - source: 'builtin' | 'community' | 'custom'           │
│     - author, repository, dependencies                      │
│     - local_path cho custom plugins                         │
│                                                              │
│  4. PLUGIN DISCOVERY                                         │
│     - Config-based (như OpenCode)                           │
│     - Directory scanning (.vinhnt-agent/plugins/)           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Knowledge System — Cần có

```
┌─────────────────────────────────────────────────────────────┐
│  KNOWLEDGE ARCHITECTURE PROPOSAL                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. INSTRUCTION LAYER (như CLAUDE.md)                       │
│     - AGENTS.md files (project-level instructions)          │
│     - Loaded mỗi session start                              │
│     - Human-written, stable                                 │
│                                                              │
│  2. AUTO MEMORY (như Claude Code)                           │
│     - Agent tự viết learnings                               │
│     - MEMORY.md as pointer index                            │
│     - Topic files for detailed knowledge                    │
│     - Background extraction                                 │
│                                                              │
│  3. SKILL SYSTEM (như OpenCode)                             │
│     - SKILL.md files with frontmatter                       │
│     - Loaded on-demand via skill tool                       │
│     - Permission-based access                               │
│                                                              │
│  4. KNOWLEDGE CATEGORIES (mới)                              │
│     - source: 'system' | 'user' | 'imported'               │
│     - sourceRef cho file/URL imports                        │
│     - contentHash cho dedup                                 │
│     - isEditable cho system knowledge                       │
│                                                              │
│  5. RETRIEVAL                                                │
│     - File-based (như OpenCode/Claude Code)                 │
│     - KHÔNG dùng vector search cho hot path                 │
│     - Vector search chỉ cho large knowledge bases           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Schema Changes — Updated

### 5.1 Tool Config
```sql
Table tool_configs {
  id text [pk]
  tool_id text [not null]
  source text [not null, default: 'custom']  -- 'builtin' | 'mcp' | 'custom'
  mcp_server_name text
  mcp_tool_name text
  version text
  config json [default: '{}']
  is_enabled boolean [default: true]
  manifest json
  created_at text
  updated_at text
  deleted_at text
}
```

### 5.2 MCP Servers (new)
```sql
Table mcp_servers {
  id text [pk]
  name text [not null, unique]
  transport text [not null]     -- 'stdio' | 'sse' | 'streamable-http'
  command text
  args json
  url text
  env json [default: '{}']
  is_enabled boolean [default: true]
  tool_count integer [default: 0]
  last_connected_at text
  created_at text
  updated_at text
  deleted_at text
}
```

### 5.3 Plugin Config
```sql
Table plugin_configs {
  id text [pk]
  plugin_id text [not null]
  source text [not null, default: 'custom']  -- 'builtin' | 'community' | 'custom'
  version text
  latest_version text
  author text
  repository text
  description text
  dependencies json [default: '[]']
  local_path text
  config json [default: '{}']
  is_enabled boolean [default: true]
  installed_at text
  created_at text
  updated_at text
  deleted_at text
}
```

### 5.4 Knowledge
```sql
Table knowledge {
  id text [pk]
  key text [not null]
  value text [not null]
  source text [not null, default: 'user']  -- 'system' | 'user' | 'imported'
  source_ref text
  tier text [default: 'stable']
  tags json [default: '[]']
  embedding text
  content_hash text
  file_path text
  is_editable boolean [default: true]
  created_at text
  updated_at text
  deleted_at text
}
```

---

## 6. Implementation Priority

### Phase 1: Foundation (Ưu tiên cao nhất)
- [ ] Define `ToolDef` internal contract
- [ ] Wrap existing 10 built-in tools vào contract
- [ ] Add `source` field vào tool_configs
- [ ] Create `mcp_servers` table

### Phase 2: Tool System Enhancement
- [ ] Implement two-tier loading (core/deferred)
- [ ] Tool search meta-tool
- [ ] MCP tool wrapping
- [ ] Permission pipeline

### Phase 3: Plugin System
- [ ] Plugin interface definition
- [ ] Hook system
- [ ] Plugin discovery
- [ ] Plugin config schema updates

### Phase 4: Knowledge System
- [ ] AGENTS.md instruction layer
- [ ] Memory system (MEMORY.md + topic files)
- [ ] Skill system (SKILL.md)
- [ ] Knowledge schema updates

### Phase 5: Integration
- [ ] AgentToolkit load tools từ all sources
- [ ] Plugin hooks trong agent loop
- [ ] Knowledge retrieval on-demand

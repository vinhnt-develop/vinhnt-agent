# ISSUE: Review Architecture — Tool, Plugin, Knowledge System

## Mục tiêu
Review và categorize rõ ràng 3 hệ thống: Tools, Plugins, Knowledge — phân biệt giữa built-in, MCP, custom/user.

---

## 1. Hiện trạng

### 1.1 Tool System

**Hiện tại có 3 loại tool nhưng KHÔNG phân biệt trong schema:**

| Loát | Nguồn | Cách đăng ký | Schema hiện tại |
|------|-------|--------------|-----------------|
| Built-in | `@vinhnt-sdk/tools` | `initializeTools()` — hardcoded 10 tools | ❌ Không lưu DB |
| MCP | MCP Server | `connectMcpServer()` — dynamic | ❌ Không lưu DB |
| Custom | User tạo | `registerCustomTools()` — webhook/mock | `tool_configs` nhưng KHÔNG có `source` |

**Vấn đề:**
- `tool_configs` chỉ có `toolId`, `config`, `isEnabled` — KHÔNG biết tool nào là built-in, MCP, hay custom
- Không track được MCP server nào đang connected
- Không version được built-in tools
- Không lưu được manifest metadata của tool

### 1.2 Plugin System

**Hiện tại:**
- `plugin_configs` chỉ có `pluginId`, `version`, `config`, `isEnabled`
- KHÔNG phân biệt: built-in plugin, community plugin (download), custom plugin (user develop)
- Không lưu: manifest, author, repository URL, dependencies

### 1.3 Knowledge System

**Hiện tại:**
- `knowledge` chỉ có `key`, `value`, `tier`, `tags`, `embedding`
- KHÔNG phân biệt: system knowledge (bundled), user knowledge (tạo tay), imported (file/URL)
- Không track source_type, content_hash, file_path

---

## 2. Đề xuất phân loại

### 2.1 Tool Categories

```
┌─────────────────────────────────────────────────────┐
│  TOOL TYPES                                         │
├─────────────────────────────────────────────────────┤
│  1. BUILT-IN  — bundled với app, dev bởi vinhnt    │
│     - File ops (read, write, edit, list, glob, grep)│
│     - Git ops (status, diff, log)                   │
│     - Shell execution                               │
│     - LSP tools                                     │
│     → source: 'builtin', versioned theo app version │
├─────────────────────────────────────────────────────┤
│  2. MCP      — từ Model Context Protocol servers    │
│     - External servers (filesystem, github, etc.)    │
│     - User configures server URLs                   │
│     → source: 'mcp', có serverName, serverConfig    │
├─────────────────────────────────────────────────────┤
│  3. CUSTOM   — user tự develop hoặc configure       │
│     - Webhook tools (HTTP call)                     │
│     - Mock tools (test/prototype)                   │
│     - User-developed tools                          │
│     → source: 'custom', có manifest full            │
└─────────────────────────────────────────────────────┘
```

### 2.2 Plugin Categories

```
┌─────────────────────────────────────────────────────┐
│  PLUGIN TYPES                                       │
├─────────────────────────────────────────────────────┤
│  1. BUILT-IN  — bundled với app                     │
│     - Permission system, tracing, etc.              │
│     → source: 'builtin'                             │
├─────────────────────────────────────────────────────┤
│  2. COMMUNITY — download từ marketplace/registry    │
│     - Plugin từ vinhnt-registry hoặc community      │
│     - Có version, author, dependencies              │
│     → source: 'community', có repository, author    │
├─────────────────────────────────────────────────────┤
│  3. CUSTOM   — user tự phát triển                   │
│     - Local plugin files                            │
│     - User viết theo plugin SDK                     │
│     → source: 'custom', có localPath                │
└─────────────────────────────────────────────────────┘
```

### 2.3 Knowledge Categories

```
┌─────────────────────────────────────────────────────┐
│  KNOWLEDGE TYPES                                    │
├─────────────────────────────────────────────────────┤
│  1. SYSTEM   — bundled với app                      │
│     - Default prompts, tool descriptions            │
│     → source: 'system', editable: false             │
├─────────────────────────────────────────────────────┤
│  2. USER     — user tự tạo nhập tay                 │
│     - Manual knowledge entries                      │
│     → source: 'user'                                │
├─────────────────────────────────────────────────────┤
│  3. IMPORTED — từ file, URL, API                    │
│     - File upload (txt, md, pdf, etc.)              │
│     - URL crawl                                     │
│     - API sync                                      │
│     → source: 'imported', có sourceRef (path/url)   │
└─────────────────────────────────────────────────────┘
```

---

## 3. Schema Changes

### 3.1 Tool Config — Thêm fields

```sql
Table tool_configs {
  id text [pk]
  tool_id text [not null]
  
  -- NEW: phân loại nguồn
  source text [not null, default: 'custom']  -- 'builtin' | 'mcp' | 'custom'
  
  -- NEW: MCP-specific fields
  mcp_server_name text     -- tên MCP server (nếu source='mcp')
  mcp_tool_name text       -- tên tool trên MCP server
  
  -- NEW: built-in version tracking
  version text             -- version của tool (nếu source='builtin')
  
  -- Existing
  config json [default: '{}']
  is_enabled boolean [default: true]
  
  -- NEW: metadata
  manifest json            -- full manifest: name, description, author, etc.
  
  created_at text [default: `datetime('now')`]
  updated_at text [default: `datetime('now')`]
  deleted_at text
}

-- Indexes
CREATE UNIQUE INDEX idx_tool_configs_tool_source ON tool_configs(tool_id, source);
CREATE INDEX idx_tool_configs_source ON tool_configs(source);
```

### 3.2 MCP Servers — Table mới

```sql
Table mcp_servers {
  id text [pk]
  name text [not null, unique]
  transport text [not null]     -- 'stdio' | 'sse' | 'streamable-http'
  command text                  -- cho stdio: command path
  args json                     -- cho stdio: command arguments
  url text                      -- cho sse/http: server URL
  env json [default: '{}']      -- environment variables
  is_enabled boolean [default: true]
  tool_count integer [default: 0]
  last_connected_at text
  created_at text [default: `datetime('now')`]
  updated_at text [default: `datetime('now')`]
  deleted_at text
}
```

### 3.3 Plugin Config — Thêm fields

```sql
Table plugin_configs {
  id text [pk]
  plugin_id text [not null]
  
  -- NEW: phân loại nguồn
  source text [not null, default: 'custom']  -- 'builtin' | 'community' | 'custom'
  
  -- NEW: version tracking
  version text
  latest_version text         -- version mới nhất available
  
  -- NEW: community-specific
  author text
  repository text             -- git URL hoặc marketplace URL
  description text
  dependencies json [default: '[]']
  
  -- NEW: custom-specific
  local_path text             -- đường dẫn local plugin file
  
  -- Existing
  config json [default: '{}']
  is_enabled boolean [default: true]
  installed_at text [default: `datetime('now')`]
  
  created_at text [default: `datetime('now')`]
  updated_at text [default: `datetime('now')`]
  deleted_at text
}

-- Indexes
CREATE UNIQUE INDEX idx_plugin_configs_plugin_source ON plugin_configs(plugin_id, source);
CREATE INDEX idx_plugin_configs_source ON plugin_configs(source);
```

### 3.4 Knowledge — Thêm fields

```sql
Table knowledge {
  id text [pk]
  key text [not null]
  value text [not null]
  
  -- NEW: phân loại nguồn
  source text [not null, default: 'user']     -- 'system' | 'user' | 'imported'
  source_ref text                             -- file path, URL, API endpoint
  
  -- Existing
  tier text [default: 'stable']
  tags json [default: '[]']
  embedding text
  
  -- NEW: content management
  content_hash text                            -- SHA-256 để dedup
  file_path text                               -- nếu imported từ file
  is_editable boolean [default: true]          -- system knowledge: false
  
  created_at text [default: `datetime('now')`]
  updated_at text [default: `datetime('now')`]
  deleted_at text
}

-- Indexes
CREATE INDEX idx_knowledge_source ON knowledge(source);
CREATE INDEX idx_knowledge_content_hash ON knowledge(content_hash);
CREATE UNIQUE INDEX idx_knowledge_key_source ON knowledge(key, source);
```

---

## 4. API Changes

### 4.1 Tool Config Endpoints

```
GET    /tools                          — List all tools (filter by source)
GET    /tools/:id                      — Get tool config
POST   /tools                          — Create custom tool
PUT    /tools/:id                      — Update tool config
DELETE /tools/:id                      — Delete custom tool
POST   /tools/:id/enable              — Enable tool
POST   /tools/:id/disable             — Disable tool

-- MCP-specific
GET    /tools/mcp/servers              — List MCP servers
POST   /tools/mcp/servers              — Add MCP server
DELETE /tools/mcp/servers/:id          — Remove MCP server
POST   /tools/mcp/servers/:id/connect  — Connect to MCP server
POST   /tools/mcp/servers/:id/disconnect — Disconnect

-- Built-in info
GET    /tools/builtin                  — List built-in tools (read-only)
```

### 4.2 Plugin Config Endpoints

```
GET    /plugins                        — List all plugins (filter by source)
GET    /plugins/:id                    — Get plugin config
POST   /plugins/install                — Install plugin (community/custom)
PUT    /plugins/:id                    — Update plugin config
DELETE /plugins/:id                    — Uninstall plugin
POST   /plugins/:id/activate          — Activate plugin
POST   /plugins/:id/deactivate        — Deactivate plugin
POST   /plugins/:id/update            — Check for updates
```

### 4.3 Knowledge Endpoints

```
GET    /knowledge                      — List all knowledge (filter by source)
GET    /knowledge/:id                  — Get knowledge entry
POST   /knowledge                      — Create knowledge entry
PUT    /knowledge/:id                  — Update knowledge entry
DELETE /knowledge/:id                  — Delete knowledge entry
POST   /knowledge/search               — Search knowledge

-- Import-specific
POST   /knowledge/import/file          — Import from file
POST   /knowledge/import/url           — Import from URL
GET    /knowledge/import/sources       — List import sources
```

---

## 5. Implementation Priority

### Phase 1: Schema + Types (Ưu tiên cao)
- [ ] Thêm `source` field vào tool_configs, plugin_configs, knowledge
- [ ] Tạo table `mcp_servers`
- [ ] Update Drizzle schemas
- [ ] Update DBML

### Phase 2: Tool System
- [ ] Update ToolConfigService để phân loại tool theo source
- [ ] Implement MCP server management
- [ ] Built-in tools query từ registry thay vì DB

### Phase 3: Plugin System
- [ ] Update PluginConfigService với source awareness
- [ ] Plugin manifest validation
- [ ] Version checking logic

### Phase 4: Knowledge System
- [ ] Update KnowledgeService với source awareness
- [ ] File import implementation
- [ ] URL import implementation
- [ ] Content dedup via content_hash

### Phase 5: Agent Integration
- [ ] AgentToolkit load tools từ cả 3 nguồn (built-in + MCP + custom)
- [ ] Plugin system activate/deactivate đúng cách
- [ ] Knowledge system merge từ nhiều nguồn

---

## 6. Open Questions

1. **Built-in tools có cần lưu DB không?**
   - Option A: KHÔNG lưu — query từ ToolRegistry trong runtime
   - Option B: Lưu để统一 API — tool_configs với source='builtin' rows
   - **Recommendation:** Option B — thống nhất API, dễ quản lý enable/disable

2. **MCP server config lưu ở agent hay cloud?**
   - Agent: vì MCP server là local resources
   - Cloud: để sync giữa devices
   - **Recommendation:** Agent-local, sync capability add sau

3. **Plugin dependencies resolve ở đâu?**
   - Local: download tất cả dependencies
   - Remote: lazy load từ registry
   - **Recommendation:** Local-first, có optional remote fallback

4. **Knowledge import validation?**
   - File types nào accept?
   - Max file size?
   - Auto-embedding generation?

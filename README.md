# vinhnt-agent

Local AI agent CLI powered by vinhnt-sdk. Runs agent loop locally with local file/shell/git tools.

## Features

- **Local-first**: Source code never leaves your machine
- **Full tool suite**: File read/write/edit, shell, git, grep, glob
- **SQLite storage**: Sessions, messages, memories stored locally
- **HTTP/WebSocket server**: Connect from vinhnt-webui or other clients
- **Sync layer**: Optional sync with vinhnt-api cloud backend
- **MCP support**: Connect to MCP servers for extended tools
- **Plugin system**: Extend with custom plugins

## Quick Start

```bash
# Install
npm install -g vinhnt-agent

# Initialize
vinhnt-agent init

# Chat
vinhnt-agent chat

# Or run a single prompt
vinhnt-agent run "Explain this codebase"

# Start server for WebUI connection
vinhnt-agent serve
```

## Commands

| Command | Description |
|---------|-------------|
| `vinhnt-agent init` | Initialize agent project |
| `vinhnt-agent chat` | Interactive chat session |
| `vinhnt-agent run <prompt>` | Run single prompt |
| `vinhnt-agent serve` | Start HTTP/WebSocket server |
| `vinhnt-agent sessions` | List all sessions |
| `vinhnt-agent memories` | List all memories |
| `vinhnt-agent tools` | List available tools |

## Configuration

Create `.env` file:

```env
AGENT_WORKSPACE_ROOT=.
AGENT_MODEL_PROVIDER=openai
AGENT_MODEL_API_KEY=your-api-key
AGENT_MODEL_BASE_URL=https://api.openai.com/v1
AGENT_MODEL_ID=gpt-4o
AGENT_MAX_STEPS=30
AGENT_MAX_TOKENS=4096
```

## Architecture

```
vinhnt-agent (Local)
├── Agent Loop (vinhnt-sdk/core)
├── Local Tools (file, shell, git, grep, glob)
├── SQLite Storage (sessions, messages, memories)
├── OS Keyring (API keys - future)
├── Sync Client (optional cloud sync)
└── HTTP/WebSocket Server (WebUI connection)
```

## API Endpoints (serve mode)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/sessions` | List sessions |
| POST | `/api/v1/sessions` | Create session |
| GET | `/api/v1/sessions/:id` | Get session |
| DELETE | `/api/v1/sessions/:id` | Delete session |
| GET | `/api/v1/sessions/:id/messages` | List messages |
| POST | `/api/v1/agent/run` | Run agent (sync) |
| POST | `/api/v1/agent/stream` | Run agent (SSE streaming) |
| POST | `/api/v1/agent/cancel` | Cancel run |
| GET | `/api/v1/tools` | List tools |
| GET | `/api/v1/memories` | List memories |
| POST | `/api/v1/memories` | Create memory |

## WebSocket Events

Connect to `ws://host:port/ws`:

```json
// Client → Server
{ "type": "run", "sessionId": "...", "prompt": "..." }
{ "type": "cancel", "runId": "..." }
{ "type": "ping" }

// Server → Client
{ "type": "chunk", "data": { ... } }
{ "type": "done" }
{ "type": "error", "error": "..." }
{ "type": "pong" }
```

## License

UNLICENSED

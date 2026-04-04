# paperclip-adapter-copilot

Copilot CLI adapter for [Paperclip](https://github.com/paperclipai/paperclip) — run GitHub Copilot as an autonomous agent in Paperclip companies.

## Why

GitHub Copilot CLI offers unlimited tokens through enterprise subscriptions, session persistence via `--resume`, structured JSON output, and access to all configured MCP tools. This adapter lets Paperclip orchestrate Copilot CLI agents with full dynamic control over tools, models, and budgets.

## Features

- **Dynamic tool control** — whitelist/blacklist tools per agent role via `--available-tools` / `--excluded-tools`
- **Session persistence** — resumes across heartbeats via `--resume=<sessionId>`
- **MCP injection** — inject additional MCP servers per agent via `--additional-mcp-config`
- **Budget tracking** — tracks `premiumRequests`, code changes, and API duration from JSON output
- **Turn limits** — cap autonomous work per heartbeat via `--max-autopilot-continues`
- **Model selection** — any model available through Copilot CLI

## Install

```bash
# In your Paperclip installation
pnpm add @paperclipai/adapter-copilot-local
```

## Agent Configuration

```json
{
  "adapterType": "copilot-local",
  "adapterConfig": {
    "model": "claude-sonnet-4",
    "maxTurnsPerRun": 50,
    "availableTools": ["bash", "edit", "view", "grep", "glob"],
    "excludedTools": ["ask_user"],
    "agent": "engineer",
    "cwd": "/path/to/workspace"
  }
}
```

### Config Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `command` | string | `"copilot"` | Path to copilot binary |
| `model` | string | — | Model override |
| `effort` | string | — | Reasoning effort (`low`/`medium`/`high`/`xhigh`) |
| `maxTurnsPerRun` | number | `50` | Max autopilot continuations per heartbeat |
| `availableTools` | string[] | all | Tool whitelist |
| `excludedTools` | string[] | none | Tool blacklist |
| `agent` | string | — | Custom agent name (`--agent` flag) |
| `additionalMcpConfig` | object/string | — | Extra MCP servers to inject |
| `noCustomInstructions` | boolean | `false` | Disable AGENTS.md loading |
| `promptTemplate` | string | — | Prompt template with `{{agent.id}}` and `{{agent.name}}` |
| `cwd` | string | — | Working directory |
| `timeoutSec` | number | `600` | Max wall-clock seconds |
| `graceSec` | number | `10` | SIGTERM grace period seconds |
| `extraArgs` | string[] | — | Additional CLI flags |
| `env` | object | — | Extra environment variables |

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT

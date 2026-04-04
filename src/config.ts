import type { AdapterModel } from '@paperclipai/adapter-utils';

export const agentConfigurationDoc = `# copilot-local agent configuration

Adapter: copilot-local

Runs GitHub Copilot CLI as an autonomous agent. Requires \`copilot\` CLI
installed and authenticated.

Core fields:
- command (string, optional): path to copilot binary (default: "copilot")
- model (string, optional): model override (e.g. "claude-sonnet-4", "gpt-5.2")
- effort (string, optional): reasoning effort level ("low" | "medium" | "high" | "xhigh")
- cwd (string, optional): absolute working directory for the agent
- maxTurnsPerRun (number, optional): max autopilot continuation turns per heartbeat (default: 50)

Tool control:
- availableTools (string[], optional): whitelist of tools the agent can use
- excludedTools (string[], optional): blacklist of tools to hide from the agent
- agent (string, optional): custom agent name (maps to --agent flag)

MCP configuration:
- additionalMcpConfig (object, optional): extra MCP servers to inject per invocation
- noCustomInstructions (boolean, optional): disable loading AGENTS.md files (default: false)

Environment:
- env (object, optional): KEY=VALUE environment variables passed to the process

Operational:
- timeoutSec (number, optional): max wall-clock seconds per run (default: 600)
- graceSec (number, optional): SIGTERM grace period in seconds (default: 10)
- promptTemplate (string, optional): prompt template with {{agent.id}} and {{agent.name}} placeholders
- extraArgs (string[], optional): additional CLI flags
`;

export const models: AdapterModel[] = [
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
  { id: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
  { id: 'claude-opus-4.6', label: 'Claude Opus 4.6' },
  { id: 'gpt-5.2', label: 'GPT-5.2' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
  { id: 'o3', label: 'o3' },
];

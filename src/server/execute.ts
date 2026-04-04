import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from '@paperclipai/adapter-utils';
import {
  asString,
  asNumber,
  asBoolean,
  asStringArray,
  parseObject,
  buildPaperclipEnv,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  readPaperclipRuntimeSkillEntries,
  renderTemplate,
  runChildProcess,
} from '@paperclipai/adapter-utils/server-utils';
import { parseCopilotStreamJson } from './parse.js';
import { resolveCopilotDesiredSkillNames } from './skills.js';

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_COMMAND = 'copilot';
const DEFAULT_MAX_TURNS = 50;
const DEFAULT_TIMEOUT_SEC = 600;
const DEFAULT_GRACE_SEC = 10;
const DEFAULT_PROMPT_TEMPLATE =
  'You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.';

/**
 * Create a temp directory with .github/skills/ containing symlinks to
 * desired Paperclip skills, so --add-dir makes Copilot CLI discover them.
 */
async function buildSkillsDir(config: Record<string, unknown>): Promise<string | null> {
  const availableEntries = await readPaperclipRuntimeSkillEntries(config, __moduleDir);
  if (availableEntries.length === 0) return null;

  const desiredNames = new Set(resolveCopilotDesiredSkillNames(config, availableEntries));
  const hasDesired = availableEntries.some((e) => desiredNames.has(e.key));
  if (!hasDesired) return null;

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'paperclip-copilot-skills-'));
  const target = path.join(tmp, '.github', 'skills');
  await fs.mkdir(target, { recursive: true });

  for (const entry of availableEntries) {
    if (!desiredNames.has(entry.key)) continue;
    await fs.symlink(entry.source, path.join(target, entry.runtimeName));
  }

  return tmp;
}

function buildCopilotArgs(opts: {
  resumeSessionId: string | null;
  model: string;
  effort: string;
  maxTurns: number;
  availableTools: string[];
  excludedTools: string[];
  agent: string;
  additionalMcpConfig: string;
  noCustomInstructions: boolean;
  skillsDir: string | null;
  extraArgs: string[];
}): string[] {
  const args = ['-p', '-', '--output-format', 'json', '-s', '--allow-all', '--autopilot'];

  if (opts.resumeSessionId) args.push('--resume', opts.resumeSessionId);
  if (opts.model) args.push('--model', opts.model);
  if (opts.effort) args.push('--effort', opts.effort);
  if (opts.maxTurns > 0) args.push('--max-autopilot-continues', String(opts.maxTurns));
  if (opts.agent) args.push('--agent', opts.agent);
  if (opts.noCustomInstructions) args.push('--no-custom-instructions');
  args.push('--no-ask-user');

  if (opts.availableTools.length > 0) {
    args.push('--available-tools', ...opts.availableTools);
  }
  if (opts.excludedTools.length > 0) {
    args.push('--excluded-tools', ...opts.excludedTools);
  }
  if (opts.additionalMcpConfig) {
    args.push('--additional-mcp-config', opts.additionalMcpConfig);
  }
  if (opts.skillsDir) {
    args.push('--add-dir', opts.skillsDir);
  }
  if (opts.extraArgs.length > 0) args.push(...opts.extraArgs);

  return args;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context } = ctx;

  // --- resolve config (with validation) ---
  const command = asString(config.command, DEFAULT_COMMAND);
  const model = asString(config.model, '');
  const effort = asString(config.effort, '');
  const maxTurns = Math.max(0, asNumber(config.maxTurnsPerRun, DEFAULT_MAX_TURNS));
  const timeoutSec = Math.max(1, asNumber(config.timeoutSec, DEFAULT_TIMEOUT_SEC));
  const graceSec = Math.max(1, asNumber(config.graceSec, DEFAULT_GRACE_SEC));
  const agentFlag = asString(config.agent, '');
  const noCustomInstructions = asBoolean(config.noCustomInstructions, false);
  const availableTools = asStringArray(config.availableTools);
  const excludedTools = asStringArray(config.excludedTools);
  const extraArgs = asStringArray(config.extraArgs);
  const promptTemplate = asString(config.promptTemplate, DEFAULT_PROMPT_TEMPLATE);

  // --- resolve workspace ---
  const workspaceContext = parseObject(context.paperclipWorkspace);
  const workspaceCwd = asString(workspaceContext.cwd, '');
  const configuredCwd = asString(config.cwd, '');
  const cwd = workspaceCwd || configuredCwd || process.cwd();
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });

  // --- resolve session resume ---
  const runtimeSessionParams = parseObject(runtime.sessionParams);
  const runtimeSessionId = asString(runtimeSessionParams.sessionId, runtime.sessionId ?? '');
  const runtimeSessionCwd = asString(runtimeSessionParams.cwd, '');
  const canResumeSession =
    runtimeSessionId.length > 0 &&
    (runtimeSessionCwd.length === 0 || path.resolve(runtimeSessionCwd) === path.resolve(cwd));
  const resumeSessionId = canResumeSession ? runtimeSessionId : null;

  // --- build environment ---
  const envConfig = parseObject(config.env);
  const env: Record<string, string> = { ...buildPaperclipEnv(agent) };
  env.PAPERCLIP_RUN_ID = runId;
  for (const [key, val] of Object.entries(envConfig)) {
    if (typeof val === 'string') env[key] = val;
  }

  // --- build MCP config override ---
  const mcpConfigRaw = config.additionalMcpConfig;
  let additionalMcpConfig = '';
  if (typeof mcpConfigRaw === 'string') {
    additionalMcpConfig = mcpConfigRaw;
  } else if (typeof mcpConfigRaw === 'object' && mcpConfigRaw !== null) {
    try {
      additionalMcpConfig = JSON.stringify(mcpConfigRaw);
    } catch {
      // Non-serializable config — skip silently
    }
  }

  // --- build prompt ---
  const prompt = renderTemplate(promptTemplate, {
    agent: { id: agent.id, name: agent.name },
    context,
  });

  // --- mount desired skills into temp dir ---
  const skillsDir = await buildSkillsDir(config);

  // --- build CLI args ---
  const args = buildCopilotArgs({
    resumeSessionId,
    model,
    effort,
    maxTurns,
    availableTools,
    excludedTools,
    agent: agentFlag,
    additionalMcpConfig,
    noCustomInstructions,
    skillsDir,
    extraArgs,
  });

  // --- verify copilot is installed ---
  await ensureCommandResolvable(command, cwd, { ...process.env, ...env });

  // --- run ---
  const proc = await runChildProcess(runId, command, args, {
    cwd,
    env,
    stdin: prompt,
    timeoutSec,
    graceSec,
    onLog: ctx.onLog,
  });

  // --- parse output ---
  const parsed = parseCopilotStreamJson(proc.stdout);

  // --- cleanup temp skills dir ---
  if (skillsDir) {
    fs.rm(skillsDir, { recursive: true, force: true }).catch(() => {});
  }

  // --- build session params for resume ---
  const resolvedSessionId = parsed.sessionId ?? resumeSessionId;
  const resolvedSessionParams = resolvedSessionId
    ? { sessionId: resolvedSessionId, cwd }
    : null;

  // --- build result ---
  return {
    exitCode: proc.exitCode,
    signal: proc.signal,
    timedOut: proc.timedOut ?? false,
    errorMessage: (proc.exitCode ?? 0) === 0 ? null : (parsed.errorMessage ?? 'Process exited with non-zero code'),
    usage: parsed.usage ?? undefined,
    sessionId: resolvedSessionId,
    sessionParams: resolvedSessionParams,
    sessionDisplayId: resolvedSessionId,
    provider: 'github',
    model: parsed.model || model || undefined,
    billingType: 'subscription',
    resultJson: parsed.resultJson,
    summary: parsed.summary,
  };
}

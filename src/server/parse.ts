import type { UsageSummary } from '@paperclipai/adapter-utils';

export interface CopilotStreamResult {
  sessionId: string | null;
  model: string;
  costUsd: number | null;
  usage: UsageSummary | null;
  summary: string;
  resultJson: Record<string, unknown> | null;
  errorMessage: string | null;
  premiumRequests: number;
  codeChanges: {
    linesAdded: number;
    linesRemoved: number;
    filesModified: string[];
  };
}

function tryParseJson(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

/**
 * Parse Copilot CLI JSON stream output (one JSON object per line).
 *
 * Event types we care about:
 * - session.mcp_servers_loaded — MCP status (informational)
 * - user.message              — echoed prompt
 * - assistant.message         — agent response text + tool requests
 * - assistant.turn_start/end  — turn boundaries
 * - result                    — final summary with sessionId, usage, exitCode
 */
export function parseCopilotStreamJson(stdout: string): CopilotStreamResult {
  let sessionId: string | null = null;
  let model = '';
  let resultEvent: Record<string, unknown> | null = null;
  const assistantTexts: string[] = [];
  let errorMessage: string | null = null;

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const event = tryParseJson(line);
    if (!event) continue;

    const type = str(event.type);
    const data = typeof event.data === 'object' && event.data !== null
      ? event.data as Record<string, unknown>
      : null;

    switch (type) {
      case 'session.tools_updated': {
        if (data) model = str(data.model, model);
        break;
      }

      case 'assistant.message': {
        if (data) {
          const content = str(data.content);
          if (content) assistantTexts.push(content);

          // Track output tokens per message
          sessionId = str(event.sessionId, sessionId ?? '') || sessionId;
        }
        break;
      }

      case 'result': {
        resultEvent = event;
        sessionId = str(event.sessionId, sessionId ?? '') || sessionId;
        break;
      }

      case 'error': {
        if (data) {
          errorMessage = str(data.message) || str(data.error) || 'Unknown error';
        }
        break;
      }
    }
  }

  // Extract usage from the result event
  const usage = extractUsage(resultEvent);
  const codeChanges = extractCodeChanges(resultEvent);
  const premiumRequests = extractPremiumRequests(resultEvent);

  if (resultEvent) {
    sessionId = str(resultEvent.sessionId, sessionId ?? '') || sessionId;
  }

  return {
    sessionId,
    model,
    costUsd: 0,
    usage,
    summary: assistantTexts.join('\n\n').trim(),
    resultJson: resultEvent,
    errorMessage,
    premiumRequests,
    codeChanges,
  };
}

function extractUsage(resultEvent: Record<string, unknown> | null): UsageSummary | null {
  if (!resultEvent) return null;

  const usageObj = typeof resultEvent.usage === 'object' && resultEvent.usage !== null
    ? resultEvent.usage as Record<string, unknown>
    : null;

  if (!usageObj) return null;

  // Copilot reports premiumRequests rather than raw tokens.
  // Map premiumRequests to inputTokens as a proxy metric.
  return {
    inputTokens: num(usageObj.premiumRequests) * 1000,
    outputTokens: num(usageObj.totalApiDurationMs),
  };
}

function extractPremiumRequests(resultEvent: Record<string, unknown> | null): number {
  if (!resultEvent) return 0;
  const usageObj = typeof resultEvent.usage === 'object' && resultEvent.usage !== null
    ? resultEvent.usage as Record<string, unknown>
    : null;
  return usageObj ? num(usageObj.premiumRequests) : 0;
}

function extractCodeChanges(resultEvent: Record<string, unknown> | null): CopilotStreamResult['codeChanges'] {
  const defaults = { linesAdded: 0, linesRemoved: 0, filesModified: [] as string[] };
  if (!resultEvent) return defaults;

  const usageObj = typeof resultEvent.usage === 'object' && resultEvent.usage !== null
    ? resultEvent.usage as Record<string, unknown>
    : null;
  if (!usageObj) return defaults;

  const changes = typeof usageObj.codeChanges === 'object' && usageObj.codeChanges !== null
    ? usageObj.codeChanges as Record<string, unknown>
    : null;
  if (!changes) return defaults;

  return {
    linesAdded: num(changes.linesAdded),
    linesRemoved: num(changes.linesRemoved),
    filesModified: Array.isArray(changes.filesModified)
      ? changes.filesModified.filter((f): f is string => typeof f === 'string')
      : [],
  };
}

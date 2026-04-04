import type { UsageSummary } from '@paperclipai/adapter-utils';

export interface CopilotStreamResult {
  sessionId: string | null;
  model: string;
  usage: UsageSummary | null;
  summary: string;
  resultJson: Record<string, unknown> | null;
  errorMessage: string | null;
  premiumRequests: number;
  sessionDurationMs: number;
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

function obj(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** Update sessionId only if the event carries a non-empty one. */
function pickSessionId(event: Record<string, unknown>, current: string | null): string | null {
  const candidate = str(event.sessionId);
  return candidate.length > 0 ? candidate : current;
}

/**
 * Parse Copilot CLI JSON stream output (one JSON object per line).
 *
 * Event types:
 * - session.tools_updated  — model selection
 * - assistant.message      — agent response text
 * - result                 — final summary with sessionId, usage, exitCode
 * - error                  — execution error
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
    const data = obj(event.data);

    switch (type) {
      case 'session.tools_updated': {
        if (data) model = str(data.model, model);
        break;
      }

      case 'assistant.message': {
        if (data) {
          const content = str(data.content);
          if (content) assistantTexts.push(content);
        }
        sessionId = pickSessionId(event, sessionId);
        break;
      }

      case 'result': {
        resultEvent = event;
        sessionId = pickSessionId(event, sessionId);
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

  const usageObj = resultEvent ? obj(resultEvent.usage) : null;

  return {
    sessionId,
    model,
    usage: extractUsage(usageObj),
    summary: assistantTexts.join('\n\n').trim(),
    resultJson: resultEvent,
    errorMessage,
    premiumRequests: usageObj ? num(usageObj.premiumRequests) : 0,
    sessionDurationMs: usageObj ? num(usageObj.sessionDurationMs) : 0,
    codeChanges: extractCodeChanges(usageObj),
  };
}

/**
 * Map Copilot usage to UsageSummary.
 *
 * Copilot CLI does not report raw token counts. It reports `premiumRequests`
 * (number of API round-trips) and `totalApiDurationMs`. We store these as-is
 * in the inputTokens/outputTokens fields since Paperclip only uses them for
 * relative cost tracking, not billing.
 */
function extractUsage(usageObj: Record<string, unknown> | null): UsageSummary | null {
  if (!usageObj) return null;
  return {
    inputTokens: num(usageObj.premiumRequests),
    outputTokens: 0,
  };
}

function extractCodeChanges(usageObj: Record<string, unknown> | null): CopilotStreamResult['codeChanges'] {
  const empty = { linesAdded: 0, linesRemoved: 0, filesModified: [] as string[] };
  if (!usageObj) return empty;

  const changes = obj(usageObj.codeChanges);
  if (!changes) return empty;

  return {
    linesAdded: num(changes.linesAdded),
    linesRemoved: num(changes.linesRemoved),
    filesModified: Array.isArray(changes.filesModified)
      ? changes.filesModified.filter((f): f is string => typeof f === 'string')
      : [],
  };
}

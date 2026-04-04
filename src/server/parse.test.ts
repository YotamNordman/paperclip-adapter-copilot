import { describe, it, expect } from 'vitest';
import { parseCopilotStreamJson } from './parse.js';

const SAMPLE_STREAM = [
  '{"type":"session.mcp_server_status_changed","data":{"serverName":"ado","status":"connected"},"timestamp":"2026-04-04T13:58:58.676Z"}',
  '{"type":"session.tools_updated","data":{"model":"claude-opus-4.6-1m"},"timestamp":"2026-04-04T13:59:08.042Z"}',
  '{"type":"user.message","data":{"content":"Fix the bug in auth.ts"},"timestamp":"2026-04-04T13:59:08.045Z"}',
  '{"type":"assistant.turn_start","data":{"turnId":"0"},"timestamp":"2026-04-04T13:59:08.066Z"}',
  '{"type":"assistant.message","data":{"messageId":"msg-1","content":"I found the bug. Fixing now.","outputTokens":12},"timestamp":"2026-04-04T13:59:12.582Z"}',
  '{"type":"assistant.message","data":{"messageId":"msg-2","content":"Done. The issue was a missing null check.","outputTokens":15},"timestamp":"2026-04-04T13:59:14.000Z"}',
  '{"type":"assistant.turn_end","data":{"turnId":"0"},"timestamp":"2026-04-04T13:59:14.100Z"}',
  '{"type":"result","sessionId":"abc-123","exitCode":0,"usage":{"premiumRequests":6,"totalApiDurationMs":4049,"sessionDurationMs":14203,"codeChanges":{"linesAdded":3,"linesRemoved":1,"filesModified":["src/auth.ts"]}},"timestamp":"2026-04-04T13:59:14.200Z"}',
].join('\n');

describe('parseCopilotStreamJson', () => {
  it('extracts session ID from result event', () => {
    const result = parseCopilotStreamJson(SAMPLE_STREAM);
    expect(result.sessionId).toBe('abc-123');
  });

  it('extracts model from tools_updated event', () => {
    const result = parseCopilotStreamJson(SAMPLE_STREAM);
    expect(result.model).toBe('claude-opus-4.6-1m');
  });

  it('concatenates assistant message texts', () => {
    const result = parseCopilotStreamJson(SAMPLE_STREAM);
    expect(result.summary).toBe(
      'I found the bug. Fixing now.\n\nDone. The issue was a missing null check.',
    );
  });

  it('extracts premium requests from usage', () => {
    const result = parseCopilotStreamJson(SAMPLE_STREAM);
    expect(result.premiumRequests).toBe(6);
  });

  it('extracts code changes', () => {
    const result = parseCopilotStreamJson(SAMPLE_STREAM);
    expect(result.codeChanges.linesAdded).toBe(3);
    expect(result.codeChanges.linesRemoved).toBe(1);
    expect(result.codeChanges.filesModified).toEqual(['src/auth.ts']);
  });

  it('maps usage to UsageSummary', () => {
    const result = parseCopilotStreamJson(SAMPLE_STREAM);
    expect(result.usage).not.toBeNull();
    expect(result.usage!.inputTokens).toBe(6000);
    expect(result.usage!.outputTokens).toBe(4049);
  });

  it('stores result event as resultJson', () => {
    const result = parseCopilotStreamJson(SAMPLE_STREAM);
    expect(result.resultJson).not.toBeNull();
    expect(result.resultJson!.exitCode).toBe(0);
  });

  it('handles empty output gracefully', () => {
    const result = parseCopilotStreamJson('');
    expect(result.sessionId).toBeNull();
    expect(result.summary).toBe('');
    expect(result.usage).toBeNull();
    expect(result.premiumRequests).toBe(0);
  });

  it('handles malformed lines without crashing', () => {
    const output = 'not json\n{"type":"result","sessionId":"x"}\ngarbage{}\n';
    const result = parseCopilotStreamJson(output);
    expect(result.sessionId).toBe('x');
  });

  it('captures error events', () => {
    const output = '{"type":"error","data":{"message":"Rate limited"}}\n';
    const result = parseCopilotStreamJson(output);
    expect(result.errorMessage).toBe('Rate limited');
  });
});

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

  it('extracts session duration from usage', () => {
    const result = parseCopilotStreamJson(SAMPLE_STREAM);
    expect(result.sessionDurationMs).toBe(14203);
  });

  it('extracts code changes', () => {
    const result = parseCopilotStreamJson(SAMPLE_STREAM);
    expect(result.codeChanges.linesAdded).toBe(3);
    expect(result.codeChanges.linesRemoved).toBe(1);
    expect(result.codeChanges.filesModified).toEqual(['src/auth.ts']);
  });

  it('maps premiumRequests directly to inputTokens without fabrication', () => {
    const result = parseCopilotStreamJson(SAMPLE_STREAM);
    expect(result.usage).not.toBeNull();
    expect(result.usage!.inputTokens).toBe(6);
    expect(result.usage!.outputTokens).toBe(0);
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
    expect(result.sessionDurationMs).toBe(0);
  });

  it('handles malformed lines without crashing', () => {
    const output = 'not json\n{"type":"result","sessionId":"x"}\ngarbage{}\n';
    const result = parseCopilotStreamJson(output);
    expect(result.sessionId).toBe('x');
  });

  it('captures error from data.message', () => {
    const output = '{"type":"error","data":{"message":"Rate limited"}}\n';
    const result = parseCopilotStreamJson(output);
    expect(result.errorMessage).toBe('Rate limited');
  });

  it('falls back to data.error when data.message is absent', () => {
    const output = '{"type":"error","data":{"error":"Quota exceeded"}}\n';
    const result = parseCopilotStreamJson(output);
    expect(result.errorMessage).toBe('Quota exceeded');
  });

  it('extracts sessionId from assistant.message when result has none', () => {
    const output = [
      '{"type":"assistant.message","sessionId":"from-msg","data":{"content":"hello"}}',
    ].join('\n');
    const result = parseCopilotStreamJson(output);
    expect(result.sessionId).toBe('from-msg');
  });

  it('result sessionId overrides earlier assistant.message sessionId', () => {
    const output = [
      '{"type":"assistant.message","sessionId":"old-id","data":{"content":"hello"}}',
      '{"type":"result","sessionId":"final-id"}',
    ].join('\n');
    const result = parseCopilotStreamJson(output);
    expect(result.sessionId).toBe('final-id');
  });

  it('returns default code changes when usage has no codeChanges', () => {
    const output = '{"type":"result","sessionId":"x","usage":{"premiumRequests":1}}\n';
    const result = parseCopilotStreamJson(output);
    expect(result.codeChanges).toEqual({ linesAdded: 0, linesRemoved: 0, filesModified: [] });
  });

  it('ignores non-object JSON lines', () => {
    const output = '"just a string"\n42\n[1,2,3]\n{"type":"result","sessionId":"ok"}\n';
    const result = parseCopilotStreamJson(output);
    expect(result.sessionId).toBe('ok');
  });
});

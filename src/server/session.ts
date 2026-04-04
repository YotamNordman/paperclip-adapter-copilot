import type { AdapterSessionCodec } from '@paperclipai/adapter-utils';

/**
 * Codec for persisting Copilot session state across heartbeats.
 * Stores sessionId + cwd so the adapter can resume with --resume.
 */
export const sessionCodec: AdapterSessionCodec = {
  deserialize(raw: unknown): Record<string, unknown> | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const obj = raw as Record<string, unknown>;
    if (typeof obj.sessionId !== 'string') return null;
    return {
      sessionId: obj.sessionId,
      cwd: typeof obj.cwd === 'string' ? obj.cwd : '',
    };
  },

  serialize(params: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!params || typeof params.sessionId !== 'string') return null;
    return {
      sessionId: params.sessionId,
      cwd: typeof params.cwd === 'string' ? params.cwd : '',
    };
  },

  getDisplayId(params: Record<string, unknown> | null): string | null {
    if (!params || typeof params.sessionId !== 'string') return null;
    const id = params.sessionId;
    // Show first 8 chars of session UUID for display
    return id.length > 8 ? id.slice(0, 8) : id;
  },
};

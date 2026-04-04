import { describe, it, expect } from 'vitest';
import { sessionCodec } from './session.js';

describe('sessionCodec', () => {
  describe('deserialize', () => {
    it('extracts sessionId and cwd from valid input', () => {
      const result = sessionCodec.deserialize({ sessionId: 'abc-123', cwd: '/tmp/work' });
      expect(result).toEqual({ sessionId: 'abc-123', cwd: '/tmp/work' });
    });

    it('returns null for missing sessionId', () => {
      expect(sessionCodec.deserialize({ cwd: '/tmp' })).toBeNull();
    });

    it('returns null for non-object input', () => {
      expect(sessionCodec.deserialize('string')).toBeNull();
      expect(sessionCodec.deserialize(null)).toBeNull();
      expect(sessionCodec.deserialize(42)).toBeNull();
    });

    it('defaults cwd to empty string', () => {
      const result = sessionCodec.deserialize({ sessionId: 'abc' });
      expect(result).toEqual({ sessionId: 'abc', cwd: '' });
    });
  });

  describe('serialize', () => {
    it('serializes valid session params', () => {
      const result = sessionCodec.serialize({ sessionId: 'abc-123', cwd: '/tmp' });
      expect(result).toEqual({ sessionId: 'abc-123', cwd: '/tmp' });
    });

    it('returns null for null input', () => {
      expect(sessionCodec.serialize(null)).toBeNull();
    });

    it('returns null for missing sessionId', () => {
      expect(sessionCodec.serialize({ cwd: '/tmp' })).toBeNull();
    });
  });

  describe('getDisplayId', () => {
    it('returns first 8 chars of session ID', () => {
      const result = sessionCodec.getDisplayId!({ sessionId: 'abc12345-longer-id' });
      expect(result).toBe('abc12345');
    });

    it('returns full ID if shorter than 8 chars', () => {
      const result = sessionCodec.getDisplayId!({ sessionId: 'short' });
      expect(result).toBe('short');
    });

    it('returns null for null input', () => {
      expect(sessionCodec.getDisplayId!(null)).toBeNull();
    });
  });
});

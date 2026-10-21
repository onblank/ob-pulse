import { describe, expect, it } from 'vitest';
import {
  beginContextSession,
  compactContext,
  contextAlert,
  observeContextUsed,
  percent,
  tokensPerSecond,
} from './index';
describe('measured token speed', () => {
  it('calculates nanosecond timings', () => {
    expect(tokensPerSecond(42, 2_000_000_000)).toBe(21);
  });
  it('unknown values do not become fake zeros', () => {
    expect(tokensPerSecond(null, 42)).toBeNull();
    expect(tokensPerSecond(5, 0)).toBeNull();
  });
});
describe('context provenance', () => {
  it('session begins at zero only after explicit start', () => {
    const s = beginContextSession('conversation-1', 8192);
    expect(s.usedTokens).toBe(0);
    expect(s.epoch).toBe(0);
  });
  it('unknown compaction summary becomes null', () => {
    const s = observeContextUsed(beginContextSession('c', 16384), 14000);
    expect(compactContext(s).usedTokens).toBeNull();
    expect(compactContext(s, 700).usedTokens).toBe(700);
  });
  it('invalid durations or percentages do not masquerade as observations', () => {
    expect(percent(null, 300)).toBeNull();
    expect(percent(50, 0)).toBeNull();
  });
  it('warns only from measured session context', () => {
    expect(contextAlert(null, 8192)).toBe('unavailable');
    expect(contextAlert(7000, 8192)).toBe('normal');
    expect(contextAlert(7500, 8192)).toBe('warning');
    expect(contextAlert(8192, 8192)).toBe('overflow');
  });
});

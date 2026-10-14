export interface ContextSession {
  readonly sessionId: string;
  readonly epoch: number;
  readonly usedTokens: number | null;
  readonly capacityTokens: number | null;
  readonly active: boolean;
}

/** A missing or zero-duration report is unknown, not zero tokens/second. */
export function tokensPerSecond(
  count: number | null | undefined,
  durationNs: number | null | undefined,
): number | null {
  if (
    count == null ||
    durationNs == null ||
    !Number.isFinite(count) ||
    !Number.isFinite(durationNs) ||
    count < 0 ||
    durationNs <= 0
  )
    return null;
  return (count * 1_000_000_000) / durationNs;
}
export function percent(
  part: number | null | undefined,
  total: number | null | undefined,
): number | null {
  if (
    part == null ||
    total == null ||
    !Number.isFinite(part) ||
    !Number.isFinite(total) ||
    part < 0 ||
    total <= 0
  )
    return null;
  return Math.min(100, Math.max(0, (part / total) * 100));
}
export function beginContextSession(
  sessionId: string,
  capacityTokens: number | null,
): ContextSession {
  if (!sessionId.trim()) throw new Error('Session ID required');
  return { sessionId, epoch: 0, capacityTokens, usedTokens: 0, active: true };
}
export function observeContextUsed(previous: ContextSession, usedTokens: number): ContextSession {
  if (!Number.isSafeInteger(usedTokens) || usedTokens < 0)
    throw new Error('Invalid used token count');
  return { ...previous, usedTokens };
}
/** A compaction without a new measured summary length MUST NOT claim zero used context. */
export function compactContext(
  previous: ContextSession,
  measuredSummaryTokens?: number,
): ContextSession {
  if (
    measuredSummaryTokens !== undefined &&
    (!Number.isSafeInteger(measuredSummaryTokens) || measuredSummaryTokens < 0)
  )
    throw new Error('Invalid summary token count');
  return { ...previous, epoch: previous.epoch + 1, usedTokens: measuredSummaryTokens ?? null };
}
export function endContextSession(previous: ContextSession): ContextSession {
  return { ...previous, active: false };
}

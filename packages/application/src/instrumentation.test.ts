import { describe, expect, it } from 'vitest';
import type { InstrumentationEvent } from '@obpulse/contracts';
import { InstrumentationSessionStore } from './instrumentation';

const common = {
  version: '1.0.0' as const,
  origin: 'agent-os-local',
  runtime_id: 'ollama' as const,
  model_id: 'qwen:latest',
  session_id: 'session-1',
};

const started: InstrumentationEvent = {
  ...common,
  event_id: 'event-1',
  at: '2026-10-21T08:00:00.000Z',
  type: 'session.started',
  data: { context_capacity_tokens: 10_000 },
};

describe('instrumented client sessions', () => {
  it('derives context, throughput and overflow state only from explicit events', () => {
    const store = new InstrumentationSessionStore();
    store.ingest(started);
    const session = store.ingest({
      ...common,
      event_id: 'event-2',
      at: '2026-10-21T08:00:03.000Z',
      type: 'request.completed',
      data: {
        prompt_tokens: 200,
        completion_tokens: 50,
        prompt_eval_duration_ns: 1_000_000_000,
        completion_eval_duration_ns: 2_000_000_000,
        context_used_tokens: 9_200,
        time_to_first_token_ms: 140,
      },
    });
    expect(session).toMatchObject({
      contextUsedPercent: 92,
      contextAlert: 'warning',
      readTokensPerSecond: 200,
      writeTokensPerSecond: 25,
      timeToFirstTokenMs: 140,
    });
  });

  it('treats replay as idempotent and rejects inconsistent continuation', () => {
    const store = new InstrumentationSessionStore();
    expect(store.ingest(started)).toEqual(store.ingest(started));
    expect(() =>
      store.ingest({
        ...common,
        event_id: 'event-3',
        at: '2026-10-21T07:59:59.000Z',
        type: 'session.ended',
        data: {},
      }),
    ).toThrow('Out-of-order');
    expect(() => store.ingest({ ...started, session_id: 'another-session' })).toThrow(
      'replay mismatch',
    );
  });

  it('increments compaction epoch and preserves unknown context as null', () => {
    const store = new InstrumentationSessionStore();
    store.ingest(started);
    const compacted = store.ingest({
      ...common,
      event_id: 'event-4',
      at: '2026-10-21T08:01:00.000Z',
      type: 'context.compacted',
      data: { summary_context_tokens: null },
    });
    expect(compacted.epoch).toBe(1);
    expect(compacted.contextUsedTokens).toBeNull();
    expect(compacted.contextAlert).toBe('unavailable');
  });
});

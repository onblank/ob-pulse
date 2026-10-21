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

  it('keeps idempotent per-request samples for multiple sessions', () => {
    const store = new InstrumentationSessionStore();
    store.ingest(started);
    const request: InstrumentationEvent = {
      ...common,
      event_id: 'event-history-1',
      at: '2026-10-21T08:00:03.000Z',
      type: 'request.completed',
      data: {
        prompt_tokens: 300,
        completion_tokens: 60,
        prompt_eval_duration_ns: 1_000_000_000,
        completion_eval_duration_ns: 2_000_000_000,
        context_used_tokens: 4_000,
        time_to_first_token_ms: 120,
      },
    };
    store.ingest(request);
    store.ingest(request);
    store.ingest({
      ...started,
      event_id: 'event-session-2',
      session_id: 'session-2',
      model_id: 'gemma:latest',
    });
    store.ingest({
      ...request,
      event_id: 'event-history-2',
      session_id: 'session-2',
      model_id: 'gemma:latest',
    });

    const snapshot = store.snapshot();
    expect(snapshot.sessions).toHaveLength(2);
    expect(snapshot.requestHistory.samples).toHaveLength(2);
    expect(snapshot.requestHistory.samples[0]).toMatchObject({
      sampleId: 'event-history-1',
      sessionId: 'session-1',
      contextUsedPercent: 40,
      readTokensPerSecond: 300,
      writeTokensPerSecond: 30,
      timeToFirstTokenMs: 120,
    });
  });

  it('prunes request samples by receipt time and a hard count bound', () => {
    let nowMs = 10_000;
    const store = new InstrumentationSessionStore({
      retentionMs: 1_000,
      maxRequestSamples: 2,
      now: () => nowMs,
    });
    store.ingest(started);
    const request = (id: string, at: string): InstrumentationEvent => ({
      ...common,
      event_id: id,
      at,
      type: 'request.completed',
      data: {
        prompt_tokens: null,
        completion_tokens: null,
        prompt_eval_duration_ns: null,
        completion_eval_duration_ns: null,
        context_used_tokens: null,
        time_to_first_token_ms: null,
      },
    });
    store.ingest(request('event-bound-1', '2026-10-21T08:00:01.000Z'));
    nowMs += 100;
    store.ingest(request('event-bound-2', '2026-10-21T08:00:02.000Z'));
    nowMs += 100;
    store.ingest(request('event-bound-3', '2026-10-21T08:00:03.000Z'));
    expect(store.snapshot().requestHistory.samples.map((sample) => sample.sampleId)).toEqual([
      'event-bound-2',
      'event-bound-3',
    ]);

    nowMs += 1_101;
    expect(store.snapshot().requestHistory.samples).toEqual([]);
  });

  it('clears sessions, replay state and request history together', () => {
    const store = new InstrumentationSessionStore();
    store.ingest(started);
    store.clear();
    expect(store.snapshot().sessions).toEqual([]);
    expect(store.snapshot().requestHistory.samples).toEqual([]);
    expect(() => store.ingest({ ...started, type: 'session.ended', data: {} })).toThrow(
      'Session has not started',
    );
  });

  it('removes ended session state after the retention window', () => {
    let nowMs = 20_000;
    const store = new InstrumentationSessionStore({ retentionMs: 1_000, now: () => nowMs });
    store.ingest(started);
    store.ingest({
      ...common,
      event_id: 'event-ended',
      at: '2026-10-21T08:00:04.000Z',
      type: 'session.ended',
      data: {},
    });
    expect(store.snapshot().sessions).toHaveLength(1);
    nowMs += 1_001;
    expect(store.snapshot().sessions).toEqual([]);
  });
});

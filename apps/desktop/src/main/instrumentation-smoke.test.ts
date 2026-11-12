import { afterEach, describe, expect, it } from 'vitest';
import { InstrumentationSessionStore } from '@obpulse/application';
import { LoopbackInstrumentationBridge } from '@obpulse/instrumentation-http';

const sessionId = 'a6c0294a-2fe2-4e8d-a02a-3661a3e3e86c';
const base = {
  version: '1.0.0',
  origin: 'pulse-smoke-test',
  runtime_id: 'ollama',
  model_id: 'qwen:latest',
  session_id: sessionId,
};
const bridges: LoopbackInstrumentationBridge[] = [];
afterEach(async () => Promise.all(bridges.map((bridge) => bridge.disable())));

describe('instrumentation bridge to session history', () => {
  it('retains only numeric session/request metrics, handles compaction and clears on disable', async () => {
    const store = new InstrumentationSessionStore();
    const bridge = new LoopbackInstrumentationBridge((event) => store.ingest(event));
    bridges.push(bridge);
    const status = await bridge.enable();
    const send = (event: Record<string, unknown>) =>
      fetch(status.endpoint!, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${status.authToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(event),
      });

    const started = await send({
      ...base,
      event_id: '550e8400-e29b-41d4-a716-446655440000',
      at: '2026-11-12T08:00:00.000Z',
      type: 'session.started',
      data: { context_capacity_tokens: 32_000 },
    });
    expect(started.status).toBe(202);

    const request = await send({
      ...base,
      event_id: '550e8400-e29b-41d4-a716-446655440001',
      at: '2026-11-12T08:00:03.000Z',
      type: 'request.completed',
      data: {
        prompt_tokens: 300,
        completion_tokens: 60,
        prompt_eval_duration_ns: 1_000_000_000,
        completion_eval_duration_ns: 2_000_000_000,
        context_used_tokens: 4_000,
        time_to_first_token_ms: 120,
      },
    });
    expect(request.status).toBe(202);
    expect(store.snapshot()).toMatchObject({
      sessions: [{ contextUsedPercent: 12.5, readTokensPerSecond: 300, writeTokensPerSecond: 30 }],
      requestHistory: {
        samples: [{ contextUsedTokens: 4_000, timeToFirstTokenMs: 120, writeTokensPerSecond: 30 }],
      },
    });

    const content = await send({
      ...base,
      event_id: '550e8400-e29b-41d4-a716-446655440002',
      at: '2026-11-12T08:00:04.000Z',
      type: 'request.completed',
      data: {
        prompt_tokens: 1,
        completion_tokens: 1,
        prompt_eval_duration_ns: 1,
        completion_eval_duration_ns: 1,
        context_used_tokens: 4_001,
        time_to_first_token_ms: 1,
      },
      prompt: 'must never be stored',
    });
    expect(content.status).toBe(400);
    expect(JSON.stringify(store.snapshot())).not.toContain('must never be stored');

    const compacted = await send({
      ...base,
      event_id: '550e8400-e29b-41d4-a716-446655440003',
      at: '2026-11-12T08:00:05.000Z',
      type: 'context.compacted',
      data: { summary_context_tokens: 900 },
    });
    expect(compacted.status).toBe(202);
    expect(store.snapshot().sessions[0]).toMatchObject({ epoch: 1, contextUsedTokens: 900 });

    const restartedSession = await send({
      ...base,
      event_id: '550e8400-e29b-41d4-a716-446655440004',
      session_id: 'b6c0294a-2fe2-4e8d-a02a-3661a3e3e86c',
      at: '2026-11-12T08:00:06.000Z',
      type: 'session.started',
      data: { context_capacity_tokens: 32_000 },
    });
    expect(restartedSession.status).toBe(202);
    expect(store.snapshot().sessions).toHaveLength(2);
    expect(
      store
        .snapshot()
        .sessions.find((session) => session.sessionId === 'b6c0294a-2fe2-4e8d-a02a-3661a3e3e86c'),
    ).toMatchObject({ epoch: 0, contextUsedTokens: 0 });

    await bridge.disable();
    store.clear();
    expect(store.snapshot()).toMatchObject({ sessions: [], requestHistory: { samples: [] } });
  });
});

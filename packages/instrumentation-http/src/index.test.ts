import { afterEach, describe, expect, it } from 'vitest';
import type { InstrumentationEvent } from '@obpulse/contracts';
import { LoopbackInstrumentationBridge, parseInstrumentationEvent } from './index';

const validEvent = {
  version: '1.0.0',
  event_id: '550e8400-e29b-41d4-a716-446655440000',
  origin: 'agent-os-local',
  at: '2026-10-21T08:00:00.000Z',
  runtime_id: 'ollama',
  model_id: 'qwen:latest',
  session_id: 'a6c0294a-2fe2-4e8d-a02a-3661a3e3e86c',
  type: 'session.started',
  data: { context_capacity_tokens: 32_768 },
};

const bridges: LoopbackInstrumentationBridge[] = [];
afterEach(async () => Promise.all(bridges.map((bridge) => bridge.disable())));

describe('instrumentation event parser', () => {
  it('accepts the versioned numeric contract and rejects content fields', () => {
    expect(parseInstrumentationEvent(validEvent)).toMatchObject({ type: 'session.started' });
    expect(() =>
      parseInstrumentationEvent({ ...validEvent, prompt: 'must never enter OB-Pulse' }),
    ).toThrow('unsupported fields');
  });
});

describe('loopback instrumentation bridge', () => {
  it('uses loopback, bearer auth and strict event validation', async () => {
    const accepted: InstrumentationEvent[] = [];
    const bridge = new LoopbackInstrumentationBridge((event) => accepted.push(event));
    bridges.push(bridge);
    const status = await bridge.enable();
    expect(status.endpoint).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/v1\/events$/);
    expect(status.authToken).toHaveLength(43);

    const unauthorized = await fetch(status.endpoint!, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validEvent),
    });
    expect(unauthorized.status).toBe(401);

    const response = await fetch(status.endpoint!, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${status.authToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(validEvent),
    });
    expect(response.status).toBe(202);
    expect(accepted).toHaveLength(1);
  });

  it('enforces a bounded request rate', async () => {
    const bridge = new LoopbackInstrumentationBridge(() => undefined, 1);
    bridges.push(bridge);
    const status = await bridge.enable();
    const first = await fetch(status.endpoint!);
    const second = await fetch(status.endpoint!);
    expect(first.status).toBe(404);
    expect(second.status).toBe(429);
  });
});

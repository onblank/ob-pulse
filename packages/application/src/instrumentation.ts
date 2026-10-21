import type {
  InstrumentationEvent,
  InstrumentationSnapshot,
  InstrumentedRequestSample,
  InstrumentedSession,
} from '@obpulse/contracts';
import {
  beginContextSession,
  compactContext,
  contextAlert,
  endContextSession,
  observeContextUsed,
  percent,
  tokensPerSecond,
} from '@obpulse/domain';

const MAX_SESSIONS = 100;
const MAX_EVENT_IDS = 8192;
export const INSTRUMENTATION_HISTORY_RETENTION_MS = 60 * 60 * 1000;
export const INSTRUMENTATION_HISTORY_MAX_SAMPLES = 7200;

interface InstrumentationStoreOptions {
  readonly retentionMs?: number;
  readonly maxRequestSamples?: number;
  readonly now?: () => number;
}

interface RetainedRequestSample {
  readonly receivedAtMs: number;
  readonly sample: InstrumentedRequestSample;
}

export class InstrumentationSessionStore {
  private readonly sessions = new Map<string, InstrumentedSession>();
  private readonly sessionReceivedAt = new Map<string, number>();
  private readonly processedEventIds = new Map<string, string>();
  private readonly eventIdOrder: string[] = [];
  private readonly requestSamples: RetainedRequestSample[] = [];
  private readonly retentionMs: number;
  private readonly maxRequestSamples: number;
  private readonly now: () => number;

  constructor(options: InstrumentationStoreOptions = {}) {
    this.retentionMs = options.retentionMs ?? INSTRUMENTATION_HISTORY_RETENTION_MS;
    this.maxRequestSamples = options.maxRequestSamples ?? INSTRUMENTATION_HISTORY_MAX_SAMPLES;
    this.now = options.now ?? Date.now;
    if (this.retentionMs <= 0 || this.maxRequestSamples <= 0)
      throw new Error('Instrumentation history bounds must be positive');
  }

  ingest(event: InstrumentationEvent): InstrumentedSession {
    const receivedAtMs = this.now();
    this.prune(receivedAtMs);
    const processedSessionId = this.processedEventIds.get(event.event_id);
    if (processedSessionId) {
      if (processedSessionId !== event.session_id) throw new Error('Event ID replay mismatch');
      const session = this.sessions.get(event.session_id);
      if (!session) throw new Error('Duplicate event references an unknown session');
      return session;
    }

    const current = this.sessions.get(event.session_id);
    let next: InstrumentedSession;
    switch (event.type) {
      case 'session.started': {
        if (current) throw new Error('Session already exists');
        this.makeRoomForSession();
        const context = beginContextSession(event.session_id, event.data.context_capacity_tokens);
        next = {
          sessionId: event.session_id,
          origin: event.origin,
          runtimeId: event.runtime_id,
          modelId: event.model_id,
          active: context.active,
          epoch: context.epoch,
          contextUsedTokens: context.usedTokens,
          contextCapacityTokens: context.capacityTokens,
          contextUsedPercent: percent(context.usedTokens, context.capacityTokens),
          contextAlert: contextAlert(context.usedTokens, context.capacityTokens),
          readTokensPerSecond: null,
          writeTokensPerSecond: null,
          timeToFirstTokenMs: null,
          lastEventAt: event.at,
        };
        break;
      }
      case 'request.completed': {
        this.assertContinuation(current, event);
        let context = beginContextSession(current.sessionId, current.contextCapacityTokens);
        context = { ...context, epoch: current.epoch, usedTokens: current.contextUsedTokens };
        if (event.data.context_used_tokens != null)
          context = observeContextUsed(context, event.data.context_used_tokens);
        next = {
          ...current,
          contextUsedTokens: context.usedTokens,
          contextUsedPercent: percent(context.usedTokens, context.capacityTokens),
          contextAlert: contextAlert(context.usedTokens, context.capacityTokens),
          readTokensPerSecond: tokensPerSecond(
            event.data.prompt_tokens,
            event.data.prompt_eval_duration_ns,
          ),
          writeTokensPerSecond: tokensPerSecond(
            event.data.completion_tokens,
            event.data.completion_eval_duration_ns,
          ),
          timeToFirstTokenMs: event.data.time_to_first_token_ms,
          lastEventAt: event.at,
        };
        break;
      }
      case 'context.compacted': {
        this.assertContinuation(current, event);
        const context = compactContext(
          {
            sessionId: current.sessionId,
            epoch: current.epoch,
            usedTokens: current.contextUsedTokens,
            capacityTokens: current.contextCapacityTokens,
            active: current.active,
          },
          event.data.summary_context_tokens ?? undefined,
        );
        next = {
          ...current,
          epoch: context.epoch,
          contextUsedTokens: context.usedTokens,
          contextUsedPercent: percent(context.usedTokens, context.capacityTokens),
          contextAlert: contextAlert(context.usedTokens, context.capacityTokens),
          lastEventAt: event.at,
        };
        break;
      }
      case 'session.ended': {
        this.assertContinuation(current, event);
        const context = endContextSession({
          sessionId: current.sessionId,
          epoch: current.epoch,
          usedTokens: current.contextUsedTokens,
          capacityTokens: current.contextCapacityTokens,
          active: current.active,
        });
        next = { ...current, active: context.active, lastEventAt: event.at };
        break;
      }
    }

    this.sessions.set(event.session_id, next);
    this.sessionReceivedAt.set(event.session_id, receivedAtMs);
    if (event.type === 'request.completed') {
      this.requestSamples.push({
        receivedAtMs,
        sample: {
          sampleId: event.event_id,
          sampledAt: event.at,
          sessionId: event.session_id,
          runtimeId: event.runtime_id,
          modelId: event.model_id,
          epoch: next.epoch,
          contextUsedTokens: next.contextUsedTokens,
          contextCapacityTokens: next.contextCapacityTokens,
          contextUsedPercent: next.contextUsedPercent,
          readTokensPerSecond: next.readTokensPerSecond,
          writeTokensPerSecond: next.writeTokensPerSecond,
          timeToFirstTokenMs: next.timeToFirstTokenMs,
        },
      });
      this.prune(receivedAtMs);
    }
    this.remember(event.event_id, event.session_id);
    return next;
  }

  snapshot(nowMs = this.now()): InstrumentationSnapshot {
    this.prune(nowMs);
    return {
      sessions: [...this.sessions.values()].sort((left, right) => {
        if (left.active !== right.active) return left.active ? -1 : 1;
        return Date.parse(right.lastEventAt) - Date.parse(left.lastEventAt);
      }),
      requestHistory: {
        retentionMs: this.retentionMs,
        maxSamples: this.maxRequestSamples,
        samples: this.requestSamples.map(({ sample }) => sample),
      },
    };
  }

  clear(): void {
    this.sessions.clear();
    this.sessionReceivedAt.clear();
    this.processedEventIds.clear();
    this.eventIdOrder.length = 0;
    this.requestSamples.length = 0;
  }

  private assertContinuation(
    current: InstrumentedSession | undefined,
    event: Exclude<InstrumentationEvent, { type: 'session.started' }>,
  ): asserts current is InstrumentedSession {
    if (!current) throw new Error('Session has not started');
    if (!current.active) throw new Error('Session has already ended');
    if (current.origin !== event.origin) throw new Error('Session origin mismatch');
    if (current.runtimeId !== event.runtime_id || current.modelId !== event.model_id)
      throw new Error('Session runtime or model mismatch');
    if (Date.parse(event.at) < Date.parse(current.lastEventAt))
      throw new Error('Out-of-order session event');
  }

  private makeRoomForSession(): void {
    if (this.sessions.size < MAX_SESSIONS) return;
    const ended = [...this.sessions.values()]
      .filter((session) => !session.active)
      .sort((left, right) => Date.parse(left.lastEventAt) - Date.parse(right.lastEventAt))[0];
    if (!ended) throw new Error('Too many active sessions');
    this.sessions.delete(ended.sessionId);
    this.sessionReceivedAt.delete(ended.sessionId);
    this.removeRequestSamplesForSession(ended.sessionId);
  }

  private remember(eventId: string, sessionId: string): void {
    this.processedEventIds.set(eventId, sessionId);
    this.eventIdOrder.push(eventId);
    if (this.eventIdOrder.length <= MAX_EVENT_IDS) return;
    const oldest = this.eventIdOrder.shift();
    if (oldest) this.processedEventIds.delete(oldest);
  }

  private prune(nowMs: number): void {
    const cutoff = nowMs - this.retentionMs;
    while ((this.requestSamples[0]?.receivedAtMs ?? nowMs) < cutoff) this.requestSamples.shift();
    if (this.requestSamples.length > this.maxRequestSamples)
      this.requestSamples.splice(0, this.requestSamples.length - this.maxRequestSamples);
    for (const session of this.sessions.values()) {
      if (session.active || (this.sessionReceivedAt.get(session.sessionId) ?? nowMs) >= cutoff)
        continue;
      this.sessions.delete(session.sessionId);
      this.sessionReceivedAt.delete(session.sessionId);
      this.removeRequestSamplesForSession(session.sessionId);
    }
  }

  private removeRequestSamplesForSession(sessionId: string): void {
    for (let index = this.requestSamples.length - 1; index >= 0; index--) {
      if (this.requestSamples[index]?.sample.sessionId === sessionId)
        this.requestSamples.splice(index, 1);
    }
  }
}

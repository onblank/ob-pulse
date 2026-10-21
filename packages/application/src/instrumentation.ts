import type {
  InstrumentationEvent,
  InstrumentationSnapshot,
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
const MAX_EVENT_IDS = 4096;

export class InstrumentationSessionStore {
  private readonly sessions = new Map<string, InstrumentedSession>();
  private readonly processedEventIds = new Map<string, string>();
  private readonly eventIdOrder: string[] = [];

  ingest(event: InstrumentationEvent): InstrumentedSession {
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
    this.remember(event.event_id, event.session_id);
    return next;
  }

  snapshot(): InstrumentationSnapshot {
    return {
      sessions: [...this.sessions.values()].sort((left, right) => {
        if (left.active !== right.active) return left.active ? -1 : 1;
        return Date.parse(right.lastEventAt) - Date.parse(left.lastEventAt);
      }),
    };
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
  }

  private remember(eventId: string, sessionId: string): void {
    this.processedEventIds.set(eventId, sessionId);
    this.eventIdOrder.push(eventId);
    if (this.eventIdOrder.length <= MAX_EVENT_IDS) return;
    const oldest = this.eventIdOrder.shift();
    if (oldest) this.processedEventIds.delete(oldest);
  }
}

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type {
  ContextCompactedEvent,
  InstrumentationBridgeStatus,
  InstrumentationEvent,
  InstrumentationEnvelopeBase,
  RequestCompletedEvent,
  RuntimeId,
  SessionEndedEvent,
  SessionStartedEvent,
} from '@obpulse/contracts';
import { RUNTIME_IDS } from '@obpulse/contracts';

const LOOPBACK_HOST = '127.0.0.1';
const MAX_BODY_BYTES = 16 * 1024;
const RATE_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT = 120;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonObject = Record<string, unknown>;

class InputError extends Error {}

function object(value: unknown, label: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new InputError(`${label} must be an object`);
  return value as JsonObject;
}

function exactKeys(value: JsonObject, keys: readonly string[], label: string): void {
  const expected = new Set(keys);
  if (
    Object.keys(value).length !== expected.size ||
    Object.keys(value).some((key) => !expected.has(key))
  )
    throw new InputError(`${label} contains missing or unsupported fields`);
}

function string(value: unknown, label: string, maxLength: number): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength ||
    Array.from(value).some((character) => character.charCodeAt(0) <= 0x1f)
  )
    throw new InputError(`${label} is invalid`);
  return value;
}

function nullableCount(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new InputError(`${label} must be a non-negative safe integer or null`);
  return value;
}

function nullableFinite(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new InputError(`${label} must be a non-negative number or null`);
  return value;
}

function common(value: JsonObject): InstrumentationEnvelopeBase {
  const version = value.version;
  if (version !== '1.0.0') throw new InputError('Unsupported instrumentation version');
  const eventId = string(value.event_id, 'event_id', 36);
  if (!UUID_V4.test(eventId)) throw new InputError('event_id must be a UUID v4');
  const origin = string(value.origin, 'origin', 64);
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(origin)) throw new InputError('origin is invalid');
  const at = string(value.at, 'at', 64);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(at) || !Number.isFinite(Date.parse(at)))
    throw new InputError('at must be an ISO-8601 timestamp');
  const runtimeId = value.runtime_id;
  if (typeof runtimeId !== 'string' || !RUNTIME_IDS.includes(runtimeId as RuntimeId))
    throw new InputError('runtime_id is unsupported');
  const sessionId = string(value.session_id, 'session_id', 36);
  if (!UUID_V4.test(sessionId)) throw new InputError('session_id must be an opaque UUID v4');
  return {
    version,
    event_id: eventId,
    origin,
    at,
    runtime_id: runtimeId as RuntimeId,
    model_id: string(value.model_id, 'model_id', 240),
    session_id: sessionId,
  };
}

export function parseInstrumentationEvent(input: unknown): InstrumentationEvent {
  const value = object(input, 'event');
  exactKeys(
    value,
    ['version', 'event_id', 'origin', 'at', 'runtime_id', 'model_id', 'session_id', 'type', 'data'],
    'event',
  );
  const base = common(value);
  const data = object(value.data, 'data');
  switch (value.type) {
    case 'session.started': {
      exactKeys(data, ['context_capacity_tokens'], 'session.started data');
      const event: SessionStartedEvent = {
        ...base,
        type: 'session.started',
        data: {
          context_capacity_tokens: nullableCount(
            data.context_capacity_tokens,
            'context_capacity_tokens',
          ),
        },
      };
      return event;
    }
    case 'request.completed': {
      exactKeys(
        data,
        [
          'prompt_tokens',
          'completion_tokens',
          'prompt_eval_duration_ns',
          'completion_eval_duration_ns',
          'context_used_tokens',
          'time_to_first_token_ms',
        ],
        'request.completed data',
      );
      const event: RequestCompletedEvent = {
        ...base,
        type: 'request.completed',
        data: {
          prompt_tokens: nullableCount(data.prompt_tokens, 'prompt_tokens'),
          completion_tokens: nullableCount(data.completion_tokens, 'completion_tokens'),
          prompt_eval_duration_ns: nullableCount(
            data.prompt_eval_duration_ns,
            'prompt_eval_duration_ns',
          ),
          completion_eval_duration_ns: nullableCount(
            data.completion_eval_duration_ns,
            'completion_eval_duration_ns',
          ),
          context_used_tokens: nullableCount(data.context_used_tokens, 'context_used_tokens'),
          time_to_first_token_ms: nullableFinite(
            data.time_to_first_token_ms,
            'time_to_first_token_ms',
          ),
        },
      };
      return event;
    }
    case 'context.compacted': {
      exactKeys(data, ['summary_context_tokens'], 'context.compacted data');
      const event: ContextCompactedEvent = {
        ...base,
        type: 'context.compacted',
        data: {
          summary_context_tokens: nullableCount(
            data.summary_context_tokens,
            'summary_context_tokens',
          ),
        },
      };
      return event;
    }
    case 'session.ended': {
      exactKeys(data, [], 'session.ended data');
      const event: SessionEndedEvent = { ...base, type: 'session.ended', data: {} };
      return event;
    }
    default:
      throw new InputError('Unsupported instrumentation event type');
  }
}

export class LoopbackInstrumentationBridge {
  private server: Server | null = null;
  private token: string | null = null;
  private endpoint: string | null = null;
  private readonly requestTimes: number[] = [];

  constructor(
    private readonly ingest: (event: InstrumentationEvent) => unknown,
    private readonly maxRequestsPerMinute = DEFAULT_RATE_LIMIT,
  ) {}

  async enable(): Promise<InstrumentationBridgeStatus> {
    if (this.server) return this.status();
    this.token = randomBytes(32).toString('base64url');
    const server = createServer((request, response) => void this.handle(request, response));
    server.requestTimeout = 10_000;
    server.headersTimeout = 5_000;
    server.keepAliveTimeout = 5_000;
    server.maxHeadersCount = 32;
    this.server = server;
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          server.off('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server.off('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(0, LOOPBACK_HOST);
      });
    } catch (error) {
      this.close();
      throw error;
    }
    const address = server.address();
    if (!address || typeof address === 'string') {
      this.close();
      throw new Error('Instrumentation bridge did not receive a loopback TCP address');
    }
    this.endpoint = `http://${LOOPBACK_HOST}:${address.port}/v1/events`;
    server.on('error', () => this.close());
    return this.status();
  }

  status(): InstrumentationBridgeStatus {
    return {
      enabled: this.server?.listening === true,
      endpoint: this.endpoint,
      authToken: this.token,
    };
  }

  async disable(): Promise<InstrumentationBridgeStatus> {
    const server = this.server;
    this.server = null;
    this.endpoint = null;
    this.token = null;
    this.requestTimes.length = 0;
    if (server)
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    return this.status();
  }

  close(): void {
    this.server?.close();
    this.server?.closeAllConnections();
    this.server = null;
    this.endpoint = null;
    this.token = null;
    this.requestTimes.length = 0;
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    response.setHeader('cache-control', 'no-store');
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('x-content-type-options', 'nosniff');
    if (!this.allowRequest()) return this.respond(response, 429, 'Rate limit exceeded');
    if (request.method !== 'POST' || request.url !== '/v1/events')
      return this.respond(response, 404, 'Not found');
    if (!this.authorized(request.headers.authorization))
      return this.respond(response, 401, 'Unauthorized');
    if (request.headers['content-type']?.split(';', 1)[0]?.trim() !== 'application/json')
      return this.respond(response, 415, 'Content-Type must be application/json');
    try {
      const body = await this.readBody(request);
      const event = parseInstrumentationEvent(JSON.parse(body) as unknown);
      this.ingest(event);
      response.statusCode = 202;
      response.end('{"accepted":true}');
    } catch (error) {
      this.respond(
        response,
        error instanceof InputError || error instanceof SyntaxError ? 400 : 409,
        error instanceof Error ? error.message : 'Event rejected',
      );
    }
  }

  private allowRequest(now = Date.now()): boolean {
    const cutoff = now - RATE_WINDOW_MS;
    while ((this.requestTimes[0] ?? now) < cutoff) this.requestTimes.shift();
    if (this.requestTimes.length >= this.maxRequestsPerMinute) return false;
    this.requestTimes.push(now);
    return true;
  }

  private authorized(header: string | undefined): boolean {
    if (!this.token || !header?.startsWith('Bearer ')) return false;
    const supplied = Buffer.from(header.slice(7));
    const expected = Buffer.from(this.token);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }

  private async readBody(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      size += buffer.length;
      if (size > MAX_BODY_BYTES) throw new InputError('Request body exceeds 16 KiB');
      chunks.push(buffer);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  private respond(response: ServerResponse, status: number, message: string): void {
    response.statusCode = status;
    response.end(JSON.stringify({ accepted: false, error: message }));
  }
}

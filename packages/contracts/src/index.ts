export type RuntimeId = 'ollama' | 'lmstudio';
export type ServerState = 'stopped' | 'external-running' | 'managed-running';
export type DataSource =
  'host' | 'owned-process' | 'runtime' | 'benchmark' | 'client-plugin' | 'local-proxy';
export type WidgetPosition = 'tray' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export interface WidgetPreferences {
  readonly position: WidgetPosition;
  readonly opacity: number;
  readonly highContrast: boolean;
}
export interface RuntimePreferences {
  readonly enabledRuntimeIds: readonly RuntimeId[];
}
export interface RuntimeCatalogEntry {
  readonly id: RuntimeId;
  readonly name: string;
  readonly enabled: boolean;
}
export interface Capabilities {
  readonly listInstalled: boolean;
  readonly listLoaded: boolean;
  readonly startServer: boolean;
  readonly stopServer: boolean;
  readonly loadModel: boolean;
  readonly unloadModel: boolean;
  readonly benchmark: boolean;
}
export interface ModelRecord {
  readonly id: string;
  readonly displayName: string;
  readonly loaded: boolean;
  readonly sizeBytes: number | null;
  readonly gpuResidentBytes: number | null;
  readonly contextCapacityTokens: number | null;
}
export interface BenchmarkRecord {
  readonly source: 'benchmark';
  readonly modelId: string;
  readonly at: string;
  readonly promptTokens: number | null;
  readonly outputTokens: number | null;
  readonly readTokensPerSecond: number | null;
  readonly writeTokensPerSecond: number | null;
  readonly timeToFirstTokenMs: number | null;
}
export interface HostSample {
  readonly sampledAt: string;
  readonly cpuUtilizationPercent: number | null;
  readonly memoryUsedBytes: number;
  readonly memoryTotalBytes: number;
  readonly memoryUsedPercent: number;
  readonly cpuLogicalCores: number;
  readonly source: 'host';
}
export interface OwnedProcessSample {
  readonly pid: number;
  readonly sampledAt: string;
  readonly cpuUtilizationPercent: number | null;
  readonly memoryResidentBytes: number | null;
  readonly source: 'owned-process';
}
export interface RuntimeSnapshot {
  readonly id: RuntimeId;
  readonly displayName: string;
  readonly state: ServerState;
  readonly capabilities: Capabilities;
  readonly installed: ModelRecord[];
  readonly loaded: ModelRecord[];
  readonly ownedProcess: OwnedProcessSample | null;
  readonly error: string | null;
  readonly observedAt: string;
}
export interface DashboardSnapshot {
  readonly selectedRuntime: RuntimeId;
  readonly runtime: RuntimeSnapshot;
  readonly host: HostSample;
  readonly latestBenchmark: BenchmarkRecord | null;
}
export interface MetricHistorySample {
  readonly sampledAt: string;
  readonly runtimeId: RuntimeId;
  readonly modelId: string | null;
  readonly hostMemoryUsedPercent: number;
  readonly gpuResidentBytes: number | null;
  readonly outputTokensPerSecond: number | null;
  readonly outputTokensSource: 'benchmark' | null;
}
export interface MetricHistoryWindow {
  readonly retentionMs: number;
  readonly sampleIntervalMs: number;
  readonly samples: readonly MetricHistorySample[];
}
export interface InstrumentationEnvelopeBase {
  readonly version: '1.0.0';
  readonly event_id: string;
  readonly origin: string;
  readonly at: string;
  readonly runtime_id: RuntimeId;
  readonly model_id: string;
  readonly session_id: string;
}
export interface SessionStartedEvent extends InstrumentationEnvelopeBase {
  readonly type: 'session.started';
  readonly data: {
    readonly context_capacity_tokens: number | null;
  };
}
export interface RequestCompletedEvent extends InstrumentationEnvelopeBase {
  readonly type: 'request.completed';
  readonly data: {
    readonly prompt_tokens: number | null;
    readonly completion_tokens: number | null;
    readonly prompt_eval_duration_ns: number | null;
    readonly completion_eval_duration_ns: number | null;
    readonly context_used_tokens: number | null;
    readonly time_to_first_token_ms: number | null;
  };
}
export interface ContextCompactedEvent extends InstrumentationEnvelopeBase {
  readonly type: 'context.compacted';
  readonly data: {
    readonly summary_context_tokens: number | null;
  };
}
export interface SessionEndedEvent extends InstrumentationEnvelopeBase {
  readonly type: 'session.ended';
  readonly data: Record<string, never>;
}
export type InstrumentationEvent =
  SessionStartedEvent | RequestCompletedEvent | ContextCompactedEvent | SessionEndedEvent;
export interface InstrumentedSession {
  readonly sessionId: string;
  readonly origin: string;
  readonly runtimeId: RuntimeId;
  readonly modelId: string;
  readonly active: boolean;
  readonly epoch: number;
  readonly contextUsedTokens: number | null;
  readonly contextCapacityTokens: number | null;
  readonly contextUsedPercent: number | null;
  readonly contextAlert: 'unavailable' | 'normal' | 'warning' | 'overflow';
  readonly readTokensPerSecond: number | null;
  readonly writeTokensPerSecond: number | null;
  readonly timeToFirstTokenMs: number | null;
  readonly lastEventAt: string;
}
export interface InstrumentedRequestSample {
  readonly sampleId: string;
  readonly sampledAt: string;
  readonly sessionId: string;
  readonly runtimeId: RuntimeId;
  readonly modelId: string;
  readonly epoch: number;
  readonly contextUsedTokens: number | null;
  readonly contextCapacityTokens: number | null;
  readonly contextUsedPercent: number | null;
  readonly readTokensPerSecond: number | null;
  readonly writeTokensPerSecond: number | null;
  readonly timeToFirstTokenMs: number | null;
}
export interface InstrumentationRequestHistory {
  readonly retentionMs: number;
  readonly maxSamples: number;
  readonly samples: readonly InstrumentedRequestSample[];
}
export interface InstrumentationSnapshot {
  readonly sessions: readonly InstrumentedSession[];
  readonly requestHistory: InstrumentationRequestHistory;
}
export interface InstrumentationBridgeStatus {
  readonly enabled: boolean;
  readonly endpoint: string | null;
  readonly authToken: string | null;
}
export interface RuntimePort {
  readonly id: RuntimeId;
  readonly displayName: string;
  readonly capabilities: Capabilities;
  ownedProcessId(): number | null;
  state(): Promise<ServerState>;
  listInstalled(): Promise<ModelRecord[]>;
  listLoaded(): Promise<ModelRecord[]>;
  startServer(): Promise<void>;
  stopServer(): Promise<void>;
  loadModel(modelId: string): Promise<void>;
  unloadModel(modelId: string): Promise<void>;
  benchmark(modelId: string): Promise<BenchmarkRecord>;
}
export interface HostMetricsPort {
  sample(): HostSample;
}
export interface ProcessMetricsPort {
  sample(pid: number): Promise<OwnedProcessSample | null>;
}
export const RUNTIME_IDS = ['ollama', 'lmstudio'] as const;

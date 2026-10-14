export type RuntimeId = 'ollama' | 'lmstudio';
export type ServerState = 'stopped' | 'external-running' | 'managed-running';
export type DataSource = 'host' | 'runtime' | 'benchmark' | 'client-plugin' | 'local-proxy';
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
export interface RuntimeSnapshot {
  readonly id: RuntimeId;
  readonly displayName: string;
  readonly state: ServerState;
  readonly capabilities: Capabilities;
  readonly installed: ModelRecord[];
  readonly loaded: ModelRecord[];
  readonly error: string | null;
  readonly observedAt: string;
}
export interface DashboardSnapshot {
  readonly selectedRuntime: RuntimeId;
  readonly runtime: RuntimeSnapshot;
  readonly host: HostSample;
  readonly latestBenchmark: BenchmarkRecord | null;
}
export interface RuntimePort {
  readonly id: RuntimeId;
  readonly displayName: string;
  readonly capabilities: Capabilities;
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
export const RUNTIME_IDS = ['ollama', 'lmstudio'] as const;

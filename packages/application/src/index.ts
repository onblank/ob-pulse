import type {
  BenchmarkRecord,
  DashboardSnapshot,
  HostMetricsPort,
  InstrumentationEvent,
  InstrumentationSnapshot,
  MetricHistorySample,
  MetricHistoryWindow,
  RuntimeId,
  RuntimeCatalogEntry,
  RuntimePort,
  RuntimeSnapshot,
} from '@obpulse/contracts';
import { InstrumentationSessionStore } from './instrumentation';

export { InstrumentationSessionStore } from './instrumentation';

export const HISTORY_RETENTION_MS = 60 * 60 * 1000;
export const HISTORY_SAMPLE_INTERVAL_MS = 3000;
const HISTORY_MAX_SAMPLES = Math.ceil(HISTORY_RETENTION_MS / HISTORY_SAMPLE_INTERVAL_MS) + 1;

export class InMemoryMetricHistory {
  private readonly samples: MetricHistorySample[] = [];
  private lastBenchmarkAt: string | null = null;

  constructor(
    private readonly retentionMs = HISTORY_RETENTION_MS,
    private readonly sampleIntervalMs = HISTORY_SAMPLE_INTERVAL_MS,
    private readonly maxSamples = HISTORY_MAX_SAMPLES,
  ) {}

  capture(snapshot: DashboardSnapshot): MetricHistorySample {
    const loaded = snapshot.runtime.loaded;
    const residentValues = loaded
      .map((model) => model.gpuResidentBytes)
      .filter((value): value is number => value != null);
    const benchmark = snapshot.latestBenchmark;
    const isNewBenchmark = benchmark != null && benchmark.at !== this.lastBenchmarkAt;
    if (isNewBenchmark) this.lastBenchmarkAt = benchmark.at;
    const sample: MetricHistorySample = {
      sampledAt: snapshot.host.sampledAt,
      runtimeId: snapshot.selectedRuntime,
      modelId: loaded[0]?.id ?? null,
      hostMemoryUsedPercent: snapshot.host.memoryUsedPercent,
      gpuResidentBytes:
        residentValues.length > 0
          ? residentValues.reduce((total, value) => total + value, 0)
          : null,
      outputTokensPerSecond: isNewBenchmark ? (benchmark.writeTokensPerSecond ?? null) : null,
      outputTokensSource: isNewBenchmark ? 'benchmark' : null,
    };
    this.samples.push(sample);
    this.prune(Date.parse(sample.sampledAt));
    return sample;
  }

  window(nowMs = Date.now()): MetricHistoryWindow {
    this.prune(nowMs);
    return {
      retentionMs: this.retentionMs,
      sampleIntervalMs: this.sampleIntervalMs,
      samples: [...this.samples],
    };
  }

  private prune(nowMs: number): void {
    const cutoff = nowMs - this.retentionMs;
    while (this.samples.length > 0) {
      const first = this.samples[0];
      if (!first || Date.parse(first.sampledAt) >= cutoff) break;
      this.samples.shift();
    }
    if (this.samples.length > this.maxSamples)
      this.samples.splice(0, this.samples.length - this.maxSamples);
  }
}

export class MonitorService {
  private selected: RuntimeId;
  private enabledRuntimeIds: ReadonlySet<RuntimeId>;
  private lastBenchmark: BenchmarkRecord | null = null;
  constructor(
    private readonly providers: ReadonlyMap<RuntimeId, RuntimePort>,
    private readonly host: HostMetricsPort,
    private readonly metricHistory = new InMemoryMetricHistory(),
    private readonly instrumentation = new InstrumentationSessionStore(),
  ) {
    this.enabledRuntimeIds = new Set(providers.keys());
    const initialRuntime = providers.has('ollama') ? 'ollama' : providers.keys().next().value;
    if (!initialRuntime) throw new Error('At least one runtime provider is required');
    this.selected = initialRuntime;
  }
  runtimes(): Array<{ id: RuntimeId; name: string }> {
    return Array.from(this.providers.values())
      .filter((provider) => this.enabledRuntimeIds.has(provider.id))
      .map((provider) => ({ id: provider.id, name: provider.displayName }));
  }
  runtimeCatalog(): RuntimeCatalogEntry[] {
    return Array.from(this.providers.values()).map((provider) => ({
      id: provider.id,
      name: provider.displayName,
      enabled: this.enabledRuntimeIds.has(provider.id),
    }));
  }
  setEnabledRuntimes(ids: readonly RuntimeId[]): void {
    if (ids.length === 0) throw new Error('At least one runtime must remain enabled');
    if (new Set(ids).size !== ids.length) throw new Error('Runtime identifiers must be unique');
    for (const id of ids) {
      if (!this.providers.has(id)) throw new Error('Unknown runtime');
    }
    this.enabledRuntimeIds = new Set(ids);
    if (!this.enabledRuntimeIds.has(this.selected)) {
      const next = ids[0];
      if (!next) throw new Error('At least one runtime must remain enabled');
      this.selected = next;
      this.lastBenchmark = null;
    }
  }
  useRuntime(id: RuntimeId): void {
    if (!this.providers.has(id)) throw new Error('Unknown runtime');
    if (!this.enabledRuntimeIds.has(id)) throw new Error('Runtime is disabled');
    this.selected = id;
    this.lastBenchmark = null;
  }
  private get provider(): RuntimePort {
    const runtime = this.providers.get(this.selected);
    if (!runtime) throw new Error('Missing runtime');
    return runtime;
  }
  async snapshot(): Promise<DashboardSnapshot> {
    const runtime = this.provider;
    let state: RuntimeSnapshot['state'] = 'stopped';
    let installed: RuntimeSnapshot['installed'] = [];
    let loaded: RuntimeSnapshot['loaded'] = [];
    let error: string | null = null;
    try {
      state = await runtime.state();
      if (state !== 'stopped') {
        [installed, loaded] = await Promise.all([runtime.listInstalled(), runtime.listLoaded()]);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    return {
      selectedRuntime: this.selected,
      host: this.host.sample(),
      latestBenchmark: this.lastBenchmark,
      runtime: {
        id: runtime.id,
        displayName: runtime.displayName,
        state,
        capabilities: runtime.capabilities,
        installed,
        loaded,
        error,
        observedAt: new Date().toISOString(),
      },
    };
  }
  async captureHistory(): Promise<MetricHistorySample> {
    return this.metricHistory.capture(await this.snapshot());
  }
  history(nowMs = Date.now()): MetricHistoryWindow {
    return this.metricHistory.window(nowMs);
  }
  ingestInstrumentation(event: InstrumentationEvent): void {
    this.instrumentation.ingest(event);
  }
  instrumentationSnapshot(): InstrumentationSnapshot {
    return this.instrumentation.snapshot();
  }
  clearInstrumentation(): void {
    this.instrumentation.clear();
  }
  async start(): Promise<void> {
    await this.provider.startServer();
  }
  async stop(): Promise<void> {
    await this.provider.stopServer();
  }
  async load(modelId: string): Promise<void> {
    await this.provider.loadModel(modelId);
  }
  async unload(modelId: string): Promise<void> {
    await this.provider.unloadModel(modelId);
  }
  async benchmark(modelId: string): Promise<BenchmarkRecord> {
    const selectedAtStart = this.selected;
    const result = await this.provider.benchmark(modelId);
    if (this.selected === selectedAtStart) this.lastBenchmark = result;
    return result;
  }
  /** On explicit quit only. Never stop an unowned external runtime. */
  async stopManagedOnQuit(): Promise<void> {
    for (const provider of this.providers.values()) {
      if ((await provider.state()) === 'managed-running') await provider.stopServer();
    }
  }
}

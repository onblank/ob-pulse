import type {
  BenchmarkRecord,
  DashboardSnapshot,
  HostMetricsPort,
  InstrumentationEvent,
  InstrumentationSnapshot,
  MetricHistorySample,
  MetricHistoryWindow,
  OwnedProcessSample,
  ProcessMetricsPort,
  RuntimeId,
  RuntimeCatalogEntry,
  RuntimePort,
  RuntimeSnapshot,
} from '@obpulse/contracts';
import { RUNTIME_IDS } from '@obpulse/contracts';
import { InstrumentationSessionStore } from './instrumentation';

export { InstrumentationSessionStore } from './instrumentation';

export const HISTORY_RETENTION_MS = 60 * 60 * 1000;
export const HISTORY_SAMPLE_INTERVAL_MS = 3000;
export const RUNTIME_POLL_TIMEOUT_MS = 2500;
const HISTORY_MAX_SAMPLES =
  (Math.ceil(HISTORY_RETENTION_MS / HISTORY_SAMPLE_INTERVAL_MS) + 1) * RUNTIME_IDS.length;

export class InMemoryMetricHistory {
  private readonly samples: MetricHistorySample[] = [];
  private readonly lastBenchmarkAt = new Map<RuntimeId, string>();

  constructor(
    private readonly retentionMs = HISTORY_RETENTION_MS,
    private readonly sampleIntervalMs = HISTORY_SAMPLE_INTERVAL_MS,
    private readonly maxSamples = HISTORY_MAX_SAMPLES,
  ) {}

  capture(snapshot: DashboardSnapshot): MetricHistorySample[] {
    const captured = snapshot.runtimes.map((runtime) => {
      const residentValues = runtime.loaded
        .map((model) => model.gpuResidentBytes)
        .filter((value): value is number => value != null);
      const benchmark = runtime.latestBenchmark;
      const isNewBenchmark =
        benchmark != null && benchmark.at !== this.lastBenchmarkAt.get(runtime.id);
      if (isNewBenchmark && benchmark) this.lastBenchmarkAt.set(runtime.id, benchmark.at);
      return {
        sampledAt: snapshot.host.sampledAt,
        runtimeId: runtime.id,
        modelId: runtime.loaded[0]?.id ?? null,
        hostMemoryUsedPercent: snapshot.host.memoryUsedPercent,
        gpuResidentBytes:
          residentValues.length > 0
            ? residentValues.reduce((total, value) => total + value, 0)
            : null,
        outputTokensPerSecond: isNewBenchmark ? (benchmark?.writeTokensPerSecond ?? null) : null,
        outputTokensSource: isNewBenchmark ? ('benchmark' as const) : null,
      } satisfies MetricHistorySample;
    });
    this.samples.push(...captured);
    this.prune(Date.parse(snapshot.host.sampledAt));
    return captured;
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
  private readonly lastBenchmarks = new Map<RuntimeId, BenchmarkRecord>();
  private snapshotInFlight: Promise<DashboardSnapshot> | null = null;
  constructor(
    private readonly providers: ReadonlyMap<RuntimeId, RuntimePort>,
    private readonly host: HostMetricsPort,
    private readonly processes: ProcessMetricsPort,
    private readonly metricHistory = new InMemoryMetricHistory(),
    private readonly instrumentation = new InstrumentationSessionStore(),
    private readonly runtimePollTimeoutMs = RUNTIME_POLL_TIMEOUT_MS,
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
    }
    this.snapshotInFlight = null;
  }
  useRuntime(id: RuntimeId): void {
    if (!this.providers.has(id)) throw new Error('Unknown runtime');
    if (!this.enabledRuntimeIds.has(id)) throw new Error('Runtime is disabled');
    this.selected = id;
    this.snapshotInFlight = null;
  }
  private providerFor(id = this.selected): RuntimePort {
    const runtime = this.providers.get(id);
    if (!runtime) throw new Error('Missing runtime');
    if (!this.enabledRuntimeIds.has(id)) throw new Error('Runtime is disabled');
    return runtime;
  }
  private async observeRuntime(runtime: RuntimePort): Promise<RuntimeSnapshot> {
    let state: RuntimeSnapshot['state'] = 'stopped';
    let installed: RuntimeSnapshot['installed'] = [];
    let loaded: RuntimeSnapshot['loaded'] = [];
    let ownedProcess: OwnedProcessSample | null = null;
    let error: string | null = null;
    const observation = (async () => {
      try {
        state = await runtime.state();
        if (state !== 'stopped') {
          try {
            [installed, loaded] = await Promise.all([
              runtime.listInstalled(),
              runtime.listLoaded(),
            ]);
          } catch (modelsError) {
            error = modelsError instanceof Error ? modelsError.message : String(modelsError);
          }
        }
        if (state === 'managed-running') {
          const pid = runtime.ownedProcessId();
          if (pid != null) {
            try {
              ownedProcess = await this.processes.sample(pid);
            } catch {
              ownedProcess = null;
            }
          }
        }
      } catch (runtimeError) {
        error = runtimeError instanceof Error ? runtimeError.message : String(runtimeError);
      }
    })();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        observation,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error(`${runtime.displayName} observation timed out`)),
            this.runtimePollTimeoutMs,
          );
        }),
      ]);
    } catch (observationError) {
      error =
        observationError instanceof Error ? observationError.message : String(observationError);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    let controlAuthority: RuntimeSnapshot['controlAuthority'] = 'observer';
    try {
      controlAuthority = runtime.controlAuthority();
    } catch (authorityError) {
      error ??= authorityError instanceof Error ? authorityError.message : String(authorityError);
    }
    return {
      id: runtime.id,
      displayName: runtime.displayName,
      state,
      controlAuthority,
      manifest: runtime.manifest,
      installed,
      loaded,
      ownedProcess,
      latestBenchmark: this.lastBenchmarks.get(runtime.id) ?? null,
      error,
      observedAt: new Date().toISOString(),
    };
  }
  snapshot(): Promise<DashboardSnapshot> {
    if (this.snapshotInFlight) return this.snapshotInFlight;
    const observation = this.collectSnapshot();
    this.snapshotInFlight = observation;
    const clear = () => {
      if (this.snapshotInFlight === observation) this.snapshotInFlight = null;
    };
    void observation.then(clear, clear);
    return observation;
  }
  private async collectSnapshot(): Promise<DashboardSnapshot> {
    const runtimes = await Promise.all(
      Array.from(this.providers.values())
        .filter((runtime) => this.enabledRuntimeIds.has(runtime.id))
        .map((runtime) => this.observeRuntime(runtime)),
    );
    const runtime = runtimes.find((entry) => entry.id === this.selected);
    if (!runtime) throw new Error('Selected runtime snapshot is unavailable');
    return {
      selectedRuntime: this.selected,
      host: this.host.sample(),
      latestBenchmark: runtime.latestBenchmark,
      runtime,
      runtimes,
    };
  }
  async captureHistory(): Promise<MetricHistorySample[]> {
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
  async start(id = this.selected): Promise<void> {
    try {
      await this.providerFor(id).startServer();
    } finally {
      this.snapshotInFlight = null;
    }
  }
  async stop(id = this.selected): Promise<void> {
    try {
      await this.providerFor(id).stopServer();
    } finally {
      this.snapshotInFlight = null;
    }
  }
  async takeControl(id = this.selected): Promise<void> {
    try {
      await this.providerFor(id).takeControl();
    } finally {
      this.snapshotInFlight = null;
    }
  }
  async releaseControl(id = this.selected): Promise<void> {
    try {
      await this.providerFor(id).releaseControl();
    } finally {
      this.snapshotInFlight = null;
    }
  }
  async load(modelId: string): Promise<void> {
    try {
      await this.providerFor().loadModel(modelId);
    } finally {
      this.snapshotInFlight = null;
    }
  }
  async unload(modelId: string): Promise<void> {
    try {
      await this.providerFor().unloadModel(modelId);
    } finally {
      this.snapshotInFlight = null;
    }
  }
  async benchmark(modelId: string): Promise<BenchmarkRecord> {
    const selectedAtStart = this.selected;
    const result = await this.providerFor().benchmark(modelId);
    if (this.selected === selectedAtStart) this.lastBenchmarks.set(selectedAtStart, result);
    this.snapshotInFlight = null;
    return result;
  }
  /** On explicit quit only. Providers must leave every external runtime untouched. */
  async shutdownOwnedOnQuit(): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this.providers.values(), (provider) => provider.shutdownOwned()),
    );
    const failures = results.flatMap((result) =>
      result.status === 'rejected' ? [result.reason] : [],
    );
    if (failures.length > 0) throw new AggregateError(failures, 'Owned runtime shutdown failed');
  }
}

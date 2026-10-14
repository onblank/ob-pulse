import type {
  BenchmarkRecord,
  DashboardSnapshot,
  HostMetricsPort,
  RuntimeId,
  RuntimePort,
  RuntimeSnapshot,
} from '@obpulse/contracts';
export class MonitorService {
  private selected: RuntimeId = 'ollama';
  private lastBenchmark: BenchmarkRecord | null = null;
  constructor(
    private readonly providers: ReadonlyMap<RuntimeId, RuntimePort>,
    private readonly host: HostMetricsPort,
  ) {}
  runtimes(): Array<{ id: RuntimeId; name: string }> {
    return Array.from(this.providers.values()).map((p) => ({ id: p.id, name: p.displayName }));
  }
  useRuntime(id: RuntimeId): void {
    if (!this.providers.has(id)) throw new Error('Unknown runtime');
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

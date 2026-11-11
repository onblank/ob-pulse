import { describe, expect, it, vi } from 'vitest';
import { InMemoryMetricHistory, MonitorService } from './index';
import type {
  BenchmarkRecord,
  Capabilities,
  DashboardSnapshot,
  HostMetricsPort,
  HostSample,
  ModelRecord,
  OwnedProcessSample,
  ProcessMetricsPort,
  RuntimePort,
  RuntimeAdapterManifest,
  RuntimeId,
  ServerState,
} from '@obpulse/contracts';

const capabilities: Capabilities = {
  listInstalled: true,
  listLoaded: true,
  startServer: true,
  stopServer: true,
  takeControl: true,
  releaseControl: true,
  loadModel: true,
  unloadModel: true,
  benchmark: true,
};
const manifest: RuntimeAdapterManifest = {
  contractVersion: '1.0.0',
  adapterVersion: 'test',
  capabilities,
  permissions: {
    networkScope: 'loopback-only',
    serverControl: 'owned-process-only',
    credentialMode: 'none',
    externalProcessTermination: false,
    modelFileDeletion: false,
    inferenceContentAccess: false,
  },
};
const hostSample: HostSample = {
  sampledAt: '2026-10-14T00:00:00Z',
  cpuUtilizationPercent: null,
  memoryUsedBytes: 200,
  memoryTotalBytes: 1000,
  memoryUsedPercent: 20,
  cpuLogicalCores: 8,
  source: 'host',
};
const processSample: OwnedProcessSample = {
  pid: 4312,
  sampledAt: '2026-10-14T00:00:00Z',
  cpuUtilizationPercent: 12.5,
  memoryResidentBytes: 128 * 1024 * 1024,
  source: 'owned-process',
};
const host: HostMetricsPort = { sample: () => hostSample };
const processes: ProcessMetricsPort = {
  sample: async (pid) => (pid === processSample.pid ? processSample : null),
};
const model: ModelRecord = {
  id: 'test:small',
  displayName: 'test:small',
  loaded: true,
  sizeBytes: 10,
  gpuResidentBytes: null,
  contextCapacityTokens: null,
};
const benchmark: BenchmarkRecord = {
  source: 'benchmark',
  modelId: model.id,
  at: '2026-10-14T00:00:00Z',
  promptTokens: 12,
  outputTokens: 6,
  readTokensPerSecond: 42,
  writeTokensPerSecond: 16,
  timeToFirstTokenMs: 80,
};
function stubRuntime(
  id: RuntimeId,
  state: ServerState,
  ownedProcessId: number | null = null,
): RuntimePort {
  return {
    id,
    displayName: id,
    manifest,
    controlAuthority: () => (ownedProcessId == null ? 'observer' : 'process-owned'),
    ownedProcessId: () => ownedProcessId,
    state: async () => state,
    listInstalled: async () => [model],
    listLoaded: async () => [model],
    startServer: async () => undefined,
    stopServer: async () => undefined,
    takeControl: async () => undefined,
    releaseControl: async () => undefined,
    shutdownOwned: async () => undefined,
    loadModel: async () => undefined,
    unloadModel: async () => undefined,
    benchmark: async () => benchmark,
  };
}

describe('runtime monitoring', () => {
  it('does not make fabricated CPU readings or model activity claims', async () => {
    const service = new MonitorService(
      new Map<RuntimeId, RuntimePort>([['ollama', stubRuntime('ollama', 'stopped')]]),
      host,
      processes,
    );
    const snapshot = await service.snapshot();
    expect(snapshot.host.cpuUtilizationPercent).toBeNull();
    expect(snapshot.runtime.state).toBe('stopped');
    expect(snapshot.runtime.manifest).toBe(manifest);
    expect(snapshot.runtime.loaded).toHaveLength(0);
    expect(snapshot.latestBenchmark).toBeNull();
    expect(snapshot.runtime.ownedProcess).toBeNull();
    expect(snapshot.runtimes).toEqual([snapshot.runtime]);
  });
  it('attributes process metrics only to a managed runtime with an owned PID', async () => {
    const managed = new MonitorService(
      new Map<RuntimeId, RuntimePort>([
        ['ollama', stubRuntime('ollama', 'managed-running', processSample.pid)],
      ]),
      host,
      processes,
    );
    expect((await managed.snapshot()).runtime.ownedProcess).toEqual(processSample);

    const external = new MonitorService(
      new Map<RuntimeId, RuntimePort>([
        ['ollama', stubRuntime('ollama', 'external-running', processSample.pid)],
      ]),
      host,
      processes,
    );
    expect((await external.snapshot()).runtime.ownedProcess).toBeNull();
  });
  it('keeps each runtime benchmark isolated across selection changes', async () => {
    const providers = new Map<RuntimeId, RuntimePort>([
      ['ollama', stubRuntime('ollama', 'external-running')],
      ['lmstudio', stubRuntime('lmstudio', 'external-running')],
    ]);
    const service = new MonitorService(providers, host, processes);
    await service.benchmark(model.id);
    expect((await service.snapshot()).latestBenchmark?.readTokensPerSecond).toBe(42);
    service.useRuntime('lmstudio');
    expect((await service.snapshot()).latestBenchmark).toBeNull();
    service.useRuntime('ollama');
    expect((await service.snapshot()).latestBenchmark?.readTokensPerSecond).toBe(42);
  });
  it('reports runtime discovery without requiring a hard-coded UI model list', () => {
    const service = new MonitorService(
      new Map<RuntimeId, RuntimePort>([['ollama', stubRuntime('ollama', 'stopped')]]),
      host,
      processes,
    );
    expect(service.runtimes()).toEqual([{ id: 'ollama', name: 'ollama' }]);
  });
  it('keeps at least one runtime enabled and rejects unknown adapters', () => {
    const service = new MonitorService(
      new Map<RuntimeId, RuntimePort>([
        ['ollama', stubRuntime('ollama', 'stopped')],
        ['lmstudio', stubRuntime('lmstudio', 'stopped')],
      ]),
      host,
      processes,
    );
    expect(() => service.setEnabledRuntimes([])).toThrow(
      'At least one runtime must remain enabled',
    );
    expect(() => service.setEnabledRuntimes(['ollama', 'unknown' as RuntimeId])).toThrow(
      'Unknown runtime',
    );
  });
  it('switches away from a disabled selection and exposes only enabled runtimes', async () => {
    const service = new MonitorService(
      new Map<RuntimeId, RuntimePort>([
        ['ollama', stubRuntime('ollama', 'stopped')],
        ['lmstudio', stubRuntime('lmstudio', 'external-running')],
      ]),
      host,
      processes,
    );
    service.setEnabledRuntimes(['lmstudio']);
    expect(service.runtimes()).toEqual([{ id: 'lmstudio', name: 'lmstudio' }]);
    expect(service.runtimeCatalog()).toEqual([
      { id: 'ollama', name: 'ollama', enabled: false },
      { id: 'lmstudio', name: 'lmstudio', enabled: true },
    ]);
    expect((await service.snapshot()).selectedRuntime).toBe('lmstudio');
    expect((await service.snapshot()).runtimes.map((runtime) => runtime.id)).toEqual(['lmstudio']);
    expect(() => service.useRuntime('ollama')).toThrow('Runtime is disabled');
    await expect(service.start('ollama')).rejects.toThrow('Runtime is disabled');
  });

  it('observes enabled runtimes together and isolates adapter failures', async () => {
    const broken = stubRuntime('lmstudio', 'external-running');
    broken.state = async () => {
      throw new Error('provider unavailable');
    };
    const service = new MonitorService(
      new Map<RuntimeId, RuntimePort>([
        ['ollama', stubRuntime('ollama', 'managed-running', processSample.pid)],
        ['lmstudio', broken],
      ]),
      host,
      processes,
    );

    const snapshot = await service.snapshot();

    expect(snapshot.runtimes).toHaveLength(2);
    expect(snapshot.runtimes.find((runtime) => runtime.id === 'ollama')).toMatchObject({
      state: 'managed-running',
      ownedProcess: processSample,
      error: null,
    });
    expect(snapshot.runtimes.find((runtime) => runtime.id === 'lmstudio')).toMatchObject({
      state: 'stopped',
      error: 'provider unavailable',
    });
  });

  it('bounds a stalled adapter without losing responsive runtime observations', async () => {
    const stalled = stubRuntime('lmstudio', 'external-running');
    stalled.state = () => new Promise<ServerState>(() => undefined);
    const service = new MonitorService(
      new Map<RuntimeId, RuntimePort>([
        ['ollama', stubRuntime('ollama', 'external-running')],
        ['lmstudio', stalled],
      ]),
      host,
      processes,
      undefined,
      undefined,
      5,
    );

    const snapshot = await service.snapshot();

    expect(snapshot.runtimes.find((runtime) => runtime.id === 'ollama')?.loaded).toHaveLength(1);
    expect(snapshot.runtimes.find((runtime) => runtime.id === 'lmstudio')?.error).toBe(
      'lmstudio observation timed out',
    );
  });

  it('shares an in-flight multi-runtime poll between concurrent consumers', async () => {
    const ollama = stubRuntime('ollama', 'external-running');
    const state = vi.spyOn(ollama, 'state');
    const service = new MonitorService(
      new Map<RuntimeId, RuntimePort>([['ollama', ollama]]),
      host,
      processes,
    );

    const [first, second] = await Promise.all([service.snapshot(), service.snapshot()]);

    expect(first).toBe(second);
    expect(state).toHaveBeenCalledTimes(1);
  });

  it('asks every provider to release only its owned resources on quit', async () => {
    const released: RuntimeId[] = [];
    const ollama = stubRuntime('ollama', 'external-running');
    const lmstudio = stubRuntime('lmstudio', 'stopped');
    ollama.shutdownOwned = async () => {
      released.push('ollama');
    };
    lmstudio.shutdownOwned = async () => {
      released.push('lmstudio');
    };
    const service = new MonitorService(
      new Map<RuntimeId, RuntimePort>([
        ['ollama', ollama],
        ['lmstudio', lmstudio],
      ]),
      host,
      processes,
    );

    await service.shutdownOwnedOnQuit();

    expect(released).toEqual(['ollama', 'lmstudio']);
  });
});

function dashboardAt(
  sampledAt: string,
  latestBenchmark: BenchmarkRecord | null = null,
): DashboardSnapshot {
  const runtime = {
    id: 'ollama' as const,
    displayName: 'Ollama',
    state: 'managed-running' as const,
    controlAuthority: 'process-owned' as const,
    manifest,
    installed: [model],
    loaded: [{ ...model, gpuResidentBytes: 12 }],
    error: null,
    ownedProcess: processSample,
    latestBenchmark,
    observedAt: sampledAt,
  };
  return {
    selectedRuntime: 'ollama',
    host: { ...hostSample, sampledAt },
    latestBenchmark,
    runtime,
    runtimes: [runtime],
  };
}

describe('one-hour in-memory metric history', () => {
  it('evicts expired and excess samples without persistence', () => {
    const history = new InMemoryMetricHistory(60_000, 3000, 2);
    history.capture(dashboardAt('2026-10-14T00:00:00.000Z'));
    history.capture(dashboardAt('2026-10-14T00:00:30.000Z'));
    history.capture(dashboardAt('2026-10-14T00:01:01.000Z'));
    const samples = history.window(Date.parse('2026-10-14T00:01:01.000Z')).samples;
    expect(samples.map((sample) => sample.sampledAt)).toEqual([
      '2026-10-14T00:00:30.000Z',
      '2026-10-14T00:01:01.000Z',
    ]);
  });

  it('records benchmark throughput once and preserves unavailable gaps', () => {
    const history = new InMemoryMetricHistory();
    history.capture(dashboardAt('2026-10-14T00:00:00.000Z', benchmark));
    history.capture(dashboardAt('2026-10-14T00:00:03.000Z', benchmark));
    const samples = history.window(Date.parse('2026-10-14T00:00:03.000Z')).samples;
    expect(samples[0]).toMatchObject({
      gpuResidentBytes: 12,
      outputTokensPerSecond: 16,
      outputTokensSource: 'benchmark',
    });
    expect(samples[1]).toMatchObject({
      outputTokensPerSecond: null,
      outputTokensSource: null,
    });
  });

  it('records one isolated sample per observed runtime', () => {
    const history = new InMemoryMetricHistory();
    const dashboard = dashboardAt('2026-10-14T00:00:00.000Z');
    const lmstudio = {
      ...dashboard.runtime,
      id: 'lmstudio' as const,
      displayName: 'LM Studio',
      loaded: [],
      latestBenchmark: null,
    };

    history.capture({ ...dashboard, runtimes: [dashboard.runtime, lmstudio] });

    expect(history.window(Date.parse(dashboard.host.sampledAt)).samples).toMatchObject([
      { runtimeId: 'ollama', modelId: model.id },
      { runtimeId: 'lmstudio', modelId: null },
    ]);
  });
});

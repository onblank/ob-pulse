import { describe, expect, it } from 'vitest';
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
  RuntimeId,
  ServerState,
} from '@obpulse/contracts';

const capabilities: Capabilities = {
  listInstalled: true,
  listLoaded: true,
  startServer: true,
  stopServer: true,
  loadModel: true,
  unloadModel: true,
  benchmark: true,
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
  id: 'ollama' | 'lmstudio',
  state: ServerState,
  ownedProcessId: number | null = null,
): RuntimePort {
  return {
    id,
    displayName: id,
    capabilities,
    ownedProcessId: () => ownedProcessId,
    state: async () => state,
    listInstalled: async () => [model],
    listLoaded: async () => [model],
    startServer: async () => undefined,
    stopServer: async () => undefined,
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
    expect(snapshot.runtime.loaded).toHaveLength(0);
    expect(snapshot.latestBenchmark).toBeNull();
    expect(snapshot.runtime.ownedProcess).toBeNull();
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
  it('clears last benchmark on runtime switch to avoid false attribution', async () => {
    const providers = new Map<RuntimeId, RuntimePort>([
      ['ollama', stubRuntime('ollama', 'external-running')],
      ['lmstudio', stubRuntime('lmstudio', 'external-running')],
    ]);
    const service = new MonitorService(providers, host, processes);
    await service.benchmark(model.id);
    expect((await service.snapshot()).latestBenchmark?.readTokensPerSecond).toBe(42);
    service.useRuntime('lmstudio');
    expect((await service.snapshot()).latestBenchmark).toBeNull();
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
    expect(() => service.useRuntime('ollama')).toThrow('Runtime is disabled');
  });
});

function dashboardAt(
  sampledAt: string,
  latestBenchmark: BenchmarkRecord | null = null,
): DashboardSnapshot {
  return {
    selectedRuntime: 'ollama',
    host: { ...hostSample, sampledAt },
    latestBenchmark,
    runtime: {
      id: 'ollama',
      displayName: 'Ollama',
      state: 'managed-running',
      capabilities,
      installed: [model],
      loaded: [{ ...model, gpuResidentBytes: 12 }],
      error: null,
      ownedProcess: processSample,
      observedAt: sampledAt,
    },
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
});

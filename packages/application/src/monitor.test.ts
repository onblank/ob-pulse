import { describe, expect, it } from 'vitest';
import { InMemoryMetricHistory, MonitorService } from './index';
import type {
  BenchmarkRecord,
  Capabilities,
  DashboardSnapshot,
  HostMetricsPort,
  HostSample,
  ModelRecord,
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
const host: HostMetricsPort = { sample: () => hostSample };
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
};
function stubRuntime(id: 'ollama' | 'lmstudio', state: ServerState): RuntimePort {
  return {
    id,
    displayName: id,
    capabilities,
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
    );
    const snapshot = await service.snapshot();
    expect(snapshot.host.cpuUtilizationPercent).toBeNull();
    expect(snapshot.runtime.state).toBe('stopped');
    expect(snapshot.runtime.loaded).toHaveLength(0);
    expect(snapshot.latestBenchmark).toBeNull();
  });
  it('clears last benchmark on runtime switch to avoid false attribution', async () => {
    const providers = new Map<RuntimeId, RuntimePort>([
      ['ollama', stubRuntime('ollama', 'external-running')],
      ['lmstudio', stubRuntime('lmstudio', 'external-running')],
    ]);
    const service = new MonitorService(providers, host);
    await service.benchmark(model.id);
    expect((await service.snapshot()).latestBenchmark?.readTokensPerSecond).toBe(42);
    service.useRuntime('lmstudio');
    expect((await service.snapshot()).latestBenchmark).toBeNull();
  });
  it('reports runtime discovery without requiring a hard-coded UI model list', () => {
    const service = new MonitorService(
      new Map<RuntimeId, RuntimePort>([['ollama', stubRuntime('ollama', 'stopped')]]),
      host,
    );
    expect(service.runtimes()).toEqual([{ id: 'ollama', name: 'ollama' }]);
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

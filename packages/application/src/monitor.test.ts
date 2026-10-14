import { describe, expect, it } from 'vitest';
import { MonitorService } from './index';
import type {
  BenchmarkRecord,
  Capabilities,
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

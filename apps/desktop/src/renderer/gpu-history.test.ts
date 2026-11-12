import { describe, expect, it } from 'vitest';
import type { GpuSample, MetricHistorySample } from '@obpulse/contracts';
import { recentGpuDevices } from './gpu-history';

const gpu: GpuSample = {
  index: 0,
  name: 'RTX 4090',
  utilizationPercent: 42,
  memoryUsedBytes: 1024,
  memoryTotalBytes: 2048,
  source: 'nvidia-smi',
};
const sample: MetricHistorySample = {
  sampledAt: '2026-10-14T00:00:00.000Z',
  runtimeId: 'ollama',
  modelId: null,
  hostMemoryUsedPercent: 50,
  hostGpus: [gpu],
  gpuResidentBytes: null,
  outputTokensPerSecond: null,
  outputTokensSource: null,
};

describe('GPU history device visibility', () => {
  it('retains a disconnected device while samples remain in the rolling window', () => {
    expect(recentGpuDevices([], [sample])).toEqual([gpu]);
    expect(recentGpuDevices([], [])).toEqual([]);
  });

  it('uses the current device reading when the device reconnects', () => {
    const current = { ...gpu, utilizationPercent: 7 };
    expect(recentGpuDevices([current], [sample])).toEqual([current]);
  });
});

import { describe, expect, it } from 'vitest';
import { parseAmdGpuSample, parseNvidiaGpuCsv } from './index';

describe('NVIDIA host GPU readings', () => {
  it('keeps devices separate and treats unavailable utilization as unknown', () => {
    expect(
      parseNvidiaGpuCsv('RTX 4090, 35, 1024, 24576\nRTX 3090, [Not Supported], 0, 24576'),
    ).toEqual([
      {
        index: 0,
        name: 'RTX 4090',
        utilizationPercent: 35,
        memoryUsedBytes: 1073741824,
        memoryTotalBytes: 25769803776,
        source: 'nvidia-smi',
      },
      {
        index: 1,
        name: 'RTX 3090',
        utilizationPercent: null,
        memoryUsedBytes: 0,
        memoryTotalBytes: 25769803776,
        source: 'nvidia-smi',
      },
    ]);
  });

  it('rejects invalid memory reports', () => {
    expect(parseNvidiaGpuCsv('RTX 4090, 30, 999, 100')).toEqual([]);
  });
});

describe('AMD Linux GPU readings', () => {
  it('accepts byte values and preserves unknown utilization', () => {
    expect(parseAmdGpuSample(2, null, '1024\n', '2048\n')).toEqual({
      index: 2,
      name: 'AMD GPU (card2)',
      utilizationPercent: null,
      memoryUsedBytes: 1024,
      memoryTotalBytes: 2048,
      source: 'amdgpu-sysfs',
    });
  });
  it('rejects invalid VRAM and utilization readings', () => {
    expect(parseAmdGpuSample(0, '101', '1', '2')?.utilizationPercent).toBeNull();
    expect(parseAmdGpuSample(0, '50', '3', '2')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { parseNvidiaGpuCsv } from './index';

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

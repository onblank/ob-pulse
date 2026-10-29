import { describe, expect, it } from 'vitest';
import {
  calculateWindowsCpuUtilization,
  NodeProcessMetrics,
  parsePsProcessSample,
  parseWindowsProcessReading,
} from './index';

describe('owned process metrics', () => {
  it('parses core-equivalent CPU percent and resident KiB from ps', () => {
    expect(parsePsProcessSample('  125.5  2048\n', 4312, '2026-10-26T20:00:00.000Z')).toEqual({
      pid: 4312,
      sampledAt: '2026-10-26T20:00:00.000Z',
      cpuUtilizationPercent: 125.5,
      memoryResidentBytes: 2 * 1024 * 1024,
      source: 'owned-process',
    });
  });

  it('rejects malformed, negative and extra process rows', () => {
    expect(parsePsProcessSample('', 1, '2026-10-26T20:00:00.000Z')).toBeNull();
    expect(parsePsProcessSample('-1 20', 1, '2026-10-26T20:00:00.000Z')).toBeNull();
    expect(parsePsProcessSample('1 20\n2 30', 1, '2026-10-26T20:00:00.000Z')).toBeNull();
  });

  it('parses Windows process identity, cumulative CPU ticks and resident bytes', () => {
    expect(parseWindowsProcessReading('638971200000000000|12500000|67108864')).toEqual({
      startedAt100ns: 638971200000000000n,
      totalProcessorTime100ns: 12500000n,
      memoryResidentBytes: 64 * 1024 * 1024,
    });
  });

  it('rejects malformed or unsafe Windows readings', () => {
    expect(parseWindowsProcessReading('')).toBeNull();
    expect(parseWindowsProcessReading('1|-1|20')).toBeNull();
    expect(parseWindowsProcessReading('1|2|9007199254740992')).toBeNull();
    expect(parseWindowsProcessReading('1|2|3\n4|5|6')).toBeNull();
  });

  it('derives core-equivalent Windows CPU only for the same process identity', () => {
    const previous = {
      startedAt100ns: 100n,
      totalProcessorTime100ns: 10_000_000n,
      memoryResidentBytes: 100,
    };
    expect(
      calculateWindowsCpuUtilization(
        previous,
        { ...previous, totalProcessorTime100ns: 15_000_000n },
        1_000,
      ),
    ).toBe(50);
    expect(
      calculateWindowsCpuUtilization(
        previous,
        { ...previous, totalProcessorTime100ns: 30_000_000n },
        1_000,
      ),
    ).toBe(200);
    expect(
      calculateWindowsCpuUtilization(
        previous,
        { ...previous, startedAt100ns: 101n, totalProcessorTime100ns: 15_000_000n },
        1_000,
      ),
    ).toBeNull();
  });

  it('samples only an explicitly supplied live PID on supported platforms', async () => {
    const sample = await new NodeProcessMetrics().sample(process.pid);
    if (
      process.platform === 'darwin' ||
      process.platform === 'linux' ||
      process.platform === 'win32'
    ) {
      expect(sample).toMatchObject({ pid: process.pid, source: 'owned-process' });
      expect(sample?.memoryResidentBytes).toBeGreaterThan(0);
    } else {
      expect(sample).toBeNull();
    }
  });
});

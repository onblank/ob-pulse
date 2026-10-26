import { describe, expect, it } from 'vitest';
import { NodeProcessMetrics, parsePsProcessSample } from './index';

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

  it('samples only an explicitly supplied live PID where ps is supported', async () => {
    const sample = await new NodeProcessMetrics().sample(process.pid);
    if (process.platform === 'darwin' || process.platform === 'linux') {
      expect(sample).toMatchObject({ pid: process.pid, source: 'owned-process' });
      expect(sample?.memoryResidentBytes).toBeGreaterThan(0);
    } else {
      expect(sample).toBeNull();
    }
  });
});

import os from 'node:os';
import type { HostMetricsPort, HostSample } from '@obpulse/contracts';
import { percent } from '@obpulse/domain';
interface CpuTicks {
  idle: number;
  total: number;
}
function readTicks(): CpuTicks {
  const entries = os.cpus();
  let idle = 0,
    total = 0;
  for (const entry of entries) {
    idle += entry.times.idle;
    total += Object.values(entry.times).reduce((a, b) => a + b, 0);
  }
  return { idle, total };
}
export class NodeHostMetrics implements HostMetricsPort {
  private prior: CpuTicks | null = null;
  sample(): HostSample {
    const now = readTicks();
    const previous = this.prior;
    this.prior = now;
    const totalDelta = previous ? now.total - previous.total : 0;
    const idleDelta = previous ? now.idle - previous.idle : 0;
    const cpu = totalDelta > 0 ? percent(totalDelta - idleDelta, totalDelta) : null;
    const total = os.totalmem();
    const used = Math.max(0, total - os.freemem());
    return {
      sampledAt: new Date().toISOString(),
      cpuUtilizationPercent: cpu,
      memoryUsedBytes: used,
      memoryTotalBytes: total,
      memoryUsedPercent: percent(used, total) ?? 0,
      cpuLogicalCores: os.cpus().length,
      source: 'host',
    };
  }
}

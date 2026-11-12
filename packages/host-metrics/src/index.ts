import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GpuSample, HostMetricsPort, HostSample } from '@obpulse/contracts';
import { percent } from '@obpulse/domain';
const execFileAsync = promisify(execFile);
const MIB = 1024 * 1024;
function number(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
export function parseNvidiaGpuCsv(output: string): GpuSample[] {
  return output
    .trim()
    .split(/\r?\n/)
    .flatMap((line, index) => {
      const fields = line.split(',').map((field) => field.trim());
      if (fields.length !== 4 || !fields[0]) return [];
      const total = number(fields[3]);
      const used = number(fields[2]);
      if (total === null || total <= 0 || used === null || used > total) return [];
      return [
        {
          index,
          name: fields[0],
          utilizationPercent: number(fields[1]),
          memoryUsedBytes: used * MIB,
          memoryTotalBytes: total * MIB,
          source: 'nvidia-smi' as const,
        },
      ];
    });
}
async function readGpus(): Promise<GpuSample[]> {
  try {
    const { stdout } = await execFileAsync(
      'nvidia-smi',
      [
        '--query-gpu=name,utilization.gpu,memory.used,memory.total',
        '--format=csv,noheader,nounits',
      ],
      { timeout: 1200, maxBuffer: 32 * 1024, windowsHide: true },
    );
    return parseNvidiaGpuCsv(stdout);
  } catch {
    return [];
  }
}
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
  async sample(): Promise<HostSample> {
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
      gpus: await readGpus(),
      source: 'host',
    };
  }
}

import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, realpath } from 'node:fs/promises';
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
  const nvidia = await readNvidiaGpus();
  const amd = await readAmdGpus();
  return [...nvidia, ...amd.map((gpu, offset) => ({ ...gpu, index: nvidia.length + offset }))];
}
async function readNvidiaGpus(): Promise<GpuSample[]> {
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
export function parseAmdGpuSample(
  index: number,
  busy: string | null,
  usedText: string,
  totalText: string,
): GpuSample | null {
  const used = number(usedText);
  const total = number(totalText);
  if (used === null || total === null || total <= 0 || used > total) return null;
  const utilization = busy === null ? null : number(busy);
  return {
    index,
    name: `AMD GPU (card${index})`,
    utilizationPercent: utilization !== null && utilization <= 100 ? utilization : null,
    memoryUsedBytes: used,
    memoryTotalBytes: total,
    source: 'amdgpu-sysfs',
  };
}
async function readAmdGpus(): Promise<GpuSample[]> {
  if (process.platform !== 'linux') return [];
  let cards: string[];
  try {
    cards = (await readdir('/sys/class/drm')).filter((entry) => /^card\d+$/.test(entry));
  } catch {
    return [];
  }
  const results = await Promise.all(
    cards.map(async (card) => {
      const base = `/sys/class/drm/${card}/device`;
      try {
        const driver = await realpath(`${base}/driver`);
        if (!driver.endsWith('/amdgpu')) return null;
        const [used, total, busy] = await Promise.all([
          readFile(`${base}/mem_info_vram_used`, 'utf8'),
          readFile(`${base}/mem_info_vram_total`, 'utf8'),
          readFile(`${base}/gpu_busy_percent`, 'utf8').catch(() => null),
        ]);
        return parseAmdGpuSample(Number(card.slice(4)), busy, used, total);
      } catch {
        return null;
      }
    }),
  );
  return results.filter((sample): sample is GpuSample => sample !== null);
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

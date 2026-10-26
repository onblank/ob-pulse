import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { OwnedProcessSample, ProcessMetricsPort } from '@obpulse/contracts';

const execFileAsync = promisify(execFile);

export function parsePsProcessSample(
  stdout: string,
  pid: number,
  sampledAt: string,
): OwnedProcessSample | null {
  const rows = stdout
    .trim()
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  if (rows.length !== 1) return null;
  const fields = rows[0]?.split(/\s+/) ?? [];
  if (fields.length !== 2) return null;
  const cpu = Number(fields[0]);
  const residentKiB = Number(fields[1]);
  if (
    !Number.isFinite(cpu) ||
    cpu < 0 ||
    !Number.isSafeInteger(residentKiB) ||
    residentKiB < 0 ||
    residentKiB > Number.MAX_SAFE_INTEGER / 1024
  )
    return null;
  return {
    pid,
    sampledAt,
    cpuUtilizationPercent: cpu,
    memoryResidentBytes: residentKiB * 1024,
    source: 'owned-process',
  };
}

export class NodeProcessMetrics implements ProcessMetricsPort {
  async sample(pid: number): Promise<OwnedProcessSample | null> {
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid owned process ID');
    if (process.platform !== 'darwin' && process.platform !== 'linux') return null;
    try {
      const sampledAt = new Date().toISOString();
      const { stdout } = await execFileAsync('/bin/ps', ['-o', '%cpu=,rss=', '-p', String(pid)], {
        encoding: 'utf8',
        timeout: 1500,
        maxBuffer: 4096,
        env: { LC_ALL: 'C' },
      });
      return parsePsProcessSample(String(stdout), pid, sampledAt);
    } catch {
      return null;
    }
  }
}

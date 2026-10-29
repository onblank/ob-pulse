import { execFile } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { win32 } from 'node:path';
import { promisify } from 'node:util';
import type { OwnedProcessSample, ProcessMetricsPort } from '@obpulse/contracts';

const execFileAsync = promisify(execFile);
const WINDOWS_TICKS_PER_MILLISECOND = 10_000;
const WINDOWS_PROCESS_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  '$ownedProcessId=[int]$env:OBPULSE_OWNED_PID',
  '$ownedProcess=[System.Diagnostics.Process]::GetProcessById($ownedProcessId)',
  '$ownedProcess.Refresh()',
  "$values=[string]::Join('|', @($ownedProcess.StartTime.ToUniversalTime().Ticks, $ownedProcess.TotalProcessorTime.Ticks, $ownedProcess.WorkingSet64))",
  '[Console]::Out.Write($values)',
].join(';');

export interface WindowsProcessReading {
  startedAt100ns: bigint;
  totalProcessorTime100ns: bigint;
  memoryResidentBytes: number;
}

interface PreviousWindowsReading {
  pid: number;
  observedAtMonotonicMs: number;
  reading: WindowsProcessReading;
}

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

export function parseWindowsProcessReading(stdout: string): WindowsProcessReading | null {
  const rows = stdout
    .trim()
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  if (rows.length !== 1) return null;
  const fields = rows[0]?.split('|') ?? [];
  if (fields.length !== 3 || fields.some((field) => !/^\d+$/.test(field))) return null;
  try {
    const startedAt100ns = BigInt(fields[0] ?? '');
    const totalProcessorTime100ns = BigInt(fields[1] ?? '');
    const memoryResidentBytes = Number(fields[2]);
    if (
      startedAt100ns <= 0n ||
      totalProcessorTime100ns < 0n ||
      !Number.isSafeInteger(memoryResidentBytes) ||
      memoryResidentBytes < 0
    )
      return null;
    return { startedAt100ns, totalProcessorTime100ns, memoryResidentBytes };
  } catch {
    return null;
  }
}

export function calculateWindowsCpuUtilization(
  previous: WindowsProcessReading,
  current: WindowsProcessReading,
  elapsedMilliseconds: number,
): number | null {
  if (
    previous.startedAt100ns !== current.startedAt100ns ||
    current.totalProcessorTime100ns < previous.totalProcessorTime100ns ||
    !Number.isFinite(elapsedMilliseconds) ||
    elapsedMilliseconds <= 0
  )
    return null;
  const delta100ns = current.totalProcessorTime100ns - previous.totalProcessorTime100ns;
  if (delta100ns > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const utilization =
    (Number(delta100ns) / (elapsedMilliseconds * WINDOWS_TICKS_PER_MILLISECOND)) * 100;
  return Number.isFinite(utilization) && utilization >= 0 ? utilization : null;
}

function windowsPowerShellPath(): string | null {
  const systemRoot = process.env.SystemRoot ?? process.env.WINDIR ?? 'C:\\Windows';
  if (!/^[A-Za-z]:\\/.test(systemRoot) || /[\r\n]/.test(systemRoot)) return null;
  return win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

export class NodeProcessMetrics implements ProcessMetricsPort {
  private previousWindowsReading: PreviousWindowsReading | null = null;

  async sample(pid: number): Promise<OwnedProcessSample | null> {
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid owned process ID');
    if (process.platform === 'win32') return this.sampleWindows(pid);
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

  private async sampleWindows(pid: number): Promise<OwnedProcessSample | null> {
    const executable = windowsPowerShellPath();
    if (!executable) return null;
    try {
      const systemRoot = process.env.SystemRoot ?? process.env.WINDIR ?? 'C:\\Windows';
      const { stdout } = await execFileAsync(
        executable,
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', WINDOWS_PROCESS_SCRIPT],
        {
          encoding: 'utf8',
          timeout: 1500,
          maxBuffer: 4096,
          windowsHide: true,
          env: {
            SystemRoot: systemRoot,
            WINDIR: systemRoot,
            OBPULSE_OWNED_PID: String(pid),
          },
        },
      );
      const reading = parseWindowsProcessReading(String(stdout));
      if (!reading) {
        this.previousWindowsReading = null;
        return null;
      }
      const observedAtMonotonicMs = performance.now();
      const previous = this.previousWindowsReading;
      const cpuUtilizationPercent =
        previous?.pid === pid
          ? calculateWindowsCpuUtilization(
              previous.reading,
              reading,
              observedAtMonotonicMs - previous.observedAtMonotonicMs,
            )
          : null;
      this.previousWindowsReading = { pid, observedAtMonotonicMs, reading };
      return {
        pid,
        sampledAt: new Date().toISOString(),
        cpuUtilizationPercent,
        memoryResidentBytes: reading.memoryResidentBytes,
        source: 'owned-process',
      };
    } catch {
      this.previousWindowsReading = null;
      return null;
    }
  }
}

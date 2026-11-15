import { execFile } from 'node:child_process';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const WINDOWS_PORT_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  '$port=[int]$env:OBPULSE_PORT',
  'Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { [Console]::Out.WriteLine($_) }',
].join(';');
const WINDOWS_PROCESS_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  '$id=[int]$env:OBPULSE_PID',
  '$p=Get-CimInstance Win32_Process -Filter "ProcessId = $id"',
  'if ($null -eq $p) { exit 3 }',
  '[Console]::Out.WriteLine("$($p.CreationDate.ToUniversalTime().Ticks)|$($p.ExecutablePath)|$($p.ParentProcessId)")',
].join(';');
const WINDOWS_TREE_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  '$target=[int]$env:OBPULSE_PID',
  '$all=@(Get-CimInstance Win32_Process)',
  '$current=$all | Where-Object { $_.ProcessId -eq $target } | Select-Object -First 1',
  'if($null -eq $current -or [string]$current.CreationDate.ToUniversalTime().Ticks -ne $env:OBPULSE_CREATED_AT){ throw "Runtime process identity changed" }',
  '$byParent=@{}; foreach($p in $all){ $key=[string]$p.ParentProcessId; if(-not $byParent.ContainsKey($key)){ $byParent[$key]=@() }; $byParent[$key]+=$p }',
  '$root=$target; $cursor=$all | Where-Object { $_.ProcessId -eq $target } | Select-Object -First 1',
  'while($null -ne $cursor -and $cursor.ParentProcessId -gt 1){ $parent=$all | Where-Object { $_.ProcessId -eq $cursor.ParentProcessId } | Select-Object -First 1; if($null -eq $parent){ break }; if($parent.ExecutablePath -match $env:OBPULSE_APP_PATTERN){ $root=[int]$parent.ProcessId }; $cursor=$parent }',
  '$ids=New-Object System.Collections.Generic.List[int]; $queue=New-Object System.Collections.Queue; $queue.Enqueue($root)',
  'while($queue.Count -gt 0){ $id=[int]$queue.Dequeue(); if($ids.Contains($id)){ continue }; $ids.Add($id); foreach($child in $byParent[[string]$id]){ $queue.Enqueue([int]$child.ProcessId) } }',
  'foreach($id in $ids){ Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }',
].join(';');

function powershell(): string {
  const root = process.env.SystemRoot ?? process.env.WINDIR ?? 'C:\\Windows';
  if (!/^[A-Za-z]:\\/.test(root) || /[\r\n]/.test(root))
    throw new Error('Invalid Windows system path');
  return `${root}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
}

async function run(
  executable: string,
  args: readonly string[],
  env?: NodeJS.ProcessEnv,
): Promise<string> {
  const result = await execFileAsync(executable, [...args], {
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 64 * 1024,
    windowsHide: true,
    env,
  });
  return String(result.stdout).trim();
}

export interface ProcessIdentity {
  readonly pid: number;
  readonly createdAt: string;
  readonly executable: string;
}

export interface ProcessControlPort {
  findListeningProcess(port: number): Promise<ProcessIdentity>;
  inspect(pid: number): Promise<ProcessIdentity>;
  terminateTree(identity: ProcessIdentity, appPattern: RegExp): Promise<void>;
}

export class NodeProcessControl implements ProcessControlPort {
  async findListeningProcess(port: number): Promise<ProcessIdentity> {
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
    let output: string;
    if (process.platform === 'win32') {
      const root = process.env.SystemRoot ?? process.env.WINDIR ?? 'C:\\Windows';
      output = await run(
        powershell(),
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', WINDOWS_PORT_SCRIPT],
        {
          SystemRoot: root,
          WINDIR: root,
          OBPULSE_PORT: String(port),
        },
      );
    } else {
      const executable = process.platform === 'darwin' ? '/usr/sbin/lsof' : '/usr/bin/fuser';
      const args =
        process.platform === 'darwin'
          ? ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN']
          : ['-n', 'tcp', String(port)];
      output = await run(executable, args, { ...process.env, LC_ALL: 'C' });
    }
    const pidText =
      process.platform === 'linux' ? (output.match(/:\s*([\d\s]+)$/)?.[1] ?? '') : output;
    const pids = [...new Set(pidText.match(/\b\d+\b/g) ?? [])].map(Number);
    if (pids.length !== 1 || !Number.isSafeInteger(pids[0]) || (pids[0] ?? 0) < 1)
      throw new Error(
        pids.length === 0
          ? `No process owns loopback port ${port}`
          : `Port ${port} has ambiguous process ownership`,
      );
    return this.inspect(pids[0]!);
  }

  async inspect(pid: number): Promise<ProcessIdentity> {
    if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('Invalid process ID');
    if (process.platform === 'win32') {
      const root = process.env.SystemRoot ?? process.env.WINDIR ?? 'C:\\Windows';
      const output = await run(
        powershell(),
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', WINDOWS_PROCESS_SCRIPT],
        {
          SystemRoot: root,
          WINDIR: root,
          OBPULSE_PID: String(pid),
        },
      );
      const [createdAt, executable] = output.split('|');
      if (!createdAt || !executable) throw new Error('Could not verify runtime process identity');
      return { pid, createdAt, executable };
    }
    const output = await run('/bin/ps', ['-p', String(pid), '-o', 'lstart=,comm='], {
      ...process.env,
      LC_ALL: 'C',
    });
    const match = output.match(/^(\w+\s+\w+\s+\d+\s+[\d:]+\s+\d{4})\s+(.+)$/);
    if (!match?.[1] || !match[2]) throw new Error(`Process ${pid} is no longer available`);
    return { pid, createdAt: match[1], executable: match[2] };
  }

  async terminateTree(identity: ProcessIdentity, appPattern: RegExp): Promise<void> {
    const current = await this.inspect(identity.pid);
    if (current.createdAt !== identity.createdAt || current.executable !== identity.executable)
      throw new Error('Runtime process identity changed; Pulse stopped no process');
    if (process.platform === 'win32') {
      const root = process.env.SystemRoot ?? process.env.WINDIR ?? 'C:\\Windows';
      await run(
        powershell(),
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', WINDOWS_TREE_SCRIPT],
        {
          SystemRoot: root,
          WINDIR: root,
          OBPULSE_PID: String(identity.pid),
          OBPULSE_CREATED_AT: identity.createdAt,
          OBPULSE_APP_PATTERN: appPattern.source,
        },
      );
      return;
    }

    const snapshot = await run('/bin/ps', ['-axo', 'pid=,ppid=,lstart=,command='], {
      ...process.env,
      LC_ALL: 'C',
    });
    const entries = snapshot.split(/\r?\n/).flatMap((line) => {
      const match = line
        .trim()
        .match(/^(\d+)\s+(\d+)\s+(\w+\s+\w+\s+\d+\s+[\d:]+\s+\d{4})\s+(.+)$/);
      return match?.[1] && match[2] && match[3] && match[4]
        ? [
            {
              pid: Number(match[1]),
              parent: Number(match[2]),
              createdAt: match[3],
              command: match[4],
            },
          ]
        : [];
    });
    const target = entries.find((entry) => entry.pid === identity.pid);
    if (!target || target.createdAt !== identity.createdAt)
      throw new Error('Runtime process identity changed; Pulse stopped no process');
    let rootPid = identity.pid;
    let parent = entries.find((entry) => entry.pid === identity.pid)?.parent;
    while (parent && parent !== 1) {
      const candidate = entries.find((entry) => entry.pid === parent);
      if (!candidate) break;
      if (appPattern.test(candidate.command)) rootPid = candidate.pid;
      parent = candidate.parent;
    }
    const tree = new Set([rootPid]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const entry of entries) {
        if (tree.has(entry.parent) && !tree.has(entry.pid)) {
          tree.add(entry.pid);
          changed = true;
        }
      }
    }
    const descendants = [...tree].filter((pid) => pid !== rootPid).reverse();
    const toTerminate = [...descendants, rootPid];
    for (const pid of toTerminate) {
      const entry = entries.find((candidate) => candidate.pid === pid);
      if (!entry) continue;
      const fresh = await this.inspect(pid).catch(() => null);
      if (!fresh || fresh.createdAt !== entry.createdAt) continue;
      try {
        process.kill(pid, 'SIGTERM');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
    }
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && toTerminate.some((pid) => processExists(pid)))
      await new Promise((resolve) => setTimeout(resolve, 50));
    for (const pid of toTerminate) {
      if (!processExists(pid)) continue;
      const entry = entries.find((candidate) => candidate.pid === pid);
      const fresh = entry ? await this.inspect(pid).catch(() => null) : null;
      if (!entry || !fresh || fresh.createdAt !== entry.createdAt) continue;
      try {
        process.kill(pid, 'SIGKILL');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
    }
  }
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

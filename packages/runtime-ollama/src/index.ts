import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';
import type {
  BenchmarkRecord,
  Capabilities,
  ControlAuthority,
  ModelRecord,
  RuntimeAdapterManifest,
  RuntimePort,
  ServerState,
} from '@obpulse/contracts';
import { RUNTIME_ADAPTER_CONTRACT_VERSION } from '@obpulse/contracts';
import { tokensPerSecond } from '@obpulse/domain';
import {
  NodeProcessControl,
  type ProcessControlPort,
  type ProcessIdentity,
} from '@obpulse/process-control';
const BASE = 'http://127.0.0.1:11434';
type Dict = Record<string, unknown>;
function isObject(v: unknown): v is Dict {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function finiteNonnegative(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}
function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}
function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => character.charCodeAt(0) <= 0x1f);
}
function binary(): string {
  if (process.env.OLLAMA_BIN) {
    return process.env.OLLAMA_BIN;
  }
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA;
    if (local) {
      const candidate = `${local}/Programs/Ollama/ollama.exe`;
      if (existsSync(candidate)) return candidate;
    }
    return 'ollama.exe';
  }
  for (const candidate of ['/opt/homebrew/bin/ollama', '/usr/local/bin/ollama', '/usr/bin/ollama'])
    if (existsSync(candidate)) return candidate;
  return 'ollama';
}
async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(init?.method === 'POST' ? 120_000 : 1500),
  });
  if (!response.ok) throw new Error(`Ollama HTTP ${response.status} on ${path}`);
  return response.json() as Promise<unknown>;
}
function parseList(value: unknown, loaded: boolean): ModelRecord[] {
  if (!isObject(value) || !Array.isArray(value.models))
    throw new Error('Malformed Ollama list response');
  return value.models.flatMap((m: unknown) => {
    if (!isObject(m)) return [];
    const id = text(m.model) ?? text(m.name);
    if (!id) return [];
    return [
      {
        id,
        displayName: id,
        loaded,
        sizeBytes: finiteNonnegative(m.size),
        gpuResidentBytes: loaded ? finiteNonnegative(m.size_vram) : null,
        contextCapacityTokens: loaded ? finiteNonnegative(m.context_length) : null,
      },
    ];
  });
}
const CAPABILITIES: Capabilities = {
  listInstalled: true,
  listLoaded: true,
  startServer: true,
  stopServer: true,
  takeControl: true,
  releaseControl: true,
  loadModel: true,
  unloadModel: true,
  benchmark: true,
};
const MANIFEST: RuntimeAdapterManifest = {
  contractVersion: RUNTIME_ADAPTER_CONTRACT_VERSION,
  adapterVersion: '0.1.0',
  capabilities: CAPABILITIES,
  permissions: {
    networkScope: 'loopback-only',
    serverControl: 'explicit-process-takeover',
    credentialMode: 'none',
    externalProcessTermination: true,
    modelFileDeletion: false,
    inferenceContentAccess: false,
  },
};
export class OllamaRuntime implements RuntimePort {
  readonly id = 'ollama' as const;
  readonly displayName = 'Ollama';
  readonly manifest = MANIFEST;
  private child: ChildProcess | null = null;
  private childIdentity: ProcessIdentity | null = null;
  private adoptedProcess: ProcessIdentity | null = null;
  constructor(private readonly processControl: ProcessControlPort = new NodeProcessControl()) {}
  ownedProcessId(): number | null {
    const child = this.child;
    if (child && child.exitCode === null && !child.killed && child.pid != null) return child.pid;
    return this.adoptedProcess?.pid ?? null;
  }
  controlAuthority(): ControlAuthority {
    return this.ownedProcessId() == null ? 'observer' : 'process-owned';
  }
  private async probe(): Promise<boolean> {
    try {
      await request('/api/version');
      return true;
    } catch {
      return false;
    }
  }
  async state(): Promise<ServerState> {
    if (!(await this.probe())) {
      if (this.child?.exitCode !== null || this.child?.killed) {
        this.child = null;
        this.childIdentity = null;
      }
      if (this.adoptedProcess) {
        const current = await this.processControl
          .inspect(this.adoptedProcess.pid)
          .catch(() => null);
        if (!current || current.createdAt !== this.adoptedProcess.createdAt)
          this.adoptedProcess = null;
      }
      if (this.ownedProcessId() !== null) return 'stopped';
      return 'stopped';
    }
    return this.ownedProcessId() !== null ? 'managed-running' : 'external-running';
  }
  async listInstalled(): Promise<ModelRecord[]> {
    return parseList(await request('/api/tags'), false);
  }
  async listLoaded(): Promise<ModelRecord[]> {
    return parseList(await request('/api/ps'), true);
  }
  async startServer(): Promise<void> {
    if (await this.probe()) return; // Attach to an existing server, do NOT take ownership.
    const child = spawn(binary(), ['serve'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    this.child = child;
    try {
      this.childIdentity = await this.processControl.inspect(child.pid!);
    } catch (error) {
      child.kill();
      this.child = null;
      throw error;
    }
    // Consume pipes to avoid child blocking due to full output buffers, without storing prompts/logs.
    child.stdout?.resume();
    child.stderr?.resume();
    for (let i = 0; i < 28; i++) {
      if (await this.probe()) return;
      if (child.exitCode !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    child.kill();
    this.child = null;
    this.childIdentity = null;
    throw new Error('Ollama did not become reachable on 127.0.0.1:11434');
  }
  stopManagedImmediately(): void {
    if (this.child && this.child.exitCode === null && !this.child.killed) this.child.kill();
    this.child = null;
    this.childIdentity = null;
  }
  async stopServer(): Promise<void> {
    if (this.adoptedProcess) {
      const identity = this.adoptedProcess;
      await this.processControl.terminateTree(
        identity,
        /ollama\.app|(?:^|[\\/])ollama(?:\.exe)?(?:\s|$)|^ollama(?:\.exe)?$/i,
      );
      this.adoptedProcess = null;
      return;
    }
    const child = this.child;
    if (!child || child.exitCode !== null || child.killed)
      throw new Error('Cannot stop Ollama: OB-Pulse does not own this server');
    if (this.childIdentity)
      await this.processControl.terminateTree(
        this.childIdentity,
        /ollama\.app|(?:^|[\\/])ollama(?:\.exe)?(?:\s|$)|^ollama(?:\.exe)?$/i,
      );
    else if (!child.kill()) throw new Error('Could not signal owned Ollama process');
    this.child = null;
    this.childIdentity = null;
  }
  async takeControl(): Promise<void> {
    if (this.ownedProcessId() !== null) return;
    const identity = await this.processControl.findListeningProcess(11434);
    if (!/ollama/i.test(identity.executable))
      throw new Error('The loopback server process is not identifiable as Ollama');
    this.adoptedProcess = identity;
  }
  async releaseControl(): Promise<void> {
    if (this.adoptedProcess) {
      this.adoptedProcess = null;
      return;
    }
    if (this.child && this.child.exitCode === null && !this.child.killed) {
      this.child = null;
      this.childIdentity = null;
      return;
    }
    throw new Error('Cannot release control: Pulse does not own an Ollama process');
  }
  async shutdownOwned(): Promise<void> {
    if (this.adoptedProcess) {
      await this.processControl.terminateTree(
        this.adoptedProcess,
        /ollama\.app|(?:^|[\\/])ollama(?:\.exe)?(?:\s|$)|^ollama(?:\.exe)?$/i,
      );
      this.adoptedProcess = null;
    } else if (this.childIdentity) {
      await this.processControl.terminateTree(
        this.childIdentity,
        /ollama\.app|(?:^|[\\/])ollama(?:\.exe)?(?:\s|$)/i,
      );
      this.child = null;
      this.childIdentity = null;
    } else this.stopManagedImmediately();
  }
  private async modelCommand(modelId: string, keepAlive: string | number): Promise<void> {
    if (!modelId || modelId.length > 240 || containsControlCharacter(modelId))
      throw new Error('Invalid model ID');
    await request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: modelId, prompt: '', stream: false, keep_alive: keepAlive }),
    });
  }
  async loadModel(modelId: string): Promise<void> {
    await this.modelCommand(modelId, '10m');
  }
  async unloadModel(modelId: string): Promise<void> {
    await this.modelCommand(modelId, 0);
  }
  async benchmark(modelId: string): Promise<BenchmarkRecord> {
    if (!modelId || modelId.length > 240 || containsControlCharacter(modelId))
      throw new Error('Invalid model ID');
    const payload = await request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        prompt: 'Write a short greeting in one sentence.',
        stream: false,
        options: { num_predict: 48, temperature: 0 },
      }),
    });
    if (!isObject(payload)) throw new Error('Malformed Ollama generation response');
    const promptTokens = finiteNonnegative(payload.prompt_eval_count);
    const outputTokens = finiteNonnegative(payload.eval_count);
    return {
      source: 'benchmark',
      modelId,
      at: new Date().toISOString(),
      promptTokens,
      outputTokens,
      readTokensPerSecond: tokensPerSecond(
        promptTokens,
        finiteNonnegative(payload.prompt_eval_duration),
      ),
      writeTokensPerSecond: tokensPerSecond(outputTokens, finiteNonnegative(payload.eval_duration)),
      timeToFirstTokenMs: null,
    };
  }
}

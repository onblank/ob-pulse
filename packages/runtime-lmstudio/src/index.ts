import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
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

const BASE = 'http://127.0.0.1:1234';
const MODELS_PATH = '/api/v1/models';
const execFileAsync = promisify(execFile);
const CLI_TIMEOUT_MS = 60_000;

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
    serverControl: 'provider-server-toggle',
    credentialMode: 'os-protected-write-only',
    externalProcessTermination: false,
    modelFileDeletion: false,
    inferenceContentAccess: false,
  },
};

type RecordObject = Record<string, unknown>;
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type CommandResult = { stdout: string };
type CommandExecutor = (
  executable: string,
  args: readonly string[],
  timeoutMs: number,
) => Promise<CommandResult>;

export interface LMStudioLifecycle {
  serverRunning(): Promise<boolean>;
  startServer(): Promise<void>;
  stopServer(): Promise<void>;
}

class LMStudioHttpError extends Error {
  constructor(
    readonly status: number,
    credentialConfigured: boolean,
  ) {
    super(
      status === 401 || status === 403
        ? credentialConfigured
          ? `LM Studio HTTP ${status}; the configured token was rejected or lacks permission`
          : `LM Studio HTTP ${status}; protected servers require a configured token`
        : `LM Studio HTTP ${status}`,
    );
  }
}

function obj(value: unknown): value is RecordObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function validModelId(value: string): void {
  if (
    value.length === 0 ||
    value.length > 240 ||
    Array.from(value).some((character) => character.charCodeAt(0) <= 0x1f)
  )
    throw new Error('Invalid model ID');
}

function loadedInstances(model: RecordObject): RecordObject[] {
  return Array.isArray(model.loaded_instances) ? model.loaded_instances.filter(obj) : [];
}

export function resolveLmsBinary(
  homeDirectory = homedir(),
  platform = process.platform,
  fileExists: (path: string) => boolean = existsSync,
): string {
  const candidate = join(
    homeDirectory,
    '.lmstudio',
    'bin',
    platform === 'win32' ? 'lms.exe' : 'lms',
  );
  if (!fileExists(candidate))
    throw new Error(`LM Studio CLI was not found at the expected path: ${candidate}`);
  return candidate;
}

export function parseServerStatus(stdout: string): boolean {
  const lines = stdout
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/)
    .reverse();
  for (const line of lines) {
    try {
      const parsed: unknown = JSON.parse(line);
      if (obj(parsed) && typeof parsed.running === 'boolean') return parsed.running;
    } catch {
      // Continue to a possible final JSON line after trusted CLI progress output.
    }
  }
  throw new Error('Malformed LM Studio server status');
}

const executeCommand: CommandExecutor = async (executable, args, timeoutMs) => {
  const { stdout } = await execFileAsync(executable, [...args], {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024,
    windowsHide: true,
  });
  return { stdout: String(stdout) };
};

export class LmsCliLifecycle implements LMStudioLifecycle {
  constructor(
    private readonly binary: () => string = resolveLmsBinary,
    private readonly execute: CommandExecutor = executeCommand,
  ) {}

  private run(args: readonly string[]): Promise<CommandResult> {
    return this.execute(this.binary(), args, CLI_TIMEOUT_MS);
  }

  async serverRunning(): Promise<boolean> {
    return parseServerStatus((await this.run(['server', 'status', '--json'])).stdout);
  }

  async startServer(): Promise<void> {
    await this.run(['server', 'start', '--port', '1234', '--bind', '127.0.0.1']);
  }

  async stopServer(): Promise<void> {
    await this.run(['server', 'stop']);
  }
}

export class LMStudioRuntime implements RuntimePort {
  readonly id = 'lmstudio' as const;
  readonly displayName = 'LM Studio';
  readonly manifest = MANIFEST;

  private ownsServer = false;
  private delegatedControl = false;
  private apiToken: string | null = null;

  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly lifecycle: LMStudioLifecycle = new LmsCliLifecycle(),
  ) {}

  ownedProcessId(): number | null {
    return null;
  }

  controlAuthority(): ControlAuthority {
    if (this.ownsServer) return 'session-managed';
    if (this.delegatedControl) return 'delegated';
    return 'observer';
  }

  setApiToken(value: string | null): void {
    if (
      value !== null &&
      (value.length === 0 ||
        value.length > 4096 ||
        Array.from(value).some((character) => {
          const code = character.charCodeAt(0);
          return code <= 0x20 || code === 0x7f;
        }))
    )
      throw new Error('Invalid LM Studio API token');
    this.apiToken = value;
  }

  hasApiToken(): boolean {
    return this.apiToken !== null;
  }

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    const headers = new Headers(init?.headers);
    if (this.apiToken) headers.set('authorization', `Bearer ${this.apiToken}`);
    const response = await this.fetcher(`${BASE}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(init?.method === 'POST' ? 120_000 : 2000),
    });
    if (!response.ok) throw new LMStudioHttpError(response.status, this.apiToken !== null);
    return response.json() as Promise<unknown>;
  }

  private async models(): Promise<RecordObject[]> {
    const data = await this.request(MODELS_PATH);
    if (!obj(data) || !Array.isArray(data.models))
      throw new Error('Malformed LM Studio v1 response');
    return data.models.filter(obj);
  }

  private async probe(): Promise<boolean> {
    try {
      await this.models();
      return true;
    } catch (error) {
      return error instanceof LMStudioHttpError && (error.status === 401 || error.status === 403);
    }
  }

  async state(): Promise<ServerState> {
    if (await this.probe())
      return this.ownsServer || this.delegatedControl ? 'managed-running' : 'external-running';
    if (!this.ownsServer && !this.delegatedControl) return 'stopped';
    if (await this.lifecycle.serverRunning()) return 'managed-running';
    this.ownsServer = false;
    this.delegatedControl = false;
    return 'stopped';
  }

  async listInstalled(): Promise<ModelRecord[]> {
    return (await this.models()).flatMap((model) => {
      const id = str(model.key);
      if (!id) return [];
      const instances = loadedInstances(model);
      const first = instances[0];
      const config = first && obj(first.config) ? first.config : null;
      return [
        {
          id,
          displayName: str(model.display_name) ?? id,
          loaded: instances.length > 0,
          sizeBytes: number(model.size_bytes),
          gpuResidentBytes: null,
          contextCapacityTokens: config ? number(config.context_length) : null,
        },
      ];
    });
  }

  async listLoaded(): Promise<ModelRecord[]> {
    return (await this.listInstalled()).filter((model) => model.loaded);
  }

  async startServer(): Promise<void> {
    if (await this.probe()) return;
    if (await this.lifecycle.serverRunning()) return;
    try {
      await this.lifecycle.startServer();
      this.ownsServer = true;
      this.delegatedControl = false;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (await this.probe()) return;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      throw new Error('LM Studio did not become reachable on 127.0.0.1:1234');
    } catch (error) {
      if (this.ownsServer) {
        try {
          await this.lifecycle.stopServer();
        } catch {
          // Preserve the original start failure.
        }
      }
      this.ownsServer = false;
      this.delegatedControl = false;
      throw error;
    }
  }

  async stopServer(): Promise<void> {
    if (!this.ownsServer && !this.delegatedControl)
      throw new Error('Cannot stop LM Studio: control has not been delegated to OB-Pulse');
    await this.lifecycle.stopServer();
    this.ownsServer = false;
    this.delegatedControl = false;
  }

  async takeControl(): Promise<void> {
    if (this.ownsServer || this.delegatedControl) return;
    if (!(await this.probe()))
      throw new Error('Cannot take control of LM Studio: its loopback server is not reachable');
    this.delegatedControl = true;
  }

  async releaseControl(): Promise<void> {
    if (!this.ownsServer && !this.delegatedControl)
      throw new Error('Cannot release LM Studio control: OB-Pulse is only observing this server');
    this.ownsServer = false;
    this.delegatedControl = false;
  }

  async shutdownOwned(): Promise<void> {
    if (this.ownsServer) {
      await this.lifecycle.stopServer();
      this.ownsServer = false;
    }
    // Delegated control is session-scoped; it does not imply shutdown-on-exit ownership.
    this.delegatedControl = false;
  }

  async loadModel(modelId: string): Promise<void> {
    validModelId(modelId);
    const response = await this.request(`${MODELS_PATH}/load`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: modelId }),
    });
    if (!obj(response) || response.status !== 'loaded' || !str(response.instance_id))
      throw new Error('Malformed LM Studio load response');
  }

  async unloadModel(modelId: string): Promise<void> {
    validModelId(modelId);
    const model = (await this.models()).find((candidate) => candidate.key === modelId);
    if (!model) throw new Error('LM Studio model is not installed');
    const instances = loadedInstances(model);
    if (instances.length === 0) throw new Error('LM Studio model is not loaded');
    if (instances.length > 1)
      throw new Error('LM Studio model has multiple loaded instances; unload it in LM Studio');
    const instanceId = str(instances[0]?.id);
    if (!instanceId) throw new Error('Malformed LM Studio loaded instance');
    const response = await this.request(`${MODELS_PATH}/unload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ instance_id: instanceId }),
    });
    if (!obj(response) || response.instance_id !== instanceId)
      throw new Error('Malformed LM Studio unload response');
  }

  async benchmark(modelId: string): Promise<BenchmarkRecord> {
    validModelId(modelId);
    const response = await this.request('/api/v1/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        input: 'Write a short greeting in one sentence.',
        temperature: 0,
        max_output_tokens: 48,
        stream: false,
        store: false,
      }),
    });
    if (!obj(response) || !obj(response.stats))
      throw new Error('Malformed LM Studio benchmark response');
    const promptTokens = number(response.stats.input_tokens);
    const outputTokens = number(response.stats.total_output_tokens);
    const writeTokensPerSecond = number(response.stats.tokens_per_second);
    const firstTokenSeconds = number(response.stats.time_to_first_token_seconds);
    return {
      source: 'benchmark',
      modelId,
      at: new Date().toISOString(),
      promptTokens,
      outputTokens,
      readTokensPerSecond: null,
      writeTokensPerSecond,
      timeToFirstTokenMs: firstTokenSeconds == null ? null : firstTokenSeconds * 1000,
    };
  }
}

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
import { parseOpenAiModelList } from '@obpulse/runtime-openai-compatible';

const BASE = 'http://127.0.0.1:9931';
const OBSERVATION_ONLY_ERROR = 'llama.cpp adapter is observation-only';

type RecordObject = Record<string, unknown>;
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function object(value: unknown): value is RecordObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isLlamaCppHealth(status: number, value: unknown): boolean {
  if (!object(value)) return false;
  if (status === 200) return value.status === 'ok';
  if (status !== 503 || !object(value.error)) return false;
  return value.error.code === 503;
}

export function parseLlamaCppModels(value: unknown): ModelRecord[] {
  return parseOpenAiModelList(value, { loaded: true, providerName: 'llama.cpp' });
}

const CAPABILITIES: Capabilities = {
  listInstalled: false,
  listLoaded: true,
  startServer: false,
  stopServer: false,
  takeControl: false,
  releaseControl: false,
  loadModel: false,
  unloadModel: false,
  benchmark: false,
};

const MANIFEST: RuntimeAdapterManifest = {
  contractVersion: RUNTIME_ADAPTER_CONTRACT_VERSION,
  adapterVersion: '0.1.0',
  capabilities: CAPABILITIES,
  permissions: {
    networkScope: 'loopback-only',
    serverControl: 'none',
    credentialMode: 'none',
    externalProcessTermination: false,
    modelFileDeletion: false,
    inferenceContentAccess: false,
  },
};

export class LlamaCppRuntime implements RuntimePort {
  readonly id = 'llamacpp' as const;
  readonly displayName = 'llama.cpp';
  readonly manifest = MANIFEST;

  constructor(private readonly fetcher: Fetcher = fetch) {}

  controlAuthority(): ControlAuthority {
    return 'observer';
  }

  ownedProcessId(): number | null {
    return null;
  }

  async state(): Promise<ServerState> {
    try {
      const response = await this.fetcher(`${BASE}/health`, {
        signal: AbortSignal.timeout(1500),
      });
      return isLlamaCppHealth(response.status, await response.json())
        ? 'external-running'
        : 'stopped';
    } catch {
      return 'stopped';
    }
  }

  async listInstalled(): Promise<ModelRecord[]> {
    return [];
  }

  async listLoaded(): Promise<ModelRecord[]> {
    const response = await this.fetcher(`${BASE}/v1/models`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw new Error(`llama.cpp HTTP ${response.status} on /v1/models`);
    return parseLlamaCppModels(await response.json());
  }

  async startServer(): Promise<void> {
    throw new Error(OBSERVATION_ONLY_ERROR);
  }

  async stopServer(): Promise<void> {
    throw new Error(OBSERVATION_ONLY_ERROR);
  }

  async takeControl(): Promise<void> {
    throw new Error(OBSERVATION_ONLY_ERROR);
  }

  async releaseControl(): Promise<void> {
    throw new Error(OBSERVATION_ONLY_ERROR);
  }

  async shutdownOwned(): Promise<void> {}

  async loadModel(modelId: string): Promise<void> {
    void modelId;
    throw new Error(OBSERVATION_ONLY_ERROR);
  }

  async unloadModel(modelId: string): Promise<void> {
    void modelId;
    throw new Error(OBSERVATION_ONLY_ERROR);
  }

  async benchmark(modelId: string): Promise<BenchmarkRecord> {
    void modelId;
    throw new Error(OBSERVATION_ONLY_ERROR);
  }
}

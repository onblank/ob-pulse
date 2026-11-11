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

const BASE = 'http://127.0.0.1:8080';
const OBSERVATION_ONLY_ERROR = 'MLX-LM adapter is observation-only';
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const CAPABILITIES: Capabilities = {
  listInstalled: true,
  listLoaded: false,
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

export class MlxLmRuntime implements RuntimePort {
  readonly id = 'mlxlm' as const;
  readonly displayName = 'MLX-LM';
  readonly manifest = MANIFEST;

  constructor(private readonly fetcher: Fetcher = fetch) {}

  controlAuthority(): ControlAuthority {
    return 'observer';
  }
  ownedProcessId(): number | null {
    return null;
  }
  private async models(): Promise<ModelRecord[]> {
    const response = await this.fetcher(`${BASE}/v1/models`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw new Error(`MLX-LM HTTP ${response.status} on /v1/models`);
    return parseOpenAiModelList(await response.json(), {
      loaded: false,
      providerName: 'MLX-LM',
    });
  }
  async state(): Promise<ServerState> {
    try {
      await this.models();
      return 'external-running';
    } catch {
      return 'stopped';
    }
  }
  listInstalled(): Promise<ModelRecord[]> {
    return this.models();
  }
  async listLoaded(): Promise<ModelRecord[]> {
    return [];
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

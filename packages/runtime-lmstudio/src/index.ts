import type {
  BenchmarkRecord,
  Capabilities,
  ModelRecord,
  RuntimePort,
  ServerState,
} from '@obpulse/contracts';

const BASE = 'http://127.0.0.1:1234';
const MODELS_PATH = '/api/v1/models';

const CAPABILITIES: Capabilities = {
  listInstalled: true,
  listLoaded: true,
  startServer: false,
  stopServer: false,
  loadModel: true,
  unloadModel: true,
  benchmark: false,
};

type RecordObject = Record<string, unknown>;
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

class LMStudioHttpError extends Error {
  constructor(readonly status: number) {
    super(`LM Studio HTTP ${status}; protected servers require a configured token`);
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

export class LMStudioRuntime implements RuntimePort {
  readonly id = 'lmstudio' as const;
  readonly displayName = 'LM Studio';
  readonly capabilities = CAPABILITIES;

  constructor(private readonly fetcher: Fetcher = fetch) {}

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    const response = await this.fetcher(`${BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(init?.method === 'POST' ? 120_000 : 2000),
    });
    if (!response.ok) throw new LMStudioHttpError(response.status);
    return response.json() as Promise<unknown>;
  }

  private async models(): Promise<RecordObject[]> {
    const data = await this.request(MODELS_PATH);
    if (!obj(data) || !Array.isArray(data.models))
      throw new Error('Malformed LM Studio v1 response');
    return data.models.filter(obj);
  }

  async state(): Promise<ServerState> {
    try {
      await this.models();
      return 'external-running';
    } catch (error) {
      if (error instanceof LMStudioHttpError && (error.status === 401 || error.status === 403))
        return 'external-running';
      return 'stopped';
    }
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
    throw new Error('LM Studio must be started outside OB-Pulse in this release');
  }

  async stopServer(): Promise<void> {
    throw new Error('Cannot stop LM Studio: OB-Pulse does not own this server');
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
    void modelId;
    throw new Error('LM Studio benchmark is not implemented');
  }
}

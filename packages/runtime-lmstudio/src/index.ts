import type {
  BenchmarkRecord,
  Capabilities,
  ModelRecord,
  RuntimePort,
  ServerState,
} from '@obpulse/contracts';
const ENDPOINT = 'http://127.0.0.1:1234/api/v1/models';
const capabilities: Capabilities = {
  listInstalled: true,
  listLoaded: true,
  startServer: false,
  stopServer: false,
  loadModel: false,
  unloadModel: false,
  benchmark: false,
};
type RecordObject = Record<string, unknown>;
function obj(value: unknown): value is RecordObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
export class LMStudioRuntime implements RuntimePort {
  readonly id = 'lmstudio' as const;
  readonly displayName = 'LM Studio';
  readonly capabilities = capabilities;
  private async models(): Promise<RecordObject[]> {
    const result = await fetch(ENDPOINT, { signal: AbortSignal.timeout(2000) });
    if (!result.ok)
      throw new Error(
        `LM Studio HTTP ${result.status}; protected servers require a configured token (not in scaffold)`,
      );
    const data: unknown = await result.json();
    if (!obj(data) || !Array.isArray(data.models))
      throw new Error('Malformed LM Studio v1 response');
    return data.models.filter(obj);
  }
  async state(): Promise<ServerState> {
    try {
      await this.models();
      return 'external-running';
    } catch {
      return 'stopped';
    }
  }
  async listInstalled(): Promise<ModelRecord[]> {
    return (await this.models()).flatMap((model) => {
      const id = str(model.key);
      if (!id) return [];
      const instances = Array.isArray(model.loaded_instances)
        ? model.loaded_instances.filter(obj)
        : [];
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
    throw new Error('LM Studio service management is not implemented');
  }
  async stopServer(): Promise<void> {
    throw new Error('LM Studio service management is not implemented');
  }
  async loadModel(modelId: string): Promise<void> {
    void modelId;
    throw new Error('LM Studio model management is not implemented');
  }
  async unloadModel(modelId: string): Promise<void> {
    void modelId;
    throw new Error('LM Studio model management is not implemented');
  }
  async benchmark(modelId: string): Promise<BenchmarkRecord> {
    void modelId;
    throw new Error('LM Studio benchmark is not implemented');
  }
}

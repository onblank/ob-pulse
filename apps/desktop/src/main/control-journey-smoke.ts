import type {
  BenchmarkRecord,
  ControlAuthority,
  ModelRecord,
  RuntimeAdapterManifest,
  RuntimeId,
  RuntimePort,
  ServerState,
} from '@obpulse/contracts';
import { RUNTIME_ADAPTER_CONTRACT_VERSION } from '@obpulse/contracts';

const writableCapabilities = {
  listInstalled: true,
  listLoaded: true,
  startServer: true,
  stopServer: true,
  takeControl: true,
  releaseControl: true,
  loadModel: true,
  unloadModel: true,
  benchmark: true,
} as const;

const observerCapabilities = {
  listInstalled: true,
  listLoaded: true,
  startServer: false,
  stopServer: false,
  takeControl: false,
  releaseControl: false,
  loadModel: false,
  unloadModel: false,
  benchmark: false,
} as const;

function manifest(readOnly: boolean): RuntimeAdapterManifest {
  return {
    contractVersion: RUNTIME_ADAPTER_CONTRACT_VERSION,
    adapterVersion: 'control-journey-smoke',
    capabilities: readOnly ? observerCapabilities : writableCapabilities,
    permissions: {
      networkScope: 'loopback-only',
      serverControl: readOnly ? 'none' : 'explicit-process-takeover',
      credentialMode: 'none',
      externalProcessTermination: !readOnly,
      modelFileDeletion: false,
      inferenceContentAccess: false,
    },
  };
}

const installedModel: ModelRecord = {
  id: 'obpulse-smoke-model',
  displayName: 'OB-Pulse smoke model',
  loaded: false,
  sizeBytes: 1024 ** 3,
  gpuResidentBytes: null,
  contextCapacityTokens: null,
};

class ControlJourneyRuntime implements RuntimePort {
  readonly manifest: RuntimeAdapterManifest;
  private stateValue: ServerState;
  private authority: ControlAuthority;
  private modelLoaded = false;

  constructor(
    readonly id: RuntimeId,
    readonly displayName: string,
    initialState: ServerState,
    private readonly readOnly: boolean,
  ) {
    this.stateValue = initialState;
    this.authority = 'observer';
    this.manifest = manifest(readOnly);
  }

  controlAuthority(): ControlAuthority {
    return this.authority;
  }

  ownedProcessId(): number | null {
    return null;
  }

  async state(): Promise<ServerState> {
    return this.stateValue;
  }

  async listInstalled(): Promise<ModelRecord[]> {
    return [{ ...installedModel }];
  }

  async listLoaded(): Promise<ModelRecord[]> {
    return this.modelLoaded ? [{ ...installedModel, loaded: true }] : [];
  }

  async startServer(): Promise<void> {
    this.requireControl();
    if (this.stateValue !== 'stopped') throw new Error('Smoke runtime is already running');
    this.stateValue = 'managed-running';
    this.authority = 'process-owned';
  }

  async stopServer(): Promise<void> {
    this.requireControl();
    if (this.authority !== 'process-owned') throw new Error('Smoke runtime is not owned');
    this.stateValue = 'stopped';
    this.authority = 'observer';
    this.modelLoaded = false;
  }

  async takeControl(): Promise<void> {
    this.requireControl();
    if (this.stateValue !== 'external-running') throw new Error('Smoke runtime is not external');
    this.stateValue = 'managed-running';
    this.authority = 'process-owned';
  }

  async releaseControl(): Promise<void> {
    this.requireControl();
    if (this.authority !== 'process-owned') throw new Error('Smoke runtime is not owned');
    this.stateValue = 'external-running';
    this.authority = 'observer';
    this.modelLoaded = false;
  }

  async shutdownOwned(): Promise<void> {
    if (this.authority !== 'process-owned') return;
    this.stateValue = 'stopped';
    this.authority = 'observer';
    this.modelLoaded = false;
  }

  async loadModel(modelId: string): Promise<void> {
    this.requireControl();
    this.requireRunning();
    if (modelId !== installedModel.id) throw new Error('Unknown smoke model');
    this.modelLoaded = true;
  }

  async unloadModel(modelId: string): Promise<void> {
    this.requireControl();
    this.requireRunning();
    if (modelId !== installedModel.id) throw new Error('Unknown smoke model');
    this.modelLoaded = false;
  }

  async benchmark(modelId: string): Promise<BenchmarkRecord> {
    this.requireControl();
    this.requireRunning();
    if (modelId !== installedModel.id) throw new Error('Unknown smoke model');
    return {
      source: 'benchmark',
      modelId,
      at: new Date().toISOString(),
      promptTokens: 0,
      outputTokens: 0,
      readTokensPerSecond: 0,
      writeTokensPerSecond: 0,
      timeToFirstTokenMs: 0,
    };
  }

  private requireControl(): void {
    if (this.readOnly) throw new Error('Smoke observer does not grant control');
  }

  private requireRunning(): void {
    if (this.stateValue === 'stopped') throw new Error('Smoke runtime is stopped');
  }
}

export function createControlJourneyRuntimes(): RuntimePort[] {
  return [
    new ControlJourneyRuntime('ollama', 'Ollama', 'external-running', false),
    new ControlJourneyRuntime('lmstudio', 'LM Studio', 'stopped', false),
    new ControlJourneyRuntime('llamacpp', 'llama.cpp', 'stopped', true),
    new ControlJourneyRuntime('mlxlm', 'MLX-LM', 'stopped', true),
  ];
}

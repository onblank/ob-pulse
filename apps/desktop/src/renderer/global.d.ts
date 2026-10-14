import type { DashboardSnapshot, RuntimeId } from '@obpulse/contracts';
export {};
declare global {
  interface Window {
    obpulse: {
      snapshot(): Promise<DashboardSnapshot>;
      runtimes(): Promise<Array<{ id: RuntimeId; name: string }>>;
      selectRuntime(id: RuntimeId): Promise<void>;
      start(): Promise<void>;
      stop(): Promise<void>;
      load(modelId: string): Promise<void>;
      unload(modelId: string): Promise<void>;
      benchmark(modelId: string): Promise<unknown>;
      toggleAlwaysOnTop(): Promise<boolean>;
      isAlwaysOnTop(): Promise<boolean>;
      hide(): Promise<void>;
    };
  }
}
